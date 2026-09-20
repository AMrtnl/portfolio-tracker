import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('../providers', () => ({ gocardless: { forget: jest.fn() } }));
jest.mock('../analytics/portfolio', () => ({ invalidatePortfolioSnapshot: jest.fn() }));

import type { PublicAccount } from '../types/accounts';
import { forgetTenant, getTenant } from '../users/tenant';
import type { User } from '../users/users';
import { GocardlessError } from './gocardless';
import { LinksStore } from './links';
import { clampDays, finishBankLink, importBankTransactions, startBankLink } from './routes';
import type { BankClient } from './routes';

const user: User = {
  id: 'u1',
  email: 'jane@example.com',
  name: 'Jane',
  passwordHash: '',
  salt: '',
  sessionVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  plan: 'free',
  planSource: 'manual',
};

function fakeClient(overrides: Partial<Record<keyof BankClient, unknown>> = {}): BankClient {
  return {
    listInstitutions: jest.fn(async () => []),
    getInstitution: jest.fn(async (id: string) => (id === 'UBS_UBSWCHZH80A' ? { id, name: 'UBS' } : null)),
    createRequisition: jest.fn(async () => ({ id: 'req-1', link: 'https://ob.gocardless.com/psd2/start/req-1' })),
    getRequisition: jest.fn(async () => ({ id: 'req-1', status: 'LN', accounts: ['acc-1', 'acc-2'] })),
    getAccountDetails: jest.fn(async (id: string) =>
      id === 'acc-1'
        ? { iban: 'CH93 0076 2011 6238 5295 7', currency: 'CHF', name: 'Privatkonto', ownerName: 'Jane Doe' }
        : { iban: 'CH5604835012345678009', currency: 'EUR', ownerName: 'Jane Doe' },
    ),
    getAccountBalances: jest.fn(async (id: string) =>
      id === 'acc-1'
        ? [
            { balanceType: 'closingBooked', balanceAmount: { amount: '100.00', currency: 'CHF' } },
            { balanceType: 'expected', balanceAmount: { amount: '123.45', currency: 'CHF' } },
          ]
        : [{ balanceType: 'interimAvailable', balanceAmount: { amount: '42.00', currency: 'EUR' } }],
    ),
    getAccountTransactions: jest.fn(async () => []),
    ...(overrides as Partial<BankClient>),
  };
}

describe('bank links', () => {
  const originalEnv = { ...process.env };
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-links-'));
    process.env.DATA_DIR = root;
    process.env.PREVIEW_MODE = 'true';
  });

  afterEach(() => {
    forgetTenant('u1');
    process.env = { ...originalEnv };
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('persists requisitions per user and finds them by reference', () => {
    const links = new LinksStore(path.join(root, 'users', 'u1'));
    links.add({ id: 'req-1', reference: 'ref-1', institutionId: 'UBS_X', institutionName: 'UBS', status: 'CR' });
    expect(new LinksStore(path.join(root, 'users', 'u1')).findByReference('ref-1')?.institutionName).toBe('UBS');
    expect(new LinksStore(path.join(root, 'users', 'u2')).findByReference('ref-1')).toBeNull();
    expect(links.setStatus('req-1', 'LN')?.status).toBe('LN');
    expect(links.remove('req-1')).toBe(true);
    expect(links.list()).toEqual([]);
  });

  it('starts a link only for a known institution and remembers the reference', async () => {
    const client = fakeClient();
    const tenant = getTenant('u1');
    expect((await startBankLink(client, tenant, { institutionId: 'NOPE', redirect: 'https://x/app' })).status).toBe(400);
    expect((await startBankLink(client, tenant, { institutionId: '', redirect: 'https://x/app' })).status).toBe(400);

    const result = await startBankLink(client, tenant, { institutionId: 'UBS_UBSWCHZH80A', redirect: 'https://x/app' });
    expect(result.status).toBe(200);
    const body = result.body as { url: string; reference: string };
    expect(body.url).toMatch(/gocardless/);
    expect(client.createRequisition).toHaveBeenCalledWith({
      redirect: 'https://x/app',
      institutionId: 'UBS_UBSWCHZH80A',
      reference: body.reference,
      userLanguage: 'EN',
    });
    expect(tenant.links.findByReference(body.reference)).toMatchObject({ id: 'req-1', institutionName: 'UBS', status: 'CR' });
  });

  it('turns a linked requisition into bank accounts with masked IBANs and preferred balances', async () => {
    const client = fakeClient();
    const tenant = getTenant('u1');
    tenant.links.add({ id: 'req-1', reference: 'ref-1', institutionId: 'UBS_X', institutionName: 'UBS', status: 'CR' });

    const result = await finishBankLink(client, tenant, user, 'ref-1');
    expect(result.status).toBe(200);
    const body = result.body as { imported: PublicAccount[]; institution: string };
    expect(body.institution).toBe('UBS');
    expect(body.imported).toHaveLength(2);
    expect(body.imported[0]).toMatchObject({
      label: 'Privatkonto',
      type: 'bank',
      provider: 'gocardless',
      status: 'connected',
      kind: 'asset',
      bookClass: 'cash',
      externalId: 'acc-1',
      maskedIdentifier: '…2957',
      institution: 'UBS',
      currency: 'CHF',
      holdings: [{ symbol: 'CHF', name: 'CHF cash', quantity: 123.45, priceUsd: 1, assetClass: 'cash' }],
      totalValueUsd: 123.45,
    });
    expect(body.imported[1]).toMatchObject({
      label: 'UBS · Jane Doe',
      maskedIdentifier: '…8009',
      currency: 'EUR',
      holdings: [{ symbol: 'EUR', quantity: 42, priceUsd: 1 }],
    });
    expect(tenant.links.findByReference('ref-1')?.status).toBe('LN');

    // Finishing again upserts instead of duplicating.
    const again = await finishBankLink(client, tenant, user, 'ref-1');
    expect((again.body as { imported: unknown[] }).imported).toHaveLength(2);
    expect(tenant.store.getAllRaw()).toHaveLength(2);
  });

  it('refuses references it does not own and requisitions the bank has not linked', async () => {
    const tenant = getTenant('u1');
    expect((await finishBankLink(fakeClient(), tenant, user, 'unknown')).status).toBe(404);

    tenant.links.add({ id: 'req-1', reference: 'ref-1', institutionId: 'UBS_X', institutionName: 'UBS', status: 'CR' });
    const client = fakeClient({
      getRequisition: jest.fn(async () => ({ id: 'req-1', status: 'GC', accounts: [] })),
    });
    const result = await finishBankLink(client, tenant, user, 'ref-1');
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ error: 'Bank link not completed', status: 'GC' });
    expect((result.body as { message: string }).message).toMatch(/consent/);
    expect(tenant.store.getAllRaw()).toHaveLength(0);
  });

  it('never invents a balance: an unreadable account lands with its error', async () => {
    const tenant = getTenant('u1');
    tenant.links.add({ id: 'req-1', reference: 'ref-1', institutionId: 'UBS_X', institutionName: 'UBS', status: 'CR' });
    const client = fakeClient({
      getAccountBalances: jest.fn(async (id: string) => {
        if (id === 'acc-2') throw new GocardlessError('GoCardless rate limit reached (429)', 429);
        return [{ balanceType: 'expected', balanceAmount: { amount: '5', currency: 'CHF' } }];
      }),
    });
    const result = await finishBankLink(client, tenant, user, 'ref-1');
    expect(result.status).toBe(200);
    const imported = (result.body as { imported: PublicAccount[] }).imported;
    expect(imported[0]).toMatchObject({ status: 'connected', totalValueUsd: 5 });
    expect(imported[1]).toMatchObject({ status: 'error', holdings: [], totalValueUsd: 0 });
    expect(imported[1].lastError).toMatch(/balances: .*429/);
  });

  it('enforces the plan limit on a new link but not on re-finishing one', async () => {
    process.env.PREVIEW_MODE = 'false';
    const tenant = getTenant('u1');
    const zpub = 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
    tenant.store.addWatchWallet('w1', { key: zpub, chain: 'btc', kind: 'xpub' });
    tenant.store.addWatchWallet('w2', { key: '0x0000000000000000000000000000000000000001', chain: 'eth', kind: 'address' });
    tenant.store.addManualAccount('Cash', { balance: 10 });
    tenant.links.add({ id: 'req-1', reference: 'ref-1', institutionId: 'UBS_X', institutionName: 'UBS', status: 'CR' });

    // Two live + one manual: one slot left, and the requisition brings two accounts.
    const first = await finishBankLink(fakeClient(), tenant, user, 'ref-1');
    expect(first.status).toBe(200);
    expect(tenant.store.getAllRaw().filter((a) => a.provider !== 'manual')).toHaveLength(4);

    // Now over the limit, but these accounts already exist: refreshing is fine.
    expect((await finishBankLink(fakeClient(), tenant, user, 'ref-1')).status).toBe(200);

    tenant.links.add({ id: 'req-2', reference: 'ref-2', institutionId: 'N26_X', institutionName: 'N26', status: 'CR' });
    const blocked = await finishBankLink(
      fakeClient({ getRequisition: jest.fn(async () => ({ id: 'req-2', status: 'LN', accounts: ['acc-9'] })) }),
      tenant,
      user,
      'ref-2',
    );
    expect(blocked.status).toBe(402);
    expect(blocked.body).toEqual({
      error: 'Plan limit reached',
      message: 'Free includes 3 live connections. Upgrade to Plus for unlimited.',
      upgrade: true,
    });
  });
});

describe('transaction import', () => {
  const originalEnv = { ...process.env };
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-tximport-'));
    process.env.DATA_DIR = root;
  });

  afterEach(() => {
    forgetTenant('u1');
    process.env = { ...originalEnv };
    fs.rmSync(root, { recursive: true, force: true });
  });

  const booked = [
    { bookingDate: '2026-09-01', transactionAmount: { amount: '-54.30', currency: 'CHF' }, creditorName: 'MIGROS ZUERICH' },
    { bookingDate: '2026-09-25', transactionAmount: { amount: '6500.00', currency: 'CHF' }, remittanceInformationUnstructured: 'Lohn September' },
    { bookingDate: '2026-09-05', transactionAmount: { amount: '-17.90', currency: 'CHF' }, creditorName: 'NETFLIX.COM' },
    { bookingDate: '2026-09-05', transactionAmount: { amount: '-17.90', currency: 'CHF' }, creditorName: 'NETFLIX.COM' },
  ];

  it('categorises, dedupes against the ledger, and asks for the right window', async () => {
    const tenant = getTenant('u1');
    const id = tenant.store.upsertGocardlessAccount({
      externalId: 'acc-1',
      label: 'Privatkonto',
      institution: 'UBS',
      currency: 'CHF',
      holdings: [],
    });
    tenant.money.addTransaction({ date: '2026-09-01', kind: 'spend', amount: 54.3, category: 'other', note: 'migros zuerich' });
    const client = fakeClient({ getAccountTransactions: jest.fn(async () => booked) });

    const now = new Date('2026-09-30T12:00:00Z');
    const result = await importBankTransactions(client, tenant, id, 90, now);
    expect(result).toEqual({ status: 200, body: { imported: 3, skipped: 1 } });
    expect(client.getAccountTransactions).toHaveBeenCalledWith('acc-1', '2026-07-02');

    const rows = tenant.money.listTransactions();
    expect(rows).toHaveLength(4);
    expect(rows.find((t) => t.note === 'Lohn September')).toMatchObject({ kind: 'income', category: 'salary' });
    expect(rows.filter((t) => t.note === 'NETFLIX.COM').map((t) => t.category)).toEqual(['subscriptions', 'subscriptions']);

    // Re-importing the same window adds nothing.
    expect(await importBankTransactions(client, tenant, id, 90, now)).toEqual({
      status: 200,
      body: { imported: 0, skipped: 4 },
    });
  });

  it('refuses accounts that are not bank links and reports upstream failures', async () => {
    const tenant = getTenant('u1');
    const manual = tenant.store.addManualAccount('Cash', { balance: 10 });
    expect((await importBankTransactions(fakeClient(), tenant, manual, 90)).status).toBe(400);
    expect((await importBankTransactions(fakeClient(), tenant, 'missing', 90)).status).toBe(404);

    const id = tenant.store.upsertGocardlessAccount({ externalId: 'acc-1', label: 'A', institution: 'UBS', currency: 'CHF', holdings: [] });
    const down = fakeClient({
      getAccountTransactions: jest.fn(async () => {
        throw new GocardlessError('GoCardless is unavailable (503). Try again in a few minutes.', 503);
      }),
    });
    const result = await importBankTransactions(down, tenant, id, 30);
    expect(result.status).toBe(502);
    expect((result.body as { message: string }).message).toMatch(/503/);
  });

  it('clamps the window to 1–730 days with 90 as the default', () => {
    expect(clampDays(undefined)).toBe(90);
    expect(clampDays('abc')).toBe(90);
    expect(clampDays(0)).toBe(1);
    expect(clampDays(5000)).toBe(730);
    expect(clampDays('365')).toBe(365);
  });
});

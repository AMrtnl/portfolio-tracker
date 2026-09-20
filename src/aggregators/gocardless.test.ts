import {
  GocardlessClient,
  GocardlessError,
  accountLabel,
  holdingsFromBalances,
  maskIdentifier,
  normalizeTransactions,
  pickBalance,
} from './gocardless';
import type { GcBalance } from './gocardless';

type Init = { method: string; headers: Record<string, string>; body?: string };

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

const DAY = 86_400;
const MONTH = 30 * DAY;

describe('GocardlessClient tokens', () => {
  const start = Date.parse('2026-09-20T12:00:00Z');
  let now: number;
  let calls: Array<{ url: string; init: Init }>;
  let fetchMock: jest.Mock;
  let client: GocardlessClient;
  let refreshStatus = 200;

  beforeEach(() => {
    now = start;
    calls = [];
    refreshStatus = 200;
    let issued = 0;
    fetchMock = jest.fn(async (url: string, init: Init) => {
      calls.push({ url, init });
      if (url.endsWith('/token/new/')) {
        issued++;
        return reply(200, {
          access: `A${issued}`,
          access_expires: DAY,
          refresh: `R${issued}`,
          refresh_expires: MONTH,
        });
      }
      if (url.endsWith('/token/refresh/')) {
        if (refreshStatus !== 200) return reply(refreshStatus, { summary: 'Invalid token' });
        return reply(200, { access: 'A-refreshed', access_expires: DAY });
      }
      if (url.includes('/institutions/?country=')) {
        return reply(200, [{ id: 'UBS_UBSWCHZH80A', name: 'UBS', countries: ['CH'] }]);
      }
      return reply(404, { summary: 'Not found', detail: url });
    });
    client = new GocardlessClient({
      secretId: 'sid',
      secretKey: 'skey',
      fetch: fetchMock as never,
      now: () => now,
    });
  });

  const authHeaders = () =>
    calls.filter((c) => !c.url.includes('/token/')).map((c) => c.init.headers.Authorization);
  const tokenCalls = () => calls.filter((c) => c.url.includes('/token/')).map((c) => c.url.split('/api/v2')[1]);

  it('issues one token with the secrets, then reuses it and the institutions cache', async () => {
    await client.listInstitutions('CH');
    await client.listInstitutions('ch');
    expect(tokenCalls()).toEqual(['/token/new/']);
    expect(JSON.parse(calls[0].init.body!)).toEqual({ secret_id: 'sid', secret_key: 'skey' });
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    // Second listing came from the 24h cache: one network read of institutions.
    expect(calls.filter((c) => c.url.includes('/institutions/'))).toHaveLength(1);
    expect(authHeaders()).toEqual(['Bearer A1']);
  });

  it('refreshes before the access token expires and re-issues once the refresh token is dead', async () => {
    await client.listInstitutions('CH');
    now += (DAY - 30) * 1000; // inside the safety margin
    await client.listInstitutions('DE');
    expect(tokenCalls()).toEqual(['/token/new/', '/token/refresh/']);
    expect(JSON.parse(calls[calls.length - 2].init.body!)).toEqual({ refresh: 'R1' });
    expect(authHeaders()).toEqual(['Bearer A1', 'Bearer A-refreshed']);

    now += MONTH * 1000;
    await client.listInstitutions('FR');
    expect(tokenCalls()).toEqual(['/token/new/', '/token/refresh/', '/token/new/']);
    expect(authHeaders()[2]).toBe('Bearer A2');
  });

  it('falls back to a fresh token pair when the refresh is rejected', async () => {
    await client.listInstitutions('CH');
    refreshStatus = 401;
    now += DAY * 1000;
    await client.listInstitutions('DE');
    expect(tokenCalls()).toEqual(['/token/new/', '/token/refresh/', '/token/new/']);
    expect(authHeaders()[1]).toBe('Bearer A2');
  });

  it('shares one token request between concurrent calls', async () => {
    await Promise.all([client.listInstitutions('CH'), client.listInstitutions('DE')]);
    expect(tokenCalls()).toEqual(['/token/new/']);
  });

  it('turns GoCardless failures into clear errors', async () => {
    const failing = (status: number, body: unknown) =>
      new GocardlessClient({
        secretId: 'sid',
        secretKey: 'skey',
        fetch: (async (url: string) =>
          url.endsWith('/token/new/')
            ? reply(200, { access: 'A', access_expires: DAY, refresh: 'R', refresh_expires: MONTH })
            : reply(status, body)) as never,
        now: () => now,
      });

    await expect(failing(401, { summary: 'Invalid token' }).listInstitutions('CH')).rejects.toThrow(
      /credentials \(401\).*GOCARDLESS_SECRET_ID/,
    );
    await expect(failing(429, { summary: 'Rate limit exceeded', detail: 'try in 3h' }).listInstitutions('CH')).rejects.toThrow(
      /rate limit.*try in 3h/i,
    );
    await expect(failing(503, {}).listInstitutions('CH')).rejects.toThrow(/unavailable \(503\)/);
    const err = await failing(400, { summary: 'Bad', detail: 'country' }).listInstitutions('CH').catch((e) => e);
    expect(err).toBeInstanceOf(GocardlessError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('GoCardless: Bad: country');
  });

  it('reads accounts through the documented paths', async () => {
    const seen: string[] = [];
    const c = new GocardlessClient({
      secretId: 'sid',
      secretKey: 'skey',
      fetch: (async (url: string) => {
        seen.push(url);
        if (url.endsWith('/token/new/')) {
          return reply(200, { access: 'A', access_expires: DAY, refresh: 'R', refresh_expires: MONTH });
        }
        if (url.endsWith('/details/')) return reply(200, { account: { iban: 'CH93', currency: 'CHF' } });
        if (url.endsWith('/balances/')) {
          return reply(200, { balances: [{ balanceAmount: { amount: '1.00', currency: 'CHF' }, balanceType: 'expected' }] });
        }
        if (url.includes('/transactions/')) return reply(200, { transactions: { booked: [], pending: [] } });
        if (url.endsWith('/requisitions/')) return reply(201, { id: 'req-1', link: 'https://ob.gocardless.com/psd2/start/x' });
        if (url.includes('/requisitions/req-1/')) return reply(200, { id: 'req-1', status: 'LN', accounts: ['acc-1'] });
        return reply(404, {});
      }) as never,
      now: () => now,
    });
    expect(await c.getAccountDetails('acc-1')).toEqual({ iban: 'CH93', currency: 'CHF' });
    expect(await c.getAccountBalances('acc-1')).toHaveLength(1);
    expect(await c.getAccountTransactions('acc-1', '2026-06-01')).toEqual([]);
    expect(await c.createRequisition({ redirect: 'https://x/app', institutionId: 'UBS_X', reference: 'ref' })).toEqual({
      id: 'req-1',
      link: 'https://ob.gocardless.com/psd2/start/x',
    });
    expect((await c.getRequisition('req-1')).accounts).toEqual(['acc-1']);
    expect(seen.map((u) => u.replace(/^.*\/api\/v2/, ''))).toEqual([
      '/token/new/',
      '/accounts/acc-1/details/',
      '/accounts/acc-1/balances/',
      '/accounts/acc-1/transactions/?date_from=2026-06-01',
      '/requisitions/',
      '/requisitions/req-1/',
    ]);
  });
});

describe('balances → holdings', () => {
  const chf = (type: string, amount: string): GcBalance => ({
    balanceType: type,
    balanceAmount: { amount, currency: 'CHF' },
  });

  it('prefers expected, then interimAvailable, then closingBooked, else the first', () => {
    expect(pickBalance([chf('closingBooked', '1'), chf('expected', '2'), chf('interimAvailable', '3')])?.balanceAmount.amount).toBe('2');
    expect(pickBalance([chf('closingBooked', '1'), chf('interimAvailable', '3')])?.balanceAmount.amount).toBe('3');
    expect(pickBalance([chf('openingBooked', '9'), chf('closingBooked', '1')])?.balanceAmount.amount).toBe('1');
    expect(pickBalance([chf('forwardAvailable', '7'), chf('openingBooked', '9')])?.balanceAmount.amount).toBe('7');
    expect(pickBalance([])).toBeNull();
  });

  it('makes one cash holding per currency, valued at par', () => {
    const holdings = holdingsFromBalances([
      chf('closingBooked', '100.50'),
      chf('expected', '123.45'),
      { balanceType: 'expected', balanceAmount: { amount: '-20', currency: 'eur' } },
    ]);
    expect(holdings).toEqual([
      { symbol: 'CHF', name: 'CHF cash', quantity: 123.45, priceUsd: 1, assetClass: 'cash' },
      { symbol: 'EUR', name: 'EUR cash', quantity: -20, priceUsd: 1, assetClass: 'cash' },
    ]);
    expect(holdingsFromBalances([])).toEqual([]);
  });

  it('masks the IBAN to its last four characters', () => {
    expect(maskIdentifier({ iban: 'CH93 0076 2011 6238 5295 7' })).toBe('…2957');
    expect(maskIdentifier({ maskedPan: '**** 1234' })).toBe('**** 1234');
    expect(maskIdentifier({ bban: '00762011623852957' })).toBe('…2957');
    expect(maskIdentifier({})).toBeUndefined();
  });

  it('labels an account from its name, product, or owner', () => {
    expect(accountLabel({ name: 'Privatkonto' }, 'UBS')).toBe('Privatkonto');
    expect(accountLabel({ product: 'Current account' }, 'UBS')).toBe('Current account');
    expect(accountLabel({ ownerName: 'Jane Doe' }, 'UBS')).toBe('UBS · Jane Doe');
    expect(accountLabel({}, 'UBS')).toBe('UBS');
  });
});

describe('normalizeTransactions', () => {
  it('splits sign into kind, keeps amounts positive, and builds a searchable note', () => {
    const rows = normalizeTransactions([
      {
        bookingDate: '2026-09-01',
        transactionAmount: { amount: '-54.30', currency: 'CHF' },
        creditorName: 'Migros',
        remittanceInformationUnstructured: 'MIGROS ZUERICH HB   Karte 1234',
      },
      {
        bookingDate: '2026-09-25',
        transactionAmount: { amount: '6500.00', currency: 'CHF' },
        debtorName: 'ACME AG',
        remittanceInformationUnstructured: 'Lohn September',
      },
      {
        valueDate: '2026-09-03',
        transactionAmount: { amount: '-3.2', currency: 'CHF' },
        remittanceInformationUnstructuredArray: ['SBB', 'CFF FFS'],
      },
      { bookingDate: '2026-09-04', transactionAmount: { amount: '0.00', currency: 'CHF' } },
      { transactionAmount: { amount: '-1.00', currency: 'CHF' } },
      { bookingDateTime: '2026-09-05T10:00:00Z', transactionAmount: { amount: 'abc', currency: 'CHF' } },
    ]);
    expect(rows).toEqual([
      { date: '2026-09-01', kind: 'spend', amount: 54.3, note: 'MIGROS ZUERICH HB Karte 1234', currency: 'CHF' },
      { date: '2026-09-25', kind: 'income', amount: 6500, note: 'ACME AG · Lohn September', currency: 'CHF' },
      { date: '2026-09-03', kind: 'spend', amount: 3.2, note: 'SBB CFF FFS', currency: 'CHF' },
    ]);
  });
});

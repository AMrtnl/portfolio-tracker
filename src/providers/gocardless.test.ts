import type { PublicAccount } from '../types/accounts';

jest.mock('../aggregators/gocardless', () => ({
  ...jest.requireActual('../aggregators/gocardless'),
  getGocardlessClient: jest.fn(),
  isGocardlessConfigured: jest.fn(() => true),
}));

import { GocardlessError, getGocardlessClient } from '../aggregators/gocardless';
import { GocardlessProvider } from './gocardless';

const account: PublicAccount = {
  id: 'b1',
  label: 'Privatkonto',
  type: 'bank',
  provider: 'gocardless',
  status: 'connected',
  kind: 'asset',
  bookClass: 'cash',
  externalId: 'acc-1',
  institution: 'UBS',
  currency: 'CHF',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockClient = getGocardlessClient as jest.Mock;

describe('GocardlessProvider.sync', () => {
  it('reads balances, persists them as the holdings snapshot, and caches the bank call', async () => {
    const getAccountBalances = jest.fn(async () => [
      { balanceType: 'closingBooked', balanceAmount: { amount: '100', currency: 'CHF' } },
      { balanceType: 'expected', balanceAmount: { amount: '250.5', currency: 'CHF' } },
    ]);
    mockClient.mockReturnValue({ getAccountBalances });
    const store = { updateAccount: jest.fn() };
    const provider = new GocardlessProvider();

    const result = await provider.sync(account, { store: store as never });
    expect(result.error).toBeUndefined();
    expect(result.totalValueUsd).toBe(250.5);
    expect(result.balances).toEqual([
      {
        asset: 'CHF',
        amount: '250.5',
        usdValue: '250.50',
        chain: 'UBS',
        accountId: 'b1',
        accountLabel: 'Privatkonto',
        provider: 'gocardless',
      },
    ]);
    expect(store.updateAccount).toHaveBeenCalledWith('b1', {
      holdings: [{ symbol: 'CHF', name: 'CHF cash', quantity: 250.5, priceUsd: 1, assetClass: 'cash' }],
    });

    await provider.sync(account);
    expect(getAccountBalances).toHaveBeenCalledTimes(1);
    provider.forget('b1');
    await provider.sync(account);
    expect(getAccountBalances).toHaveBeenCalledTimes(2);
  });

  it('falls back to the stored snapshot when the bank cannot be read', async () => {
    mockClient.mockReturnValue({
      getAccountBalances: jest.fn(async () => {
        throw new GocardlessError('GoCardless rate limit reached (429)', 429);
      }),
    });
    const result = await new GocardlessProvider().sync({
      ...account,
      holdings: [{ symbol: 'CHF', quantity: 80, priceUsd: 1, assetClass: 'cash' }],
    });
    expect(result.error).toMatch(/429/);
    expect(result.totalValueUsd).toBe(80);
    expect(result.balances[0].usdValue).toBe('80.00');
  });

  it('explains a missing configuration instead of returning zero', async () => {
    mockClient.mockReturnValue(null);
    const result = await new GocardlessProvider().sync({
      ...account,
      holdings: [{ symbol: 'CHF', quantity: 5, priceUsd: 1 }],
    });
    expect(result.error).toMatch(/GOCARDLESS_SECRET_ID/);
    expect(result.totalValueUsd).toBe(5);
  });

  it('describes itself as an OAuth-style bank connector', () => {
    const info = new GocardlessProvider().info();
    expect(info).toMatchObject({ id: 'gocardless', connectMode: 'oauth', accountTypes: ['bank'] });
    expect(info.coverage).toBe('EU and UK banks via open banking; Switzerland partial');
  });
});

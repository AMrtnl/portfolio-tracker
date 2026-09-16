import type { PublicAccount } from '../types/accounts';

jest.mock('../market/quotes', () => ({ getQuotes: jest.fn() }));
jest.mock('../wallets', () => ({
  ...jest.requireActual('../wallets'),
  fetchWatchBalances: jest.fn(),
}));

import { getQuotes } from '../market/quotes';
import { fetchWatchBalances } from '../wallets';
import { WatchProvider } from './watch';

const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';

const account: PublicAccount = {
  id: 'w1',
  label: 'Ledger · Bitcoin',
  type: 'crypto_wallet',
  provider: 'watch',
  status: 'pending',
  kind: 'asset',
  bookClass: 'crypto',
  externalId: ZPUB,
  currency: 'USD',
  createdAt: '2026-01-01T00:00:00.000Z',
  chain: 'btc',
};

const quotesFor = (prices: Record<string, number>) => ({
  quotes: new Map(Object.entries(prices).map(([s, price]) => [s, { symbol: s, price }])),
  stale: new Set<string>(),
  missing: [],
  warnings: [],
});

const mockRead = fetchWatchBalances as jest.Mock;
const mockQuotes = getQuotes as jest.Mock;

beforeEach(() => {
  mockRead.mockReset();
  mockQuotes.mockReset();
});

describe('WatchProvider.sync', () => {
  it('prices the read, persists it as the holdings snapshot, and caches the chain call', async () => {
    mockRead.mockResolvedValue({
      balances: [
        { asset: 'BTC', name: 'Bitcoin', amount: 0.5, chain: 'Bitcoin' },
        { asset: 'USDC', name: 'USD Coin', amount: 100, chain: 'Bitcoin' },
      ],
    });
    mockQuotes.mockResolvedValue(quotesFor({ 'BTC-USD': 60_000 }));
    const store = { updateAccount: jest.fn() };
    const provider = new WatchProvider();
    provider.attachStore(store as never);

    const result = await provider.sync(account);

    expect(result.error).toBeUndefined();
    expect(result.totalValueUsd).toBeCloseTo(30_100);
    expect(result.balances.map((b) => [b.asset, b.usdValue, b.chain])).toEqual([
      ['BTC', '30000.00', 'Bitcoin (watch-only)'],
      ['USDC', '100.00', 'Bitcoin (watch-only)'],
    ]);
    expect(mockQuotes).toHaveBeenCalledWith(['BTC-USD']);
    expect(store.updateAccount).toHaveBeenCalledWith('w1', {
      holdings: [
        { symbol: 'BTC', name: 'Bitcoin', quantity: 0.5, priceUsd: 60_000, assetClass: 'crypto' },
        { symbol: 'USDC', name: 'USD Coin', quantity: 100, priceUsd: 1, assetClass: 'cash' },
      ],
    });

    await provider.sync(account);
    expect(mockRead).toHaveBeenCalledTimes(1);
    provider.forget('w1');
    await provider.sync(account);
    expect(mockRead).toHaveBeenCalledTimes(2);
  });

  it('falls back to the stored snapshot when the network is unreachable', async () => {
    mockRead.mockRejectedValue(new Error('503 from mempool.space'));
    const result = await new WatchProvider().sync({
      ...account,
      holdings: [{ symbol: 'BTC', quantity: 0.25, priceUsd: 50_000 }],
    });

    expect(result.error).toMatch(/Bitcoin network.*503/);
    expect(result.totalValueUsd).toBe(12_500);
    expect(result.balances[0].usdValue).toBe('12500.00');
    expect(mockQuotes).not.toHaveBeenCalled();
  });

  it('keeps the last known price when the quote layer has nothing', async () => {
    mockRead.mockResolvedValue({
      balances: [{ asset: 'BTC', name: 'Bitcoin', amount: 1, chain: 'Bitcoin' }],
    });
    mockQuotes.mockResolvedValue(quotesFor({}));
    const result = await new WatchProvider().sync({
      ...account,
      holdings: [{ symbol: 'BTC', quantity: 0.25, priceUsd: 55_000 }],
    });
    expect(result.totalValueUsd).toBe(55_000);
  });

  it('refuses a key it cannot read', async () => {
    const result = await new WatchProvider().sync({ ...account, externalId: 'not-a-key' });
    expect(result.balances).toEqual([]);
    expect(result.error).toMatch(/not recognised/);
    expect(mockRead).not.toHaveBeenCalled();
  });
});

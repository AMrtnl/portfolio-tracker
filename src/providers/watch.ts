import { getQuotes } from '../market/quotes';
import { isStablecoin } from '../market/symbols';
import { Holding, ProviderInfo, PublicAccount } from '../types/accounts';
import { Balance } from '../types/common';
import {
  CHAIN_NAMES,
  detectWatchKey,
  fetchWatchBalances,
  type WatchBalance,
  type WatchKey,
} from '../wallets';
import { FinanceProvider, SyncContext, SyncResult } from './types';

/** Chain reads are slow and rate-limited; the dashboard re-renders often. */
const CACHE_TTL = 5 * 60 * 1000;

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class WatchProvider implements FinanceProvider {
  id = 'watch' as const;
  /** Keyed by account id, which is a UUID, so users cannot collide here. */
  private cache = new Map<string, { at: number; balances: WatchBalance[] }>();

  info(): ProviderInfo {
    return {
      id: 'watch',
      name: 'Watch-only wallet',
      description:
        'Bitcoin, Ethereum, or Solana balances from a public key or address — a Ledger export works as-is, nothing to sign.',
      accountTypes: ['crypto_wallet'],
      configured: true,
      coverage: 'Bitcoin · Ethereum · Solana',
      connectMode: 'watch',
    };
  }

  isConfigured(): boolean {
    return true;
  }

  /** Drop the cached read so the next sync hits the network. */
  forget(accountId: string): void {
    this.cache.delete(accountId);
  }

  /** `ctx.store` lets a successful read persist as the account's holdings snapshot. */
  async sync(account: PublicAccount, ctx?: SyncContext): Promise<SyncResult> {
    const key = detectWatchKey(account.externalId || '');
    if (!key) {
      return {
        balances: [],
        positions: [],
        totalValueUsd: 0,
        error: 'This key or address is not recognised.',
      };
    }

    let raw: WatchBalance[];
    let fresh = false;
    const hit = this.cache.get(account.id);
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      raw = hit.balances;
    } else {
      try {
        raw = (await fetchWatchBalances(key)).balances;
        this.cache.set(account.id, { at: Date.now(), balances: raw });
        fresh = true;
      } catch (err) {
        return this.fromSnapshot(
          account,
          key,
          `Could not read the ${CHAIN_NAMES[key.chain]} network: ${message(err)}`,
        );
      }
    }

    const holdings = await priceHoldings(raw, account.holdings ?? []);
    // Only a fresh chain read is worth a disk write; cached reads happen on
    // every dashboard refresh.
    if (fresh) ctx?.store?.updateAccount(account.id, { holdings });
    return result(holdings, account, key);
  }

  /** Last successful read, so a flaky RPC doesn't zero the dashboard. */
  private fromSnapshot(account: PublicAccount, key: WatchKey, error: string): SyncResult {
    return { ...result(account.holdings ?? [], account, key), error };
  }
}

/** Stablecoins are worth a dollar; everything else asks the quote layer. */
async function priceHoldings(raw: WatchBalance[], previous: Holding[]): Promise<Holding[]> {
  const symbols = raw.filter((r) => !isStablecoin(r.asset)).map((r) => `${r.asset}-USD`);
  const lookup = symbols.length ? await getQuotes(symbols) : null;
  const lastPrice = new Map(previous.map((h) => [h.symbol, h.priceUsd]));
  return raw.map((r) => {
    const stable = isStablecoin(r.asset);
    const quoted = lookup?.quotes.get(`${r.asset}-USD`)?.price;
    const priceUsd = stable ? 1 : (quoted ?? lastPrice.get(r.asset) ?? 0);
    return {
      symbol: r.asset,
      name: r.name,
      quantity: r.amount,
      priceUsd,
      assetClass: stable ? 'cash' : 'crypto',
    };
  });
}

function result(holdings: Holding[], account: PublicAccount, key: WatchKey): SyncResult {
  const balances: Balance[] = holdings
    .filter((h) => h.quantity > 0)
    .map((h) => ({
      asset: h.symbol,
      amount: String(h.quantity),
      usdValue: (h.quantity * h.priceUsd).toFixed(2),
      chain: `${CHAIN_NAMES[key.chain]} (watch-only)`,
      accountId: account.id,
      accountLabel: account.label,
      provider: 'watch',
    }));
  const totalValueUsd = balances.reduce((s, b) => s + parseFloat(b.usdValue), 0);
  return { balances, positions: [], totalValueUsd };
}

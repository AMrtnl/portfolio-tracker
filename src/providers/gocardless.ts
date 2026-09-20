import {
  getGocardlessClient,
  gocardlessErrorMessage,
  holdingsFromBalances,
  isGocardlessConfigured,
} from '../aggregators/gocardless';
import type { GcBalance } from '../aggregators/gocardless';
import { Holding, ProviderInfo, PublicAccount } from '../types/accounts';
import { Balance } from '../types/common';
import { FinanceProvider, SyncContext, SyncResult } from './types';

/**
 * Banks let GoCardless read an account only a few times a day, and the
 * dashboard re-syncs on every visit, so a read is kept for a good while. An
 * explicit sync goes through `forget` first.
 */
const CACHE_TTL = 6 * 60 * 60 * 1000;

export class GocardlessProvider implements FinanceProvider {
  id = 'gocardless' as const;
  /** Keyed by account id, which is a UUID, so users cannot collide here. */
  private cache = new Map<string, { at: number; balances: GcBalance[] }>();

  info(): ProviderInfo {
    const configured = this.isConfigured();
    return {
      id: 'gocardless',
      name: 'GoCardless',
      description:
        'Balances and transactions from a bank account through open banking (GoCardless Bank Account Data), read-only.',
      accountTypes: ['bank'],
      configured,
      coverage: 'EU and UK banks via open banking; Switzerland partial',
      connectMode: 'oauth',
    };
  }

  isConfigured(): boolean {
    return isGocardlessConfigured();
  }

  /** Drop the cached read so the next sync asks the bank. */
  forget(accountId: string): void {
    this.cache.delete(accountId);
  }

  /** `ctx.store` lets a successful read persist as the account's holdings snapshot. */
  async sync(account: PublicAccount, ctx?: SyncContext): Promise<SyncResult> {
    const client = getGocardlessClient();
    if (!client) {
      return this.fromSnapshot(
        account,
        'GoCardless not configured. Set GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY.',
      );
    }
    if (!account.externalId) {
      return this.fromSnapshot(account, 'Missing GoCardless account id.');
    }

    let raw: GcBalance[];
    let fresh = false;
    const hit = this.cache.get(account.id);
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      raw = hit.balances;
    } else {
      try {
        raw = await client.getAccountBalances(account.externalId);
        this.cache.set(account.id, { at: Date.now(), balances: raw });
        fresh = true;
      } catch (err) {
        return this.fromSnapshot(account, gocardlessErrorMessage(err));
      }
    }

    const holdings = holdingsFromBalances(raw);
    // Only a fresh bank read is worth a disk write.
    if (fresh) ctx?.store?.updateAccount(account.id, { holdings });
    return result(holdings, account);
  }

  /** Last successful read, so a bank outage or a daily cap does not zero the dashboard. */
  private fromSnapshot(account: PublicAccount, error: string): SyncResult {
    return { ...result(account.holdings ?? [], account), error };
  }
}

function result(holdings: Holding[], account: PublicAccount): SyncResult {
  const balances: Balance[] = holdings
    .filter((h) => h.quantity !== 0)
    .map((h) => ({
      asset: h.symbol,
      amount: String(h.quantity),
      // Amount is in the account's own currency — not FX-converted, the same
      // convention as the SnapTrade provider. Analytics convert by `asset`.
      usdValue: (h.quantity * h.priceUsd).toFixed(2),
      chain: account.institution || 'Bank',
      accountId: account.id,
      accountLabel: account.label,
      provider: 'gocardless',
    }));
  const totalValueUsd = balances.reduce((s, b) => s + parseFloat(b.usdValue), 0);
  return { balances, positions: [], totalValueUsd };
}

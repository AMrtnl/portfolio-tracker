import { HyperliquidAdapter } from '../defi/hyperliquid';
import type { Store } from '../store';
import { WalletCore } from '../wallet-core';
import { ProviderInfo, PublicAccount } from '../types/accounts';
import { FinanceProvider, SyncResult } from './types';

/**
 * In-memory live adapters keyed by account id. Ids are UUIDs, so one
 * process-wide map is safe across users; a user's adapters are removed with
 * their accounts.
 */
const liveAdapters = new Map<string, HyperliquidAdapter>();

export function getLiveAdapter(accountId: string): HyperliquidAdapter | undefined {
  return liveAdapters.get(accountId);
}

export function hasLiveAdapter(accountId: string): boolean {
  return liveAdapters.has(accountId);
}

export function removeLiveAdapter(accountId: string): void {
  liveAdapters.delete(accountId);
}

export function bootHyperliquidAccount(
  accountId: string,
  mnemonic: string,
): { address: string; ok: boolean } {
  try {
    const wc = new WalletCore();
    wc.setMnemonic(mnemonic);
    const hl = new HyperliquidAdapter(wc);
    liveAdapters.set(accountId, hl);
    return { address: hl.getAddress(), ok: true };
  } catch (err) {
    console.error(`❌ Failed to boot Hyperliquid account ${accountId}:`, err);
    return { address: '', ok: false };
  }
}

/**
 * Boots a live adapter for every Hyperliquid wallet in `store`. Runs at start
 * for each user and again when legacy data is adopted by the first sign-up.
 */
export function rehydrateHyperliquidAccounts(store: Store): { booted: number; failed: number } {
  let booted = 0;
  let failed = 0;
  for (const acct of store.getAllRaw()) {
    if (acct.provider !== 'hyperliquid') continue;
    const mnemonic = store.getMnemonic(acct.id);
    if (!mnemonic) {
      console.log(`  ❌ Could not decrypt wallet "${acct.label}"`);
      failed++;
      continue;
    }
    const { ok } = bootHyperliquidAccount(acct.id, mnemonic);
    console.log(
      ok
        ? `  ✅ Loaded crypto "${acct.label}" (${acct.externalId})`
        : `  ❌ Could not load crypto "${acct.label}"`,
    );
    if (ok) booted++;
    else failed++;
  }
  return { booted, failed };
}

export class HyperliquidProvider implements FinanceProvider {
  id = 'hyperliquid' as const;

  info(): ProviderInfo {
    return {
      id: 'hyperliquid',
      name: 'Hyperliquid',
      description: 'Crypto wallet — perps equity and spot balances via recovery phrase.',
      accountTypes: ['crypto_wallet'],
      configured: true,
      coverage: 'Global · Hyperliquid L1',
      connectMode: 'mnemonic',
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async sync(account: PublicAccount): Promise<SyncResult> {
    const adapter = liveAdapters.get(account.id);
    if (!adapter) {
      return {
        balances: [],
        positions: [],
        totalValueUsd: 0,
        error: 'Wallet not loaded. Re-add the recovery phrase or restart the server.',
      };
    }

    const [balances, positions, pnl] = await Promise.all([
      adapter.getBalances(),
      adapter.getPositions(),
      adapter.getPnl(),
    ]);

    const taggedBalances = balances.map((b) => ({
      ...b,
      accountId: account.id,
      accountLabel: account.label,
      provider: 'hyperliquid',
    }));
    const taggedPositions = positions.map((p) => ({
      ...p,
      accountId: account.id,
      accountLabel: account.label,
      provider: 'hyperliquid',
    }));

    const totalValueUsd = taggedBalances.reduce(
      (s, b) => s + parseFloat(b.usdValue || '0'),
      0,
    );

    return {
      balances: taggedBalances,
      positions: taggedPositions,
      pnl: {
        pnl24h: pnl.pnl24h,
        pnl7d: pnl.pnl7d,
        pnl30d: pnl.pnl30d,
      },
      totalValueUsd,
    };
  }
}

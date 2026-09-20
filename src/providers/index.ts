import { ProviderId, ProviderInfo } from '../types/accounts';
import { GocardlessProvider } from './gocardless';
import { HyperliquidProvider } from './hyperliquid';
import { ManualProvider } from './manual';
import { SnaptradeProvider } from './snaptrade';
import { WatchProvider } from './watch';
import { FinanceProvider } from './types';

const hyperliquid = new HyperliquidProvider();
const manual = new ManualProvider();
const snaptrade = new SnaptradeProvider();
const gocardless = new GocardlessProvider();
const watch = new WatchProvider();

const byId: Record<ProviderId, FinanceProvider> = {
  hyperliquid,
  manual,
  snaptrade,
  gocardless,
  watch,
};

export function getProvider(id: ProviderId): FinanceProvider {
  return byId[id];
}

export function listProviders(): ProviderInfo[] {
  return Object.values(byId).map((p) => p.info());
}

export { gocardless, hyperliquid, manual, snaptrade, watch };
export type { FinanceProvider, SyncContext, SyncResult, ConnectResult } from './types';
export {
  bootHyperliquidAccount,
  getLiveAdapter,
  hasLiveAdapter,
  rehydrateHyperliquidAccounts,
  removeLiveAdapter,
} from './hyperliquid';

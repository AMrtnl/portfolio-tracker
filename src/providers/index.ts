import { ProviderId, ProviderInfo } from '../types/accounts';
import { HyperliquidProvider } from './hyperliquid';
import { ManualProvider } from './manual';
import { SnaptradeProvider } from './snaptrade';
import { FinanceProvider } from './types';

const hyperliquid = new HyperliquidProvider();
const manual = new ManualProvider();
const snaptrade = new SnaptradeProvider();

const byId: Record<ProviderId, FinanceProvider> = {
  hyperliquid,
  manual,
  snaptrade,
};

export function getProvider(id: ProviderId): FinanceProvider {
  return byId[id];
}

export function listProviders(): ProviderInfo[] {
  return Object.values(byId).map((p) => p.info());
}

export { hyperliquid, manual, snaptrade };
export type { FinanceProvider, SyncResult, ConnectResult } from './types';
export {
  bootHyperliquidAccount,
  getLiveAdapter,
  hasLiveAdapter,
  removeLiveAdapter,
} from './hyperliquid';

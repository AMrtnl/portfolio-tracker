/**
 * Mirrors of the Meridian API view models. Kept as a standalone copy rather than
 * importing from `../../src/types` so the mobile app can be moved to its own
 * repo without dragging the server along.
 *
 * Source of truth: src/types/common.ts, src/types/accounts.ts, src/snaptrade/types.ts
 */

export type AccountType = 'crypto_wallet' | 'broker' | 'bank' | 'manual';
export type ProviderId = 'hyperliquid' | 'snaptrade' | 'manual';
export type AccountStatus =
  | 'connected'
  | 'pending'
  | 'error'
  | 'disconnected'
  | 'unconfigured';
export type AssetClass = 'equity' | 'etf' | 'crypto' | 'cash' | 'other';

export interface Holding {
  symbol: string;
  name?: string;
  quantity: number;
  priceUsd: number;
  assetClass?: AssetClass;
}

export interface PublicAccount {
  id: string;
  label: string;
  type: AccountType;
  provider: ProviderId;
  status: AccountStatus;
  externalId?: string;
  maskedIdentifier?: string;
  institution?: string;
  currency: string;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
  live?: boolean;
  holdings?: Holding[];
  totalValueUsd?: number;
}

export interface Balance {
  asset: string;
  amount: string;
  usdValue: string;
  chain: string;
  accountId?: string;
  accountLabel?: string;
  provider?: string;
}

export interface Position {
  asset: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  pnl: string;
  pnlPercent: string;
  leverage: string;
  side: 'LONG' | 'SHORT';
  type: 'PERPETUAL' | 'FUTURE' | 'OPTION' | 'EQUITY';
  protocol: string;
  accountId?: string;
  accountLabel?: string;
  provider?: string;
}

export interface PortfolioSource {
  accountId: string;
  label: string;
  provider: string;
  type: string;
  valueUsd: number;
  status: string;
  error?: string;
}

export interface PortfolioSummary {
  totalValue: string;
  pnl24h: string;
  pnl7d: string;
  pnl30d: string;
  assets: Balance[];
  positions: Position[];
  sources?: PortfolioSource[];
  lastUpdated: string;
  /**
   * Not returned by the API yet — the aggregate is summed in USD. Read here so
   * the UI upgrades automatically once the backend adds FX normalization.
   */
  currency?: string;
}

export interface SnapAccountVM {
  externalId: string;
  label: string;
  institution: string;
  numberSuffix?: string;
  accountType?: string | null;
  accountCategory?: string | null;
  status?: string | null;
  currency: string;
  totalValue?: number | null;
  isPaper: boolean;
  holdingsUnavailable?: boolean;
  lastHoldingsSync?: string | null;
  brokerageAuthorizationId?: string;
}

export interface SnapBalanceVM {
  currency: string;
  cash: number | null;
  buyingPower: number | null;
}

export interface SnapPositionVM {
  symbol: string;
  name?: string | null;
  units: number;
  price: number | null;
  averageCost: number | null;
  marketValue: number | null;
  currency: string;
  openPnl: number | null;
  cashEquivalent: boolean;
}

export interface SnapOrderVM {
  brokerageOrderId?: string;
  symbol?: string;
  action?: string;
  status?: string;
  orderType?: string | null;
  totalQuantity?: string | null;
  filledQuantity?: string | null;
  limitPrice?: string | null;
  executionPrice?: string | null;
  timePlaced?: string;
  timeExecuted?: string | null;
  currency?: string | null;
}

export interface SnapActivityVM {
  id?: string;
  type?: string;
  symbol?: string | null;
  description?: string;
  amount: number | null;
  units: number | null;
  price: number | null;
  currency: string | null;
  tradeDate?: string | null;
  settlementDate?: string | null;
  fee: number | null;
  institution?: string;
}

export interface SnapConnectionVM {
  id: string;
  name: string;
  brokerageName: string;
  brokerageSlug?: string;
  type?: string;
  disabled: boolean;
  disabledDate?: string | null;
  dataFreshnessMode?: string;
  createdDate?: string;
}

export interface SnapSectionResult<T> {
  data: T;
  error?: string;
}

export interface SnapAccountDetailVM {
  account: SnapAccountVM | null;
  balances: SnapSectionResult<SnapBalanceVM[]>;
  positions: SnapSectionResult<SnapPositionVM[]>;
  retrievedAt: string;
  errors: string[];
}

export interface SnapStatus {
  configured: boolean;
  accountCount: number;
  connectionCount: number;
  disabledConnectionCount: number;
  errors?: string[];
  retrievedAt: string;
}

export interface AccountsResponse {
  accounts: PublicAccount[];
}

export interface ConnectionsResponse {
  connections: SnapConnectionVM[];
  retrievedAt: string;
}

export interface OrdersResponse {
  orders: SnapOrderVM[];
  error?: string;
  retrievedAt?: string;
}

export interface ActivitiesResponse {
  activities: SnapActivityVM[];
  error?: string;
  retrievedAt?: string;
}

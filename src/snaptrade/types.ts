/** Normalized SnapTrade view models for the Meridian API (no raw SDK dumps). */

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

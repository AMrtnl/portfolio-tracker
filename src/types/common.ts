export type Address = `0x${string}`;

export interface Balance {
  asset: string;
  amount: string;
  usdValue: string;
  chain: string;
  /** Owning Meridian account id when aggregated */
  accountId?: string;
  /** Display label of the source account */
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
  protocol: 'HYPERLIQUID' | 'ASTER' | string;
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
}

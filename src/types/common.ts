export type Address = `0x${string}`;

export interface Balance {
  asset: string;
  amount: string;
  usdValue: string;
  chain: string;
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
  type: 'PERPETUAL' | 'FUTURE' | 'OPTION';
  protocol: 'HYPERLIQUID' | 'ASTER' | string;
}

export interface PortfolioSummary {
  totalValue: string;
  pnl24h: string;
  pnl7d: string;
  pnl30d: string;
  assets: Balance[];
  positions: Position[];
  lastUpdated: string;
}

// ── Account Types ─────────────────────────────────────────────────────────────

export type Address = `0x${string}`;

export type AccountType = 'CRYPTO_EXCHANGE' | 'BROKER' | 'BANK' | 'DEFI' | 'PREDICTION';

export type Platform =
  | 'hyperliquid'
  | 'binance'
  | 'bybit'
  | 'bitget'
  | 'coinbase'
  | 'kraken'
  | 'okx'
  | 'gate'
  | 'polymarket'
  | 'kalshi'
  | 'aster'
  | 'ibkr'
  | 'schwab'
  | 'swissquote'
  | 'six-blink';

// ── Balance ───────────────────────────────────────────────────────────────────

export interface Balance {
  asset: string;
  amount: string;
  usdValue: string;
  chain?: string;
  platform?: string;
}

// ── Position ──────────────────────────────────────────────────────────────────

export interface Position {
  asset: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  pnl: string;
  pnlPercent: string;
  leverage?: string;
  side: 'LONG' | 'SHORT' | 'FLAT';
  type: 'PERPETUAL' | 'FUTURE' | 'SPOT' | 'OPTION' | 'PREDICTION';
  protocol: string;
  platform?: string;
  metadata?: Record<string, unknown>;
}

// ── Transaction ───────────────────────────────────────────────────────────────

export interface TxRecord {
  id?: string;
  asset: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'DIVIDEND' | 'STAKE' | 'UNSTAKE';
  amount: number;
  price?: number;
  fee: number;
  currency: string;
  timestamp: Date;
  platform?: string;
}

// ── Aggregated Portfolio ──────────────────────────────────────────────────────

export interface PortfolioSummary {
  totalValue: string;
  pnl24h: string;
  pnl7d: string;
  pnl30d: string;
  assets: Balance[];
  positions: Position[];
  lastUpdated: string;
}

export interface UnifiedPortfolio {
  totalValue: number;
  breakdown: {
    crypto: number;
    tradfi: number;
    cash: number;
    predictions: number;
    defi: number;
  };
  balances: Balance[];
  positions: Position[];
  pnl24h: number;
  pnl24hPercent: number;
  lastUpdated: string;
}

// ── Market Data ───────────────────────────────────────────────────────────────

export interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
  change24hPercent: number;
  marketCap?: number;
  volume24h?: number;
}

export interface EconomicEvent {
  date: string;
  time?: string;
  event: string;
  country: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  forecast?: string;
  previous?: string;
  actual?: string;
}

export interface EarningsEvent {
  date: string;
  ticker: string;
  company: string;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  period: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  relatedAssets?: string[];
}

export interface MacroData {
  fedFundsRate: number;
  cpi: number;
  tenYearYield: number;
  dxy: number;
  fearGreedIndex: number;
  fearGreedLabel: string;
}

// ── Budget ────────────────────────────────────────────────────────────────────

export interface SubscriptionItem {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cadence: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY';
  category: string;
  nextBilling: string;
  logoUrl?: string;
  isActive: boolean;
  monthlyEquivalent: number;
}

// ── AI ────────────────────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface AIInsight {
  type: 'WARNING' | 'OPPORTUNITY' | 'INFO';
  title: string;
  body: string;
  asset?: string;
  priority: number;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface AlertConfig {
  id?: string;
  type: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'PNL_PERCENT' | 'NET_WORTH_ABOVE' | 'NET_WORTH_BELOW';
  asset?: string;
  threshold: number;
  isActive: boolean;
}

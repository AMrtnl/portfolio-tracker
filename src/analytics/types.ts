import type { MarketAssetClass } from '../market';

/**
 * One holding, normalized across SnapTrade / Hyperliquid / manual accounts and
 * enriched with market data.
 *
 * `*Base` fields are converted into the display currency; the un-suffixed
 * fields stay in the currency the source reported. A null `*Base` means we had
 * no FX rate and refused to guess.
 */
export interface EnrichedPosition {
  /** Ticker exactly as the source reported it. */
  symbol: string;
  /** Ticker used for market data, or null when unmappable. */
  yahooSymbol: string | null;
  name: string | null;
  units: number;
  /** Price per unit in `currency`. */
  price: number | null;
  currency: string;
  marketValue: number | null;
  marketValueBase: number | null;
  /** Average cost per unit in `currency`. */
  averageCost: number | null;
  costBasis: number | null;
  costBasisBase: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  accountId: string;
  accountLabel: string;
  institution: string;
  provider: string;
  isCash: boolean;
  assetClass: MarketAssetClass;
  sector: string | null;
  industry: string | null;
  region: string | null;
  /** Today's move for the whole position, in the display currency. */
  dayChange: number | null;
  dayChangePercent: number | null;
  /** True when the price came from an expired cache entry. */
  quoteStale: boolean;
}

export interface AccountRef {
  accountId: string;
  label: string;
  institution: string;
  provider: string;
  currency: string;
  externalId?: string;
}

/** A cash-flow / income event, already normalized out of SnapTrade activities. */
export interface NormalizedActivity {
  type: string;
  symbol: string | null;
  description: string | null;
  amount: number | null;
  currency: string;
  /** YYYY-MM-DD */
  date: string | null;
  fee: number | null;
  accountId: string;
  institution: string;
}

export interface PortfolioSnapshotData {
  positions: EnrichedPosition[];
  accounts: AccountRef[];
  currency: string;
  /** True when sources reported more than one native currency. */
  isMixedCurrency: boolean;
  /** Currencies present that could not be converted into the display currency. */
  unconvertedCurrencies: string[];
  /** Sum of values we could not convert, grouped by native currency. */
  unconvertedByCurrency: Record<string, number>;
  fxRates: Record<string, number>;
  warnings: string[];
  retrievedAt: string;
}

/**
 * Pure portfolio math.
 *
 * Nothing in this file does I/O — it takes normalized positions / activities
 * and returns the numbers the API serves, so every rule here is unit-testable.
 * Two conventions hold throughout:
 *   - A value we do not know is `null`, never `0`.
 *   - Positions whose value could not be converted into the display currency
 *     are excluded from totals and counted separately.
 */
import type { EnrichedPosition, NormalizedActivity } from './types';

/**
 * Rounds to cents-ish precision without turning nulls into zeros.
 *
 * Uses exponent shifting rather than `value * 10 ** decimals` because the
 * naive form gets money wrong: `1.005 * 100` is 100.49999999999999 in binary
 * floating point and would round down to 1.00. Halves round away from zero so
 * gains and losses are treated symmetrically.
 */
export function round(value: number | null | undefined, decimals = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const magnitude = Math.abs(value);
  const text = magnitude.toString();
  // Values already in exponential notation cannot take a second exponent.
  if (text.includes('e') || text.includes('E')) {
    const factor = 10 ** decimals;
    return (sign * Math.round(magnitude * factor)) / factor;
  }
  const shifted = Number(`${text}e${decimals}`);
  if (!Number.isFinite(shifted)) return value;
  const rounded = Number(`${Math.round(shifted)}e-${decimals}`);
  return Number.isFinite(rounded) ? sign * rounded : value;
}

/** Same as `round` but for fields the contract types as a plain number. */
export function round0(value: number | null | undefined, decimals = 2): number {
  return round(value, decimals) ?? 0;
}

export function sumValues(positions: EnrichedPosition[]): number {
  return positions.reduce((total, p) => total + (p.marketValueBase ?? 0), 0);
}

export function percentOf(part: number, whole: number): number | null {
  if (!Number.isFinite(whole) || whole === 0) return null;
  return (part / whole) * 100;
}

// ---------- overview ----------

export interface OverviewTotals {
  totalValue: number;
  costBasis: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  cashValue: number;
  cashPercent: number | null;
  investedValue: number;
  holdingsCount: number;
  dayChange: number | null;
  dayChangePercent: number | null;
  /** Share of total value for which we have a cost basis, 0-100. */
  costBasisCoveragePercent: number;
  /** Share of total value for which we have a day change, 0-100. */
  dayChangeCoveragePercent: number;
}

export function computeOverview(positions: EnrichedPosition[]): OverviewTotals {
  const totalValue = sumValues(positions);
  const cashValue = positions
    .filter((p) => p.isCash || p.assetClass === 'cash')
    .reduce((total, p) => total + (p.marketValueBase ?? 0), 0);

  let costBasis: number | null = null;
  let coveredByCost = 0;
  for (const position of positions) {
    if (position.costBasisBase == null) continue;
    costBasis = (costBasis ?? 0) + position.costBasisBase;
    coveredByCost += position.marketValueBase ?? 0;
  }

  // Only compare like with like: P&L is market value minus cost for the
  // positions that actually reported a cost basis.
  let valueWithCost = 0;
  for (const position of positions) {
    if (position.costBasisBase == null) continue;
    valueWithCost += position.marketValueBase ?? 0;
  }
  const unrealizedPnl = costBasis == null ? null : valueWithCost - costBasis;
  const unrealizedPnlPercent =
    costBasis == null || costBasis === 0
      ? null
      : ((valueWithCost - costBasis) / Math.abs(costBasis)) * 100;

  let dayChange: number | null = null;
  let coveredByDay = 0;
  for (const position of positions) {
    if (position.dayChange == null) continue;
    dayChange = (dayChange ?? 0) + position.dayChange;
    coveredByDay += position.marketValueBase ?? 0;
  }
  // Percent is measured against yesterday's close of the covered slice.
  const priorValue = dayChange == null ? 0 : coveredByDay - dayChange;
  const dayChangePercent =
    dayChange == null || priorValue === 0 ? null : (dayChange / priorValue) * 100;

  return {
    totalValue,
    costBasis,
    unrealizedPnl,
    unrealizedPnlPercent,
    cashValue,
    cashPercent: percentOf(cashValue, totalValue),
    investedValue: totalValue - cashValue,
    holdingsCount: positions.length,
    dayChange,
    dayChangePercent,
    costBasisCoveragePercent: percentOf(coveredByCost, totalValue) ?? 0,
    dayChangeCoveragePercent: percentOf(coveredByDay, totalValue) ?? 0,
  };
}

// ---------- allocation ----------

export type AllocationDimension =
  | 'assetClass'
  | 'sector'
  | 'region'
  | 'currency'
  | 'account'
  | 'institution'
  | 'symbol';

export const ALLOCATION_DIMENSIONS: AllocationDimension[] = [
  'assetClass',
  'sector',
  'region',
  'currency',
  'account',
  'institution',
  'symbol',
];

export interface AllocationSegment {
  key: string;
  label: string;
  value: number;
  percent: number;
  count: number;
}

export interface AllocationResult {
  segments: AllocationSegment[];
  unclassifiedValue: number;
  unclassifiedPercent: number;
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: 'Stocks',
  etf: 'ETFs',
  fund: 'Funds',
  crypto: 'Crypto',
  cash: 'Cash',
  bond: 'Bonds',
  other: 'Other',
  unclassified: 'Unclassified',
};

const UNCLASSIFIED = 'unclassified';

/**
 * Which bucket a position falls into for a dimension.
 * `null` means genuinely unknown and is reported as `unclassified` rather than
 * folded into an "Other" bucket that would look like a real allocation.
 */
export function allocationKey(
  position: EnrichedPosition,
  by: AllocationDimension,
): { key: string; label: string } | null {
  switch (by) {
    case 'assetClass': {
      if (position.assetClass === 'unclassified') return null;
      return {
        key: position.assetClass,
        label: ASSET_CLASS_LABELS[position.assetClass] || position.assetClass,
      };
    }
    case 'sector': {
      // Cash and crypto have no equity sector; labelling them keeps the chart
      // honest without pretending they are unknown.
      if (position.isCash || position.assetClass === 'cash') {
        return { key: 'cash', label: 'Cash' };
      }
      if (position.assetClass === 'crypto') {
        return { key: 'crypto', label: 'Crypto' };
      }
      if (!position.sector) return null;
      return { key: position.sector, label: position.sector };
    }
    case 'region': {
      if (!position.region) return null;
      return { key: position.region, label: position.region };
    }
    case 'currency': {
      if (!position.currency) return null;
      return { key: position.currency, label: position.currency };
    }
    case 'account': {
      return { key: position.accountId, label: position.accountLabel };
    }
    case 'institution': {
      if (!position.institution) return null;
      return { key: position.institution, label: position.institution };
    }
    case 'symbol': {
      if (!position.symbol) return null;
      return { key: position.symbol, label: position.name || position.symbol };
    }
    default:
      return null;
  }
}

export function buildAllocation(
  positions: EnrichedPosition[],
  by: AllocationDimension,
): AllocationResult {
  const total = sumValues(positions);
  const buckets = new Map<string, AllocationSegment>();
  let unclassifiedValue = 0;

  for (const position of positions) {
    const value = position.marketValueBase;
    if (value == null) continue;
    const bucket = allocationKey(position, by);
    if (!bucket) {
      unclassifiedValue += value;
      continue;
    }
    const existing = buckets.get(bucket.key);
    if (existing) {
      existing.value += value;
      existing.count += 1;
    } else {
      buckets.set(bucket.key, {
        key: bucket.key,
        label: bucket.label,
        value,
        percent: 0,
        count: 1,
      });
    }
  }

  const segments = Array.from(buckets.values())
    .map((segment) => ({
      ...segment,
      value: round0(segment.value),
      percent: round0(percentOf(segment.value, total) ?? 0),
    }))
    .sort((a, b) => b.value - a.value);

  if (unclassifiedValue > 0) {
    segments.push({
      key: UNCLASSIFIED,
      label: 'Unclassified',
      value: round0(unclassifiedValue),
      percent: round0(percentOf(unclassifiedValue, total) ?? 0),
      count: positions.filter(
        (p) => p.marketValueBase != null && !allocationKey(p, by),
      ).length,
    });
  }

  return {
    segments,
    unclassifiedValue: round0(unclassifiedValue),
    unclassifiedPercent: round0(percentOf(unclassifiedValue, total) ?? 0),
  };
}

// ---------- concentration ----------

export interface ConcentrationEntry {
  symbol: string;
  label: string;
  value: number;
  percent: number;
}

export interface ConcentrationFlag {
  level: 'info' | 'warn' | 'high';
  message: string;
}

export interface ConcentrationResult {
  top: ConcentrationEntry[];
  top5Percent: number;
  top10Percent: number;
  /** Herfindahl-Hirschman index over percent weights, 0–10,000. */
  hhi: number;
  /** 10,000 / HHI — how many equally sized holdings this is equivalent to. */
  effectiveHoldings: number;
  flags: ConcentrationFlag[];
}

/** Merges the same ticker held across several accounts into one line. */
export function mergeBySymbol(positions: EnrichedPosition[]): ConcentrationEntry[] {
  const total = sumValues(positions);
  const merged = new Map<string, ConcentrationEntry>();
  for (const position of positions) {
    const value = position.marketValueBase;
    if (value == null) continue;
    const key = position.symbol || 'UNKNOWN';
    const existing = merged.get(key);
    if (existing) {
      existing.value += value;
    } else {
      merged.set(key, {
        symbol: key,
        label: position.name || key,
        value,
        percent: 0,
      });
    }
  }
  return Array.from(merged.values())
    .map((entry) => ({
      ...entry,
      value: round0(entry.value),
      percent: round0(percentOf(entry.value, total) ?? 0),
    }))
    .sort((a, b) => b.value - a.value);
}

export function computeConcentration(
  positions: EnrichedPosition[],
  topCount = 10,
): ConcentrationResult {
  const entries = mergeBySymbol(positions);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

  if (entries.length === 0 || total <= 0) {
    return {
      top: [],
      top5Percent: 0,
      top10Percent: 0,
      hhi: 0,
      effectiveHoldings: 0,
      flags: [{ level: 'info', message: 'No priced holdings to analyze yet.' }],
    };
  }

  const cumulative = (n: number) =>
    entries.slice(0, n).reduce((sum, entry) => sum + entry.value, 0);
  const top5Percent = round0(percentOf(cumulative(5), total) ?? 0);
  const top10Percent = round0(percentOf(cumulative(10), total) ?? 0);

  const hhi = entries.reduce((sum, entry) => {
    const weight = (entry.value / total) * 100;
    return sum + weight * weight;
  }, 0);
  const effectiveHoldings = hhi > 0 ? 10_000 / hhi : 0;

  const flags: ConcentrationFlag[] = [];
  const largest = entries[0];
  const largestPercent = percentOf(largest.value, total) ?? 0;

  if (largestPercent >= 25) {
    flags.push({
      level: 'high',
      message: `${largest.symbol} is ${largestPercent.toFixed(1)}% of the portfolio — a single-name shock moves the whole book.`,
    });
  } else if (largestPercent >= 15) {
    flags.push({
      level: 'warn',
      message: `${largest.symbol} is ${largestPercent.toFixed(1)}% of the portfolio.`,
    });
  }

  if (top5Percent >= 75) {
    flags.push({
      level: 'high',
      message: `Top 5 holdings are ${top5Percent.toFixed(1)}% of the portfolio.`,
    });
  } else if (top5Percent >= 55) {
    flags.push({
      level: 'warn',
      message: `Top 5 holdings are ${top5Percent.toFixed(1)}% of the portfolio.`,
    });
  }

  if (effectiveHoldings < 5) {
    flags.push({
      level: 'high',
      message: `Diversification is equivalent to ${effectiveHoldings.toFixed(1)} equally weighted holdings.`,
    });
  } else if (effectiveHoldings < 10) {
    flags.push({
      level: 'warn',
      message: `Diversification is equivalent to ${effectiveHoldings.toFixed(1)} equally weighted holdings.`,
    });
  }

  if (flags.length === 0) {
    flags.push({
      level: 'info',
      message: `No single position dominates: largest is ${largestPercent.toFixed(1)}%, equivalent to ${effectiveHoldings.toFixed(1)} equally weighted holdings.`,
    });
  }

  return {
    top: entries.slice(0, topCount),
    top5Percent,
    top10Percent,
    hhi: round0(hhi),
    effectiveHoldings: round0(effectiveHoldings),
    flags,
  };
}

// ---------- activity classification ----------

export type ActivityBucket =
  | 'dividend'
  | 'interest'
  | 'deposit'
  | 'withdrawal'
  | 'other';

const DIVIDEND_TYPES = new Set([
  'DIVIDEND',
  'DIV',
  'STOCK_DIVIDEND',
  'STOCKDIVIDEND',
  'CASH_DIVIDEND',
  'DIVIDENDREINVESTMENT',
]);
const INTEREST_TYPES = new Set([
  'INTEREST',
  'INT',
  'INTEREST_INCOME',
  'CREDIT_INTEREST',
]);
const DEPOSIT_TYPES = new Set([
  'CONTRIBUTION',
  'DEPOSIT',
  'FUNDING',
  'EXTERNAL_ASSET_TRANSFER_IN',
  'INTERNAL_CASH_TRANSFER_IN',
  'INTERNAL_ASSET_TRANSFER_IN',
  'TRANSFER_IN',
]);
const WITHDRAWAL_TYPES = new Set([
  'WITHDRAWAL',
  'WITHDRAW',
  'EXTERNAL_ASSET_TRANSFER_OUT',
  'INTERNAL_CASH_TRANSFER_OUT',
  'INTERNAL_ASSET_TRANSFER_OUT',
  'TRANSFER_OUT',
]);

/**
 * Buckets a broker activity type. Generic `TRANSFER` rows are split by the
 * sign of the amount because brokers do not always use directional types.
 */
export function classifyActivity(activity: NormalizedActivity): ActivityBucket {
  const type = (activity.type || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (DIVIDEND_TYPES.has(type)) return 'dividend';
  if (INTEREST_TYPES.has(type)) return 'interest';
  if (DEPOSIT_TYPES.has(type)) return 'deposit';
  if (WITHDRAWAL_TYPES.has(type)) return 'withdrawal';
  if (type === 'TRANSFER' || type === 'CASH') {
    if (activity.amount == null || activity.amount === 0) return 'other';
    return activity.amount > 0 ? 'deposit' : 'withdrawal';
  }
  return 'other';
}

/** `YYYY-MM` for a `YYYY-MM-DD` date, or null when the date is unusable. */
export function monthKey(date: string | null | undefined): string | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})/.exec(date);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** The last `months` month keys ending with the month containing `now`. */
export function recentMonths(months: number, now: Date): string[] {
  const keys: string[] = [];
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  for (let offset = months - 1; offset >= 0; offset--) {
    const date = new Date(Date.UTC(year, month - offset, 1));
    keys.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    );
  }
  return keys;
}

export type Convert = (amount: number, currency: string) => number | null;

export interface IncomeMonth {
  month: string;
  dividends: number;
  interest: number;
  total: number;
}

export interface IncomeSymbol {
  symbol: string;
  total: number;
  count: number;
}

export interface IncomeResult {
  ttmTotal: number;
  byMonth: IncomeMonth[];
  bySymbol: IncomeSymbol[];
  /** Rows we could not convert into the display currency. */
  unconvertedCount: number;
}

export function aggregateIncome(
  activities: NormalizedActivity[],
  months: number,
  now: Date,
  convert: Convert,
): IncomeResult {
  const keys = recentMonths(months, now);
  const window = new Set(keys);
  const byMonth = new Map<string, IncomeMonth>(
    keys.map((month) => [month, { month, dividends: 0, interest: 0, total: 0 }]),
  );
  const bySymbol = new Map<string, IncomeSymbol>();
  let unconvertedCount = 0;

  for (const activity of activities) {
    const bucket = classifyActivity(activity);
    if (bucket !== 'dividend' && bucket !== 'interest') continue;
    const key = monthKey(activity.date);
    if (!key || !window.has(key)) continue;
    if (activity.amount == null) continue;

    const value = convert(activity.amount, activity.currency);
    if (value == null) {
      unconvertedCount++;
      continue;
    }
    // Reinvestment legs come through as negative cash; income is the credit.
    if (value <= 0) continue;

    const row = byMonth.get(key)!;
    if (bucket === 'dividend') row.dividends += value;
    else row.interest += value;
    row.total += value;

    const symbol = activity.symbol || (bucket === 'interest' ? 'INTEREST' : 'UNKNOWN');
    const entry = bySymbol.get(symbol);
    if (entry) {
      entry.total += value;
      entry.count += 1;
    } else {
      bySymbol.set(symbol, { symbol, total: value, count: 1 });
    }
  }

  const monthRows = keys.map((key) => {
    const row = byMonth.get(key)!;
    return {
      month: row.month,
      dividends: round0(row.dividends),
      interest: round0(row.interest),
      total: round0(row.total),
    };
  });

  // TTM is the trailing twelve months inside the requested window.
  const ttmKeys = new Set(recentMonths(Math.min(12, months), now));
  const ttmTotal = monthRows
    .filter((row) => ttmKeys.has(row.month))
    .reduce((sum, row) => sum + row.total, 0);

  return {
    ttmTotal: round0(ttmTotal),
    byMonth: monthRows,
    bySymbol: Array.from(bySymbol.values())
      .map((entry) => ({ ...entry, total: round0(entry.total) }))
      .sort((a, b) => b.total - a.total),
    unconvertedCount,
  };
}

export interface FlowMonth {
  month: string;
  deposits: number;
  withdrawals: number;
  net: number;
}

export interface FlowResult {
  byMonth: FlowMonth[];
  netTotal: number;
  unconvertedCount: number;
}

export function aggregateFlows(
  activities: NormalizedActivity[],
  months: number,
  now: Date,
  convert: Convert,
): FlowResult {
  const keys = recentMonths(months, now);
  const window = new Set(keys);
  const byMonth = new Map<string, FlowMonth>(
    keys.map((month) => [month, { month, deposits: 0, withdrawals: 0, net: 0 }]),
  );
  let unconvertedCount = 0;

  for (const activity of activities) {
    const bucket = classifyActivity(activity);
    if (bucket !== 'deposit' && bucket !== 'withdrawal') continue;
    const key = monthKey(activity.date);
    if (!key || !window.has(key)) continue;
    if (activity.amount == null) continue;

    const value = convert(activity.amount, activity.currency);
    if (value == null) {
      unconvertedCount++;
      continue;
    }

    const row = byMonth.get(key)!;
    // Withdrawals are reported as positive magnitudes; `net` carries the sign.
    if (bucket === 'deposit') row.deposits += Math.abs(value);
    else row.withdrawals += Math.abs(value);
    row.net = row.deposits - row.withdrawals;
  }

  const monthRows = keys.map((key) => {
    const row = byMonth.get(key)!;
    return {
      month: row.month,
      deposits: round0(row.deposits),
      withdrawals: round0(row.withdrawals),
      net: round0(row.deposits - row.withdrawals),
    };
  });

  return {
    byMonth: monthRows,
    netTotal: round0(monthRows.reduce((sum, row) => sum + row.net, 0)),
    unconvertedCount,
  };
}

// ---------- series ----------

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface IndexedPoint {
  date: string;
  indexed: number;
}

/**
 * Rebases a series so the first point is 100.
 * Returns an empty array when the base is zero — a percentage change from
 * nothing is undefined, not infinite.
 */
export function indexToHundred(points: SeriesPoint[]): IndexedPoint[] {
  if (points.length === 0) return [];
  const base = points[0].value;
  if (!Number.isFinite(base) || base === 0) return [];
  return points.map((point) => ({
    date: point.date,
    indexed: round0((point.value / base) * 100, 4),
  }));
}

/** Total return of an indexed series, in percent. */
export function seriesReturnPercent(points: IndexedPoint[]): number | null {
  if (points.length < 2) return null;
  return round(points[points.length - 1].indexed - 100, 4);
}

export const RANGES = ['1m', '3m', '6m', '1y', 'all'] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: unknown, fallback: Range = '1y'): Range {
  return typeof value === 'string' && (RANGES as readonly string[]).includes(value)
    ? (value as Range)
    : fallback;
}

/** Inclusive start date (YYYY-MM-DD) for a range, or null for `all`. */
export function rangeStartDate(range: Range, now: Date): string | null {
  if (range === 'all') return null;
  const months = range === '1m' ? 1 : range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()),
  );
  return start.toISOString().slice(0, 10);
}

/**
 * Picks, for each portfolio date, the benchmark close on or before that date.
 * Markets close on different days than snapshots are taken, so exact-date
 * joins would silently drop points.
 */
export function alignSeries(
  dates: string[],
  closes: Array<{ date: string; close: number }>,
): SeriesPoint[] {
  if (dates.length === 0 || closes.length === 0) return [];
  const sorted = [...closes].sort((a, b) => a.date.localeCompare(b.date));
  const out: SeriesPoint[] = [];
  let cursor = 0;
  let last: number | null = null;
  for (const date of [...dates].sort((a, b) => a.localeCompare(b))) {
    while (cursor < sorted.length && sorted[cursor].date <= date) {
      last = sorted[cursor].close;
      cursor++;
    }
    if (last == null) continue;
    out.push({ date, value: last });
  }
  return out;
}

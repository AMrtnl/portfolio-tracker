import { useMemo } from 'react'
import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'
import axios from 'axios'
import { useDemo } from '@/wealth/DemoContext'
import {
  DEMO_CONCENTRATION_RES,
  DEMO_HOLDINGS_RES,
  DEMO_MOVERS_RES,
  demoAllocation,
  demoBenchmark,
  demoFlows,
  demoHistoryRes,
  demoIncome,
  demoOverview,
  demoNews,
  demoPriceHistory,
  demoQuote,
  demoTrades,
} from '@/wealth/demo'

/* ------------------------------------------------------------------ *
 * Wire types for /api/analytics/* and /api/market/*.
 *
 * Every field the server may omit is optional here. These endpoints are
 * young, and a missing key must degrade a single line of a panel rather
 * than throw the whole page away.
 * ------------------------------------------------------------------ */

/** Servers send either a bare string or a levelled object. Accept both. */
export type Warning = string | { level?: string; message: string }

export interface Envelope {
  warnings?: Warning[]
  retrievedAt?: string
}

export interface AnalyticsOverview extends Envelope {
  totalValue: number
  costBasis?: number | null
  unrealizedPnl?: number | null
  unrealizedPnlPercent?: number | null
  cashValue?: number | null
  cashPercent?: number | null
  investedValue?: number | null
  holdingsCount?: number
  accountsCount?: number
  dayChange?: number | null
  dayChangePercent?: number | null
  currency?: string
}

export type AllocationDimension =
  | 'assetClass'
  | 'sector'
  | 'region'
  | 'currency'
  | 'account'
  | 'institution'
  | 'symbol'

export interface AllocationSegment {
  key: string
  label: string
  value: number
  percent: number
  count?: number
}

export interface AllocationResponse extends Envelope {
  by: AllocationDimension
  segments: AllocationSegment[]
  unclassifiedValue?: number | null
  unclassifiedPercent?: number | null
}

export interface ConcentrationFlag {
  level: 'info' | 'warn' | 'high' | string
  message: string
}

export interface ConcentrationResponse extends Envelope {
  top: Array<{ symbol: string; label?: string; value: number; percent: number }>
  top5Percent?: number | null
  top10Percent?: number | null
  /** Herfindahl–Hirschman index over position weights. */
  hhi?: number | null
  /** 1 / HHI — how many equally sized positions this portfolio behaves like. */
  effectiveHoldings?: number | null
  flags?: ConcentrationFlag[]
}

export interface AnalyticsHolding {
  symbol: string
  name?: string
  units?: number | null
  price?: number | null
  marketValue: number
  currency?: string
  averageCost?: number | null
  costBasis?: number | null
  unrealizedPnl?: number | null
  unrealizedPnlPercent?: number | null
  weight?: number | null
  accountId?: string
  accountLabel?: string
  institution?: string
  assetClass?: string
  sector?: string
  industry?: string
  region?: string
  dayChange?: number | null
  dayChangePercent?: number | null
  quoteStale?: boolean
}

export interface HoldingsResponse extends Envelope {
  holdings: AnalyticsHolding[]
}

export interface IncomeMonth {
  month: string
  dividends?: number | null
  interest?: number | null
  total?: number | null
}

export interface IncomeResponse extends Envelope {
  ttmTotal?: number | null
  byMonth: IncomeMonth[]
  bySymbol?: Array<{ symbol: string; total: number; count?: number }>
  currency?: string
}

export interface FlowMonth {
  month: string
  deposits?: number | null
  withdrawals?: number | null
  net?: number | null
}

export interface FlowsResponse extends Envelope {
  byMonth: FlowMonth[]
  netTotal?: number | null
  currency?: string
}

export type HistoryRange = '1m' | '3m' | '6m' | '1y' | 'all'

export interface HistoryResponse extends Envelope {
  points: Array<{ date: string; value: number }>
  range?: HistoryRange
  /** When the very first daily snapshot was taken. */
  firstRecordedAt?: string | null
  /** True when the range asked for is longer than the recorded history. */
  isPartial?: boolean
  note?: string | null
  currency?: string
}

export type BenchmarkRange = '1m' | '3m' | '6m' | '1y'

export interface BenchmarkResponse extends Envelope {
  /** Both series are rebased to 100 at the start of the window. */
  portfolio: Array<{ date: string; indexed: number }>
  benchmark: Array<{ date: string; indexed: number }>
  symbol?: string
  portfolioReturnPercent?: number | null
  benchmarkReturnPercent?: number | null
  isPartial?: boolean
  note?: string | null
}

export interface Mover {
  symbol: string
  name?: string
  price?: number | null
  marketValue?: number | null
  dayChange?: number | null
  dayChangePercent?: number | null
}

export interface MoversResponse extends Envelope {
  gainers?: Mover[]
  losers?: Mover[]
}

export interface TradeFill {
  date: string
  side: 'buy' | 'sell'
  units: number
  price: number
  total: number
  accountLabel?: string
  currency?: string
}

export interface TradesResponse extends Envelope {
  trades: TradeFill[]
}

export interface NewsArticle {
  title: string
  publisher?: string
  link: string
  publishedAt?: string
  symbols?: string[]
}

export interface NewsResponse extends Envelope {
  articles: NewsArticle[]
}

export interface Quote extends Envelope {
  symbol: string
  name?: string
  price?: number | null
  currency?: string
  dayChange?: number | null
  dayChangePercent?: number | null
  marketCap?: number | null
  peRatio?: number | null
  fiftyTwoWeekHigh?: number | null
  fiftyTwoWeekLow?: number | null
  sector?: string
  industry?: string
  quoteStale?: boolean
}

export type PriceHistoryRange = '1m' | '3m' | '6m' | '1y' | '5y'

export interface PriceHistoryResponse extends Envelope {
  symbol: string
  yahooSymbol?: string
  range?: PriceHistoryRange | string
  currency?: string | null
  points: Array<{ date: string; close: number }>
  note?: string | null
}

/* ------------------------------------------------------------------ *
 * Query plumbing
 * ------------------------------------------------------------------ */

async function get<T>(path: string): Promise<T> {
  const { data } = await axios.get<T>(path)
  return data
}

/**
 * These endpoints are new, so a 404 means "not deployed yet" rather than
 * "try again". Fail fast and let the panel render its unavailable state.
 */
function analyticsQuery<T>(
  key: unknown[],
  path: string,
  extra?: Partial<UseQueryOptions<T>>,
) {
  return {
    queryKey: key,
    queryFn: () => get<T>(path),
    retry: 0,
    staleTime: 60_000,
    ...extra,
  } as UseQueryOptions<T>
}

/**
 * Sample-book fallback: when the sample household is on and the live
 * endpoint has nothing to show (or failed), hand the panel the demo
 * response instead. Live data always wins the moment it exists.
 */
function useSampled<T>(
  query: UseQueryResult<T>,
  isEmpty: (data: T | undefined) => boolean,
  make: () => T,
): UseQueryResult<T> {
  const { enabled } = useDemo()
  const useDemoData = enabled && !query.isLoading && (query.error != null || isEmpty(query.data))
  const data = useMemo(
    () => (useDemoData ? make() : query.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useDemoData, query.data],
  )
  if (!useDemoData) return query
  return { ...query, data, error: null, isError: false } as UseQueryResult<T>
}

export function useOverview() {
  const q = useQuery(
    analyticsQuery<AnalyticsOverview>(
      ['analytics', 'overview'],
      '/api/analytics/overview',
      { refetchInterval: 60_000 },
    ),
  )
  return useSampled(q, (d) => !d?.totalValue, demoOverview)
}

export function useAllocation(by: AllocationDimension) {
  const q = useQuery(
    analyticsQuery<AllocationResponse>(
      ['analytics', 'allocation', by],
      `/api/analytics/allocation?by=${by}`,
    ),
  )
  return useSampled(q, (d) => !d?.segments?.length, () => demoAllocation(by))
}

export function useConcentration() {
  const q = useQuery(
    analyticsQuery<ConcentrationResponse>(
      ['analytics', 'concentration'],
      '/api/analytics/concentration',
    ),
  )
  return useSampled(q, (d) => !d?.top?.length, () => DEMO_CONCENTRATION_RES)
}

export function useAnalyticsHoldings() {
  const q = useQuery(
    analyticsQuery<HoldingsResponse>(
      ['analytics', 'holdings'],
      '/api/analytics/holdings',
      { refetchInterval: 60_000 },
    ),
  )
  return useSampled(q, (d) => !d?.holdings?.length, () => DEMO_HOLDINGS_RES)
}

export function useIncome(months = 12) {
  const q = useQuery(
    analyticsQuery<IncomeResponse>(
      ['analytics', 'income', months],
      `/api/analytics/income?months=${months}`,
    ),
  )
  return useSampled(
    q,
    (d) =>
      !d?.byMonth?.some(
        (m) => (m.total ?? (m.dividends || 0) + (m.interest || 0)) > 0,
      ),
    () => demoIncome(months),
  )
}

export function useFlows(months = 12) {
  const q = useQuery(
    analyticsQuery<FlowsResponse>(
      ['analytics', 'flows', months],
      `/api/analytics/flows?months=${months}`,
    ),
  )
  return useSampled(
    q,
    (d) => !d?.byMonth?.some((m) => (m.deposits || 0) + (m.withdrawals || 0) > 0),
    () => demoFlows(months),
  )
}

export function useHistory(range: HistoryRange) {
  const q = useQuery(
    analyticsQuery<HistoryResponse>(
      ['analytics', 'history', range],
      `/api/analytics/history?range=${range}`,
    ),
  )
  return useSampled(q, (d) => (d?.points?.length ?? 0) < 8, () => demoHistoryRes(range))
}

export function useBenchmark(range: BenchmarkRange, symbol = 'SPY') {
  const q = useQuery(
    analyticsQuery<BenchmarkResponse>(
      ['analytics', 'benchmark', range, symbol],
      `/api/analytics/benchmark?range=${range}&symbol=${encodeURIComponent(symbol)}`,
    ),
  )
  return useSampled(q, (d) => !d?.portfolio?.length, () => demoBenchmark(range))
}

export function useMovers() {
  const q = useQuery(
    analyticsQuery<MoversResponse>(['market', 'movers'], '/api/market/movers', {
      refetchInterval: 120_000,
    }),
  )
  return useSampled(
    q,
    (d) => !(d?.gainers?.length || d?.losers?.length),
    () => DEMO_MOVERS_RES,
  )
}

export function useNews(limit = 20, symbol?: string) {
  const path = symbol
    ? `/api/market/news?limit=${limit}&symbol=${encodeURIComponent(symbol)}`
    : `/api/market/news?limit=${limit}`
  const q = useQuery(
    analyticsQuery<NewsResponse>(['market', 'news', limit, symbol ?? 'all'], path),
  )
  const demo = symbol ? demoNews(symbol.toUpperCase()) : undefined
  const sampled = useSampled(q, (d) => !d?.articles?.length, () => demo as NewsResponse)
  return demo ? sampled : q
}

/**
 * Broker fills for one symbol. There is no live endpoint for this yet —
 * the query 404s and, with the sample book on, the demo lots step in.
 * When /api/analytics/trades ships, live data wins automatically.
 */
export function useTrades(symbol: string | undefined) {
  const q = useQuery(
    analyticsQuery<TradesResponse>(
      ['analytics', 'trades', symbol ?? ''],
      `/api/analytics/trades?symbol=${encodeURIComponent(symbol ?? '')}`,
      { enabled: Boolean(symbol) },
    ),
  )
  const demo = symbol ? demoTrades(symbol.toUpperCase()) : undefined
  const sampled = useSampled(q, (d) => !d?.trades?.length, () => demo as TradesResponse)
  return demo ? sampled : q
}

export function useQuote(symbol: string | undefined) {
  const q = useQuery(
    analyticsQuery<Quote>(
      ['market', 'quote', symbol ?? ''],
      `/api/market/quote/${encodeURIComponent(symbol ?? '')}`,
      { enabled: Boolean(symbol) },
    ),
  )
  const demo = symbol ? demoQuote(symbol.toUpperCase()) : undefined
  const sampled = useSampled(q, (d) => d?.price == null, () => demo as Quote)
  // Only symbols the sample book actually holds get a sample quote.
  return demo ? sampled : q
}

export function usePriceHistory(
  symbol: string | undefined,
  range: PriceHistoryRange = '1y',
) {
  const q = useQuery(
    analyticsQuery<PriceHistoryResponse>(
      ['market', 'history', symbol ?? '', range],
      `/api/market/history/${encodeURIComponent(symbol ?? '')}?range=${range}`,
      { enabled: Boolean(symbol) },
    ),
  )
  const known = symbol ? demoQuote(symbol.toUpperCase()) != null : false
  const sampled = useSampled(
    q,
    (d) => (d?.points?.length ?? 0) < 3,
    () => demoPriceHistory(symbol!.toUpperCase(), range) as PriceHistoryResponse,
  )
  return known ? sampled : q
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Flattens the two accepted warning shapes to plain sentences. */
export function warningText(warnings?: Warning[]): string[] {
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((w) => (typeof w === 'string' ? w : w?.message))
    .filter((w): w is string => Boolean(w))
}

export const ALLOCATION_DIMENSIONS: Array<{
  value: AllocationDimension
  label: string
  /** What this cut is for, in one line. */
  caption: string
}> = [
  {
    value: 'assetClass',
    label: 'Asset class',
    caption: 'Equity, crypto, cash and fixed income as shares of the whole.',
  },
  {
    value: 'sector',
    label: 'Sector',
    caption: 'Which parts of the economy your equity exposure sits in.',
  },
  {
    value: 'region',
    label: 'Region',
    caption: 'Where the companies and assets you own are domiciled.',
  },
  {
    value: 'currency',
    label: 'Currency',
    caption: 'The currencies your value is denominated in before conversion.',
  },
  {
    value: 'account',
    label: 'Account',
    caption: 'How much of the total each connected account contributes.',
  },
]

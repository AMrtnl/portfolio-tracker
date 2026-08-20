/**
 * Sample household used to fill the book so the product can be judged with
 * a complete picture. Live accounts and ledger rows are kept; sample rows
 * are tagged with a `demo-` id and can be hidden from the header.
 */

import type { Account } from '@/hooks/useAccounts'
import type {
  CashflowMonth,
  CashflowResponse,
  MoneyCategory,
  MoneyTransaction,
  Subscription,
} from '@/hooks/useMoneyLedger'
import type {
  AllocationDimension,
  AllocationResponse,
  AllocationSegment,
  AnalyticsOverview,
  BenchmarkRange,
  BenchmarkResponse,
  ConcentrationResponse,
  FlowsResponse,
  HistoryRange,
  HistoryResponse,
  HoldingsResponse,
  IncomeResponse,
  MoversResponse,
  NewsResponse,
  PriceHistoryRange,
  PriceHistoryResponse,
  Quote,
  TradesResponse,
} from '@/hooks/useAnalytics'
import { GEO_COLORS, SECTOR_COLORS } from '@/wealth/tokens'

const SPEND_CATS: MoneyCategory[] = [
  { id: 'housing', name: 'Housing', color: '#FF9F45' },
  { id: 'insurance', name: 'Insurance', color: '#4BD57E' },
  { id: 'groceries', name: 'Groceries', color: '#FFD84D' },
  { id: 'subscriptions', name: 'Subscriptions', color: '#A57BFF' },
  { id: 'transport', name: 'Transport', color: '#3ABEFF' },
  { id: 'leisure', name: 'Leisure', color: '#FF5C48' },
  { id: 'other', name: 'Other', color: '#8E8E93' },
]

export const DEMO_PREFIX = 'demo-'

export function isDemoId(id: string | undefined): boolean {
  return Boolean(id?.startsWith(DEMO_PREFIX))
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthsBack(n: number): Date {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return d
}

const NOW = new Date()
const CREATED = ymd(NOW)

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: 'demo-cash-checking',
    label: 'UBS · Checking',
    type: 'bank',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'cash',
    institution: 'UBS',
    currency: 'USD',
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: 'Salary lands here',
    totalValueUsd: 42800,
  },
  {
    id: 'demo-cash-savings',
    label: 'UBS · Savings',
    type: 'bank',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'cash',
    institution: 'UBS',
    currency: 'USD',
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: 'Emergency buffer',
    totalValueUsd: 18400,
  },
  {
    id: 'demo-broker-ibkr',
    label: 'Interactive Brokers',
    type: 'broker',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'stocks',
    institution: 'IBKR',
    currency: 'USD',
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: 'Global equities',
    totalValueUsd: 186420,
    holdings: [
      { symbol: 'AAPL', name: 'Apple', quantity: 120, priceUsd: 228, assetClass: 'equity' },
      { symbol: 'NVDA', name: 'NVIDIA', quantity: 40, priceUsd: 118, assetClass: 'equity' },
      { symbol: 'NESN', name: 'Nestlé', quantity: 180, priceUsd: 92, assetClass: 'equity' },
      { symbol: 'VWCE', name: 'FTSE All-World', quantity: 220, priceUsd: 142, assetClass: 'etf' },
      { symbol: 'MSFT', name: 'Microsoft', quantity: 35, priceUsd: 428, assetClass: 'equity' },
    ],
  },
  {
    id: 'demo-pension-viac',
    label: 'VIAC · 3a',
    type: 'pension',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'pension',
    institution: 'VIAC',
    currency: 'USD',
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: 'Global 100 strategy',
    totalValueUsd: 94200,
  },
  {
    id: 'demo-estate-zh',
    label: 'Apartment · Zürich',
    type: 'estate',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'estate',
    institution: 'Home',
    currency: 'USD',
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: 'Owner-occupied',
    totalValueUsd: 1_120_000,
  },
  {
    id: 'demo-loan-mortgage',
    label: 'Mortgage · ZKB',
    type: 'loan',
    provider: 'manual',
    status: 'connected',
    kind: 'liability',
    bookClass: 'other',
    institution: 'ZKB',
    currency: 'USD',
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: '1.15% · 10y fixed',
    totalValueUsd: 640_000,
  },
]

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const SPEND_PATTERN: Array<{ category: string; note: string; amount: number; day: number }> = [
  { category: 'housing', note: 'Mortgage interest', amount: 1840, day: 1 },
  { category: 'insurance', note: 'CSS health', amount: 412, day: 3 },
  { category: 'groceries', note: 'Migros', amount: 620, day: 6 },
  { category: 'groceries', note: 'Coop', amount: 280, day: 18 },
  { category: 'transport', note: 'SBB travel', amount: 96, day: 8 },
  { category: 'subscriptions', note: 'Recurring stack', amount: 214, day: 12 },
  { category: 'leisure', note: 'Dinner / weekend', amount: 340, day: 15 },
  { category: 'leisure', note: 'Travel day', amount: 190, day: 22 },
  { category: 'other', note: 'Household', amount: 160, day: 20 },
]

export const DEMO_TRANSACTIONS: MoneyTransaction[] = (() => {
  const rows: MoneyTransaction[] = []
  for (let i = 5; i >= 0; i--) {
    const origin = monthsBack(i)
    const y = origin.getFullYear()
    const m = origin.getMonth()
    const jitter = ((m * 17 + y) % 7) - 3
    rows.push({
      id: `${DEMO_PREFIX}tx-sal-${y}-${m}`,
      date: ymd(new Date(y, m, 25)),
      kind: 'income',
      amount: 9800,
      category: 'salary',
      note: 'Salary',
      createdAt: CREATED,
    })
    if (m === 5 || m === 11) {
      rows.push({
        id: `${DEMO_PREFIX}tx-bonus-${y}-${m}`,
        date: ymd(new Date(y, m, 26)),
        kind: 'income',
        amount: 4200,
        category: 'bonus',
        note: 'Bonus',
        createdAt: CREATED,
      })
    }
    for (const s of SPEND_PATTERN) {
      const day = Math.min(28, s.day)
      rows.push({
        id: `${DEMO_PREFIX}tx-${s.category}-${y}-${m}-${s.day}`,
        date: ymd(new Date(y, m, day)),
        kind: 'spend',
        amount: Math.max(40, s.amount + jitter * (s.category === 'leisure' ? 18 : 6)),
        category: s.category,
        note: s.note,
        createdAt: CREATED,
      })
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date))
})()

export const DEMO_SUBSCRIPTIONS: Subscription[] = [
  { id: 'demo-sub-css', name: 'CSS', plan: 'Health insurance', amount: 412, cycle: 'monthly', day: 3, cat: 'essentials', createdAt: CREATED },
  { id: 'demo-sub-swisscom', name: 'Swisscom', plan: 'inOne M', amount: 79, cycle: 'monthly', day: 8, cat: 'telecom', createdAt: CREATED },
  { id: 'demo-sub-sbb', name: 'SBB GA', plan: '2nd class', amount: 3860, cycle: 'yearly', day: 1, month: 1, cat: 'transport', createdAt: CREATED },
  { id: 'demo-sub-netflix', name: 'Netflix', plan: 'Standard', amount: 18.9, cycle: 'monthly', day: 14, cat: 'media', createdAt: CREATED },
  { id: 'demo-sub-spotify', name: 'Spotify', plan: 'Individual', amount: 12.9, cycle: 'monthly', day: 19, cat: 'media', createdAt: CREATED },
  { id: 'demo-sub-icloud', name: 'iCloud+', plan: '200 GB', amount: 2.99, cycle: 'monthly', day: 11, cat: 'software', createdAt: CREATED },
  { id: 'demo-sub-fitness', name: 'Migros Fitness', plan: 'Club', amount: 89, cycle: 'monthly', day: 5, cat: 'essentials', createdAt: CREATED },
  { id: 'demo-sub-openai', name: 'ChatGPT', plan: 'Plus', amount: 20, cycle: 'monthly', day: 21, cat: 'software', createdAt: CREATED },
]

function monthBuckets(count: number): CashflowMonth[] {
  const buckets: CashflowMonth[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = monthsBack(i)
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth(),
      income: 0,
      spend: 0,
    })
  }
  return buckets
}

export function buildCashflow(
  transactions: MoneyTransaction[],
  months = 6,
): CashflowResponse {
  const buckets = monthBuckets(months)
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  const latest = buckets[buckets.length - 1]
  const spendByCat = new Map<string, number>()
  for (const t of transactions) {
    const bucket = byKey.get(t.date.slice(0, 7))
    if (!bucket) continue
    if (t.kind === 'income') bucket.income += t.amount
    else bucket.spend += t.amount
    if (t.kind === 'spend' && latest && t.date.slice(0, 7) === latest.key) {
      spendByCat.set(t.category, (spendByCat.get(t.category) || 0) + t.amount)
    }
  }
  const categories = [...spendByCat.entries()]
    .map(([id, amount]) => {
      const cat: MoneyCategory =
        SPEND_CATS.find((c) => c.id === id) ?? SPEND_CATS[SPEND_CATS.length - 1]
      return { id, name: cat.name, color: cat.color, amount }
    })
    .sort((a, b) => b.amount - a.amount)
  return {
    months: buckets,
    categories,
    hasActivity: transactions.length > 0,
    retrievedAt: new Date().toISOString(),
  }
}

export const DEMO_CASHFLOW = buildCashflow(DEMO_TRANSACTIONS, 6)

export function mergeAccounts(live: Account[] | undefined, enabled: boolean): Account[] {
  const real = live ?? []
  if (!enabled) return real.filter((a) => !isDemoId(a.id))
  const taken = new Set(real.filter((a) => !isDemoId(a.id)).map((a) => a.type))
  const extras = DEMO_ACCOUNTS.filter((a) => !taken.has(a.type))
  const demoIds = new Set(extras.map((a) => a.id))
  return [...real.filter((a) => !isDemoId(a.id) || demoIds.has(a.id)), ...extras.filter((a) => !real.some((r) => r.id === a.id))]
}

export function mergeTransactions(
  live: MoneyTransaction[] | undefined,
  enabled: boolean,
): MoneyTransaction[] {
  const real = (live ?? []).filter((t) => !isDemoId(t.id))
  if (!enabled) return real
  const ids = new Set(real.map((t) => t.id))
  return [...DEMO_TRANSACTIONS.filter((t) => !ids.has(t.id)), ...real].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
}

export function mergeSubscriptions(
  live: Subscription[] | undefined,
  enabled: boolean,
): Subscription[] {
  const real = (live ?? []).filter((s) => !isDemoId(s.id))
  if (!enabled) return real
  const names = new Set(real.map((s) => s.name.toLowerCase()))
  return [...real, ...DEMO_SUBSCRIPTIONS.filter((s) => !names.has(s.name.toLowerCase()))]
}

export function demoHistory(
  endValue: number,
  days: number,
): Array<{ date: string; value: number }> {
  const points: Array<{ date: string; value: number }> = []
  const start = endValue * 0.91
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const t = 1 - i / Math.max(days - 1, 1)
    const wave = Math.sin(t * Math.PI * 3.2) * endValue * 0.012
    const dip = Math.sin(t * Math.PI * 1.1) * endValue * 0.018
    points.push({ date: ymd(d), value: start + (endValue - start) * t + wave - dip })
  }
  if (points.length) points[points.length - 1].value = endValue
  return points
}

export const DEMO_DAY_CHANGE = 1840

export const DEMO_GEO: AllocationSegment[] = [
  { key: 'CH', label: 'Switzerland', value: 1_262_000, percent: 72 },
  { key: 'US', label: 'United States', value: 312_000, percent: 18 },
  { key: 'EU', label: 'Europe', value: 124_000, percent: 7 },
  { key: 'EM', label: 'Emerging', value: 52_000, percent: 3 },
].map((s) => ({ ...s, label: GEO_COLORS[s.key]?.name ?? s.label }))

export const DEMO_SECTOR: AllocationSegment[] = [
  { key: 'real_estate', label: 'Real estate', value: 1_120_000, percent: 64 },
  { key: 'technology', label: 'Technology', value: 198_000, percent: 11 },
  { key: 'financials', label: 'Financials', value: 86_000, percent: 5 },
  { key: 'consumer', label: 'Consumer', value: 74_000, percent: 4 },
  { key: 'healthcare', label: 'Healthcare', value: 41_000, percent: 2 },
  { key: 'other', label: 'Other', value: 242_000, percent: 14 },
].map((s) => ({
  ...s,
  label: SECTOR_COLORS[s.key]?.name ?? s.label,
}))

export const DEMO_MOVERS = {
  gainers: [{ symbol: 'NVDA', dayChangePercent: 2.4 }],
  losers: [{ symbol: 'NESN', dayChangePercent: -0.8 }],
}

export const DEMO_CONCENTRATION = {
  top: [{ symbol: 'ZRH', label: 'Apartment · Zürich', value: 1_120_000, percent: 64 }],
}

/* ------------------------------------------------------------------ *
 * Analytics endpoints, sample edition. Shapes mirror /api/analytics/*
 * so every panel renders the full product while the book is empty.
 * ------------------------------------------------------------------ */

const DEMO_GROSS = 1_461_820
const stamp = () => new Date().toISOString()

interface DemoPosition {
  symbol: string
  name: string
  units: number
  price: number
  cost: number
  sector: string
  region: string
  dayPct: number
  assetClass: string
}

const DEMO_POSITIONS: DemoPosition[] = [
  { symbol: 'VWCE', name: 'FTSE All-World', units: 220, price: 142, cost: 119, sector: 'other', region: 'global', dayPct: 0.4, assetClass: 'etf' },
  { symbol: 'AAPL', name: 'Apple', units: 120, price: 228, cost: 182, sector: 'technology', region: 'united states', dayPct: 0.6, assetClass: 'equity' },
  { symbol: 'NESN', name: 'Nestlé', units: 180, price: 92, cost: 97, sector: 'consumer defensive', region: 'switzerland', dayPct: -0.8, assetClass: 'equity' },
  { symbol: 'MSFT', name: 'Microsoft', units: 35, price: 428, cost: 338, sector: 'technology', region: 'united states', dayPct: 0.9, assetClass: 'equity' },
  { symbol: 'NVDA', name: 'NVIDIA', units: 40, price: 118, cost: 89, sector: 'technology', region: 'united states', dayPct: 2.4, assetClass: 'equity' },
]

export const DEMO_HOLDINGS_RES: HoldingsResponse = {
  holdings: DEMO_POSITIONS.map((p) => {
    const marketValue = p.units * p.price
    const costBasis = p.units * p.cost
    const pnl = marketValue - costBasis
    return {
      symbol: p.symbol,
      name: p.name,
      units: p.units,
      price: p.price,
      marketValue,
      currency: 'USD',
      averageCost: p.cost,
      costBasis,
      unrealizedPnl: pnl,
      unrealizedPnlPercent: (pnl / costBasis) * 100,
      weight: (marketValue / DEMO_GROSS) * 100,
      accountId: 'demo-broker-ibkr',
      accountLabel: 'Interactive Brokers',
      institution: 'IBKR',
      assetClass: p.assetClass,
      sector: p.sector,
      region: p.region,
      dayChange: marketValue * (p.dayPct / 100),
      dayChangePercent: p.dayPct,
    }
  }),
  retrievedAt: stamp(),
}

export function demoOverview(): AnalyticsOverview {
  const pnl = DEMO_HOLDINGS_RES.holdings.reduce((s, h) => s + (h.unrealizedPnl || 0), 0)
  const cost = DEMO_HOLDINGS_RES.holdings.reduce((s, h) => s + (h.costBasis || 0), 0)
  return {
    totalValue: DEMO_GROSS,
    costBasis: cost,
    unrealizedPnl: pnl,
    unrealizedPnlPercent: (pnl / cost) * 100,
    cashValue: 61_200,
    cashPercent: 4.2,
    investedValue: DEMO_GROSS - 61_200,
    holdingsCount: DEMO_POSITIONS.length,
    accountsCount: DEMO_ACCOUNTS.length,
    dayChange: DEMO_DAY_CHANGE,
    dayChangePercent: (DEMO_DAY_CHANGE / DEMO_GROSS) * 100,
    currency: 'USD',
    retrievedAt: stamp(),
  }
}

function seg(key: string, label: string, value: number): AllocationSegment {
  return { key, label, value, percent: (value / DEMO_GROSS) * 100 }
}

export function demoAllocation(by: AllocationDimension): AllocationResponse {
  let segments: AllocationSegment[]
  switch (by) {
    case 'assetClass':
      segments = [
        seg('real_estate', 'Real estate', 1_120_000),
        seg('equity', 'Stocks', 186_420),
        seg('pension', 'Pension', 94_200),
        seg('cash', 'Cash', 61_200),
      ]
      break
    case 'region':
      segments = DEMO_GEO
      break
    case 'sector':
      segments = DEMO_SECTOR
      break
    case 'currency':
      segments = [
        seg('CHF', 'Swiss franc', 1_138_000),
        seg('USD', 'US dollar', 292_620),
        seg('EUR', 'Euro', 31_200),
      ]
      break
    case 'institution':
      segments = [
        seg('home', 'Home', 1_120_000),
        seg('ibkr', 'IBKR', 186_420),
        seg('viac', 'VIAC', 94_200),
        seg('ubs', 'UBS', 61_200),
      ]
      break
    case 'symbol':
      segments = DEMO_HOLDINGS_RES.holdings.map((h) =>
        seg(h.symbol, h.name || h.symbol, h.marketValue),
      )
      break
    default:
      segments = DEMO_ACCOUNTS.filter((a) => a.kind !== 'liability').map((a) =>
        seg(a.id, a.label, a.totalValueUsd || 0),
      )
  }
  return { by, segments, retrievedAt: stamp() }
}

export const DEMO_CONCENTRATION_RES: ConcentrationResponse = {
  top: [
    { symbol: 'ZRH', label: 'Apartment · Zürich', value: 1_120_000, percent: 76.6 },
    { symbol: 'VWCE', label: 'FTSE All-World', value: 31_240, percent: 2.1 },
    { symbol: 'AAPL', label: 'Apple', value: 27_360, percent: 1.9 },
    { symbol: 'NESN', label: 'Nestlé', value: 16_560, percent: 1.1 },
    { symbol: 'MSFT', label: 'Microsoft', value: 14_980, percent: 1.0 },
  ],
  top5Percent: 82.7,
  top10Percent: 84.1,
  hhi: 0.6,
  effectiveHoldings: 1.7,
  flags: [
    { level: 'high', message: 'Over three quarters of the book sits in a single property.' },
    { level: 'info', message: 'Sample figures — connect accounts to see your own risk.' },
  ],
  retrievedAt: stamp(),
}

export function demoIncome(months = 12): IncomeResponse {
  const byMonth = []
  for (let i = months - 1; i >= 0; i--) {
    const d = monthsBack(i)
    const dividends = [2, 5, 8, 11].includes(d.getMonth()) ? 420 : 0
    const interest = 15
    byMonth.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      dividends,
      interest,
      total: dividends + interest,
    })
  }
  return {
    ttmTotal: byMonth.reduce((s, m) => s + (m.total || 0), 0),
    byMonth,
    bySymbol: [
      { symbol: 'NESN', total: 980, count: 4 },
      { symbol: 'VWCE', total: 700, count: 4 },
    ],
    currency: 'USD',
    retrievedAt: stamp(),
  }
}

export function demoFlows(months = 12): FlowsResponse {
  const byMonth = []
  for (let i = months - 1; i >= 0; i--) {
    const d = monthsBack(i)
    const deposits = 2_088
    const withdrawals = d.getMonth() === 6 ? 1_000 : 0
    byMonth.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      deposits,
      withdrawals,
      net: deposits - withdrawals,
    })
  }
  return {
    byMonth,
    netTotal: byMonth.reduce((s, m) => s + (m.net || 0), 0),
    currency: 'USD',
    retrievedAt: stamp(),
  }
}

const RANGE_TO_DAYS: Record<HistoryRange, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  all: 540,
}

export function demoHistoryRes(range: HistoryRange): HistoryResponse {
  return {
    points: demoHistory(DEMO_GROSS, RANGE_TO_DAYS[range] ?? 90),
    range,
    isPartial: false,
    currency: 'USD',
    retrievedAt: stamp(),
  }
}

export function demoBenchmark(range: BenchmarkRange): BenchmarkResponse {
  const days = RANGE_TO_DAYS[range] ?? 90
  const points = demoHistory(DEMO_GROSS, days)
  const start = points[0]?.value || 1
  const bmReturn = { '1m': 2.1, '3m': 4.8, '6m': 7.9, '1y': 11.2 }[range] ?? 4.8
  const portfolio = points.map((p) => ({
    date: p.date,
    indexed: (p.value / start) * 100,
  }))
  const benchmark = points.map((p, i) => {
    const t = i / Math.max(points.length - 1, 1)
    const wave = Math.sin(t * Math.PI * 2.6) * 0.7
    return { date: p.date, indexed: 100 + bmReturn * t + wave }
  })
  return {
    portfolio,
    benchmark,
    symbol: 'SPY',
    portfolioReturnPercent: (portfolio[portfolio.length - 1]?.indexed ?? 100) - 100,
    benchmarkReturnPercent: bmReturn,
    isPartial: false,
    retrievedAt: stamp(),
  }
}

/** Market color for each sample symbol: quote card + price chart personality. */
interface DemoMarket {
  name: string
  sector?: string
  industry?: string
  low52: number
  high52: number
  marketCap?: number
  peRatio?: number
  /** Total return over each chart range, in percent. */
  growth: Record<PriceHistoryRange, number>
}

export const DEMO_MARKET: Record<string, DemoMarket> = {
  AAPL: {
    name: 'Apple',
    sector: 'Technology',
    industry: 'Consumer electronics',
    low52: 164,
    high52: 237,
    marketCap: 3_400_000_000_000,
    peRatio: 34.8,
    growth: { '1m': 2, '3m': 6, '6m': 11, '1y': 24, '5y': 180 },
  },
  NVDA: {
    name: 'NVIDIA',
    sector: 'Technology',
    industry: 'Semiconductors',
    low52: 39,
    high52: 140,
    marketCap: 2_900_000_000_000,
    peRatio: 55.2,
    growth: { '1m': 8, '3m': 22, '6m': 45, '1y': 120, '5y': 900 },
  },
  MSFT: {
    name: 'Microsoft',
    sector: 'Technology',
    industry: 'Software',
    low52: 309,
    high52: 468,
    marketCap: 3_200_000_000_000,
    peRatio: 36.1,
    growth: { '1m': 1.5, '3m': 5, '6m': 9, '1y': 18, '5y': 140 },
  },
  NESN: {
    name: 'Nestlé',
    sector: 'Consumer defensive',
    industry: 'Packaged foods',
    low52: 84,
    high52: 108,
    marketCap: 240_000_000_000,
    peRatio: 19.3,
    growth: { '1m': -1, '3m': -3, '6m': -5, '1y': -8, '5y': 10 },
  },
  VWCE: {
    name: 'FTSE All-World',
    industry: 'Accumulating ETF',
    low52: 104,
    high52: 143,
    growth: { '1m': 1.2, '3m': 4, '6m': 8, '1y': 16, '5y': 70 },
  },
}

export function demoQuote(symbol: string): Quote | undefined {
  const m = DEMO_MARKET[symbol]
  const pos = DEMO_POSITIONS.find((p) => p.symbol === symbol)
  if (!m || !pos) return undefined
  return {
    symbol,
    name: m.name,
    price: pos.price,
    currency: 'USD',
    dayChange: pos.price * (pos.dayPct / 100),
    dayChangePercent: pos.dayPct,
    marketCap: m.marketCap ?? null,
    peRatio: m.peRatio ?? null,
    fiftyTwoWeekLow: m.low52,
    fiftyTwoWeekHigh: m.high52,
    sector: m.sector,
    industry: m.industry,
    retrievedAt: stamp(),
  }
}

const PRICE_RANGE_DAYS: Record<PriceHistoryRange, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '5y': 1825,
}

export function demoPriceHistory(
  symbol: string,
  range: PriceHistoryRange,
): PriceHistoryResponse | undefined {
  const m = DEMO_MARKET[symbol]
  const pos = DEMO_POSITIONS.find((p) => p.symbol === symbol)
  if (!m || !pos) return undefined
  const totalDays = PRICE_RANGE_DAYS[range]
  const step = range === '5y' ? 7 : 1
  const count = Math.floor(totalDays / step)
  const end = pos.price
  const start = end / (1 + m.growth[range] / 100)
  const points: Array<{ date: string; close: number }> = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * step)
    const t = 1 - i / Math.max(count - 1, 1)
    // Two incommensurate waves give the walk texture without randomness.
    const wobble =
      Math.sin(t * Math.PI * 5.3 + symbol.length) * end * 0.016 +
      Math.sin(t * Math.PI * 11.7) * end * 0.007
    points.push({
      date: ymd(d),
      close: Math.max(0.01, start + (end - start) * t + wobble),
    })
  }
  if (points.length) points[points.length - 1].close = end
  return {
    symbol,
    range,
    currency: 'USD',
    points,
    retrievedAt: stamp(),
  }
}

/**
 * Broker fills behind each sample position. Every symbol's lots sum
 * exactly to the position's units and cost basis, so the ledger, the
 * purchase history, and the P&L all tell the same story.
 */
const DEMO_LOTS: Record<
  string,
  Array<{ date: string; units: number; price: number }>
> = {
  AAPL: [
    { date: '2024-10-14', units: 40, price: 158 },
    { date: '2025-05-12', units: 40, price: 182 },
    { date: '2026-02-09', units: 40, price: 206 },
  ],
  NVDA: [
    { date: '2025-01-20', units: 15, price: 71 },
    { date: '2025-08-11', units: 10, price: 89 },
    { date: '2026-03-16', units: 15, price: 107 },
  ],
  NESN: [
    { date: '2024-11-18', units: 60, price: 103 },
    { date: '2025-06-09', units: 60, price: 97 },
    { date: '2026-01-12', units: 60, price: 91 },
  ],
  MSFT: [
    { date: '2024-12-02', units: 12, price: 300 },
    { date: '2025-07-07', units: 11, price: 338 },
    { date: '2026-03-02', units: 12, price: 376 },
  ],
  VWCE: [
    { date: '2024-10-07', units: 80, price: 104 },
    { date: '2025-06-02', units: 60, price: 119 },
    { date: '2026-04-06', units: 80, price: 134 },
  ],
}

export function demoTrades(symbol: string): TradesResponse | undefined {
  const lots = DEMO_LOTS[symbol]
  if (!lots) return undefined
  return {
    trades: [...lots]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((l) => ({
        date: l.date,
        side: 'buy' as const,
        units: l.units,
        price: l.price,
        total: l.units * l.price,
        accountLabel: 'Interactive Brokers',
        currency: 'USD',
      })),
    retrievedAt: stamp(),
  }
}

const DEMO_HEADLINES: Record<
  string,
  Array<{ title: string; hoursAgo: number }>
> = {
  AAPL: [
    { title: 'Apple lines up its autumn hardware event as services revenue keeps climbing', hoursAgo: 5 },
    { title: 'Analysts split on whether the iPhone upgrade cycle has one more leg', hoursAgo: 26 },
    { title: 'Apple expands its Swiss retail footprint with a refreshed Zürich flagship', hoursAgo: 70 },
  ],
  NVDA: [
    { title: 'NVIDIA data-center demand still outruns supply, say channel checks', hoursAgo: 3 },
    { title: 'Hyperscalers signal another year of accelerated AI capital spending', hoursAgo: 22 },
    { title: 'NVIDIA rally broadens as networking revenue surprises to the upside', hoursAgo: 55 },
  ],
  NESN: [
    { title: 'Nestlé leans on pricing as volumes stay soft across Europe', hoursAgo: 8 },
    { title: 'Swiss consumer staples lag the market as investors rotate into growth', hoursAgo: 30 },
    { title: 'Nestlé outlines coffee and pet-care push in strategy update', hoursAgo: 76 },
  ],
  MSFT: [
    { title: 'Microsoft cloud growth steadies as Copilot seats ramp in the enterprise', hoursAgo: 6 },
    { title: 'Azure capacity buildout keeps capex elevated for another quarter', hoursAgo: 28 },
    { title: 'Microsoft and OpenAI extend their partnership terms', hoursAgo: 60 },
  ],
  VWCE: [
    { title: 'Global equities grind higher as rate-cut expectations firm up', hoursAgo: 4 },
    { title: 'Fund flows: accumulating world ETFs take in another record month', hoursAgo: 24 },
    { title: 'What a strong dollar means for globally diversified portfolios', hoursAgo: 50 },
  ],
}

export function demoNews(symbol: string): NewsResponse | undefined {
  const rows = DEMO_HEADLINES[symbol]
  const name = DEMO_MARKET[symbol]?.name ?? symbol
  if (!rows) return undefined
  return {
    articles: rows.map((r) => {
      const d = new Date()
      d.setHours(d.getHours() - r.hoursAgo)
      return {
        title: r.title,
        publisher: 'Sample wire',
        link: `https://news.google.com/search?q=${encodeURIComponent(`${name} stock`)}`,
        publishedAt: d.toISOString(),
        symbols: [symbol],
      }
    }),
    retrievedAt: stamp(),
  }
}

/** Every sample symbol's headlines merged into one feed, newest first. */
export function demoNewsFeed(limit = 8): NewsResponse {
  const all = Object.keys(DEMO_HEADLINES).flatMap(
    (sym) => demoNews(sym)?.articles ?? [],
  )
  all.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  return { articles: all.slice(0, limit), retrievedAt: stamp() }
}

export const DEMO_MOVERS_RES: MoversResponse = {
  gainers: [
    { symbol: 'NVDA', name: 'NVIDIA', price: 118, marketValue: 4_720, dayChange: 111, dayChangePercent: 2.4 },
    { symbol: 'MSFT', name: 'Microsoft', price: 428, marketValue: 14_980, dayChange: 133, dayChangePercent: 0.9 },
    { symbol: 'AAPL', name: 'Apple', price: 228, marketValue: 27_360, dayChange: 163, dayChangePercent: 0.6 },
  ],
  losers: [
    { symbol: 'NESN', name: 'Nestlé', price: 92, marketValue: 16_560, dayChange: -134, dayChangePercent: -0.8 },
  ],
  retrievedAt: stamp(),
}

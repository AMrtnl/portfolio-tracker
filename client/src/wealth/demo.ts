/**
 * Sample household used to fill the book so the product can be judged with
 * a complete picture. Live accounts and ledger rows are kept; sample rows
 * are tagged with a `demo-` id and can be hidden from the header.
 *
 * Every figure comes from the handoff fixture (wh/fixtures/demo-data.json),
 * which is internally consistent: accounts sum to the assets, holdings sum
 * to their accounts, cash matches the cash-flow position, and the Grow
 * opportunities quote the same numbers. Months are anchored to today, so
 * the last month that happened is the current one.
 */

import type { Account, Holding } from '@/hooks/useAccounts'
import type { Goal } from '@/hooks/useGoals'
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
import { FIXTURE } from '@/wh/model/fixture'

const SPEND_CATS: MoneyCategory[] = [
  { id: 'housing', name: 'Housing', color: '#FF9F45' },
  { id: 'tax', name: 'Tax provision', color: '#8E8E93' },
  { id: 'insurance', name: 'Insurance', color: '#4BD57E' },
  { id: 'groceries', name: 'Food', color: '#FFD84D' },
  { id: 'subscriptions', name: 'Subscriptions', color: '#A57BFF' },
  { id: 'transport', name: 'Transport', color: '#3ABEFF' },
  { id: 'leisure', name: 'Leisure', color: '#FF5C48' },
  { id: 'other', name: 'Other', color: '#8E8E93' },
]

export const DEMO_PREFIX = 'demo-'

export function isDemoId(id: string | undefined): boolean {
  return Boolean(id?.startsWith(DEMO_PREFIX))
}

/** The fixture's ledger currency. Every sample figure is in it. */
export const DEMO_CURRENCY = FIXTURE.currency

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

/** "2 min", "1 h", "3 d" from the fixture into a timestamp that far back. */
function freshAgo(fresh?: string): string | undefined {
  const m = fresh?.match(/(\d+)\s*(min|h|d)/)
  if (!m) return undefined
  const n = Number(m[1])
  const minutes = m[2] === 'min' ? n : m[2] === 'h' ? n * 60 : n * 1440
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

const F = FIXTURE
const fx = (name: string) => F.accounts.find((a) => a.name === name)!
const fh = (name: string) => F.holdings.find((h) => h.name === name)!

/** A holding whose quantity times price is exactly the fixture value. */
function lot(symbol: string, name: string, quantity: number, value: number, assetClass: Holding['assetClass']): Holding {
  return { symbol, name, quantity, priceUsd: value / quantity, assetClass }
}
const cashLot = (value: number): Holding => ({ symbol: DEMO_CURRENCY, name: 'Cash', quantity: value, priceUsd: 1, assetClass: 'cash' })

export const DEMO_ACCOUNT_IDS = {
  apartment: 'demo-property-apartment',
  ibkr: 'demo-broker-ibkr',
  ubs: 'demo-bank-ubs',
  pillar3a: 'demo-pension-3a',
  ledger: 'demo-wallet-ledger',
  revolut: 'demo-bank-revolut',
  mortgage: 'demo-loan-mortgage',
  car: 'demo-loan-car',
} as const

/** Symbols the sample positions trade under. Funds without a public ticker get a house code. */
export const DEMO_SYMBOLS = {
  allWorld: 'VWCE',
  ubsFund: 'UBSSF',
  spi: 'CHSPI',
  apple: 'AAPL',
  nestle: 'NESN',
  bitcoin: 'BTC',
  ether: 'ETH',
} as const

const IBKR_CASH = fx('Interactive Brokers').value - fh('Vanguard FTSE All-World').value - fh('iShares SPI').value - fh('Apple').value
const UBS_CASH = fx('UBS').value - fh('UBS Strategy Fund').value - fh('Nestle').value

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: DEMO_ACCOUNT_IDS.apartment,
    label: 'Apartment',
    type: 'estate',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'estate',
    institution: 'Home',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: '2026-03-02T09:00:00.000Z',
    notes: 'Property, by hand',
    totalValueUsd: fx('Apartment').value,
  },
  {
    id: DEMO_ACCOUNT_IDS.ibkr,
    label: 'Interactive Brokers',
    type: 'broker',
    provider: 'snaptrade',
    status: 'connected',
    kind: 'asset',
    bookClass: 'stocks',
    institution: 'Interactive Brokers',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: freshAgo(fx('Interactive Brokers').fresh),
    notes: 'Brokerage',
    totalValueUsd: fx('Interactive Brokers').value,
    holdings: [
      lot(DEMO_SYMBOLS.allWorld, 'Vanguard FTSE All-World', 1400, fh('Vanguard FTSE All-World').value, 'etf'),
      lot(DEMO_SYMBOLS.spi, 'iShares SPI', 600, fh('iShares SPI').value, 'etf'),
      lot(DEMO_SYMBOLS.apple, 'Apple', 410, fh('Apple').value, 'equity'),
      cashLot(IBKR_CASH),
    ],
  },
  {
    id: DEMO_ACCOUNT_IDS.ubs,
    label: 'UBS',
    type: 'bank',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'cash',
    institution: 'UBS',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: freshAgo(fx('UBS').fresh),
    notes: 'Accounts and funds',
    totalValueUsd: fx('UBS').value,
    holdings: [
      lot(DEMO_SYMBOLS.ubsFund, 'UBS Strategy Fund', 500, fh('UBS Strategy Fund').value, 'etf'),
      lot(DEMO_SYMBOLS.nestle, 'Nestle', 500, fh('Nestle').value, 'equity'),
      cashLot(UBS_CASH),
    ],
  },
  {
    id: DEMO_ACCOUNT_IDS.pillar3a,
    label: 'Pillar 3a',
    type: 'pension',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'pension',
    institution: 'Pillar 3a',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    notes: 'Pension',
    totalValueUsd: fx('Pillar 3a').value,
  },
  {
    id: DEMO_ACCOUNT_IDS.ledger,
    label: 'Ledger',
    type: 'crypto_wallet',
    provider: 'watch',
    chain: 'btc',
    status: 'connected',
    kind: 'asset',
    bookClass: 'crypto',
    institution: 'Ledger',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: freshAgo(fx('Ledger').fresh),
    maskedIdentifier: 'bc1q9h7…k4m2',
    notes: 'Hardware wallet, read-only',
    totalValueUsd: fx('Ledger').value,
    holdings: [lot(DEMO_SYMBOLS.bitcoin, 'Bitcoin', 0.62, fh('Bitcoin').value, 'crypto'), lot(DEMO_SYMBOLS.ether, 'Ethereum', 10.4, fh('Ethereum').value, 'crypto')],
  },
  {
    id: DEMO_ACCOUNT_IDS.revolut,
    label: 'Revolut',
    type: 'bank',
    provider: 'manual',
    status: 'connected',
    kind: 'asset',
    bookClass: 'cash',
    institution: 'Revolut',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: freshAgo('4 h'),
    notes: 'Everyday account',
    totalValueUsd: fx('Revolut').value,
    holdings: [cashLot(fx('Revolut').value)],
  },
  {
    id: DEMO_ACCOUNT_IDS.mortgage,
    label: 'Mortgage',
    type: 'loan',
    provider: 'manual',
    status: 'connected',
    kind: 'liability',
    bookClass: 'other',
    institution: 'UBS',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: fx('Mortgage').note ?? 'Mortgage',
    totalValueUsd: Math.abs(fx('Mortgage').value),
  },
  {
    id: DEMO_ACCOUNT_IDS.car,
    label: 'Car loan',
    type: 'loan',
    provider: 'manual',
    status: 'connected',
    kind: 'liability',
    bookClass: 'other',
    currency: DEMO_CURRENCY,
    createdAt: CREATED,
    lastSyncedAt: CREATED,
    notes: 'Car loan',
    totalValueUsd: Math.abs(fx('Car loan').value),
  },
]

/** Twelve-month change per sample account, which no live source reports yet. */
export const DEMO_ACCOUNT_CHANGE_12M: Record<string, number> = {
  [DEMO_ACCOUNT_IDS.ibkr]: fx('Interactive Brokers').change12m ?? 0,
  [DEMO_ACCOUNT_IDS.ubs]: fx('UBS').change12m ?? 0,
  [DEMO_ACCOUNT_IDS.pillar3a]: fx('Pillar 3a').change12m ?? 0,
  [DEMO_ACCOUNT_IDS.ledger]: fx('Ledger').change12m ?? 0,
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Where a month goes, from the fixture's September, by category id. */
const SPEND_SHAPE: Array<{ id: string; note: string; day: number; amount: number }> = [
  { id: 'housing', note: 'Rent and charges', day: 1, amount: F.cashflow.september.Housing },
  { id: 'tax', note: 'Tax provision', day: 2, amount: F.cashflow.september['Tax provision'] },
  { id: 'groceries', note: 'Food', day: 6, amount: F.cashflow.september.Food },
  { id: 'leisure', note: 'Leisure', day: 15, amount: F.cashflow.september.Leisure },
  { id: 'insurance', note: 'Insurance', day: 3, amount: F.cashflow.september.Insurance },
  { id: 'transport', note: 'Transport', day: 8, amount: F.cashflow.september.Transport },
  { id: 'subscriptions', note: 'Subscriptions', day: 12, amount: F.cashflow.september.Subscriptions },
  { id: 'other', note: 'Household', day: 20, amount: F.cashflow.september.Other },
]
const SHAPE_TOTAL = SPEND_SHAPE.reduce((s, c) => s + c.amount, 0)
const SALARY = 9200

/** Months that happened: the fixture's actual months, the last one being now. */
export const DEMO_ACTUAL_MONTHS = F.cashflow.forecastFromIndex

export const DEMO_TRANSACTIONS: MoneyTransaction[] = (() => {
  const rows: MoneyTransaction[] = []
  const n = DEMO_ACTUAL_MONTHS
  for (let k = 0; k < n; k++) {
    const origin = monthsBack(n - 1 - k)
    const y = origin.getFullYear()
    const m = origin.getMonth()
    const income = F.cashflow.in[k]
    const out = F.cashflow.out[k]
    rows.push({ id: `${DEMO_PREFIX}tx-salary-${y}-${m}`, date: ymd(new Date(y, m, 25)), kind: 'income', amount: SALARY, category: 'salary', note: 'Salary', createdAt: CREATED })
    if (income > SALARY) {
      const extra = income - SALARY
      rows.push({
        id: `${DEMO_PREFIX}tx-extra-${y}-${m}`,
        date: ymd(new Date(y, m, 26)),
        kind: 'income',
        amount: extra,
        category: extra >= 1000 ? 'bonus' : 'other-income',
        note: extra >= 1000 ? 'Bonus' : 'Expense refund',
        createdAt: CREATED,
      })
    }
    let placed = 0
    SPEND_SHAPE.forEach((c, i) => {
      const last = i === SPEND_SHAPE.length - 1
      const amount = last ? Math.round((out - placed) * 100) / 100 : Math.round((out * c.amount) / SHAPE_TOTAL)
      placed += amount
      rows.push({ id: `${DEMO_PREFIX}tx-${c.id}-${y}-${m}`, date: ymd(new Date(y, m, c.day)), kind: 'spend', amount, category: c.id, note: c.note, createdAt: CREATED })
    })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date))
})()

/** "2014" or "Feb 2026" into the first of that month. */
function sinceIso(since: string): string {
  const m = since.match(/^([A-Z][a-z]{2})\s+(\d{4})$/)
  if (m) return `${m[2]}-${String(MONTH_LABELS.indexOf(m[1]) + 1).padStart(2, '0')}-01`
  return `${since}-01-01`
}

/** Renewal day from "2 Oct"; a subscription with a flag and no date renews mid-month. */
function renewalDay(next?: string): number {
  const m = next?.match(/(\d{1,2})\s+[A-Z][a-z]{2}/)
  return m ? Number(m[1]) : 15
}

const SUB_KIND: Record<string, string> = {
  Swisscom: 'telecom',
  Gym: 'health',
  Netflix: 'media',
  'YouTube Premium': 'media',
  Claude: 'software',
  Spotify: 'media',
  'iCloud+': 'software',
  Notion: 'software',
}

export const DEMO_SUBSCRIPTIONS: Subscription[] = F.subscriptions.items.map((s) => ({
  id: `${DEMO_PREFIX}sub-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name: s.name,
  plan: s.plan,
  amount: s.price,
  cycle: 'monthly' as const,
  day: renewalDay(s.next),
  cat: SUB_KIND[s.name] ?? 'software',
  createdAt: sinceIso(s.since),
}))

/** Sample facts no ledger row carries: what the fixture says beside each subscription. */
export const DEMO_SUBSCRIPTION_NOTES: Record<string, { since: string; next?: string; flag?: string }> = Object.fromEntries(
  F.subscriptions.items.map((s) => [s.name, { since: s.since, next: s.next, flag: s.flag }]),
)
export const DEMO_SUBSCRIPTION_HISTORY = F.subscriptions.history12m
export const DEMO_SUBSCRIPTION_ALERTS = F.subscriptions.alerts

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

export function buildCashflow(transactions: MoneyTransaction[], months = 6): CashflowResponse {
  const buckets = monthBuckets(months)
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  const latest = buckets[buckets.length - 1]
  const spendByCat = new Map<string, number>()
  const windowByCat = new Map<string, number>()
  for (const t of transactions) {
    const bucket = byKey.get(t.date.slice(0, 7))
    if (!bucket) continue
    if (t.kind === 'income') bucket.income += t.amount
    else bucket.spend += t.amount
    if (t.kind === 'spend') {
      windowByCat.set(t.category, (windowByCat.get(t.category) || 0) + t.amount)
      if (latest && t.date.slice(0, 7) === latest.key) {
        spendByCat.set(t.category, (spendByCat.get(t.category) || 0) + t.amount)
      }
    }
  }
  const averages: Record<string, number> = {}
  for (const [id, total] of windowByCat) averages[id] = total / months
  const categories = [...spendByCat.entries()]
    .map(([id, amount]) => {
      const cat: MoneyCategory = SPEND_CATS.find((c) => c.id === id) ?? SPEND_CATS[SPEND_CATS.length - 1]
      return { id, name: cat.name, color: cat.color, amount }
    })
    .sort((a, b) => b.amount - a.amount)
  return {
    months: buckets,
    categories,
    averages,
    hasActivity: transactions.length > 0,
    retrievedAt: new Date().toISOString(),
  }
}

export const DEMO_CASHFLOW = buildCashflow(DEMO_TRANSACTIONS, DEMO_ACTUAL_MONTHS)

/** The fixture's cash position by month and its three forecast months. */
export const DEMO_CASH_POSITION = F.cashflow.cashPosition
export const DEMO_FORECAST = {
  months: F.cashflow.months.slice(F.cashflow.forecastFromIndex),
  in: F.cashflow.in.slice(F.cashflow.forecastFromIndex),
  out: F.cashflow.out.slice(F.cashflow.forecastFromIndex),
}

/** Three goals in different states: behind, on track, and open-ended. */
export const DEMO_GOALS: Goal[] = (() => {
  const now = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const created = new Date(now.getFullYear(), now.getMonth() - 4, 12).toISOString()
  return [
    {
      id: 'demo-goal-emergency',
      name: 'Emergency fund',
      targetAmount: 40000,
      targetDate: iso(new Date(now.getFullYear(), now.getMonth() + 10, 1)),
      accountIds: [DEMO_ACCOUNT_IDS.revolut],
      monthlyContribution: 800,
      expectedReturn: 0.01,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: 'demo-goal-home',
      name: 'Second property deposit',
      targetAmount: 250000,
      targetDate: iso(new Date(now.getFullYear() + 3, 5, 1)),
      accountIds: [DEMO_ACCOUNT_IDS.ibkr],
      monthlyContribution: 1500,
      expectedReturn: 0.05,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: 'demo-goal-sabbatical',
      name: 'Sabbatical year',
      targetAmount: 60000,
      accountIds: [DEMO_ACCOUNT_IDS.ubs],
      monthlyContribution: 400,
      expectedReturn: 0,
      createdAt: created,
      updatedAt: created,
    },
  ]
})()

export function mergeGoals(live: Goal[] | undefined, enabled: boolean): Goal[] {
  const real = (live ?? []).filter((g) => !isDemoId(g.id))
  if (!enabled) return real
  const names = new Set(real.map((g) => g.name.toLowerCase()))
  return [...real, ...DEMO_GOALS.filter((g) => !names.has(g.name.toLowerCase()))]
}

/** What the recurring-charge detector would surface for the sample household. */
export function demoRecurringSuggestions() {
  const d = new Date()
  const iso = (monthsAgo: number, day: number) => {
    const x = new Date(d.getFullYear(), d.getMonth() - monthsAgo, day)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return [
    {
      key: 'zurich versicherung|quarterly',
      name: 'Zürich Versicherung',
      amount: 312,
      cycle: 'quarterly' as const,
      day: 1,
      month: d.getMonth(),
      cat: 'essentials',
      category: 'insurance',
      occurrences: 3,
      firstDate: iso(6, 1),
      lastDate: iso(0, 1),
    },
    {
      key: 'adobe creative cloud|monthly',
      name: 'Adobe Creative Cloud',
      amount: 62.9,
      cycle: 'monthly' as const,
      day: 17,
      cat: 'software',
      category: 'subscriptions',
      occurrences: 4,
      firstDate: iso(3, 17),
      lastDate: iso(0, 17),
    },
  ]
}

export function mergeAccounts(live: Account[] | undefined, enabled: boolean): Account[] {
  const real = live ?? []
  if (!enabled) return real.filter((a) => !isDemoId(a.id))
  const taken = new Set(real.filter((a) => !isDemoId(a.id)).map((a) => a.type))
  const extras = DEMO_ACCOUNTS.filter((a) => !taken.has(a.type))
  const demoIds = new Set(extras.map((a) => a.id))
  return [...real.filter((a) => !isDemoId(a.id) || demoIds.has(a.id)), ...extras.filter((a) => !real.some((r) => r.id === a.id))]
}

export function mergeTransactions(live: MoneyTransaction[] | undefined, enabled: boolean): MoneyTransaction[] {
  const real = (live ?? []).filter((t) => !isDemoId(t.id))
  if (!enabled) return real
  const ids = new Set(real.map((t) => t.id))
  return [...DEMO_TRANSACTIONS.filter((t) => !ids.has(t.id)), ...real].sort((a, b) => b.date.localeCompare(a.date))
}

export function mergeSubscriptions(live: Subscription[] | undefined, enabled: boolean): Subscription[] {
  const real = (live ?? []).filter((s) => !isDemoId(s.id))
  if (!enabled) return real
  const names = new Set(real.map((s) => s.name.toLowerCase()))
  return [...real, ...DEMO_SUBSCRIPTIONS.filter((s) => !names.has(s.name.toLowerCase()))]
}

/** A calm net-worth curve that ends exactly on the value given and starts `growthPct` lower. */
export function demoHistory(endValue: number, days: number, growthPct = 9): Array<{ date: string; value: number }> {
  const points: Array<{ date: string; value: number }> = []
  const start = endValue / (1 + growthPct / 100)
  const span = Math.abs(endValue - start) || endValue * 0.02
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const t = 1 - i / Math.max(days - 1, 1)
    // Gentle undulation that fades out towards today, so the line settles on the real figure.
    const wave = Math.sin(t * Math.PI * 3.2) * span * 0.16 * (1 - t)
    const dip = Math.sin(t * Math.PI * 1.1) * span * 0.22 * (1 - t)
    points.push({ date: ymd(d), value: start + (endValue - start) * t + wave - dip })
  }
  if (points.length) points[points.length - 1].value = endValue
  return points
}

export const DEMO_NET_WORTH = F.netWorth
export const DEMO_GROSS = F.assets
export const DEMO_LIABILITIES = F.liabilities
export const DEMO_CHANGE_12M = F.change12m
export const DEMO_YTD = F.ytd
export const DEMO_DAY_CHANGE = 1_840

const INVESTED = F.holdings.filter((h) => h.class?.startsWith('Fund') || h.class === 'Equity').reduce((s, h) => s + h.value, 0)

const COUNTRY_KEYS: Record<string, string> = {
  Switzerland: 'CH',
  'United States': 'US',
  Eurozone: 'EU',
  Japan: 'JP',
  'United Kingdom': 'UK',
  'Emerging markets': 'EM',
  Other: 'other',
}

const SECTOR_KEYS: Record<string, string> = {
  Technology: 'technology',
  Financials: 'financials',
  'Health care': 'healthcare',
  Industrials: 'industrials',
  'Consumer staples': 'consumer defensive',
  'Consumer discretionary': 'consumer cyclical',
  Energy: 'energy',
  Other: 'other',
}

const pctSeg = (key: string, label: string, percent: number, base: number): AllocationSegment => ({ key, label, value: Math.round((base * percent) / 100), percent })

export const DEMO_GEO: AllocationSegment[] = F.exposure.country.map(([label, pct]) => pctSeg(COUNTRY_KEYS[label] ?? label.toLowerCase(), label, pct, INVESTED))
export const DEMO_SECTOR: AllocationSegment[] = F.exposure.sector.map(([label, pct]) => pctSeg(SECTOR_KEYS[label] ?? label.toLowerCase(), label, pct, INVESTED))
export const DEMO_CURRENCY_MIX: AllocationSegment[] = F.exposure.currency.map(([label, pct]) => pctSeg(label, label, pct, F.assets))
export const DEMO_EXPOSURE_INSIGHT = F.exposure.insight

export const DEMO_MOVERS = {
  gainers: [{ symbol: DEMO_SYMBOLS.bitcoin, dayChangePercent: 2.4 }],
  losers: [{ symbol: DEMO_SYMBOLS.apple, dayChangePercent: -0.8 }],
}

export const DEMO_CONCENTRATION = {
  top: [{ symbol: 'HOME', label: 'Apartment', value: fx('Apartment').value, percent: fx('Apartment').share ?? 0 }],
}

/* ------------------------------------------------------------------ *
 * Analytics endpoints, sample edition. Shapes mirror /api/analytics/*
 * so every panel renders the full product while the book is empty.
 * ------------------------------------------------------------------ */

const stamp = () => new Date().toISOString()

interface DemoPosition {
  symbol: string
  name: string
  accountId: string
  accountLabel: string
  institution: string
  units: number
  value: number
  costPct: number
  sector: string
  region: string
  currency: string
  change: number
  assetClass: string
  classLabel: string
  ter?: number
  note?: string
}

const pos = (symbol: string, name: string, accountId: string, accountLabel: string, institution: string, units: number, costPct: number, extra: Partial<DemoPosition> = {}): DemoPosition => {
  const h = fh(name)
  return {
    symbol,
    name,
    accountId,
    accountLabel,
    institution,
    units,
    value: h.value,
    costPct,
    sector: (h.sector ?? '').toLowerCase() || 'other',
    region: (h.country ?? 'World').toLowerCase(),
    currency: h.currency ?? DEMO_CURRENCY,
    change: h.change ?? 0,
    assetClass: h.class?.startsWith('Fund') ? 'etf' : h.class === 'Equity' ? 'equity' : 'crypto',
    classLabel: h.class ?? 'Crypto',
    ter: h.ter,
    note: h.units,
    ...extra,
  }
}

export const DEMO_POSITIONS: DemoPosition[] = [
  pos(DEMO_SYMBOLS.allWorld, 'Vanguard FTSE All-World', DEMO_ACCOUNT_IDS.ibkr, 'Interactive Brokers', 'IBKR', 1400, 84),
  pos(DEMO_SYMBOLS.ubsFund, 'UBS Strategy Fund', DEMO_ACCOUNT_IDS.ubs, 'UBS', 'UBS', 500, 96),
  pos(DEMO_SYMBOLS.spi, 'iShares SPI', DEMO_ACCOUNT_IDS.ibkr, 'Interactive Brokers', 'IBKR', 600, 91),
  pos(DEMO_SYMBOLS.apple, 'Apple', DEMO_ACCOUNT_IDS.ibkr, 'Interactive Brokers', 'IBKR', 410, 79),
  pos(DEMO_SYMBOLS.nestle, 'Nestle', DEMO_ACCOUNT_IDS.ubs, 'UBS', 'UBS', 500, 108, { classLabel: 'Equity', sector: 'consumer defensive', region: 'switzerland', currency: 'CHF', change: -3.1 }),
  pos(DEMO_SYMBOLS.bitcoin, 'Bitcoin', DEMO_ACCOUNT_IDS.ledger, 'Ledger', 'Ledger', 0.62, 62, { classLabel: 'Crypto', sector: 'other', region: 'world', currency: 'BTC' }),
  pos(DEMO_SYMBOLS.ether, 'Ethereum', DEMO_ACCOUNT_IDS.ledger, 'Ledger', 'Ledger', 10.4, 88, { classLabel: 'Crypto', sector: 'other', region: 'world', currency: 'ETH', change: 11.2 }),
]

/** Facts beside each sample position that the analytics wire shape has no field for. */
export const DEMO_POSITION_META: Record<string, { classLabel: string; ter?: number; note?: string; change30d: number; sparkline: number[] }> = Object.fromEntries(
  DEMO_POSITIONS.map((p, i) => {
    const steps = 18
    const end = 100
    const start = end / (1 + p.change / 100)
    const spark = Array.from({ length: steps }, (_, k) => {
      const t = k / (steps - 1)
      return start + (end - start) * t + Math.sin(t * Math.PI * (2.3 + i * 0.7)) * Math.abs(end - start) * 0.35
    })
    return [p.symbol, { classLabel: p.classLabel, ter: p.ter, note: p.note, change30d: p.change, sparkline: spark }]
  }),
)

export const DEMO_HOLDINGS_RES: HoldingsResponse = {
  holdings: DEMO_POSITIONS.map((p) => {
    const marketValue = p.value
    const costBasis = (p.value * p.costPct) / 100
    const pnl = marketValue - costBasis
    return {
      symbol: p.symbol,
      name: p.name,
      units: p.units,
      price: p.value / p.units,
      marketValue,
      currency: DEMO_CURRENCY,
      averageCost: costBasis / p.units,
      costBasis,
      unrealizedPnl: pnl,
      unrealizedPnlPercent: (pnl / costBasis) * 100,
      weight: (marketValue / DEMO_GROSS) * 100,
      accountId: p.accountId,
      accountLabel: p.accountLabel,
      institution: p.institution,
      assetClass: p.assetClass,
      sector: p.sector,
      industry: p.classLabel,
      region: p.region,
      dayChange: marketValue * (p.change / 100 / 30),
      dayChangePercent: p.change / 30,
    }
  }),
  retrievedAt: stamp(),
}

export function demoOverview(): AnalyticsOverview {
  const pnl = DEMO_HOLDINGS_RES.holdings.reduce((s, h) => s + (h.unrealizedPnl || 0), 0)
  const cost = DEMO_HOLDINGS_RES.holdings.reduce((s, h) => s + (h.costBasis || 0), 0)
  const cash = IBKR_CASH + UBS_CASH + fx('Revolut').value
  return {
    totalValue: DEMO_GROSS,
    costBasis: cost,
    unrealizedPnl: pnl,
    unrealizedPnlPercent: (pnl / cost) * 100,
    cashValue: cash,
    cashPercent: (cash / DEMO_GROSS) * 100,
    investedValue: DEMO_GROSS - cash,
    holdingsCount: DEMO_POSITIONS.length,
    accountsCount: DEMO_ACCOUNTS.length,
    dayChange: DEMO_DAY_CHANGE,
    dayChangePercent: (DEMO_DAY_CHANGE / DEMO_GROSS) * 100,
    currency: DEMO_CURRENCY,
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
        seg('real_estate', 'Property', fx('Apartment').value),
        seg('equity', 'Equities and funds', INVESTED),
        seg('pension', 'Pension', fx('Pillar 3a').value),
        seg('cash', 'Cash', IBKR_CASH + UBS_CASH + fx('Revolut').value),
        seg('crypto', 'Crypto', fx('Ledger').value),
      ]
      break
    case 'region':
      segments = DEMO_GEO
      break
    case 'sector':
      segments = DEMO_SECTOR
      break
    case 'currency':
      segments = DEMO_CURRENCY_MIX
      break
    case 'institution':
      segments = DEMO_ACCOUNTS.filter((a) => a.kind !== 'liability').map((a) => seg(a.institution?.toLowerCase() ?? a.id, a.institution ?? a.label, a.totalValueUsd || 0))
      break
    case 'symbol':
      segments = DEMO_HOLDINGS_RES.holdings.map((h) => seg(h.symbol, h.name || h.symbol, h.marketValue))
      break
    default:
      segments = DEMO_ACCOUNTS.filter((a) => a.kind !== 'liability').map((a) => seg(a.id, a.label, a.totalValueUsd || 0))
  }
  return { by, segments, retrievedAt: stamp() }
}

export const DEMO_CONCENTRATION_RES: ConcentrationResponse = {
  top: [
    { symbol: 'HOME', label: 'Apartment', value: fx('Apartment').value, percent: fx('Apartment').share ?? 0 },
    ...DEMO_POSITIONS.slice(0, 4).map((p) => ({ symbol: p.symbol, label: p.name, value: p.value, percent: (p.value / DEMO_GROSS) * 100 })),
  ],
  top5Percent: 75.4,
  top10Percent: 93.7,
  hhi: 0.24,
  effectiveHoldings: 4.2,
  flags: [
    { level: 'high', message: 'Apple is 18% of the invested portfolio: held directly, and again inside two funds.' },
    { level: 'info', message: 'Sample figures. Connect accounts to see your own risk.' },
  ],
  retrievedAt: stamp(),
}

export function demoIncome(months = 12): IncomeResponse {
  const byMonth = []
  for (let i = months - 1; i >= 0; i--) {
    const d = monthsBack(i)
    const dividends = [2, 5, 8, 11].includes(d.getMonth()) ? 640 : 0
    const interest = 38
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
      { symbol: DEMO_SYMBOLS.nestle, total: 1_180, count: 1 },
      { symbol: DEMO_SYMBOLS.spi, total: 1_380, count: 4 },
    ],
    currency: DEMO_CURRENCY,
    retrievedAt: stamp(),
  }
}

export function demoFlows(months = 12): FlowsResponse {
  const byMonth = []
  for (let i = months - 1; i >= 0; i--) {
    const d = monthsBack(i)
    const deposits = 2_000
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
    currency: DEMO_CURRENCY,
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

/** Growth over each range, so the 12-month figure matches the fixture exactly. */
const RANGE_GROWTH: Record<HistoryRange, number> = {
  '1m': 0.9,
  '3m': 2.1,
  '6m': 3.6,
  '1y': F.change12m.pct,
  all: 18,
}

/** Gross assets over time; net worth is this minus the debts, which do not move. */
export function demoHistoryRes(range: HistoryRange): HistoryResponse {
  const growthNet = RANGE_GROWTH[range] ?? 4
  // The chart is of assets; scale the growth so the net figure moves by the fixture's amount.
  const growthGross = (growthNet * DEMO_NET_WORTH) / (DEMO_GROSS - (growthNet / 100) * DEMO_NET_WORTH)
  return {
    points: demoHistory(DEMO_GROSS, RANGE_TO_DAYS[range] ?? 90, growthGross),
    range,
    isPartial: false,
    currency: DEMO_CURRENCY,
    retrievedAt: stamp(),
  }
}

export function demoBenchmark(range: BenchmarkRange): BenchmarkResponse {
  const days = RANGE_TO_DAYS[range] ?? 90
  const points = demoHistory(DEMO_GROSS, days, RANGE_GROWTH[range] ?? 4)
  const start = points[0]?.value || 1
  const bmReturn = { '1m': 2.1, '3m': 4.8, '6m': 7.9, '1y': 11.2 }[range] ?? 4.8
  const portfolio = points.map((p) => ({ date: p.date, indexed: (p.value / start) * 100 }))
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

/** Market colour for each sample symbol: quote card and price chart personality. */
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
  [DEMO_SYMBOLS.apple]: {
    name: 'Apple',
    sector: 'Technology',
    industry: 'Consumer electronics',
    low52: 164,
    high52: 237,
    marketCap: 3_400_000_000_000,
    peRatio: 34.8,
    growth: { '1m': -1.8, '3m': 4, '6m': 9, '1y': 21, '5y': 160 },
  },
  [DEMO_SYMBOLS.nestle]: {
    name: 'Nestle',
    sector: 'Consumer defensive',
    industry: 'Packaged foods',
    low52: 71,
    high52: 92,
    marketCap: 205_000_000_000,
    peRatio: 18.6,
    growth: { '1m': -3.1, '3m': -4, '6m': -6, '1y': -9, '5y': 4 },
  },
  [DEMO_SYMBOLS.allWorld]: {
    name: 'Vanguard FTSE All-World',
    industry: 'Accumulating ETF',
    low52: 108,
    high52: 133,
    growth: { '1m': 1.4, '3m': 4, '6m': 8.2, '1y': 16, '5y': 68 },
  },
  [DEMO_SYMBOLS.spi]: {
    name: 'iShares SPI',
    industry: 'Swiss equity ETF',
    low52: 140,
    high52: 163,
    growth: { '1m': 1.1, '3m': 3, '6m': 5, '1y': 9, '5y': 30 },
  },
  [DEMO_SYMBOLS.ubsFund]: {
    name: 'UBS Strategy Fund',
    industry: 'Balanced fund, 1.42% a year',
    low52: 186,
    high52: 202,
    growth: { '1m': 0.6, '3m': 1.5, '6m': 2.4, '1y': 4, '5y': 14 },
  },
  [DEMO_SYMBOLS.bitcoin]: {
    name: 'Bitcoin',
    industry: 'Crypto asset',
    low52: 52_000,
    high52: 104_000,
    growth: { '1m': 6, '3m': 12, '6m': 24, '1y': 58, '5y': 320 },
  },
  [DEMO_SYMBOLS.ether]: {
    name: 'Ethereum',
    industry: 'Crypto asset',
    low52: 1_600,
    high52: 3_900,
    growth: { '1m': 4, '3m': 11, '6m': 20, '1y': 31, '5y': 180 },
  },
}

export function demoQuote(symbol: string): Quote | undefined {
  const m = DEMO_MARKET[symbol]
  const p = DEMO_POSITIONS.find((x) => x.symbol === symbol)
  if (!m || !p) return undefined
  const price = p.value / p.units
  const day = p.change / 30
  return {
    symbol,
    name: m.name,
    price,
    currency: DEMO_CURRENCY,
    dayChange: price * (day / 100),
    dayChangePercent: day,
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

export function demoPriceHistory(symbol: string, range: PriceHistoryRange): PriceHistoryResponse | undefined {
  const m = DEMO_MARKET[symbol]
  const p = DEMO_POSITIONS.find((x) => x.symbol === symbol)
  if (!m || !p) return undefined
  const totalDays = PRICE_RANGE_DAYS[range]
  const step = range === '5y' ? 7 : 1
  const count = Math.floor(totalDays / step)
  const end = p.value / p.units
  const start = end / (1 + m.growth[range] / 100)
  const points: Array<{ date: string; close: number }> = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * step)
    const t = 1 - i / Math.max(count - 1, 1)
    // Two incommensurate waves give the walk texture without randomness.
    const wobble = Math.sin(t * Math.PI * 5.3 + symbol.length) * end * 0.016 + Math.sin(t * Math.PI * 11.7) * end * 0.007
    points.push({ date: ymd(d), close: Math.max(0.01, start + (end - start) * t + wobble) })
  }
  if (points.length) points[points.length - 1].close = end
  return { symbol, range, currency: DEMO_CURRENCY, points, retrievedAt: stamp() }
}

/**
 * Broker fills behind each sample position. Every symbol's lots sum
 * exactly to the position's units and cost basis, so the ledger, the
 * purchase history, and the P&L all tell the same story.
 */
function lotsFor(p: DemoPosition): Array<{ date: string; units: number; price: number }> {
  const costBasis = (p.value * p.costPct) / 100
  const thirds = [0.34, 0.33, 0.33]
  const prices = [0.9, 1, 1.1]
  const dates = ['2024-10-14', '2025-05-12', '2026-02-09']
  const units = thirds.map((f) => p.units * f)
  const weighted = units.reduce((s, u, i) => s + u * prices[i], 0)
  const base = costBasis / weighted
  return dates.map((date, i) => ({ date, units: Math.round(units[i] * 10000) / 10000, price: Math.round(base * prices[i] * 100) / 100 }))
}

export function demoTrades(symbol: string): TradesResponse | undefined {
  const p = DEMO_POSITIONS.find((x) => x.symbol === symbol)
  if (!p) return undefined
  return {
    trades: lotsFor(p)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((l) => ({
        date: l.date,
        side: 'buy' as const,
        units: l.units,
        price: l.price,
        total: l.units * l.price,
        accountLabel: p.accountLabel,
        currency: DEMO_CURRENCY,
      })),
    retrievedAt: stamp(),
  }
}

const DEMO_HEADLINES: Record<string, Array<{ title: string; hoursAgo: number }>> = {
  [DEMO_SYMBOLS.apple]: [
    { title: 'Apple lines up its autumn hardware event as services revenue keeps climbing', hoursAgo: 5 },
    { title: 'Analysts split on whether the iPhone upgrade cycle has one more leg', hoursAgo: 26 },
    { title: 'Apple expands its Swiss retail footprint with a refreshed Zurich flagship', hoursAgo: 70 },
  ],
  [DEMO_SYMBOLS.nestle]: [
    { title: 'Nestle leans on pricing as volumes stay soft across Europe', hoursAgo: 8 },
    { title: 'Swiss consumer staples lag the market as investors rotate into growth', hoursAgo: 30 },
    { title: 'Nestle outlines coffee and pet-care push in strategy update', hoursAgo: 76 },
  ],
  [DEMO_SYMBOLS.allWorld]: [
    { title: 'Global equities grind higher as rate-cut expectations firm up', hoursAgo: 4 },
    { title: 'Fund flows: accumulating world ETFs take in another record month', hoursAgo: 24 },
    { title: 'What a strong dollar means for globally diversified portfolios', hoursAgo: 50 },
  ],
  [DEMO_SYMBOLS.bitcoin]: [
    { title: 'Bitcoin holds above its spring range as ETF inflows steady', hoursAgo: 3 },
    { title: 'Miners trim hash rate after the halving squeezes margins', hoursAgo: 22 },
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
  const all = Object.keys(DEMO_HEADLINES).flatMap((sym) => demoNews(sym)?.articles ?? [])
  all.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  return { articles: all.slice(0, limit), retrievedAt: stamp() }
}

export const DEMO_MOVERS_RES: MoversResponse = {
  gainers: [
    { symbol: DEMO_SYMBOLS.bitcoin, name: 'Bitcoin', price: fh('Bitcoin').value / 0.62, marketValue: fh('Bitcoin').value, dayChange: 1_430, dayChangePercent: 2.4 },
    { symbol: DEMO_SYMBOLS.allWorld, name: 'Vanguard FTSE All-World', price: fh('Vanguard FTSE All-World').value / 1400, marketValue: fh('Vanguard FTSE All-World').value, dayChange: 740, dayChangePercent: 0.4 },
  ],
  losers: [{ symbol: DEMO_SYMBOLS.apple, name: 'Apple', price: fh('Apple').value / 410, marketValue: fh('Apple').value, dayChange: -740, dayChangePercent: -0.8 }],
  retrievedAt: stamp(),
}

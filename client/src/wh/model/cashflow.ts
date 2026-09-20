import { useMemo } from 'react'
import { useCashflow, useCategories, useSubscriptions } from '@/hooks/useMoneyLedger'
import { useDemo } from '@/wealth/DemoContext'
import { DEMO_CASH_POSITION, DEMO_FORECAST } from '@/wealth/demo'
import { monthlyEquivalent } from '@/wealth/calendar'
import { ICONS, type IconName } from '@/wh/icons'
import { useBook } from './book'

export type Period = 'Monthly' | 'Quarterly' | 'Yearly'

export const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Yearly', label: 'Yearly' },
]

export interface CashflowCategory {
  id: string
  name: string
  amount: number
  icon: IconName
}

export interface CashflowTableRow {
  label: string
  opening: number
  in: number
  out: number
  closing: number
  forecast: boolean
  /** The period that is happening now. */
  now: boolean
}

export interface CashflowView {
  labels: string[]
  ins: number[]
  outs: number[]
  position: number[]
  forecastFrom: number
  nowIndex: number
  cashToday: number
  asOf: string
  current: { label: string; in: number; out: number; kept: number; keptPct: number }
  categories: CashflowCategory[]
  table: CashflowTableRow[]
  hasActivity: boolean
  loading: boolean
  subscriptionsMonthly: number
}

const CATEGORY_ICON: Record<string, IconName> = {
  housing: ICONS.spending.housing,
  tax: ICONS.spending.tax,
  groceries: ICONS.spending.food,
  food: ICONS.spending.food,
  leisure: ICONS.spending.leisure,
  insurance: ICONS.spending.insurance,
  transport: ICONS.spending.transport,
  subscriptions: ICONS.spending.subscriptions,
  other: ICONS.spending.other,
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const round = (n: number) => Math.round(n)

/** Money in, money out and where the cash is heading, for the chosen period, with a short forecast. */
export function useCashflowView(period: Period = 'Monthly'): CashflowView {
  const { enabled: sampleOn } = useDemo()
  const book = useBook()
  const { data, isLoading } = useCashflow(12)
  const { data: cats } = useCategories()
  const { data: subs } = useSubscriptions()

  return useMemo(() => {
    const months = data?.months ?? []
    const now = new Date()
    const fixture = sampleOn && !book.hasLive
    const cashToday = fixture ? DEMO_CASH_POSITION[DEMO_FORECAST.months.length ? DEMO_CASH_POSITION.length - DEMO_FORECAST.months.length - 1 : DEMO_CASH_POSITION.length - 1] : book.cash

    // Actual buckets by period, oldest first.
    let actual: Array<{ label: string; in: number; out: number }> = []
    if (period === 'Monthly') {
      actual = months.slice(-6).map((m) => ({ label: m.label, in: m.income, out: m.spend }))
    } else if (period === 'Quarterly') {
      const q = new Map<string, { label: string; in: number; out: number }>()
      for (const m of months) {
        const k = `${m.year}-Q${Math.floor(m.month / 3) + 1}`
        const b = q.get(k) ?? { label: `Q${Math.floor(m.month / 3) + 1} ${String(m.year).slice(2)}`, in: 0, out: 0 }
        b.in += m.income
        b.out += m.spend
        q.set(k, b)
      }
      actual = [...q.values()]
    } else {
      const y = new Map<number, { label: string; in: number; out: number }>()
      for (const m of months) {
        const b = y.get(m.year) ?? { label: String(m.year), in: 0, out: 0 }
        b.in += m.income
        b.out += m.spend
        y.set(m.year, b)
      }
      actual = [...y.values()]
    }

    // Forecast: the fixture's, or the average of the last three periods that happened.
    let forecast: Array<{ label: string; in: number; out: number }> = []
    if (period === 'Monthly') {
      if (fixture) forecast = DEMO_FORECAST.months.map((label, i) => ({ label, in: DEMO_FORECAST.in[i], out: DEMO_FORECAST.out[i] }))
      else {
        const recent = actual.slice(-3)
        const avgIn = recent.length ? round(recent.reduce((s, m) => s + m.in, 0) / recent.length) : 0
        const avgOut = recent.length ? round(recent.reduce((s, m) => s + m.out, 0) / recent.length) : 0
        forecast = [1, 2, 3].map((k) => ({ label: MONTHS[(now.getMonth() + k) % 12], in: avgIn, out: avgOut }))
      }
    } else if (period === 'Quarterly') {
      const recent = actual.slice(-2)
      const avgIn = recent.length ? round(recent.reduce((s, m) => s + m.in, 0) / recent.length) : 0
      const avgOut = recent.length ? round(recent.reduce((s, m) => s + m.out, 0) / recent.length) : 0
      const nextQ = Math.floor(now.getMonth() / 3) + 2
      forecast = [{ label: `Q${((nextQ - 1) % 4) + 1} ${String(nextQ > 4 ? now.getFullYear() + 1 : now.getFullYear()).slice(2)}`, in: avgIn, out: avgOut }]
    } else {
      const last = actual[actual.length - 1]
      const monthsIn = months.filter((m) => m.year === now.getFullYear()).length || 1
      forecast = last ? [{ label: String(now.getFullYear() + 1), in: round((last.in / monthsIn) * 12), out: round((last.out / monthsIn) * 12) }] : []
    }

    const all = [...actual, ...forecast]
    const forecastFrom = actual.length
    const nowIndex = Math.max(0, actual.length - 1)

    // Cash position: walk back from today through what happened, then forward through the forecast.
    let position: number[]
    if (fixture && period === 'Monthly') position = DEMO_CASH_POSITION.slice(-all.length)
    else {
      position = new Array(all.length).fill(cashToday)
      for (let i = nowIndex - 1; i >= 0; i--) position[i] = position[i + 1] - (all[i + 1].in - all[i + 1].out)
      for (let i = nowIndex + 1; i < all.length; i++) position[i] = position[i - 1] + (all[i].in - all[i].out)
    }

    const cur = actual[actual.length - 1] ?? { label: MONTHS[now.getMonth()], in: 0, out: 0 }
    const kept = cur.in - cur.out
    const catList = cats?.spend ?? []
    const categories: CashflowCategory[] = (data?.categories ?? [])
      .map((c) => ({ id: c.id, name: catList.find((x) => x.id === c.id)?.name ?? c.name, amount: c.amount, icon: CATEGORY_ICON[c.id] ?? ICONS.spending.other }))
      .sort((a, b) => b.amount - a.amount)

    const from = period === 'Monthly' ? Math.max(0, all.length - 7) : 0
    const table: CashflowTableRow[] = all.slice(from).map((m, k) => {
      const i = from + k
      return { label: m.label + (i === forecastFrom ? ' (forecast)' : ''), opening: position[i] - (m.in - m.out), in: m.in, out: m.out, closing: position[i], forecast: i >= forecastFrom, now: i === nowIndex }
    })

    const asOf = `${now.getDate()} ${MONTHS[now.getMonth()]}`
    return {
      labels: all.map((m) => m.label),
      ins: all.map((m) => m.in),
      outs: all.map((m) => m.out),
      position,
      forecastFrom,
      nowIndex,
      cashToday,
      asOf,
      current: { label: period === 'Monthly' ? LONG[now.getMonth()] : cur.label, in: cur.in, out: cur.out, kept, keptPct: cur.in ? (kept / cur.in) * 100 : 0 },
      categories,
      table,
      hasActivity: Boolean(data?.hasActivity) || fixture,
      loading: isLoading,
      subscriptionsMonthly: (subs?.subscriptions ?? []).reduce((s, x) => s + monthlyEquivalent(x), 0),
    }
  }, [data, isLoading, cats, subs, period, sampleOn, book.hasLive, book.cash])
}

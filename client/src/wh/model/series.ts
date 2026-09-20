import { useMemo } from 'react'
import { useHistory, type HistoryRange } from '@/hooks/useAnalytics'
import { useDemo } from '@/wealth/DemoContext'
import { DEMO_CHANGE_12M, DEMO_YTD } from '@/wealth/demo'

export type Range = '1M' | '3M' | 'YTD' | '1Y' | 'All'

export const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
]

const TO_HISTORY: Record<Range, HistoryRange> = { '1M': '1m', '3M': '3m', YTD: '1y', '1Y': '1y', All: 'all' }

export interface NetWorthSeries {
  values: number[]
  dates: string[]
  /** Change over the range, in the series' own currency. */
  change: number
  changePct: number
  /** "over 12 months", "this year", "over 3 months". */
  span: string
  loading: boolean
  /** Fewer than two points: nothing to draw yet. */
  thin: boolean
  note: string | null
}

const SPAN: Record<Range, string> = { '1M': 'over a month', '3M': 'over 3 months', YTD: 'this year', '1Y': 'over 12 months', All: 'since the start' }

/** Net worth over the chosen range: the recorded assets curve with today's debts taken off every point. */
export function useNetWorthSeries(range: Range, owe: number, netNow: number): NetWorthSeries {
  const { enabled: sampleOn } = useDemo()
  const { data, isLoading } = useHistory(TO_HISTORY[range])
  return useMemo(() => {
    let points = data?.points ?? []
    if (range === 'YTD') {
      const jan = `${new Date().getFullYear()}-01-01`
      points = points.filter((p) => p.date >= jan)
    }
    let values = points.map((p) => p.value - owe)
    const dates = points.map((p) => p.date)
    if (values.length >= 2 && netNow) {
      // The curve ends on today's figure, whatever the last snapshot said.
      const shift = netNow - values[values.length - 1]
      values = values.map((v) => v + shift)
    }
    const thin = values.length < 2
    let change = thin ? 0 : values[values.length - 1] - values[0]
    let changePct = thin || !values[0] ? 0 : (change / Math.abs(values[0])) * 100
    if (sampleOn && !thin && (range === '1Y' || range === 'YTD')) {
      // The sample states its twelve-month and year-to-date change outright.
      const src = range === '1Y' ? DEMO_CHANGE_12M : DEMO_YTD
      change = src.amount
      changePct = src.pct
    }
    return { values, dates, change, changePct, span: SPAN[range], loading: isLoading, thin, note: data?.note ?? null }
  }, [data, isLoading, range, owe, netNow, sampleOn])
}

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import axios from 'axios'
import { useMergedHoldings } from '@/wealth/useMergedHoldings'
import { useMoney } from '@/wealth/format'
import { DEMO_POSITION_META, isDemoId } from '@/wealth/demo'
import type { PriceHistoryResponse } from '@/hooks/useAnalytics'
import type { ClassId } from '@/wh/Token'
import { pctChange } from '@/wh/charts/math'
import { useBook } from './book'
import { countryCode, holdingClassId, holdingClassLabel, sentence } from './classify'

export interface HoldingRow {
  key: string
  symbol: string
  name: string
  classId: ClassId
  /** "Fund, world", "Equity", "Crypto", "Property". */
  classLabel: string
  /** Where it is held. */
  account: string
  accountId?: string
  /** What the account is: "Everyday account", "Brokerage". */
  accountKind: string
  sector: string | null
  country: string
  currency: string
  /** Converted into the display currency. */
  value: number
  /** Of everything you own. */
  weight: number | null
  /** Thirty-day change in percent, when known. */
  change: number | null
  spark: number[] | null
  /** A whole account that is one thing: a flat, a pension. */
  kind: 'position' | 'account'
  /** "0.62 BTC", "410 shares". */
  units: string | null
}

const CASH = new Set(['CHF', 'USD', 'EUR', 'GBP', 'CASH'])

function unitsLabel(symbol: string, units: number | null | undefined, cls: ClassId): string | null {
  if (units == null || !Number.isFinite(units)) return null
  if (cls === 'crypto' || cls === 'bitcoin') return `${Number(units.toFixed(4))} ${symbol.toUpperCase()}`
  if (cls === 'cash') return null
  return `${Number(units.toFixed(2)).toLocaleString('en-GB')} ${units === 1 ? 'share' : 'shares'}`
}

/** One-month closes for the symbols that need a sparkline, a few at a time. */
function useSparklines(symbols: string[], enabled: boolean) {
  const results = useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ['market', 'history', symbol, '1m'],
      queryFn: async () => (await axios.get<PriceHistoryResponse>(`/api/market/history/${encodeURIComponent(symbol)}?range=1m`)).data,
      enabled,
      retry: 0,
      staleTime: 10 * 60_000,
    })),
  })
  return useMemo(() => {
    const out = new Map<string, number[]>()
    results.forEach((r, i) => {
      const pts = r.data?.points?.map((p) => p.close) ?? []
      if (pts.length >= 3) out.set(symbols[i], pts)
    })
    return out
  }, [results, symbols])
}

/** Every position and every single-thing account, as rows sorted by value. */
export function useHoldingRows(): { rows: HoldingRow[]; loading: boolean; invested: number } {
  const book = useBook()
  const holdings = useMergedHoldings()
  const { toDisplay } = useMoney()
  const liveSymbols = useMemo(
    () =>
      [...new Set(holdings.filter((h) => !isDemoId(h.accountId) && !CASH.has(h.symbol.toUpperCase())).map((h) => h.symbol.toUpperCase()))].slice(0, 12),
    [holdings],
  )
  const sparks = useSparklines(liveSymbols, book.hasLive)

  return useMemo(() => {
    const rows: HoldingRow[] = []
    for (const h of holdings) {
      const sample = isDemoId(h.accountId)
      const acct = book.accounts.find((a) => a.id === h.accountId)
      const value = sample ? toDisplay(h.marketValue || 0, h.currency || 'CHF') : h.marketValue || 0
      if (value <= 0) continue
      const classId = holdingClassId(h)
      const meta = sample ? DEMO_POSITION_META[h.symbol] : undefined
      const live = sparks.get(h.symbol.toUpperCase())
      const spark = meta?.sparkline ?? live ?? null
      const change = meta?.change30d ?? (live ? pctChange(live) : null)
      rows.push({
        key: `${h.symbol}-${h.accountId ?? ''}`,
        symbol: h.symbol,
        name: classId === 'cash' ? `Cash, ${acct?.name ?? h.accountLabel ?? h.symbol}` : h.name || h.symbol,
        classId,
        classLabel: classId === 'cash' ? 'Cash' : holdingClassLabel(h),
        account: acct?.account.institution || h.accountLabel || h.institution || '',
        accountId: h.accountId,
        accountKind: acct?.kind ?? '',
        sector: h.sector ? sentence(h.sector) : null,
        country: countryCode(h.region),
        currency: (h.currency || 'CHF').toUpperCase(),
        value,
        weight: book.own ? (value / book.own) * 100 : null,
        change: classId === 'cash' ? null : change,
        spark: classId === 'cash' ? null : spark,
        kind: 'position',
        units: unitsLabel(h.symbol, h.units, classId),
      })
    }
    // Accounts that are one thing and carry no positions: a flat, a pension.
    const covered = new Set(holdings.map((h) => h.accountId))
    for (const a of book.assets) {
      if (covered.has(a.id) || (a.account.holdings?.length ?? 0) > 0) continue
      rows.push({
        key: `acct-${a.id}`,
        symbol: a.name,
        name: a.name,
        classId: a.classId,
        classLabel: a.classId === 'property' ? 'Property' : a.classId === 'pension' ? 'Pension' : a.kind,
        account: a.classId === 'property' ? 'by hand' : a.account.institution || a.kind,
        accountId: a.id,
        accountKind: a.kind,
        sector: null,
        country: a.classId === 'property' ? 'CH' : '—',
        currency: (a.account.currency || 'CHF').toUpperCase(),
        value: a.value,
        weight: a.share,
        change: a.change12m,
        spark: null,
        kind: 'account',
        units: null,
      })
    }
    rows.sort((a, b) => b.value - a.value)
    const invested = rows.filter((r) => r.classId === 'equities' || r.classId === 'funds' || r.classId === 'bonds').reduce((s, r) => s + r.value, 0)
    return { rows, loading: book.loading, invested }
  }, [holdings, book, sparks, toDisplay])
}

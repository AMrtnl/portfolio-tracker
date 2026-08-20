import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import {
  useAllocation,
  useConcentration,
  useHistory,
  useMovers,
  useOverview,
  type HistoryRange,
} from '@/hooks/useAnalytics'
import { useAccounts } from '@/hooks/useAccounts'
import { usePortfolio } from '@/hooks/usePortfolio'
import { accountClass, accountValue, isLiability } from '@/wealth/classifyAccount'
import { CandleChart, Ring, SplitBar, StackedChart, type Candle, type ChartSeries } from '@/wealth/charts'
import { useQuickLook } from '@/wealth/QuickLook'
import { useMoney } from '@/wealth/format'
import { HoldingsGroups } from '@/wealth/HoldingsGroups'
import { InsightsStrip, toSplitRows } from '@/wealth/Insights'
import { CLASSES, GEO_COLORS, RANGES, SECTOR_COLORS, classOf } from '@/wealth/tokens'
import { useDemo } from '@/wealth/DemoContext'
import { FLAGS } from '@/wealth/logos'
import {
  DEMO_CONCENTRATION,
  DEMO_DAY_CHANGE,
  DEMO_GEO,
  DEMO_MOVERS,
  DEMO_SECTOR,
  demoHistory,
  isDemoId,
} from '@/wealth/demo'

function fmtDate(iso: string, long = false): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString(
    'en-GB',
    long
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
  )
}

const RANGE_DAYS: Record<(typeof RANGES)[number]['k'], number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
}

export function Dashboard() {
  const { chf, pctStr, unit } = useMoney()
  const { enabled: sampleOn } = useDemo()
  const { look } = useQuickLook()
  const { data: accounts } = useAccounts()
  const hasAccounts = (accounts?.length ?? 0) > 0
  const hasLive = (accounts ?? []).some((a) => !isDemoId(a.id))
  const { data: portfolio, isLoading, error, refetch } = usePortfolio({
    enabled: hasLive,
  })
  const { data: overview } = useOverview()
  const { data: byClass } = useAllocation('assetClass')
  const { data: byRegion } = useAllocation('region')
  const { data: bySector } = useAllocation('sector')
  const { data: concentration } = useConcentration()
  const { data: movers } = useMovers()
  const [mode, setMode] = useState<'stacked' | 'candles'>('stacked')
  const [range, setRange] = useState<(typeof RANGES)[number]['k']>('3M')
  const [off, setOff] = useState<Record<string, boolean>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [cur, setCur] = useState<number | null>(null)
  const [split, setSplit] = useState<'geo' | 'sector'>('geo')

  const historyRange: HistoryRange =
    (RANGES.find((r) => r.k === range)?.n as HistoryRange) ?? '3m'
  const { data: history } = useHistory(historyRange)

  useEffect(() => {
    document.title = 'Wealth'
  }, [])

  const currency = overview?.currency || 'USD'
  const livePoints = history?.points ?? []
  const grossHint =
    (accounts ?? []).filter((a) => !isLiability(a)).reduce((s, a) => s + accountValue(a), 0) ||
    overview?.totalValue ||
    0
  const points =
    livePoints.length >= 8
      ? livePoints
      : sampleOn && grossHint
        ? demoHistory(grossHint, RANGE_DAYS[range] ?? 90)
        : livePoints
  const assetSeries = useMemo(() => points.map((p) => p.value), [points])

  const classTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const a of accounts ?? []) {
      if (isLiability(a)) continue
      const id = accountClass(a)
      totals[id] = (totals[id] || 0) + accountValue(a)
    }
    if (!Object.keys(totals).length) {
      for (const seg of byClass?.segments ?? []) {
        const cls = classOf(seg.key)
        totals[cls.id] = (totals[cls.id] || 0) + (seg.value || 0)
      }
    }
    return totals
  }, [byClass, accounts])

  const debtNow = useMemo(
    () => (accounts ?? []).filter(isLiability).reduce((s, a) => s + accountValue(a), 0),
    [accounts],
  )

  const netSeries = useMemo(
    () => assetSeries.map((v) => v - debtNow),
    [assetSeries, debtNow],
  )

  const grossNow =
    Object.values(classTotals).reduce((s, v) => s + v, 0) ||
    overview?.totalValue ||
    parseFloat(portfolio?.totalValue || '0') ||
    0

  const series: ChartSeries[] = useMemo(() => {
    const active = CLASSES.filter((c) => (classTotals[c.id] || 0) > 0 && !off[c.id])
    const source = assetSeries.length ? assetSeries : [grossNow]
    return active.map((c) => {
      const weight = grossNow ? (classTotals[c.id] || 0) / grossNow : 0
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        values: source.map((v) => v * weight),
      }
    })
  }, [classTotals, off, assetSeries, grossNow])

  const candles: Candle[] = useMemo(
    () =>
      netSeries.map((t, i) => {
        const o = i ? netSeries[i - 1] : t
        return { o, c: t, h: Math.max(o, t), l: Math.min(o, t) }
      }),
    [netSeries],
  )

  const n = Math.max(netSeries.length, 1)
  const idx = cur ?? n - 1
  const net = netSeries[idx] ?? grossNow - debtNow
  const start = netSeries[0] ?? net
  const delta = net - start
  const pct = start ? (delta / start) * 100 : 0
  const up = delta >= 0
  const dayAbs =
    overview?.dayChange ?? (sampleOn ? DEMO_DAY_CHANGE : parseFloat(portfolio?.pnl24h || '0') || 0)
  const plotLen = Math.max(series[0]?.values.length ?? 0, 1)
  const dates = {
    short: (i: number) => (points[i] ? fmtDate(points[i].date) : 'Today'),
    long: (i: number) => (points[i] ? fmtDate(points[i].date, true) : 'Today'),
  }

  const geoRows = toSplitRows(
    byRegion?.segments?.length ? byRegion.segments : sampleOn ? DEMO_GEO : undefined,
    GEO_COLORS,
    FLAGS,
  )
  const secRows = toSplitRows(
    bySector?.segments?.length ? bySector.segments : sampleOn ? DEMO_SECTOR : undefined,
    SECTOR_COLORS,
  )
  const top = concentration?.top?.[0] ?? (sampleOn ? DEMO_CONCENTRATION.top[0] : undefined)
  const liquid =
    (classTotals.cash || 0) +
    (classTotals.stocks || 0) +
    (classTotals.bonds || 0) +
    (classTotals.crypto || 0)

  if (!hasAccounts) {
    return (
      <>
        <section className="a-card">
          <div className="a-hero">
            <div className="a-caption">Net worth</div>
            <div className="a-value">
              <span className="a-unit">USD</span>
              {chf(0)}
            </div>
            <div className="a-delta muted">Add what you own and what you owe</div>
          </div>
          <p className="a-insnote spaced">
            Cash, brokers, crypto, pension, property, and loans sit on one book.
            Cash flow and subscriptions work even before a broker is connected.
          </p>
        </section>
        <Link to="/accounts" className="a-add">
          <Plus size={17} strokeWidth={2.5} />
          Add account
        </Link>
      </>
    )
  }

  if (hasLive && isLoading) {
    return (
      <section className="a-card" aria-hidden>
        <div className="a-hero">
          <span className="ui-skel" style={{ width: 88, height: 14, borderRadius: 7 }} />
        </div>
      </section>
    )
  }

  if (hasLive && error && !sampleOn) {
    return (
      <div className="ui-empty">
        <div className="ui-empty-icon">!</div>
        <b>Could not load your portfolio</b>
        <p>{(error as Error)?.message || 'The API may be offline.'}</p>
        <button type="button" className="ui-btn primary sm" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="a-desk">
        <div className="a-desk-primary">
      <section className="a-heroblock">
        <div className="a-herotop">
          <div className="a-hero bare">
            <div className="a-caption">
              {cur != null && points[cur] ? dates.long(cur) : 'Net worth'}
            </div>
            <div className="a-value">
              <span className="a-unit">{unit(currency)}</span>
              {chf(net, false, currency)}
            </div>
            <div className={`a-delta ${up ? 'gain' : 'loss'}`}>
              {chf(delta, true, currency)} · {pctStr(pct)}
              <span className="a-period">{range}</span>
            </div>
          </div>
          <div className="a-pills" role="tablist" aria-label="History range">
            {RANGES.map((r) => (
              <button
                key={r.k}
                type="button"
                role="tab"
                aria-selected={range === r.k}
                onClick={() => {
                  setRange(r.k)
                  setCur(null)
                }}
                className={`a-pill ${range === r.k ? 'on' : ''}`}
              >
                {r.k}
              </button>
            ))}
          </div>
        </div>

        {plotLen >= 2 && mode === 'candles' ? (
          <CandleChart data={candles} height={236} dates={dates.short} onScrub={setCur} />
        ) : plotLen >= 2 ? (
          <StackedChart
            series={series}
            net={netSeries.length ? netSeries : [grossNow - debtNow]}
            len={plotLen}
            height={236}
            dates={dates.short}
            onScrub={setCur}
            showDebt={debtNow > 0}
          />
        ) : (
          <p className="a-insnote spaced">
            History starts after the first snapshot. The mix below is live.
          </p>
        )}

        {mode === 'stacked' && series.length > 0 && (
          <div className="a-alloc">
            {series.map((c) => (
              <div
                key={c.id}
                className="a-allocseg"
                style={{ flex: c.values[idx] || 0.01, background: c.color }}
              />
            ))}
          </div>
        )}

        <div className="a-chartfoot">
          {mode === 'stacked' ? (
            <div className="a-keys">
              {CLASSES.filter((c) => (classTotals[c.id] || 0) > 0).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`a-key ${off[c.id] ? 'off' : ''}`}
                  onClick={() => setOff((h) => ({ ...h, [c.id]: !h[c.id] }))}
                >
                  <span className="a-dot" style={{ background: c.color }} />
                  {c.name}
                  <b>
                    {off[c.id]
                      ? '—'
                      : `${grossNow ? (((classTotals[c.id] || 0) / grossNow) * 100).toFixed(0) : 0}%`}
                  </b>
                </button>
              ))}
              {debtNow > 0 && (
                <span className="a-key static">
                  <span className="a-dot hatch" />
                  Debt
                </span>
              )}
            </div>
          ) : (
            <span />
          )}
          <div className="a-pills" role="tablist" aria-label="Chart mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'stacked'}
              className={`a-pill ${mode === 'stacked' ? 'on' : ''}`}
              onClick={() => setMode('stacked')}
            >
              Composition
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'candles'}
              className={`a-pill ${mode === 'candles' ? 'on' : ''}`}
              onClick={() => setMode('candles')}
            >
              Movement
            </button>
          </div>
        </div>
      </section>

      <div className="a-catchips">
        {CLASSES.filter((c) => (classTotals[c.id] || 0) > 0).map((c) => {
          const v = classTotals[c.id] || 0
          const share = grossNow ? (v / grossNow) * 100 : 0
          return (
            <button
              key={c.id}
              type="button"
              className="a-catchip"
              onClick={() => look({ kind: 'class', id: c.id })}
            >
              <Ring pct={share} color={c.color} size={38} stroke={4.5} label="" />
              <span className="a-catchiptext">
                <b>{c.name}</b>
                <em>
                  {chf(v, false, currency)} · {share.toFixed(0)}%
                </em>
              </span>
              <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
            </button>
          )
        })}
      </div>

      <div className="a-stats">
        <div className="a-stat">
          <span>Assets</span>
          <b>{chf(grossNow, false, currency)}</b>
        </div>
        <div className="a-stat">
          <span>Debt</span>
          <b className="loss">{chf(-debtNow, false, currency)}</b>
        </div>
        <div className="a-stat">
          <span>Today</span>
          <b className={dayAbs >= 0 ? 'gain' : 'loss'}>{chf(dayAbs, true, currency)}</b>
        </div>
      </div>

      </div>

      <aside className="a-desk-aside">
      <InsightsStrip
        topLabel={top ? top.label || top.symbol : undefined}
        topPercent={top?.percent}
        liquidPercent={grossNow ? (liquid / grossNow) * 100 : 0}
        defensive={(classTotals.cash || 0) + (classTotals.bonds || 0)}
        growth={(classTotals.stocks || 0) + (classTotals.funds || 0) + (classTotals.estate || 0) + (classTotals.pension || 0) + (classTotals.other || 0)}
        speculative={classTotals.crypto || 0}
        best={
          movers?.gainers?.[0]
            ? { symbol: movers.gainers[0].symbol, pct: movers.gainers[0].dayChangePercent ?? 0 }
            : sampleOn
              ? { symbol: DEMO_MOVERS.gainers[0].symbol, pct: DEMO_MOVERS.gainers[0].dayChangePercent }
              : undefined
        }
        worst={
          movers?.losers?.[0]
            ? { symbol: movers.losers[0].symbol, pct: movers.losers[0].dayChangePercent ?? 0 }
            : sampleOn
              ? { symbol: DEMO_MOVERS.losers[0].symbol, pct: DEMO_MOVERS.losers[0].dayChangePercent }
              : undefined
        }
        onSymbol={(symbol) => look({ kind: 'holding', symbol })}
      />
      </aside>
      </div>

      {(geoRows.length > 0 || secRows.length > 0) && (
        <>
          <div className="a-header">Diversification</div>
          <section className="a-gcard pad">
            <div
              className="a-seg flat"
              style={{ '--i': split === 'geo' ? 0 : 1, '--n': 2 } as React.CSSProperties}
            >
              <span className="a-thumb" />
              <button
                type="button"
                className={`a-segbtn ${split === 'geo' ? 'on' : ''}`}
                onClick={() => setSplit('geo')}
              >
                By country
              </button>
              <button
                type="button"
                className={`a-segbtn ${split === 'sector' ? 'on' : ''}`}
                onClick={() => setSplit('sector')}
              >
                By sector
              </button>
            </div>
            <div className="a-splitwrap">
              <SplitBar
                rows={split === 'geo' ? geoRows : secRows}
                money={(n) => chf(n, false, currency)}
              />
            </div>
          </section>
        </>
      )}

      <HoldingsGroups
        gross={grossNow}
        debt={debtNow}
        currency={currency}
        collapsed={collapsed}
        onToggle={(id) => setCollapsed((s) => ({ ...s, [id]: !s[id] }))}
      />

      <Link to="/accounts" className="a-add">
        <Plus size={17} strokeWidth={2.5} />
        Add account
      </Link>
    </>
  )
}

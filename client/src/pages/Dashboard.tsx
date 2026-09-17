import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CaretRight, Plus } from '@phosphor-icons/react'
import { useCashflow, useSubscriptions, useTransactions } from '@/hooks/useMoneyLedger'
import { useGoals } from '@/hooks/useGoals'
import { GOAL_COLORS, STATE_COPY, goalStatus, monthLabel } from '@/wealth/goals'
import { useSettings } from '@/hooks/useSettings'
import { HEADLINE_COPY } from '@/wealth/PreferencesSheet'
import {
  useAllocation,
  useConcentration,
  useHistory,
  useMovers,
  useNews,
  useOverview,
  type HistoryRange,
} from '@/hooks/useAnalytics'
import { useAccounts } from '@/hooks/useAccounts'
import { usePortfolio } from '@/hooks/usePortfolio'
import { accountClass, accountValue, isLiability } from '@/wealth/classifyAccount'
import { CandleChart, Ring, Sparkline, SplitBar, StackedChart, type Candle, type ChartSeries } from '@/wealth/charts'
import { useQuickLook } from '@/wealth/QuickLook'
import { useMoney } from '@/wealth/format'
import { Money } from '@/wealth/Money'
import { HoldingsGroups } from '@/wealth/HoldingsGroups'
import { toSplitRows } from '@/wealth/Insights'
import { CLASSES, GEO_COLORS, RANGES, SECTOR_COLORS, classOf } from '@/wealth/tokens'
import { useDemo } from '@/wealth/DemoContext'
import { FLAGS, LogoAvatar } from '@/wealth/logos'
import { relativeTime } from '@/lib/utils'
import {
  DEMO_CONCENTRATION,
  DEMO_DAY_CHANGE,
  DEMO_GEO,
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

/**
 * Mercury-style setup checklist, shown until something real is connected.
 * The order is a real sequence: nothing downstream means much before an
 * account exists.
 */
function SetupChecklist({
  accounts,
  transactions,
  subscriptions,
}: {
  accounts: number
  transactions: number
  subscriptions: number
}) {
  const steps = [
    {
      done: accounts > 0,
      title: 'Add an account',
      sub: 'Cash, a broker, crypto, property, or a loan — synced or by hand',
      to: '/accounts',
    },
    {
      done: transactions > 0,
      title: 'Import a bank statement',
      sub: 'Paste a CSV and every line is categorised for you',
      to: '/cashflow',
    },
    {
      done: subscriptions > 0,
      title: 'Confirm recurring charges',
      sub: 'Meridian spots subscriptions in the ledger; you approve them',
      to: '/subscriptions',
    },
  ]
  const done = steps.filter((s) => s.done).length
  return (
    <section className="a-setup" aria-label="Setup">
      <div className="a-setuphead">
        <b>Finish setting up</b>
        <em>
          {done} of {steps.length}
        </em>
      </div>
      {steps.map((s, i) => (
        <Link key={s.title} to={s.to} className={`a-step ${s.done ? 'done' : ''}`}>
          <span className="a-stepnum">
            {s.done ? <Check size={14} /> : i + 1}
          </span>
          <span className="a-atext">
            <b>{s.title}</b>
            <em>{s.sub}</em>
          </span>
          <CaretRight size={15} className="a-rowchev" />
        </Link>
      ))}
    </section>
  )
}

/** Keeps a daily series to a drawable number of points; the last point always survives. */
function thinPoints<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  const step = Math.ceil(points.length / max)
  const out = points.filter((_, i) => i % step === 0)
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1])
  return out
}

/** Six little bars for a tile — the last one in ink, the rest in grey. */
function TinyBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <svg className="a-spark" width={values.length * 14} height={22} aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * 20)
        return (
          <rect
            key={i}
            x={i * 14}
            y={22 - h}
            width={9}
            height={h}
            rx={1.5}
            fill={i === values.length - 1 ? 'var(--ink)' : 'var(--ink-30)'}
          />
        )
      })}
    </svg>
  )
}

export function Dashboard() {
  const { chf, pctStr, unit, toDisplay } = useMoney()
  const { enabled: sampleOn } = useDemo()
  const { look } = useQuickLook()
  const { data: accounts } = useAccounts()
  const hasAccounts = (accounts?.length ?? 0) > 0
  const hasLive = (accounts ?? []).some((a) => !isDemoId(a.id))
  const { data: portfolio, error, refetch } = usePortfolio({
    enabled: hasLive,
  })
  const { data: overview } = useOverview()
  const { data: byClass } = useAllocation('assetClass')
  const { data: byRegion } = useAllocation('region')
  const { data: bySector } = useAllocation('sector')
  const { data: concentration } = useConcentration()
  const { data: movers } = useMovers()
  const { data: news } = useNews(6)
  const { data: txs } = useTransactions()
  const { data: subData } = useSubscriptions()
  const { data: cashflow } = useCashflow(6)
  const flowMonths = cashflow?.months ?? []
  const lastSaved = flowMonths.length
    ? flowMonths[flowMonths.length - 1].income - flowMonths[flowMonths.length - 1].spend
    : 0
  const { data: settings } = useSettings()
  const { data: goals = [] } = useGoals()
  const goalRows = useMemo(
    () =>
      goals.slice(0, 3).map((goal, i) => {
        const current = goal.accountIds.reduce((s, id) => {
          const a = accounts?.find((x) => x.id === id)
          return s + (a ? Math.max(accountValue(a), 0) : 0)
        }, 0)
        return {
          goal,
          status: goalStatus(goal, current),
          color: GOAL_COLORS[i % GOAL_COLORS.length],
        }
      }),
    [goals, accounts],
  )
  const metric = settings?.headlineMetric ?? 'net'
  const realAccounts = (accounts ?? []).filter((a) => !isDemoId(a.id)).length
  const realTxs = (txs ?? []).filter((t) => !isDemoId(t.id)).length
  const realSubs = (subData?.subscriptions ?? []).filter((s) => !isDemoId(s.id)).length
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
  const livePoints = useMemo(() => history?.points ?? [], [history])
  const grossHint =
    (accounts ?? []).filter((a) => !isLiability(a)).reduce((s, a) => s + accountValue(a), 0) ||
    overview?.totalValue ||
    0
  const points = useMemo(() => {
    const raw =
      livePoints.length >= 8
        ? livePoints
        : sampleOn && grossHint
          ? demoHistory(grossHint, RANGE_DAYS[range] ?? 90)
          : livePoints
    return thinPoints(raw, 320)
  }, [livePoints, sampleOn, grossHint, range])
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

  const liquidNow =
    (classTotals.cash || 0) +
    (classTotals.stocks || 0) +
    (classTotals.bonds || 0) +
    (classTotals.crypto || 0)
  const liquidShare = grossNow ? liquidNow / grossNow : 0
  // The headline follows the preference: net worth, liquid financial
  // assets, or gross assets — each scrubbed along the same history.
  const headlineSeries =
    metric === 'net'
      ? netSeries
      : metric === 'gross'
        ? assetSeries
        : assetSeries.map((v) => v * liquidShare)
  const n = Math.max(headlineSeries.length, 1)
  const idx = cur ?? n - 1
  const net =
    headlineSeries[idx] ??
    (metric === 'net' ? grossNow - debtNow : metric === 'gross' ? grossNow : liquidNow)
  const start = headlineSeries[0] ?? net
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
  const liquid = liquidNow
  const moverRows = [
    ...(movers?.gainers ?? []).slice(0, 3),
    ...(movers?.losers ?? []).slice(0, 3),
  ]
  const riskBuckets = [
    {
      key: 'def',
      name: 'Defensive',
      color: '#3ABEFF',
      amount: (classTotals.cash || 0) + (classTotals.bonds || 0),
    },
    {
      key: 'gro',
      name: 'Growth',
      color: '#FFD84D',
      amount:
        (classTotals.stocks || 0) +
        (classTotals.funds || 0) +
        (classTotals.estate || 0) +
        (classTotals.pension || 0) +
        (classTotals.other || 0),
    },
    { key: 'spec', name: 'Speculative', color: '#FF5C48', amount: classTotals.crypto || 0 },
  ]
  const riskTotal = Math.max(
    riskBuckets.reduce((s, b) => s + b.amount, 0),
    1,
  )

  if (!hasAccounts) {
    return (
      <>
        <section className="a-heroblock">
          <div className="a-hero bare">
            <div className="a-caption">Net worth</div>
            <div className="a-value">
              <span className="a-unit">USD</span>
              {chf(0)}
            </div>
            <div className="a-delta muted">Nothing on the book yet</div>
          </div>
        </section>
        <SetupChecklist accounts={realAccounts} transactions={realTxs} subscriptions={realSubs} />
        <p className="a-insnote spaced">
          Cash, brokers, crypto, pension, property, and loans sit on one book. Cash flow
          and subscriptions work even before a broker is connected — turn on Sample to
          see the layout filled in.
        </p>
        <Link to="/accounts" className="a-add">
          <Plus size={17} />
          Add account
        </Link>
      </>
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
      {realAccounts === 0 && (
        <SetupChecklist accounts={realAccounts} transactions={realTxs} subscriptions={realSubs} />
      )}
      <div className="a-desk">
        <div className="a-desk-primary">
      <section className="a-heroblock">
        <div className="a-herotop">
          <div className="a-hero bare">
            <div className="a-caption">
              {cur != null && points[cur] ? dates.long(cur) : HEADLINE_COPY[metric].label}
            </div>
            <div className="a-value">
              <span className="a-unit">{unit(currency)}</span>
              <Money value={net} currency={currency} animated={cur == null} />
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
          <CandleChart
            data={candles}
            height={236}
            dates={dates.short}
            onScrub={setCur}
            convert={(v) => toDisplay(v, currency)}
          />
        ) : plotLen >= 2 ? (
          <StackedChart
            series={series}
            net={netSeries.length ? netSeries : [grossNow - debtNow]}
            len={plotLen}
            height={236}
            dates={dates.short}
            onScrub={setCur}
            showDebt={debtNow > 0}
            convert={(v) => toDisplay(v, currency)}
            money={(v) => chf(v, false, currency)}
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
              <CaretRight size={15} className="a-rowchev" />
            </button>
          )
        })}
      </div>

      <div className="a-vitals" aria-label="Vitals">
        <div className="a-vital">
          <span>Assets</span>
          <b><Money value={grossNow} currency={currency} /></b>
          <Sparkline values={assetSeries} color="var(--ink)" h={22} fill stretch />
        </div>
        <div className="a-vital">
          <span>Debt</span>
          <b className={debtNow > 0 ? 'loss' : ''}><Money value={-debtNow} currency={currency} /></b>
          <em>{grossNow ? `${((debtNow / grossNow) * 100).toFixed(0)}% of assets` : '—'}</em>
        </div>
        <div className="a-vital">
          <span>Today</span>
          <b className={dayAbs >= 0 ? '' : 'loss'}><Money value={dayAbs} currency={currency} sign /></b>
          <em>{assetSeries.length > 1 ? `${pctStr((dayAbs / (assetSeries[assetSeries.length - 2] || 1)) * 100)} on the day` : '—'}</em>
        </div>
        {flowMonths.length > 0 && (
          <div className="a-vital">
            <span>Spend · {flowMonths[flowMonths.length - 1].label}</span>
            <b><Money value={flowMonths[flowMonths.length - 1].spend} /></b>
            <TinyBars values={flowMonths.map((m) => m.spend)} />
          </div>
        )}
        {flowMonths.length > 0 && (
          <div className="a-vital">
            <span>Saved · {flowMonths[flowMonths.length - 1].label}</span>
            <b className={lastSaved < 0 ? 'loss' : ''}><Money value={lastSaved} sign /></b>
            <em>
              {flowMonths[flowMonths.length - 1].income
                ? `${((lastSaved / flowMonths[flowMonths.length - 1].income) * 100).toFixed(0)}% savings rate`
                : 'No income logged'}
            </em>
          </div>
        )}
      </div>

      </div>

      <aside className="a-desk-aside">
        {moverRows.length > 0 && (
          <>
            <div className="a-header">Today&rsquo;s movers <em>Biggest moves among your positions</em></div>
            <section className="a-gcard">
              {moverRows.map((m) => (
                <button
                  key={m.symbol}
                  type="button"
                  className="a-arow tap"
                  onClick={() => look({ kind: 'holding', symbol: m.symbol })}
                >
                  <LogoAvatar symbol={m.symbol} name={m.name} color="#FFD84D" />
                  <span className="a-atext">
                    <b>{m.name || m.symbol}</b>
                    <em>
                      {m.symbol}
                      {m.price != null ? ` · ${chf(m.price, false, currency)}` : ''}
                    </em>
                  </span>
                  <span className={`a-tag ${(m.dayChangePercent ?? 0) >= 0 ? 'gain' : 'loss'}`}>
                    {pctStr(m.dayChangePercent ?? 0)}
                  </span>
                </button>
              ))}
            </section>
          </>
        )}

        <div className="a-header">Portfolio health <em>How concentrated and how liquid the book is</em></div>
        <section className="a-gcard pad">
          <div className="a-healthrow">
            <span>Concentration</span>
            <span className="a-catbar">
              <i
                style={{
                  width: `${Math.min(top?.percent ?? 0, 100)}%`,
                  background: (top?.percent ?? 0) > 50 ? 'var(--warn)' : 'var(--gain)',
                }}
              />
            </span>
            <b>{(top?.percent ?? 0).toFixed(0)}%</b>
          </div>
          <div className="a-healthrow">
            <span>Liquid</span>
            <span className="a-catbar">
              <i
                style={{
                  width: `${grossNow ? Math.min((liquid / grossNow) * 100, 100) : 0}%`,
                  background: 'var(--accent)',
                }}
              />
            </span>
            <b>{grossNow ? ((liquid / grossNow) * 100).toFixed(0) : 0}%</b>
          </div>
          {top && (concentration?.top?.length ?? (sampleOn ? 2 : 0)) >= 2 && (
            <p className="a-insnote spaced">
              <b>{top.label || top.symbol}</b> is the largest holding
              {(top.percent ?? 0) > 50 ? ' — over half the book sits in one place.' : '.'}
            </p>
          )}
          <div className="a-riskbar spaced">
            {riskBuckets.map((b) => (
              <i
                key={b.key}
                style={{ flex: Math.max(b.amount, 0.01), background: b.color }}
              />
            ))}
          </div>
          <div className="a-keys">
            {riskBuckets.map((b) => (
              <span key={b.key} className="a-key static">
                <span className="a-dot" style={{ background: b.color }} />
                {b.name}
                <b>{((b.amount / riskTotal) * 100).toFixed(0)}%</b>
              </span>
            ))}
          </div>
        </section>

        {goalRows.length > 0 && (
          <>
            <div className="a-header">Goals <em>Progress from live balances</em></div>
            <section className="a-gcard">
              {goalRows.map(({ goal, status, color }) => (
                <Link key={goal.id} to="/goals" className="a-arow tap">
                  <Ring pct={status.pct} color={color} size={36} stroke={4.5} label="" />
                  <span className="a-atext">
                    <b>{goal.name}</b>
                    <em>
                      {status.state === 'funded'
                        ? 'Funded'
                        : status.state === 'behind'
                          ? 'Behind — needs more each month'
                          : status.etaDate
                            ? `On course for ${monthLabel(status.etaDate)}`
                            : STATE_COPY[status.state].label}
                    </em>
                  </span>
                  <span className={`a-tag ${STATE_COPY[status.state].tone}`}>
                    {status.pct.toFixed(0)}%
                  </span>
                </Link>
              ))}
            </section>
          </>
        )}

        <div className="a-header">Market recap <em>News on what you hold</em></div>
        <section className="a-gcard pad">
          {(news?.articles ?? []).slice(0, 5).map((a) => (
            <a
              key={`${a.link}-${a.title}`}
              className="a-newsrow"
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <em>
                {[
                  (a.symbols ?? []).slice(0, 3).join(' · '),
                  a.publisher,
                  a.publishedAt ? relativeTime(a.publishedAt) : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </em>
              <b>{a.title}</b>
            </a>
          ))}
          {!(news?.articles ?? []).length && (
            <p className="a-insnote spaced">No recent stories mention your holdings.</p>
          )}
        </section>
      </aside>
      </div>

      {(geoRows.length > 1 || secRows.length > 1) && (
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
        <Plus size={17} />
        Add account
      </Link>
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  useAllocation,
  useBenchmark,
  useConcentration,
  useFlows,
  useHistory,
  useIncome,
  useOverview,
  type AllocationDimension,
  type HistoryRange,
} from '@/hooks/useAnalytics'
import {
  CompareChart,
  DetailChart,
  FlowBars,
  MiniBars,
  Ring,
  SplitBar,
} from '@/wealth/charts'
import { useMoney } from '@/wealth/format'
import { useQuickLook } from '@/wealth/QuickLook'
import { toSplitRows } from '@/wealth/Insights'
import { FLAGS, LogoAvatar } from '@/wealth/logos'
import { useMergedHoldings } from '@/wealth/useMergedHoldings'
import {
  CLASS_BY_KEY,
  GAIN,
  GEO_COLORS,
  RANGES,
  SECTOR_COLORS,
  TINT,
  classOf,
} from '@/wealth/tokens'

const CUTS: Array<{ value: AllocationDimension; label: string }> = [
  { value: 'assetClass', label: 'Class' },
  { value: 'sector', label: 'Sector' },
  { value: 'region', label: 'Region' },
  { value: 'currency', label: 'Currency' },
  { value: 'account', label: 'Account' },
]

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function longDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00`)
  if (!Number.isFinite(d.getTime())) return month
  return d.toLocaleDateString('en-GB', { month: 'short' })
}

export function Analysis() {
  const { chf, pctStr } = useMoney()
  const { look } = useQuickLook()
  const [range, setRange] = useState<(typeof RANGES)[number]['k']>('3M')
  const [cut, setCut] = useState<AllocationDimension>('assetClass')
  const [cur, setCur] = useState<number | null>(null)

  const historyRange: HistoryRange =
    (RANGES.find((r) => r.k === range)?.n as HistoryRange) ?? '3m'
  const { data: overview } = useOverview()
  const { data: history } = useHistory(historyRange)
  const { data: allocation } = useAllocation(cut)
  const { data: benchmark } = useBenchmark(
    historyRange === 'all' ? '1y' : historyRange,
  )
  const { data: concentration } = useConcentration()
  const { data: income } = useIncome(12)
  const { data: flows } = useFlows(12)
  const holdings = useMergedHoldings()

  useEffect(() => {
    document.title = 'Analysis'
  }, [])

  const currency = overview?.currency || 'USD'
  const points = history?.points ?? []
  const values = useMemo(() => points.map((p) => p.value), [points])
  const total = overview?.totalValue ?? values[values.length - 1] ?? 0
  const shown = cur != null && values[cur] != null ? values[cur] : total
  const first = values[0]
  const last = values[values.length - 1]
  const periodDelta = first != null && last != null ? last - first : null
  const periodPct = first ? ((last - first) / first) * 100 : null

  const cutRows = useMemo(() => {
    const segments = allocation?.segments ?? []
    if (cut === 'assetClass') {
      return segments.map((s) => {
        const cls = classOf(s.key)
        return {
          key: s.key,
          name: cls.id === 'other' ? s.label : cls.name,
          color: cls.color,
          amount: s.value,
          pct: s.percent,
        }
      })
    }
    if (cut === 'region') return toSplitRows(segments, GEO_COLORS, FLAGS)
    if (cut === 'sector') return toSplitRows(segments, SECTOR_COLORS)
    const palette = ['#3ABEFF', '#FFD84D', '#A57BFF', '#4BD57E', '#FF9F45', '#FF5C48', '#8E8E93']
    return segments.map((s, i) => ({
      key: s.key,
      name: s.label,
      color: palette[i % palette.length],
      amount: s.value,
      pct: s.percent,
    }))
  }, [allocation, cut])

  const topPositions = useMemo(() => {
    const bySymbol = new Map<
      string,
      { symbol: string; name?: string; value: number }
    >()
    for (const h of holdings) {
      const acc = bySymbol.get(h.symbol) ?? { symbol: h.symbol, name: h.name, value: 0 }
      acc.value += h.marketValue || 0
      acc.name = acc.name || h.name
      bySymbol.set(h.symbol, acc)
    }
    return [...bySymbol.values()].sort((a, b) => b.value - a.value)
  }, [holdings])

  const conc = concentration
  const top5 = conc?.top5Percent ?? null
  const effective = conc?.effectiveHoldings ?? null

  const incomeMonths = (income?.byMonth ?? []).map((m) => ({
    label: monthLabel(m.month),
    value: m.total ?? (m.dividends || 0) + (m.interest || 0),
  }))
  const ttm = income?.ttmTotal ?? incomeMonths.reduce((s, m) => s + m.value, 0)

  const flowMonths = (flows?.byMonth ?? []).map((m) => ({
    label: monthLabel(m.month),
    income: m.deposits || 0,
    spend: Math.abs(m.withdrawals || 0),
  }))
  const netFlows =
    flows?.netTotal ??
    (flows?.byMonth ?? []).reduce((s, m) => s + (m.net ?? (m.deposits || 0) - Math.abs(m.withdrawals || 0)), 0)

  const bench = benchmark
  const benchLen = Math.min(
    bench?.portfolio?.length ?? 0,
    bench?.benchmark?.length ?? 0,
  )

  return (
    <>
      <section className="a-heroblock">
        <div className="a-herotop">
          <div className="a-hero bare">
            <div className="a-caption">
              {cur != null && points[cur] ? longDate(points[cur].date) : 'Portfolio value'}
            </div>
            <div className="a-value">{chf(shown, false, currency)}</div>
            {cur == null && periodDelta != null ? (
              <div className={`a-delta ${periodDelta >= 0 ? 'gain' : 'loss'}`}>
                {chf(periodDelta, true, currency)}
                {periodPct != null ? ` · ${pctStr(periodPct)}` : ''}
                <span className="a-period">{range}</span>
              </div>
            ) : cur == null && overview?.unrealizedPnl != null ? (
              <div className={`a-delta ${overview.unrealizedPnl >= 0 ? 'gain' : 'loss'}`}>
                {chf(overview.unrealizedPnl, true, currency)} unrealized
              </div>
            ) : null}
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

        {values.length >= 2 ? (
          <DetailChart
            values={values}
            height={220}
            color="#FFFFFF"
            dates={(i) => (points[i] ? shortDate(points[i].date) : '')}
            onScrub={setCur}
          />
        ) : (
          <p className="a-insnote spaced">
            History starts after the first snapshot.
          </p>
        )}
      </section>

      <div className="a-stats">
        <div className="a-stat">
          <span>Invested</span>
          <b>{chf(overview?.investedValue ?? total, false, currency)}</b>
        </div>
        <div className="a-stat">
          <span>Cash</span>
          <b>{chf(overview?.cashValue ?? 0, false, currency)}</b>
        </div>
        <div className="a-stat">
          <span>Unrealized P&L</span>
          <b
            className={
              (overview?.unrealizedPnl ?? 0) >= 0 ? 'gain' : 'loss'
            }
          >
            {overview?.unrealizedPnl != null
              ? chf(overview.unrealizedPnl, true, currency)
              : '—'}
          </b>
        </div>
        <div className="a-stat">
          <span>Positions</span>
          <b>{overview?.holdingsCount ?? topPositions.length}</b>
        </div>
      </div>

      <div className="a-desk">
        <div className="a-desk-primary">
          <div className="a-header">Allocation</div>
          <section className="a-gcard pad">
            <div className="a-pills wrap" role="tablist" aria-label="Allocation cut">
              {CUTS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="tab"
                  aria-selected={cut === c.value}
                  className={`a-pill ${cut === c.value ? 'on' : ''}`}
                  onClick={() => setCut(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="a-splitwrap">
              {cut === 'assetClass' ? (
                <>
                  <div className="a-split">
                    {cutRows.map((r) => (
                      <i
                        key={r.key}
                        style={{ flex: Math.max(r.amount, 0.01), background: r.color }}
                        title={r.name}
                      />
                    ))}
                  </div>
                  <div className="a-arows">
                    {cutRows.map((r) => {
                      const cls = classOf(r.key)
                      const known = cls.id !== 'other' || r.key.toLowerCase() === 'other'
                      return (
                        <button
                          key={r.key}
                          type="button"
                          className="a-arow tap"
                          onClick={
                            known && CLASS_BY_KEY[cls.id]
                              ? () => look({ kind: 'class', id: cls.id })
                              : undefined
                          }
                        >
                          <span className="a-tile sm" style={{ background: `${r.color}26` }}>
                            <span className="a-tiledot" style={{ background: r.color }} />
                          </span>
                          <span className="a-atext">
                            <b>{r.name}</b>
                            <em>{r.pct.toFixed(1)}% of portfolio</em>
                          </span>
                          <span className="a-anum">
                            <b>{chf(r.amount, false, currency)}</b>
                          </span>
                          <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <SplitBar rows={cutRows} money={(n) => chf(n, false, currency)} />
              )}
            </div>
          </section>

          <div className="a-header">Against the market</div>
          <section className="a-gcard pad">
            {benchLen >= 2 ? (
              <>
                <CompareChart
                  a={bench!.portfolio.slice(0, benchLen).map((p) => p.indexed)}
                  b={bench!.benchmark.slice(0, benchLen).map((p) => p.indexed)}
                  height={200}
                  dates={(i) =>
                    bench!.portfolio[i] ? shortDate(bench!.portfolio[i].date) : ''
                  }
                />
                <div className="a-chartfoot">
                  <div className="a-keys">
                    <span className="a-key static">
                      <span className="a-dot" style={{ background: '#fff' }} />
                      This book
                      <b>
                        {bench?.portfolioReturnPercent != null
                          ? pctStr(bench.portfolioReturnPercent)
                          : '—'}
                      </b>
                    </span>
                    <span className="a-key static">
                      <span className="a-dot" style={{ background: 'rgba(235,235,245,.38)' }} />
                      {bench?.symbol || 'S&P 500'}
                      <b>
                        {bench?.benchmarkReturnPercent != null
                          ? pctStr(bench.benchmarkReturnPercent)
                          : '—'}
                      </b>
                    </span>
                  </div>
                </div>
                {bench?.note && <p className="a-insnote spaced">{bench.note}</p>}
              </>
            ) : (
              <p className="a-insnote spaced">
                Not enough overlapping history to compare against the market yet.
              </p>
            )}
          </section>

          <div className="a-header">Largest positions</div>
          <section className="a-gcard">
            {topPositions.slice(0, 8).map((p) => {
              const share = total ? (p.value / total) * 100 : 0
              return (
                <button
                  key={p.symbol}
                  type="button"
                  className="a-arow tap"
                  onClick={() => look({ kind: 'holding', symbol: p.symbol })}
                >
                  <LogoAvatar symbol={p.symbol} name={p.name} color="#FFD84D" />
                  <span className="a-atext">
                    <b>{p.name || p.symbol}</b>
                    <em>{p.symbol}</em>
                  </span>
                  <span className="a-catbar fixed">
                    <i style={{ width: `${Math.min(share, 100)}%`, background: TINT }} />
                  </span>
                  <span className="a-anum">
                    <b>{chf(p.value, false, currency)}</b>
                    <em>{share.toFixed(1)}%</em>
                  </span>
                  <ChevronRight size={15} strokeWidth={2.5} className="a-rowchev" />
                </button>
              )
            })}
          </section>
        </div>

        <aside className="a-desk-aside">
          <div className="a-header">Concentration</div>
          <section className="a-gcard pad">
            <div className="a-instop">
              <div>
                <div className="a-inslabel">Top 5 positions</div>
                <div className="a-insval">
                  {top5 != null ? `${top5.toFixed(0)}%` : '—'}
                </div>
              </div>
              {top5 != null && (
                <Ring
                  pct={top5}
                  color={top5 > 70 ? '#FF9F45' : GAIN}
                  label={`${top5.toFixed(0)}%`}
                />
              )}
            </div>
            <p className="a-insnote">
              {conc?.top?.[0]
                ? `${conc.top[0].label || conc.top[0].symbol} is the single largest position at ${conc.top[0].percent.toFixed(1)}%.`
                : 'Concentration shows how much rides on your largest positions.'}
            </p>
            {effective != null && (
              <div className="a-inforow">
                <span>Behaves like</span>
                <b>{effective.toFixed(1)} equal positions</b>
              </div>
            )}
            {conc?.top10Percent != null && (
              <div className="a-inforow">
                <span>Top 10</span>
                <b>{conc.top10Percent.toFixed(0)}% of value</b>
              </div>
            )}
          </section>

          <div className="a-header">Income</div>
          <section className="a-gcard pad">
            <div className="a-hero bare tight">
              <div className="a-caption">Last 12 months</div>
              <div className="a-value sm">{chf(ttm, false, income?.currency || currency)}</div>
            </div>
            {incomeMonths.length >= 2 && (
              <MiniBars data={incomeMonths} color={GAIN} height={140} />
            )}
            {(income?.bySymbol?.length ?? 0) > 0 && (
              <div className="a-arows">
                {income!.bySymbol!.slice(0, 3).map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    className="a-arow tap"
                    onClick={() => look({ kind: 'holding', symbol: s.symbol })}
                  >
                    <span className="a-atext">
                      <b>{s.symbol}</b>
                      <em>{s.count ? `${s.count} payouts` : 'Payouts'}</em>
                    </span>
                    <span className="a-anum">
                      <b>{chf(s.total, false, income?.currency || currency)}</b>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="a-header">Deposits &amp; withdrawals</div>
          <section className="a-gcard pad">
            <div className="a-hero bare tight">
              <div className="a-caption">Net over 12 months</div>
              <div className={`a-value sm ${netFlows >= 0 ? '' : 'loss'}`}>
                {chf(netFlows, true, flows?.currency || currency)}
              </div>
            </div>
            {flowMonths.length >= 2 && <FlowBars data={flowMonths} height={150} />}
            <div className="a-keys">
              <span className="a-key static">
                <span className="a-dot" style={{ background: GAIN }} />
                In
              </span>
              <span className="a-key static">
                <span className="a-dot" style={{ background: '#FF453A' }} />
                Out
              </span>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}

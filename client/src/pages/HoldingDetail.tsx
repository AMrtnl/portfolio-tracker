import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { NewsList } from '@/components/NewsList'
import {
  useAnalyticsHoldings,
  usePriceHistory,
  useQuote,
  useTrades,
  warningText,
  type AnalyticsHolding,
  type PriceHistoryRange,
} from '@/hooks/useAnalytics'
import { DetailChart } from '@/wealth/charts'
import { useMoney } from '@/wealth/format'
import { LogoAvatar } from '@/wealth/logos'

const PRICE_RANGES: Array<{ value: PriceHistoryRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
]

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fillDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function compact(n: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n)
  } catch {
    return n.toLocaleString()
  }
}

function units(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/** Merge same-symbol lots into one position view. */
function mergeLots(lots: AnalyticsHolding[]): AnalyticsHolding | null {
  if (lots.length === 0) return null
  if (lots.length === 1) return lots[0]

  let qty = 0
  let marketValue = 0
  let costBasis = 0
  let hasCost = false
  let dayChange = 0
  let hasDay = false
  let weight = 0

  for (const lot of lots) {
    qty += lot.units ?? 0
    marketValue += lot.marketValue || 0
    if (lot.costBasis != null) {
      costBasis += lot.costBasis
      hasCost = true
    }
    if (lot.dayChange != null) {
      dayChange += lot.dayChange
      hasDay = true
    }
    weight += lot.weight ?? 0
  }

  const averageCost = hasCost && qty > 0 ? costBasis / qty : lots[0].averageCost ?? null
  const unrealizedPnl = hasCost ? marketValue - costBasis : lots[0].unrealizedPnl ?? null
  const unrealizedPnlPercent =
    hasCost && costBasis !== 0
      ? (unrealizedPnl! / costBasis) * 100
      : lots[0].unrealizedPnlPercent ?? null

  return {
    ...lots[0],
    units: qty,
    marketValue,
    costBasis: hasCost ? costBasis : lots[0].costBasis ?? null,
    averageCost,
    unrealizedPnl,
    unrealizedPnlPercent,
    dayChange: hasDay ? dayChange : lots[0].dayChange ?? null,
    weight,
    accountLabel: lots.length > 1 ? `${lots.length} accounts` : lots[0].accountLabel,
  }
}

/**
 * One holding, fully opened. Fey-style anatomy: identity, hero price with
 * a full-bleed chart and range pills at the chart's edge, then a stat
 * strip, your position, fills, and news for this symbol only.
 */
export function HoldingDetail() {
  const { chf, pctStr } = useMoney()
  const { symbol: raw } = useParams<{ symbol: string }>()
  const symbol = decodeURIComponent(raw || '').toUpperCase()
  const [range, setRange] = useState<PriceHistoryRange>('1y')
  const [cur, setCur] = useState<number | null>(null)

  const holdingsQ = useAnalyticsHoldings()
  const quoteQ = useQuote(symbol || undefined)
  const historyQ = usePriceHistory(symbol || undefined, range)
  const tradesQ = useTrades(symbol || undefined)

  useEffect(() => {
    document.title = symbol || 'Holding'
  }, [symbol])

  const lots = useMemo(
    () => (holdingsQ.data?.holdings ?? []).filter((h) => h.symbol.toUpperCase() === symbol),
    [holdingsQ.data?.holdings, symbol],
  )
  const position = useMemo(() => mergeLots(lots), [lots])
  const quote = quoteQ.data
  const points = historyQ.data?.points ?? []
  const notes = [...warningText(historyQ.data?.warnings), ...warningText(quoteQ.data?.warnings)]

  const name = position?.name || quote?.name
  const currency = position?.currency || quote?.currency || 'USD'
  const livePrice = quote?.price ?? position?.price ?? null
  const price = cur != null && points[cur] ? points[cur].close : livePrice

  const first = points[0]?.close
  const last = points[points.length - 1]?.close
  const periodPct = first != null && last != null && first !== 0 ? ((last - first) / first) * 100 : null
  const plottable = points.length >= 3

  const low = quote?.fiftyTwoWeekLow
  const high = quote?.fiftyTwoWeekHigh
  const rangePos =
    low != null && high != null && high > low && livePrice != null
      ? Math.min(Math.max(((livePrice - low) / (high - low)) * 100, 0), 100)
      : null

  const trades = tradesQ.data?.trades ?? []
  const invested = trades.reduce((s, t) => s + (t.side === 'buy' ? t.total : -t.total), 0)

  if (!symbol) {
    return (
      <div className="ui-empty">
        <div className="ui-empty-icon">?</div>
        <b>Missing symbol</b>
        <p>Open a holding from your portfolio to see its detail.</p>
        <Link to="/" className="ui-btn tinted sm">
          Back to portfolio
        </Link>
      </div>
    )
  }

  return (
    <article>
      <Link to="/" className="a-back">
        <ArrowLeft size={20} strokeWidth={2.5} />
        Wealth
      </Link>

      <section className="a-heroblock">
        <div className="a-herotop">
          <div className="a-detid">
            <LogoAvatar symbol={symbol} name={name} className="lg" color="#FFD84D" />
            <div>
              <h2 className="a-dettitle">{name || symbol}</h2>
              <p className="a-detsub">
                {symbol}
                {quote?.sector ? ` · ${quote.sector}` : ''}
                {quote?.industry ? ` · ${quote.industry}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="a-hero bare">
          <div className="a-caption">
            {cur != null && points[cur] ? shortDate(points[cur].date) : 'Price'}
          </div>
          <div className="a-value">
            {price != null ? (
              <>
                <span className="a-unit">{currency}</span>
                {chf(price, false, currency)}
              </>
            ) : (
              '—'
            )}
          </div>
          {cur == null && quote?.dayChangePercent != null ? (
            <div className={`a-delta ${quote.dayChangePercent >= 0 ? 'gain' : 'loss'}`}>
              {quote.dayChange != null ? `${chf(quote.dayChange, true, currency)} · ` : ''}
              {pctStr(quote.dayChangePercent)}
              <span className="a-period">today</span>
            </div>
          ) : cur == null && periodPct != null ? (
            <div className={`a-delta ${periodPct >= 0 ? 'gain' : 'loss'}`}>
              {pctStr(periodPct)}
              <span className="a-period">{PRICE_RANGES.find((r) => r.value === range)?.label}</span>
            </div>
          ) : null}
        </div>

        {plottable ? (
          <DetailChart
            values={points.map((p) => p.close)}
            height={230}
            color="#FFFFFF"
            dates={(i) => (points[i] ? shortDate(points[i].date) : '')}
            onScrub={setCur}
          />
        ) : (
          <p className="a-insnote spaced">
            {historyQ.data?.note ||
              'Not enough daily closes to draw a line yet. Meridian never invents a curve.'}
          </p>
        )}

        <div className="a-chartfoot">
          {periodPct != null && plottable ? (
            <span className={`a-tag ${periodPct >= 0 ? 'gain' : 'loss'}`}>
              {pctStr(periodPct)} over{' '}
              {PRICE_RANGES.find((r) => r.value === range)?.label}
            </span>
          ) : (
            <span />
          )}
          <div className="a-pills" role="tablist" aria-label="Price range">
            {PRICE_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={range === r.value}
                className={`a-pill ${range === r.value ? 'on' : ''}`}
                onClick={() => {
                  setRange(r.value)
                  setCur(null)
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(quote?.marketCap != null ||
        quote?.peRatio != null ||
        low != null ||
        high != null) && (
        <div className="a-statstrip">
          {quote?.marketCap != null && (
            <div className="a-statcell">
              <span>Mkt cap</span>
              <b>{compact(quote.marketCap)}</b>
            </div>
          )}
          {quote?.peRatio != null && (
            <div className="a-statcell">
              <span>P/E</span>
              <b>{quote.peRatio.toFixed(1)}</b>
            </div>
          )}
          {low != null && (
            <div className="a-statcell">
              <span>52w low</span>
              <b>{chf(low, false, currency)}</b>
            </div>
          )}
          {high != null && (
            <div className="a-statcell">
              <span>52w high</span>
              <b>{chf(high, false, currency)}</b>
            </div>
          )}
          {quote?.sector && (
            <div className="a-statcell">
              <span>Sector</span>
              <b>{quote.sector}</b>
            </div>
          )}
        </div>
      )}

      {rangePos != null && (
        <div className="a-range">
          <div className="a-rangebar">
            <i style={{ left: `${rangePos}%` }} />
          </div>
          <div className="a-rangelabels">
            <span>{chf(low!, false, currency)}</span>
            <em>52 weeks</em>
            <span>{chf(high!, false, currency)}</span>
          </div>
        </div>
      )}

      <div className="a-desk">
        <div className="a-desk-primary">
          <div className="a-header">Your position</div>
          {position ? (
            <section className="a-gcard pad">
              <div className="a-statstrip flat">
                <div className="a-statcell">
                  <span>Market value</span>
                  <b>{chf(position.marketValue ?? 0, false, currency)}</b>
                </div>
                <div className="a-statcell">
                  <span>Units</span>
                  <b>{position.units != null ? units(position.units) : '—'}</b>
                </div>
                <div className="a-statcell">
                  <span>Avg cost</span>
                  <b>
                    {position.averageCost != null
                      ? chf(position.averageCost, false, currency)
                      : '—'}
                  </b>
                </div>
                <div className="a-statcell">
                  <span>Unrealized P&L</span>
                  <b
                    className={
                      (position.unrealizedPnl ?? 0) >= 0 ? 'gain' : 'loss'
                    }
                  >
                    {position.unrealizedPnl != null
                      ? chf(position.unrealizedPnl, true, currency)
                      : '—'}
                  </b>
                </div>
                <div className="a-statcell">
                  <span>Return</span>
                  <b
                    className={
                      position.unrealizedPnlPercent == null
                        ? ''
                        : position.unrealizedPnlPercent >= 0
                          ? 'gain'
                          : 'loss'
                    }
                  >
                    {position.unrealizedPnlPercent != null
                      ? pctStr(position.unrealizedPnlPercent)
                      : '—'}
                  </b>
                </div>
                {position.weight != null && (
                  <div className="a-statcell">
                    <span>Weight</span>
                    <b>{position.weight.toFixed(1)}%</b>
                  </div>
                )}
              </div>
              <p className="a-insnote spaced">
                {position.accountLabel
                  ? `Held in ${position.accountLabel}.`
                  : 'Across your connected accounts.'}
                {position.costBasis == null
                  ? ' Cost basis is not reported by the provider.'
                  : ''}
              </p>
            </section>
          ) : (
            <section className="a-gcard pad">
              <p className="a-insnote spaced">
                You don&rsquo;t currently hold {symbol}. The quote and chart still
                reflect the market.
              </p>
            </section>
          )}

          {trades.length > 0 && (
            <>
              <div className="a-header">Purchases</div>
              <section className="a-gcard">
                {trades.map((t) => (
                  <div key={`${t.date}-${t.side}-${t.price}`} className="a-arow">
                    <span className={`a-tag ${t.side === 'buy' ? 'gain' : 'loss'}`}>
                      {t.side === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                    <span className="a-atext">
                      <b>
                        {units(t.units)} × {chf(t.price, false, t.currency || currency)}
                      </b>
                      <em>{fillDate(t.date)}</em>
                    </span>
                    <span className="a-anum">
                      <b>{chf(t.total, false, t.currency || currency)}</b>
                    </span>
                  </div>
                ))}
                <div className="a-postotal">
                  <span>
                    {trades.length} fills
                    {trades[0]?.accountLabel ? ` · ${trades[0].accountLabel}` : ''}
                  </span>
                  <b>{chf(invested, false, currency)} invested</b>
                </div>
              </section>
            </>
          )}

          {notes.length > 0 && (
            <p className="a-insnote spaced">{notes.join(' · ')}</p>
          )}
        </div>

        <aside className="a-desk-aside">
          <NewsList headingId="holding-news" symbol={symbol} limit={8} title={`News · ${symbol}`} />
        </aside>
      </div>
    </article>
  )
}

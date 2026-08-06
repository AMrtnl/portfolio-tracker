import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { NewsList } from '@/components/NewsList'
import { Amount, Delta } from '@/components/ui/Amount'
import { LinePlot, RangeTabs, type Series } from '@/components/ui/chart'
import { SectionHead, StatStrip } from '@/components/ui/data'
import {
  EmptyState,
  HistoryBuilding,
  PanelUnavailable,
  SkeletonBlock,
  SkeletonChart,
  SkeletonRows,
} from '@/components/ui/states'
import {
  useAnalyticsHoldings,
  usePriceHistory,
  useQuote,
  warningText,
  type AnalyticsHolding,
  type PriceHistoryRange,
} from '@/hooks/useAnalytics'
import { formatAmount, formatCurrency } from '@/lib/utils'

const RANGES: Array<{ value: PriceHistoryRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
]

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Merge same-symbol lots into one position view. */
function mergeLots(lots: AnalyticsHolding[]): AnalyticsHolding | null {
  if (lots.length === 0) return null
  if (lots.length === 1) return lots[0]

  let units = 0
  let marketValue = 0
  let costBasis = 0
  let hasCost = false
  let dayChange = 0
  let hasDay = false
  let weight = 0

  for (const lot of lots) {
    units += lot.units ?? 0
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

  const averageCost =
    hasCost && units > 0 ? costBasis / units : lots[0].averageCost ?? null
  const unrealizedPnl = hasCost ? marketValue - costBasis : lots[0].unrealizedPnl ?? null
  const unrealizedPnlPercent =
    hasCost && costBasis !== 0 ? (unrealizedPnl! / costBasis) * 100 : lots[0].unrealizedPnlPercent ?? null

  return {
    ...lots[0],
    units,
    marketValue,
    costBasis: hasCost ? costBasis : lots[0].costBasis ?? null,
    averageCost,
    unrealizedPnl,
    unrealizedPnlPercent,
    dayChange: hasDay ? dayChange : lots[0].dayChange ?? null,
    weight,
    accountLabel:
      lots.length > 1
        ? `${lots.length} accounts`
        : lots[0].accountLabel,
  }
}

/**
 * One holding, fully opened.
 *
 * Shape follows Acorns / N26 / Revolut asset detail: identity + position
 * value and unrealized P&L first, then a price chart with honest empty
 * states, then a ledger of what you own, then news for that symbol only.
 */
export function HoldingDetail() {
  const { symbol: raw } = useParams<{ symbol: string }>()
  const symbol = decodeURIComponent(raw || '').toUpperCase()
  const [range, setRange] = useState<PriceHistoryRange>('1y')
  const [hover, setHover] = useState<number | null>(null)

  const holdingsQ = useAnalyticsHoldings()
  const quoteQ = useQuote(symbol || undefined)
  const historyQ = usePriceHistory(symbol || undefined, range)

  useEffect(() => {
    document.title = symbol ? `${symbol} — Meridian` : 'Holding — Meridian'
  }, [symbol])

  const lots = useMemo(
    () => (holdingsQ.data?.holdings ?? []).filter((h) => h.symbol.toUpperCase() === symbol),
    [holdingsQ.data?.holdings, symbol],
  )
  const position = useMemo(() => mergeLots(lots), [lots])
  const quote = quoteQ.data
  const points = historyQ.data?.points ?? []
  const historyWarnings = warningText(historyQ.data?.warnings)
  const quoteWarnings = warningText(quoteQ.data?.warnings)

  const first = points[0]?.close
  const last = points[points.length - 1]?.close
  const periodChange =
    first != null && last != null && first !== 0
      ? ((last - first) / first) * 100
      : null

  const hoverActive = hover != null && hover >= 0 && hover < points.length
  const plottable = points.length >= 3

  const series: Series[] = [
    {
      id: 'price',
      label: symbol,
      color: 'hsl(var(--chart-1))',
      fill: true,
      values: points.map((p) => p.close),
    },
  ]

  if (!symbol) {
    return (
      <div className="measure px-5 py-10 sm:px-8">
        <EmptyState
          size="page"
          glyph="holdings"
          title="Missing symbol"
          description="Open a holding from your portfolio to see its detail."
          action={
            <Link
              to="/"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Back to portfolio
            </Link>
          }
        />
      </div>
    )
  }

  const name = position?.name || quote?.name
  const currency = position?.currency || quote?.currency || 'USD'
  const marketValue = position?.marketValue
  const price = quote?.price ?? position?.price ?? null

  return (
    <article className="pb-16">
      <div className="measure px-5 pt-8 sm:px-8 sm:pt-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Portfolio
        </Link>

        <header className="mt-6">
          <p className="t-eyebrow">{symbol}</p>
          <h1 className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
            {name || symbol}
          </h1>

          {quoteQ.isLoading && !price ? (
            <SkeletonBlock className="mt-4 h-10 w-48" />
          ) : price != null ? (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Amount value={price} currency={currency} size="lg" />
              <Delta
                amount={quote?.dayChange ?? null}
                percent={quote?.dayChangePercent ?? null}
                size="md"
                showArrow
              />
              <span className="text-sm text-muted-foreground">today</span>
            </div>
          ) : quoteQ.error ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No live quote for this symbol.
            </p>
          ) : null}

          {(quote?.sector || quote?.industry) && (
            <p className="t-meta mt-2">
              {[quote.sector, quote.industry].filter(Boolean).join(' · ')}
            </p>
          )}
        </header>

        {/* Position ledger — Acorns "What you own" / N26 "In your portfolio" */}
        <section className="mt-10" aria-labelledby="position-heading">
          <SectionHead
            id="position-heading"
            title="Your position"
            caption={
              position?.accountLabel
                ? `Held in ${position.accountLabel}.`
                : 'Across your connected accounts.'
            }
          />

          {holdingsQ.isLoading ? (
            <SkeletonRows rows={2} />
          ) : !position ? (
            <p className="border-y border-border/60 py-6 text-sm text-muted-foreground">
              You don’t currently hold {symbol}. The quote and chart below still
              reflect the market, when available.
            </p>
          ) : (
            <StatStrip
              stats={[
                {
                  label: 'Market value',
                  value: (
                    <Amount value={marketValue ?? 0} currency={currency} size="md" />
                  ),
                  sub:
                    position.weight != null
                      ? `${position.weight.toFixed(1)}% of portfolio`
                      : undefined,
                },
                {
                  label: 'Units',
                  value: (
                    <span className="num text-base font-medium">
                      {position.units != null ? formatAmount(position.units) : '—'}
                    </span>
                  ),
                  sub:
                    position.averageCost != null
                      ? `Avg cost ${formatCurrency(position.averageCost, { currency })}`
                      : undefined,
                },
                {
                  label: 'Cost basis',
                  value:
                    position.costBasis != null ? (
                      <Amount value={position.costBasis} currency={currency} size="md" />
                    ) : (
                      <span className="text-base text-muted-foreground">—</span>
                    ),
                  sub:
                    position.costBasis == null
                      ? 'Not reported by provider'
                      : undefined,
                },
                {
                  label: 'Unrealized P&L',
                  value: (
                    <Delta
                      amount={position.unrealizedPnl ?? null}
                      percent={position.unrealizedPnlPercent ?? null}
                      size="md"
                    />
                  ),
                  sub:
                    position.dayChange != null ? (
                      <span>
                        Today{' '}
                        <Delta
                          amount={position.dayChange}
                          percent={position.dayChangePercent ?? null}
                          size="sm"
                        />
                      </span>
                    ) : undefined,
                },
              ]}
            />
          )}
        </section>

        {/* Price chart */}
        <section className="mt-12" aria-labelledby="chart-heading">
          <SectionHead
            id="chart-heading"
            title="Price"
            caption="Daily closes from the market. Gaps are left blank rather than filled in."
            meta={
              periodChange != null && plottable ? (
                <Delta percent={periodChange} size="sm" />
              ) : undefined
            }
          />

          {historyQ.isLoading ? (
            <SkeletonChart />
          ) : historyQ.error ? (
            <PanelUnavailable
              what="Price history"
              onRetry={() => historyQ.refetch()}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0" aria-live="polite">
                  {hoverActive ? (
                    <>
                      <p className="t-eyebrow mb-1">
                        {shortDate(points[hover!].date)}
                      </p>
                      <Amount
                        value={points[hover!].close}
                        currency={historyQ.data?.currency ?? currency}
                        size="md"
                      />
                    </>
                  ) : historyQ.data?.note ? (
                    <p className="text-sm text-muted-foreground">{historyQ.data.note}</p>
                  ) : periodChange != null && plottable ? (
                    <p className="text-sm text-muted-foreground">
                      {RANGES.find((r) => r.value === range)?.label} change{' '}
                      <Delta percent={periodChange} size="sm" className="inline" />
                    </p>
                  ) : null}
                </div>
                <RangeTabs
                  label="Price range"
                  value={range}
                  options={RANGES}
                  onChange={(next) => {
                    setRange(next)
                    setHover(null)
                  }}
                />
              </div>

              {plottable ? (
                <LinePlot
                  series={series}
                  labels={points.map((p) => shortDate(p.date))}
                  formatValue={(v) =>
                    formatCurrency(v, {
                      currency: historyQ.data?.currency ?? currency,
                      digits: v >= 100 ? 2 : 4,
                    })
                  }
                  onHover={setHover}
                  hoverIndex={hover}
                  ariaLabel={`Price history for ${symbol}`}
                />
              ) : (
                <HistoryBuilding
                  title={
                    historyQ.data?.note
                      ? 'No chart for this asset'
                      : 'Not enough closes to draw a line yet'
                  }
                  detail={
                    historyQ.data?.note ||
                    'Meridian needs at least three daily closes before it will plot a curve. Inventing a line from two points would overstate precision.'
                  }
                  footnote={
                    points.length > 0
                      ? `${points.length} ${points.length === 1 ? 'close' : 'closes'} in this range.`
                      : undefined
                  }
                />
              )}

              {historyWarnings.length > 0 && (
                <ul className="t-meta list-none space-y-1 p-0">
                  {historyWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {(quote?.fiftyTwoWeekHigh != null || quote?.marketCap != null) && (
          <section className="mt-12" aria-labelledby="quote-stats">
            <SectionHead id="quote-stats" title="Market" />
            <StatStrip
              animate={false}
              stats={[
                ...(quote.fiftyTwoWeekLow != null
                  ? [
                      {
                        label: '52-week low',
                        value: (
                          <Amount
                            value={quote.fiftyTwoWeekLow}
                            currency={currency}
                            size="sm"
                          />
                        ),
                      },
                    ]
                  : []),
                ...(quote.fiftyTwoWeekHigh != null
                  ? [
                      {
                        label: '52-week high',
                        value: (
                          <Amount
                            value={quote.fiftyTwoWeekHigh}
                            currency={currency}
                            size="sm"
                          />
                        ),
                      },
                    ]
                  : []),
                ...(quote.marketCap != null
                  ? [
                      {
                        label: 'Market cap',
                        value: (
                          <Amount
                            value={quote.marketCap}
                            currency={currency}
                            compact
                            size="sm"
                          />
                        ),
                      },
                    ]
                  : []),
                ...(quote.peRatio != null
                  ? [
                      {
                        label: 'P/E',
                        value: (
                          <span className="num text-sm font-medium">
                            {quote.peRatio.toFixed(1)}
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {quoteWarnings.length > 0 && (
              <ul className="t-meta mt-3 list-none space-y-1 p-0">
                {quoteWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mt-12">
          <NewsList
            headingId="holding-news"
            symbol={symbol}
            limit={8}
            title={`News · ${symbol}`}
          />
        </div>
      </div>
    </article>
  )
}

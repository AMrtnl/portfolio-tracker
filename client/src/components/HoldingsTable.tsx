import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Amount, Delta } from '@/components/ui/Amount'
import { Meter } from '@/components/ui/chart'
import {
  SectionHead,
  Segmented,
  SortHeader,
  type SortDirection,
} from '@/components/ui/data'
import { EmptyState, PanelUnavailable, SkeletonRows } from '@/components/ui/states'
import { useAnalyticsHoldings, type AnalyticsHolding } from '@/hooks/useAnalytics'
import { cn, formatAmount, formatCurrency } from '@/lib/utils'

/** Which figure the switchable right-hand column shows. */
type Metric = 'pnl' | 'day' | 'cost'

const METRICS: Array<{ value: Metric; label: string }> = [
  { value: 'pnl', label: 'Total gain' },
  { value: 'day', label: 'Today' },
  { value: 'cost', label: 'Cost' },
]

type SortKey = 'symbol' | 'value' | 'metric' | 'weight'

/**
 * Every holding, in one grid.
 *
 * Sixty-six rows is enough that the layout has to earn its calm. Three
 * patterns from the desktop brokerages do the work:
 *
 *   • Quicken's web holdings table sets the column order — identity left,
 *     tabular money right, one row per position, search above the header.
 *   • Fidelity's positions list makes the right-hand metric switchable
 *     ("Total gain/loss $" as a dropdown) instead of showing every figure
 *     at once. That's what keeps this under six columns.
 *   • Monarch's "Group by type" collapses the list by account when the
 *     flat list gets long.
 *
 * On a phone the columns collapse to identity + value + the chosen metric,
 * with the weight meter beneath — the table is never side-scrolled.
 */
export function HoldingsTable({
  headingId,
  /** Caps the list and links onward; used on the portfolio overview. */
  limit,
}: {
  headingId: string
  limit?: number
}) {
  const { data, isLoading, error, refetch } = useAnalyticsHoldings()
  const [metric, setMetric] = useState<Metric>('pnl')
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [query, setQuery] = useState('')
  const [grouped, setGrouped] = useState(false)

  const all = data?.holdings ?? []

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setDirection(key === 'symbol' ? 'asc' : 'desc')
    }
  }

  function metricValue(h: AnalyticsHolding): number {
    if (metric === 'day') return h.dayChange ?? 0
    if (metric === 'cost') return h.costBasis ?? 0
    return h.unrealizedPnl ?? 0
  }

  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? all.filter(
        (h) =>
          h.symbol.toLowerCase().includes(needle) ||
          (h.name ?? '').toLowerCase().includes(needle) ||
          (h.accountLabel ?? '').toLowerCase().includes(needle) ||
          (h.sector ?? '').toLowerCase().includes(needle),
      )
    : all

  const sorted = [...filtered].sort((a, b) => {
    const flip = direction === 'desc' ? 1 : -1
    if (sortKey === 'symbol') {
      return a.symbol.localeCompare(b.symbol) * (direction === 'asc' ? 1 : -1)
    }
    if (sortKey === 'weight') return ((b.weight ?? 0) - (a.weight ?? 0)) * flip
    if (sortKey === 'metric') return (metricValue(b) - metricValue(a)) * flip
    return (b.marketValue - a.marketValue) * flip
  })

  const visible = limit ? sorted.slice(0, limit) : sorted
  const total = filtered.reduce((s, h) => s + (h.marketValue || 0), 0)
  const metricTotal = filtered.reduce((s, h) => s + metricValue(h), 0)

  // Grouping is only worth offering once there's more than one account in
  // play, and only on the full list.
  const accounts = Array.from(new Set(all.map((h) => h.accountLabel).filter(Boolean)))
  const canGroup = !limit && accounts.length > 1

  const groups = grouped
    ? accounts.map((label) => ({
        label: label as string,
        rows: visible.filter((h) => h.accountLabel === label),
      }))
    : [{ label: '', rows: visible }]

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title="Holdings"
        caption={
          limit
            ? 'Your largest positions by market value.'
            : 'Every position across your connected accounts, with what you paid.'
        }
        meta={
          all.length > 0 ? (
            <span className="num">
              {formatCurrency(total, { compact: true })} · {filtered.length}
            </span>
          ) : undefined
        }
      >
        {!isLoading && !error && all.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {!limit && (
              <label className="relative min-w-0 flex-1 sm:max-w-[16rem]">
                <span className="sr-only">Search holdings</span>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Symbol, name, account"
                  className="h-9 w-full rounded-md border border-border/80 bg-background/60 pl-8 pr-8 text-sm placeholder:text-muted-foreground/70 focus:border-primary/40"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </label>
            )}

            <Segmented
              label="Right-hand column"
              value={metric}
              options={METRICS}
              onChange={setMetric}
            />

            {canGroup && (
              <button
                type="button"
                onClick={() => setGrouped((g) => !g)}
                aria-pressed={grouped}
                className={cn(
                  'h-9 rounded-md border px-2.5 text-xs font-medium transition-colors',
                  grouped
                    ? 'border-primary/40 bg-accent/60 text-foreground'
                    : 'border-border/80 bg-background/60 text-muted-foreground hover:text-foreground',
                )}
              >
                Group by account
              </button>
            )}
          </div>
        )}
      </SectionHead>

      {isLoading ? (
        <SkeletonRows rows={limit ?? 8} />
      ) : error ? (
        <PanelUnavailable what="Your holdings breakdown" onRetry={() => refetch()} />
      ) : all.length === 0 ? (
        <div className="border-y border-border/60">
          <EmptyState
            glyph="holdings"
            title="No holdings yet"
            description="Positions from your connected brokerage, crypto and manual accounts land here with their cost basis."
            action={
              <Link
                to="/accounts"
                className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Connect an account
              </Link>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-y border-border/60 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing matches “{query}”.{' '}
            <button
              type="button"
              onClick={() => setQuery('')}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Clear search
            </button>
          </p>
        </div>
      ) : (
        <>
          {/* Headers exist only at widths that can align to them. */}
          <div className="hidden border-b border-border/70 px-2 pb-2 lg:grid lg:grid-cols-[minmax(0,1fr)_6rem_6rem_7.5rem_8.5rem_5rem] lg:items-end lg:gap-3">
            <SortHeader
              column="symbol"
              active={sortKey}
              direction={direction}
              onSort={handleSort}
              align="left"
            >
              Holding
            </SortHeader>
            <span className="t-eyebrow text-right">Units</span>
            <span className="t-eyebrow text-right">Price</span>
            <SortHeader
              column="value"
              active={sortKey}
              direction={direction}
              onSort={handleSort}
            >
              Value
            </SortHeader>
            <SortHeader
              column="metric"
              active={sortKey}
              direction={direction}
              onSort={handleSort}
            >
              {METRICS.find((m) => m.value === metric)?.label ?? 'Gain'}
            </SortHeader>
            <SortHeader
              column="weight"
              active={sortKey}
              direction={direction}
              onSort={handleSort}
            >
              Weight
            </SortHeader>
          </div>

          {groups.map((group) => (
            <div key={group.label || 'all'}>
              {group.label && (
                <div className="flex items-baseline justify-between gap-3 border-b border-border/70 px-2 pb-1.5 pt-5">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <Amount
                    value={group.rows.reduce((s, h) => s + h.marketValue, 0)}
                    className="text-xs text-muted-foreground"
                  />
                </div>
              )}

              <ul className="list-none border-b border-border/70 p-0">
                {group.rows.map((holding, i) => (
                  <HoldingRow
                    key={`${holding.symbol}-${holding.accountId ?? i}`}
                    holding={holding}
                    metric={metric}
                    index={i}
                  />
                ))}
              </ul>
            </div>
          ))}

          {/* Totals line: the column you chose is summed too, which is what
           * makes the metric switch worth having. */}
          <div className="grid grid-cols-2 items-baseline gap-3 px-2 pt-2.5 lg:grid-cols-[minmax(0,1fr)_6rem_6rem_7.5rem_8.5rem_5rem]">
            <span className="t-eyebrow">
              {limit && sorted.length > limit
                ? `Top ${visible.length} of ${sorted.length}`
                : 'Total'}
            </span>
            <span className="hidden lg:block" aria-hidden />
            <span className="hidden lg:block" aria-hidden />
            <Amount value={total} className="text-right text-sm font-semibold" />
            <span className="col-start-2 text-right lg:col-start-auto">
              {metric === 'cost' ? (
                <Amount value={metricTotal} className="text-sm font-semibold" />
              ) : (
                <Delta amount={metricTotal} size="sm" className="font-semibold" />
              )}
            </span>
            <span className="hidden lg:block" aria-hidden />
          </div>

          {limit && sorted.length > limit && (
            <p className="pt-4">
              <Link
                to="/analysis#holdings"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                See all {sorted.length} holdings
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  )
}

function HoldingRow({
  holding,
  metric,
  index,
}: {
  holding: AnalyticsHolding
  metric: Metric
  index: number
}) {
  const subtitle = [holding.name, holding.accountLabel].filter(Boolean).join(' · ')

  const metricCell =
    metric === 'cost' ? (
      <span className="num text-sm">
        {holding.costBasis != null ? formatCurrency(holding.costBasis) : '—'}
      </span>
    ) : metric === 'day' ? (
      <Delta
        amount={holding.dayChange ?? null}
        percent={holding.dayChangePercent ?? null}
        size="sm"
      />
    ) : (
      <Delta
        amount={holding.unrealizedPnl ?? null}
        percent={holding.unrealizedPnlPercent ?? null}
        size="sm"
      />
    )

  return (
    <li
      className="animate-rise border-b border-border/40 last:border-0"
      style={{ animationDelay: `${Math.min(300, index * 18)}ms` }}
    >
      <Link
        to={`/holdings/${encodeURIComponent(holding.symbol)}`}
        className="row-hover -mx-2 block rounded-md px-2 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_6rem_6rem_7.5rem_8.5rem_5rem] lg:items-center lg:gap-3"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="h-7 w-[3px] shrink-0"
            style={{
              background:
                (holding.unrealizedPnl ?? 0) >= 0
                  ? 'hsl(var(--gain) / 0.5)'
                  : 'hsl(var(--loss) / 0.5)',
            }}
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {holding.symbol}
              {holding.quoteStale && (
                <span
                  className="chip-neutral rounded px-1 py-px text-[0.625rem] font-medium"
                  title="This price is older than the rest of your portfolio"
                >
                  stale
                </span>
              )}
            </p>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <p className="num hidden text-right text-xs text-muted-foreground lg:block">
          {holding.units != null ? formatAmount(holding.units) : '—'}
        </p>
        <p className="num hidden text-right text-xs text-muted-foreground lg:block">
          {holding.price != null
            ? formatCurrency(holding.price, { currency: holding.currency })
            : '—'}
        </p>

        {/* Phone layout: value and the chosen metric share one line under
         * the name, then the weight meter. */}
        <div className="mt-1.5 flex items-baseline justify-between gap-3 lg:mt-0 lg:block lg:text-right">
          <span className="num text-xs text-muted-foreground lg:hidden">
            {holding.units != null ? `${formatAmount(holding.units)} units` : ''}
          </span>
          <Amount
            value={holding.marketValue}
            currency={holding.currency}
            className="text-sm font-semibold"
          />
        </div>

        <div className="mt-1 flex items-center justify-between gap-3 lg:mt-0 lg:block lg:text-right">
          {metricCell}
          <span className="num text-xs text-muted-foreground lg:hidden">
            {holding.weight != null ? `${holding.weight.toFixed(1)}%` : ''}
          </span>
        </div>

        <div className="hidden lg:block">
          <span className="num block text-right text-xs text-muted-foreground">
            {holding.weight != null ? `${holding.weight.toFixed(1)}%` : '—'}
          </span>
          <Meter
            percent={holding.weight ?? 0}
            className="mt-1"
            delayMs={80 + index * 12}
          />
        </div>
      </Link>
    </li>
  )
}

import { useState } from 'react'
import { LinePlot, RangeTabs, type Series } from '@/components/ui/chart'
import { SectionHead } from '@/components/ui/data'
import {
  HistoryBuilding,
  PanelUnavailable,
  PartialBadge,
  SkeletonChart,
} from '@/components/ui/states'
import {
  useBenchmark,
  warningText,
  type BenchmarkRange,
} from '@/hooks/useAnalytics'
import { cn, formatPercent } from '@/lib/utils'

const RANGES: Array<{ value: BenchmarkRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
]

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** A named return, printed the way Fidelity prints its benchmark rows. */
function ReturnRow({
  label,
  percent,
  swatch,
  dashed,
  emphasis,
}: {
  label: string
  percent?: number | null
  swatch: string
  dashed?: boolean
  emphasis?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 py-2.5 last:border-0">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn('h-0 w-4 shrink-0 border-t-2', dashed && 'border-dashed')}
          style={{ borderColor: swatch }}
        />
        <span
          className={cn(
            'truncate text-sm',
            emphasis ? 'font-semibold' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      </span>
      <span
        className={cn(
          'num shrink-0 text-sm font-medium',
          percent == null
            ? 'text-muted-foreground'
            : percent >= 0
              ? 'text-gain'
              : 'text-loss',
        )}
      >
        {percent == null ? '—' : formatPercent(percent)}
      </span>
    </div>
  )
}

/**
 * You against the index.
 *
 * Monarch and Origin both draw this as two rebased lines over a dashed 0%
 * baseline, with the two returns named in a legend above the plot rather
 * than in a floating tooltip — so the answer is readable before you touch
 * anything. Origin's range selector is plain text, not filled pills.
 *
 * The interesting case is having almost no history. Fidelity's Performance
 * block shows the honest fallback: the same comparison as three aligned
 * numbers and no chart at all. That's what runs while the daily snapshots
 * accumulate, because two data points drawn as a "curve" would be a lie
 * about precision.
 */
export function BenchmarkPanel({ headingId }: { headingId: string }) {
  const [range, setRange] = useState<BenchmarkRange>('3m')
  const [hover, setHover] = useState<number | null>(null)
  const { data, isLoading, error, refetch } = useBenchmark(range)

  const symbol = data?.symbol || 'SPY'
  const warnings = warningText(data?.warnings)

  // Align both series on the portfolio's dates; a benchmark reading we
  // don't have becomes a gap, never an interpolation.
  const dates = (data?.portfolio ?? []).map((p) => p.date)
  const benchmarkByDate = new Map(
    (data?.benchmark ?? []).map((p) => [p.date, p.indexed]),
  )
  const series: Series[] = [
    {
      id: 'portfolio',
      label: 'Your portfolio',
      color: 'hsl(var(--chart-1))',
      values: (data?.portfolio ?? []).map((p) => p.indexed),
    },
    {
      id: 'benchmark',
      label: symbol,
      color: 'hsl(var(--chart-5))',
      dashed: true,
      values: dates.map((d) => benchmarkByDate.get(d) ?? null),
    },
  ]

  const plottable = dates.length >= 3
  const hoverActive = hover != null && hover >= 0 && hover < dates.length

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title="Against the market"
        caption={`Both lines start at the same point, so the gap between them is the difference in return.`}
        meta={data?.isPartial ? <PartialBadge>Partial range</PartialBadge> : undefined}
      />

      {isLoading ? (
        <SkeletonChart />
      ) : error ? (
        <PanelUnavailable what="Benchmark comparison" onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4">
          {/* Legend doubles as the readout: it shows the period return, or
           * the value at the hovered date. */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1 sm:max-w-sm" aria-live="polite">
              {hoverActive ? (
                <>
                  <p className="t-eyebrow mb-2">{shortDate(dates[hover!])}</p>
                  <div>
                    <ReturnRow
                      label="Your portfolio"
                      percent={
                        series[0].values[hover!] != null
                          ? (series[0].values[hover!] as number) - 100
                          : null
                      }
                      swatch="hsl(var(--chart-1))"
                      emphasis
                    />
                    <ReturnRow
                      label={symbol}
                      percent={
                        series[1].values[hover!] != null
                          ? (series[1].values[hover!] as number) - 100
                          : null
                      }
                      swatch="hsl(var(--chart-5))"
                      dashed
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="t-eyebrow mb-2">
                    Return over {RANGES.find((r) => r.value === range)?.label}
                  </p>
                  <div>
                    <ReturnRow
                      label="Your portfolio"
                      percent={data?.portfolioReturnPercent}
                      swatch="hsl(var(--chart-1))"
                      emphasis
                    />
                    <ReturnRow
                      label={symbol}
                      percent={data?.benchmarkReturnPercent}
                      swatch="hsl(var(--chart-5))"
                      dashed
                    />
                  </div>
                </>
              )}
            </div>

            <RangeTabs
              label="Comparison range"
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
              labels={dates.map(shortDate)}
              baseline={100}
              formatValue={(v) => `${(v - 100).toFixed(0)}%`}
              onHover={setHover}
              hoverIndex={hover}
              ariaLabel={`Your portfolio returned ${
                data?.portfolioReturnPercent != null
                  ? formatPercent(data.portfolioReturnPercent)
                  : 'an unknown amount'
              } over ${range}, against ${
                data?.benchmarkReturnPercent != null
                  ? formatPercent(data.benchmarkReturnPercent)
                  : 'an unknown amount'
              } for ${symbol}.`}
            />
          ) : (
            <HistoryBuilding
              title="Not enough days to draw a line yet"
              detail={`Meridian needs at least three daily snapshots to plot a comparison. The two returns above are already real — they just can't be drawn as a curve yet.`}
              footnote={
                dates.length > 0
                  ? `${dates.length} ${
                      dates.length === 1 ? 'day' : 'days'
                    } recorded so far, starting ${shortDate(dates[0])}.`
                  : 'Recording starts with your first daily snapshot.'
              }
            />
          )}

          {/* Finimize puts the "how is this tracked" note directly under the
           * chart. Cheap to read, and it stops the number being over-trusted. */}
          <p className="t-meta max-w-xl">
            {data?.note ||
              `Compared against ${symbol}. Your return is measured from daily
               closing snapshots of your own holdings, so it includes cash drag
               and excludes anything your providers didn't report.`}
          </p>

          {warnings.length > 0 && (
            <ul className="t-meta list-none space-y-1 p-0">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

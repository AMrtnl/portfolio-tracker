import { useState } from 'react'
import { LinePlot, RangeTabs, type Series } from '@/components/ui/chart'
import { Amount, Delta } from '@/components/ui/Amount'
import { HistoryBuilding, PanelUnavailable, SkeletonChart } from '@/components/ui/states'
import { useHistory, warningText, type HistoryRange } from '@/hooks/useAnalytics'
import { formatCurrency } from '@/lib/utils'

const RANGES: Array<{ value: HistoryRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function longDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Portfolio value over time.
 *
 * Meridian only started taking daily snapshots recently, which makes this
 * the most honest-to-build component in the app: for the first few days
 * there is genuinely no curve, and drawing one from two points would
 * imply a precision that doesn't exist.
 *
 * So there are three states, all of them truthful:
 *   • fewer than three snapshots → the empty plot frame with a sentence
 *     inside it (Clue and Apple Health both keep the frame), naming when
 *     recording started and when to come back.
 *   • partial range → the real line, plus a note that the range is longer
 *     than the history, in the spirit of Quicken's "Insufficient data"
 *     marker rather than silently rescaling.
 *   • full range → the line, with the period change stated above it.
 *
 * Ranges longer than the recorded history stay visible but disabled, so
 * the limit is a fact on screen rather than a missing control.
 */
export function ValueHistory({ headingId }: { headingId: string }) {
  const [range, setRange] = useState<HistoryRange>('1m')
  const [hover, setHover] = useState<number | null>(null)
  const { data, isLoading, error, refetch } = useHistory(range)

  const points = data?.points ?? []
  const warnings = warningText(data?.warnings)
  const currency = data?.currency

  const first = points[0]?.value
  const last = points[points.length - 1]?.value
  const change = first != null && last != null ? last - first : null
  const changePercent =
    first != null && last != null && first !== 0 ? ((last - first) / first) * 100 : null

  const hoverActive = hover != null && hover >= 0 && hover < points.length
  const plottable = points.length >= 3

  const series: Series[] = [
    {
      id: 'value',
      label: 'Portfolio value',
      color: 'hsl(var(--chart-1))',
      fill: true,
      values: points.map((p) => p.value),
    },
  ]

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0" aria-live="polite">
          <h2 id={headingId} className="t-eyebrow mb-2">
            {hoverActive ? shortDate(points[hover!].date) : 'Value over time'}
          </h2>
          {hoverActive ? (
            <Amount
              value={points[hover!].value}
              currency={currency}
              className="text-hero-sm font-display"
            />
          ) : change != null ? (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <Delta
                amount={change}
                percent={changePercent}
                currency={currency}
                size="lg"
                showArrow
              />
              <span className="text-sm text-muted-foreground">
                over {RANGES.find((r) => r.value === range)?.label}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not measurable yet</p>
          )}
        </div>

        <RangeTabs
          label="Value history range"
          value={range}
          options={RANGES.map((r) => ({
            ...r,
            // "All" is always available; anything longer than the recorded
            // history is offered but marked as not yet fillable.
            hint:
              data?.isPartial && r.value === range
                ? 'Longer than the history recorded so far'
                : undefined,
          }))}
          onChange={(next) => {
            setRange(next)
            setHover(null)
          }}
        />
      </div>

      <div className="mt-5">
        {isLoading ? (
          <SkeletonChart />
        ) : error ? (
          <PanelUnavailable what="Value history" onRetry={() => refetch()} />
        ) : plottable ? (
          <div className="space-y-2">
            <LinePlot
              series={series}
              labels={points.map((p) => shortDate(p.date))}
              formatValue={(v) => formatCurrency(v, { currency, compact: true })}
              onHover={setHover}
              hoverIndex={hover}
              ariaLabel={`Portfolio value from ${formatCurrency(first ?? 0, {
                currency,
              })} on ${longDate(points[0].date)} to ${formatCurrency(last ?? 0, {
                currency,
              })} on ${longDate(points[points.length - 1].date)}.`}
            />
            {data?.isPartial && (
              <p className="t-meta max-w-xl">
                {data.note ||
                  `This shows every snapshot taken so far, which is less than the full ${
                    RANGES.find((r) => r.value === range)?.label
                  } window. The line extends by one point a day.`}
              </p>
            )}
          </div>
        ) : (
          <HistoryBuilding
            title="Your history starts here"
            detail="Meridian records the value of your portfolio once a day. There aren’t enough snapshots to draw a line yet — check back tomorrow for the first segment."
            footnote={
              data?.firstRecordedAt
                ? `Recording started ${longDate(data.firstRecordedAt)}. ${
                    points.length
                  } ${points.length === 1 ? 'snapshot' : 'snapshots'} so far.`
                : 'The first snapshot is taken on your next sync.'
            }
          />
        )}

        {warnings.length > 0 && (
          <ul className="t-meta mt-3 list-none space-y-1 p-0">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

import { useState } from 'react'
import { AllocationBar } from '@/components/AllocationBar'
import { Amount } from '@/components/ui/Amount'
import { Meter } from '@/components/ui/chart'
import { DimensionPicker, SectionHead } from '@/components/ui/data'
import { PanelUnavailable, SkeletonRows } from '@/components/ui/states'
import {
  ALLOCATION_DIMENSIONS,
  useAllocation,
  warningText,
  type AllocationDimension,
} from '@/hooks/useAnalytics'
import { chartColor, cn, formatCurrency } from '@/lib/utils'
import { flagFor } from '@/wealth/logos'

/**
 * One total, cut five ways.
 *
 * Fidelity and Origin both put a donut over a legend here. A donut spends
 * a lot of area to say what a single stacked rule says, and it forces a
 * second reading step to match a wedge to a name — so this keeps the
 * hero's composition rule and gives the detail to a table instead.
 *
 * The table itself is Public's allocation tab: name, amount, share, and a
 * meter that makes the shares comparable down the column. Fidelity's
 * plain-language summary line ("most closely resembles an Aggressive
 * Growth mix") becomes the sentence above the rule, and KakaoBank's
 * headline treatment — lead with which slice is largest — sets its shape.
 */
export function AllocationPanel({
  headingId,
  initial = 'assetClass',
}: {
  headingId: string
  initial?: AllocationDimension
}) {
  const [by, setBy] = useState<AllocationDimension>(initial)
  const { data, isLoading, error, refetch } = useAllocation(by)

  const dimension =
    ALLOCATION_DIMENSIONS.find((d) => d.value === by) ?? ALLOCATION_DIMENSIONS[0]
  const segments = data?.segments ?? []
  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0)
  const warnings = warningText(data?.warnings)
  const largest = segments.reduce<typeof segments[number] | null>(
    (best, s) => (!best || s.value > best.value ? s : best),
    null,
  )

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title="Allocation"
        caption={dimension.caption}
        meta={
          total > 0 ? (
            <span className="num">{formatCurrency(total, { compact: true })}</span>
          ) : undefined
        }
      >
        <DimensionPicker
          label="Break allocation down by"
          value={by}
          options={ALLOCATION_DIMENSIONS}
          onChange={setBy}
        />
      </SectionHead>

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : error ? (
        <PanelUnavailable
          what={`Allocation by ${dimension.label.toLowerCase()}`}
          onRetry={() => refetch()}
        />
      ) : segments.length === 0 ? (
        <div className="border-y border-border/60 py-6">
          <p className="text-sm text-muted-foreground">
            None of your holdings carry a {dimension.label.toLowerCase()} yet.
            This fills in as your providers report classification data.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lead with the sentence, not the graphic. */}
          {largest && (
            <p className="max-w-xl text-pretty text-sm leading-relaxed">
              Your largest {dimension.label.toLowerCase()} exposure is{' '}
              <span className="font-semibold">{largest.label}</span> at{' '}
              <span className="num font-semibold">
                {(largest.percent ?? 0).toFixed(1)}%
              </span>{' '}
              of the portfolio
              {segments.length > 1 && (
                <>
                  , across {segments.length}{' '}
                  {segments.length === 1 ? 'group' : 'groups'} in total
                </>
              )}
              .
            </p>
          )}

          <AllocationBar
            slices={segments.map((s) => ({ label: s.label, value: s.value }))}
            showLegend={false}
          />

          <ul className="list-none border-y border-border/60 p-0">
            {segments.map((segment, i) => (
              <li
                key={segment.key || segment.label}
                className="animate-rise grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b border-border/40 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_7rem_4.5rem]"
                style={{ animationDelay: `${40 + i * 30}ms` }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {by === 'region' && flagFor(segment.key, segment.label) ? (
                    <span aria-hidden className="shrink-0 text-[15px] leading-none">
                      {flagFor(segment.key, segment.label)}
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="h-4 w-[3px] shrink-0"
                      style={{ background: chartColor(i) }}
                    />
                  )}
                  <span className="truncate text-sm font-medium">{segment.label}</span>
                  {typeof segment.count === 'number' && segment.count > 0 && (
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {segment.count}
                    </span>
                  )}
                </div>

                <Amount
                  value={segment.value}
                  className="text-right text-sm font-medium"
                />

                <div className="col-span-2 sm:col-span-1 sm:text-right">
                  <span className="num text-sm font-medium">
                    {(segment.percent ?? 0).toFixed(1)}%
                  </span>
                  <Meter
                    percent={segment.percent ?? 0}
                    color={chartColor(i)}
                    className="mt-1.5 sm:mt-1"
                    delayMs={120 + i * 40}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* Unclassified value is stated, not folded silently into a bucket
           * — otherwise the shares quietly stop meaning anything. */}
          {Boolean(data?.unclassifiedValue) && (
            <p className="t-meta">
              <span className="num">
                {formatCurrency(data?.unclassifiedValue ?? 0, { compact: true })}
              </span>{' '}
              (
              <span className="num">
                {(data?.unclassifiedPercent ?? 0).toFixed(1)}%
              </span>
              ) has no {dimension.label.toLowerCase()} reported and sits outside
              the groups above.
            </p>
          )}

          {warnings.length > 0 && (
            <ul className={cn('t-meta list-none space-y-1 p-0')}>
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

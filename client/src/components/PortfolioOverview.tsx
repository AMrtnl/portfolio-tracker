import { useCountUp } from '@/components/AnimatedNumber'
import { AllocationBar, type AllocationSlice } from '@/components/AllocationBar'
import { Amount, Delta } from '@/components/ui/Amount'
import { FreshnessNote, RefreshButton, SyncToast } from '@/components/ui/data'
import { cn, formatPercent } from '@/lib/utils'

interface PortfolioOverviewProps {
  totalValue: string
  pnl24h: string
  pnl7d: string
  pnl30d: string
  allocation: AllocationSlice[]
  accountCount: number
  lastUpdated: string
  isFetching: boolean
  onRefresh: () => void
  justSynced: boolean
}

/** One column of the unboxed stat strip. Hairlines, no boxes. */
function PeriodStat({
  label,
  value,
  delayClass,
}: {
  label: string
  value: number
  delayClass: string
}) {
  return (
    <div className={cn('animate-rise px-4 first:pl-0 sm:px-6', delayClass)}>
      <dt className="t-eyebrow mb-2">{label}</dt>
      <dd
        className={cn(
          'num text-sm font-medium sm:text-base',
          value >= 0 ? 'text-gain' : 'text-loss',
        )}
      >
        {formatPercent(value)}
      </dd>
    </div>
  )
}

/**
 * The first viewport: what it's worth, how it moved today, and what it's
 * made of — read as a single composition with no cards.
 *
 * The value / day-change pairing follows Yahoo Finance and Quicken's web
 * summary strip; the de-emphasised cents come from Revolut and Mercury.
 */
export function PortfolioOverview({
  totalValue,
  pnl24h,
  pnl7d,
  pnl30d,
  allocation,
  accountCount,
  lastUpdated,
  isFetching,
  onRefresh,
  justSynced,
}: PortfolioOverviewProps) {
  const total = parseFloat(totalValue) || 0
  const d1 = parseFloat(pnl24h) || 0
  const d7 = parseFloat(pnl7d) || 0
  const d30 = parseFloat(pnl30d) || 0
  const dayDollars = total * (d1 / 100)
  const animatedTotal = useCountUp(total)

  return (
    <section aria-labelledby="portfolio-summary" className="measure px-5 pt-9 sm:px-8 sm:pt-14">
      {/* Refresh sits on the label line so nothing interrupts the run from
       * the value down to today's move. */}
      <div className="flex items-center justify-between gap-4">
        <h1 id="portfolio-summary" className="t-eyebrow">
          Total portfolio value
        </h1>
        <div className="flex items-center gap-2">
          <SyncToast visible={justSynced} />
          <RefreshButton
            onRefresh={onRefresh}
            busy={isFetching}
            label="Refresh portfolio"
          />
        </div>
      </div>

      <p className="mt-3 sm:mt-4" aria-live="polite">
        <Amount value={animatedTotal} size="hero" />
        <span className="sr-only">
          across {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
        </span>
      </p>

      {/* Day move in dollars and percent, then the read timestamp — the
       * order Yahoo Finance uses under a portfolio balance. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <Delta
          amount={dayDollars}
          percent={d1}
          size="lg"
          showArrow
          className="animate-rise stagger-1"
        />
        <span className="text-sm text-muted-foreground">today</span>
      </div>

      <FreshnessNote iso={lastUpdated} className="mt-2.5" />

      <div className="mt-8 sm:mt-10">
        <h2 className="t-eyebrow mb-3">Composition</h2>
        <AllocationBar slices={allocation} />
      </div>

      <div className="rule mt-8 pt-5 sm:mt-10">
        <dl className="divide-rule flex max-w-xl">
          <PeriodStat label="24 hours" value={d1} delayClass="stagger-2" />
          <PeriodStat label="7 days" value={d7} delayClass="stagger-3" />
          <PeriodStat label="30 days" value={d30} delayClass="stagger-4" />
        </dl>
      </div>
    </section>
  )
}

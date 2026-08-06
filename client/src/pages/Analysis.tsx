import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AllocationPanel } from '@/components/analysis/AllocationPanel'
import { BenchmarkPanel } from '@/components/analysis/BenchmarkPanel'
import { ConcentrationPanel } from '@/components/analysis/ConcentrationPanel'
import { FlowsPanel } from '@/components/analysis/FlowsPanel'
import { IncomePanel } from '@/components/analysis/IncomePanel'
import { ValueHistory } from '@/components/analysis/ValueHistory'
import { HoldingsTable } from '@/components/HoldingsTable'
import { Amount, Delta } from '@/components/ui/Amount'
import { FreshnessNote } from '@/components/ui/data'
import { Banner, SkeletonBlock, SkeletonRows } from '@/components/ui/states'
import { useOverview, warningText } from '@/hooks/useAnalytics'

/**
 * Deep portfolio analysis — allocation, concentration, income, flows,
 * and benchmark — kept as one calm ledger rather than a dashboard of cards.
 *
 * Tab order mirrors Public's Return / Allocation / Income switcher, but
 * as vertical sections so every cut stays bookmarkable (`#allocation`).
 */
export function Analysis() {
  const { data: overview, isLoading, error, refetch } = useOverview()

  useEffect(() => {
    document.title = 'Analysis — Meridian'
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isLoading])

  const warnings = warningText(overview?.warnings)

  return (
    <article className="pb-16">
      <header className="measure px-5 pt-9 sm:px-8 sm:pt-14">
        <p className="t-eyebrow">Analysis</p>
        <h1 className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
          How the portfolio is built
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Allocation, concentration, income and flows — only from reported
          holdings and activities. Missing history is stated, never invented.
        </p>

        {isLoading ? (
          <div className="mt-8 space-y-3" aria-hidden>
            <SkeletonBlock className="h-10 w-56" />
            <SkeletonRows rows={1} />
          </div>
        ) : error ? (
          <Banner
            tone="warn"
            title="Overview couldn’t load"
            action={
              <button
                type="button"
                onClick={() => refetch()}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Retry
              </button>
            }
          >
            Panels below still try their own endpoints independently.
          </Banner>
        ) : overview ? (
          <div className="mt-8 space-y-5">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <Amount value={overview.totalValue} size="lg" />
              {overview.unrealizedPnl != null && (
                <Delta
                  amount={overview.unrealizedPnl}
                  percent={overview.unrealizedPnlPercent ?? null}
                  size="md"
                  showArrow
                />
              )}
              {overview.dayChange != null && (
                <span className="text-sm text-muted-foreground">
                  today{' '}
                  <Delta
                    amount={overview.dayChange}
                    percent={overview.dayChangePercent ?? null}
                    size="sm"
                    className="inline"
                  />
                </span>
              )}
            </div>
            <dl className="divide-rule flex max-w-2xl flex-wrap">
              {overview.costBasis != null && (
                <div className="px-4 first:pl-0 sm:px-6">
                  <dt className="t-eyebrow mb-1.5">Cost basis</dt>
                  <dd>
                    <Amount value={overview.costBasis} className="text-sm font-medium" />
                  </dd>
                </div>
              )}
              {overview.cashValue != null && (
                <div className="px-4 sm:px-6">
                  <dt className="t-eyebrow mb-1.5">Cash</dt>
                  <dd>
                    <Amount value={overview.cashValue} className="text-sm font-medium" />
                    {overview.cashPercent != null && (
                      <span className="num ml-1.5 text-xs text-muted-foreground">
                        {overview.cashPercent.toFixed(1)}%
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {overview.holdingsCount != null && (
                <div className="px-4 sm:px-6">
                  <dt className="t-eyebrow mb-1.5">Holdings</dt>
                  <dd className="num text-sm font-medium">{overview.holdingsCount}</dd>
                </div>
              )}
              {overview.accountsCount != null && (
                <div className="px-4 sm:px-6">
                  <dt className="t-eyebrow mb-1.5">Accounts</dt>
                  <dd className="num text-sm font-medium">{overview.accountsCount}</dd>
                </div>
              )}
            </dl>
            {overview.retrievedAt && (
              <FreshnessNote iso={overview.retrievedAt} />
            )}
          </div>
        ) : null}

        {warnings.length > 0 && (
          <ul className="t-meta mt-4 list-none space-y-1 p-0">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <nav
          aria-label="Analysis sections"
          className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-y border-border/60 py-3 text-sm"
        >
          {[
            ['history', 'Value'],
            ['allocation', 'Allocation'],
            ['concentration', 'Concentration'],
            ['income', 'Income'],
            ['flows', 'Flows'],
            ['benchmark', 'Benchmark'],
            ['holdings', 'Holdings'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
          <Link
            to="/"
            className="ml-auto font-medium text-primary underline-offset-4 hover:underline"
          >
            Portfolio
          </Link>
        </nav>
      </header>

      <div className="measure space-y-16 px-5 pt-10 sm:px-8 sm:pt-12">
        <div id="history" className="scroll-mt-20">
          <ValueHistory headingId="history-heading" />
        </div>
        <div id="allocation" className="scroll-mt-20">
          <AllocationPanel headingId="allocation-heading" />
        </div>
        <div id="concentration" className="scroll-mt-20">
          <ConcentrationPanel headingId="concentration-heading" />
        </div>
        <div id="income" className="scroll-mt-20">
          <IncomePanel headingId="income-heading" />
        </div>
        <div id="flows" className="scroll-mt-20">
          <FlowsPanel headingId="flows-heading" />
        </div>
        <div id="benchmark" className="scroll-mt-20">
          <BenchmarkPanel headingId="benchmark-heading" />
        </div>
        <div id="holdings" className="scroll-mt-20">
          <HoldingsTable headingId="holdings-heading" />
        </div>
      </div>
    </article>
  )
}

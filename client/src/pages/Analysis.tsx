import { useEffect } from 'react'
import { AllocationPanel } from '@/components/analysis/AllocationPanel'
import { BenchmarkPanel } from '@/components/analysis/BenchmarkPanel'
import { ConcentrationPanel } from '@/components/analysis/ConcentrationPanel'
import { FlowsPanel } from '@/components/analysis/FlowsPanel'
import { IncomePanel } from '@/components/analysis/IncomePanel'
import { ValueHistory } from '@/components/analysis/ValueHistory'
import { HoldingsTable } from '@/components/HoldingsTable'
import { Amount, Delta } from '@/components/ui/Amount'
import { FreshnessNote } from '@/components/ui/data'
import { Banner, SkeletonRows } from '@/components/ui/states'
import { useOverview, warningText } from '@/hooks/useAnalytics'

export function Analysis() {
  const { data: overview, isLoading, error, refetch } = useOverview()

  useEffect(() => {
    document.title = 'Analysis'
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isLoading])

  const warnings = warningText(overview?.warnings)

  return (
    <article>
      {isLoading ? (
        <section className="a-gcard pad" aria-hidden>
          <SkeletonRows rows={2} />
        </section>
      ) : error ? (
        <Banner
          tone="warn"
          title="Overview could not load"
          action={
            <button type="button" className="ui-btn tinted sm" onClick={() => refetch()}>
              Retry
            </button>
          }
        >
          Panels below still try their own endpoints independently.
        </Banner>
      ) : overview ? (
        <section className="a-gcard pad">
          <div className="a-hero">
            <div className="a-caption">Portfolio</div>
            <Amount value={overview.totalValue} size="lg" />
            {overview.unrealizedPnl != null && (
              <div className="a-delta">
                <Delta
                  amount={overview.unrealizedPnl}
                  percent={overview.unrealizedPnlPercent ?? null}
                  size="md"
                />
              </div>
            )}
          </div>
          {overview.retrievedAt && (
            <p className="a-insnote spaced">
              <FreshnessNote iso={overview.retrievedAt} />
            </p>
          )}
        </section>
      ) : null}

      {warnings.length > 0 && (
        <p className="a-insnote spaced">{warnings.join(' · ')}</p>
      )}

      <nav className="a-keys" aria-label="Analysis sections">
        {[
          ['history', 'Value'],
          ['allocation', 'Mix'],
          ['benchmark', 'Benchmark'],
          ['holdings', 'Holdings'],
          ['concentration', 'Risk'],
          ['income', 'Income'],
          ['flows', 'Flows'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="a-key static">
            {label}
          </a>
        ))}
      </nav>

      <div className="a-desk">
        <div className="a-desk-primary">
          <div id="history" className="a-header">
            Value
          </div>
          <section className="a-gcard pad">
            <ValueHistory headingId="history-heading" />
          </section>
          <div id="allocation" className="a-header">
            Allocation
          </div>
          <section className="a-gcard pad">
            <AllocationPanel headingId="allocation-heading" />
          </section>
          <div id="benchmark" className="a-header">
            Benchmark
          </div>
          <section className="a-gcard pad">
            <BenchmarkPanel headingId="benchmark-heading" />
          </section>
        </div>

        <aside className="a-desk-aside">
          <div id="concentration" className="a-header">
            Concentration
          </div>
          <section className="a-gcard pad">
            <ConcentrationPanel headingId="concentration-heading" />
          </section>
          <div id="income" className="a-header">
            Income
          </div>
          <section className="a-gcard pad">
            <IncomePanel headingId="income-heading" />
          </section>
          <div id="flows" className="a-header">
            Flows
          </div>
          <section className="a-gcard pad">
            <FlowsPanel headingId="flows-heading" />
          </section>
        </aside>
      </div>

      <div id="holdings" className="a-header">
        Holdings
      </div>
      <section className="a-gcard pad">
        <HoldingsTable headingId="holdings-heading" />
      </section>
    </article>
  )
}

import { Amount, Delta } from '@/components/ui/Amount'
import { MonthBars, monthLabel, type MonthBar } from '@/components/ui/chart'
import { SectionHead, StatStrip } from '@/components/ui/data'
import { PanelUnavailable, SkeletonChart } from '@/components/ui/states'
import { useFlows, warningText } from '@/hooks/useAnalytics'
import { formatCurrency } from '@/lib/utils'

const IN_COLOR = 'hsl(var(--chart-2))'
const OUT_COLOR = 'hsl(var(--loss) / 0.55)'

/**
 * Money you put in, versus money the market gave you.
 *
 * This is the section that stops a rising total being misread as
 * performance. Copilot Money separates balance change from contributions
 * for the same reason. Withdrawals hang below the axis so a month that
 * netted out reads as a month that netted out.
 */
export function FlowsPanel({ headingId }: { headingId: string }) {
  const { data, isLoading, error, refetch } = useFlows(12)

  const months = data?.byMonth ?? []
  const currency = data?.currency
  const warnings = warningText(data?.warnings)

  const deposits = months.reduce((s, m) => s + (m.deposits || 0), 0)
  const withdrawals = months.reduce((s, m) => s + Math.abs(m.withdrawals || 0), 0)
  const net = data?.netTotal ?? deposits - withdrawals
  const active = months.filter((m) => (m.deposits || 0) !== 0 || (m.withdrawals || 0) !== 0)

  const bars: MonthBar[] = months.map((m) => {
    const inflow = m.deposits || 0
    const outflow = Math.abs(m.withdrawals || 0)
    return {
      month: m.month,
      total: m.net ?? inflow - outflow,
      segments: [
        { id: 'in', label: 'Deposits', value: inflow, color: IN_COLOR },
        { id: 'out', label: 'Withdrawals', value: -outflow, color: OUT_COLOR },
      ].filter((s) => s.value !== 0),
    }
  })

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title="Contributions"
        caption="What you added and withdrew, so growth isn’t confused with deposits."
      />

      {isLoading ? (
        <SkeletonChart height="h-32" />
      ) : error ? (
        <PanelUnavailable what="Contributions and withdrawals" onRetry={() => refetch()} />
      ) : (
        <div className="space-y-7">
          <StatStrip
            stats={[
              {
                label: 'Net added',
                value: (
                  <Delta amount={net} currency={currency} size="lg" className="font-display" />
                ),
                sub: 'last twelve months',
              },
              {
                label: 'Deposits',
                value: (
                  <Amount
                    value={deposits}
                    currency={currency}
                    className="text-base font-medium"
                  />
                ),
                sub: `${active.length} active ${
                  active.length === 1 ? 'month' : 'months'
                }`,
              },
              {
                label: 'Withdrawals',
                value: (
                  <Amount
                    value={withdrawals}
                    currency={currency}
                    className="text-base font-medium"
                  />
                ),
                sub: 'taken out',
              },
            ]}
          />

          {months.length > 0 ? (
            <div className="space-y-3">
              <MonthBars
                bars={bars}
                currency={currency}
                ariaLabel={`Monthly deposits and withdrawals, netting ${formatCurrency(
                  net,
                  { currency },
                )} over ${months.length} months.`}
              />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2" style={{ background: IN_COLOR }} />
                  Deposits
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2" style={{ background: OUT_COLOR }} />
                  Withdrawals
                </span>
                {months.length > 0 && (
                  <span className="t-meta">
                    {monthLabel(months[0].month, true)} –{' '}
                    {monthLabel(months[months.length - 1].month, true)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="border-y border-border/60 py-6 text-sm text-muted-foreground">
              No transfers have been reported for the last twelve months. Deposits
              and withdrawals appear here once your providers share cash activity.
            </p>
          )}

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

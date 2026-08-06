import { Link } from 'react-router-dom'
import { Amount } from '@/components/ui/Amount'
import { MonthBars, monthLabel, type MonthBar } from '@/components/ui/chart'
import { SectionHead, StatStrip } from '@/components/ui/data'
import { PanelUnavailable, SkeletonChart } from '@/components/ui/states'
import { useIncome, warningText } from '@/hooks/useAnalytics'
import { formatCurrency } from '@/lib/utils'

const DIVIDEND_COLOR = 'hsl(var(--chart-1))'
const INTEREST_COLOR = 'hsl(var(--chart-5))'

/**
 * What the portfolio pays you.
 *
 * Public's Income hub is the reference: a single trailing total as the
 * headline, a month-by-month bar chart, the two income types split out as
 * their own subtotals, and then the per-symbol list underneath. Shopee's
 * earnings screen reinforces the ordering — chart first, then the
 * breakdown for the period.
 *
 * Dividends and interest are stacked in one column rather than drawn as
 * two series, because the question is "how much came in this month", with
 * the split as the follow-up.
 */
export function IncomePanel({ headingId }: { headingId: string }) {
  const { data, isLoading, error, refetch } = useIncome(12)

  const months = data?.byMonth ?? []
  const currency = data?.currency
  const warnings = warningText(data?.warnings)

  const dividendTotal = months.reduce((s, m) => s + (m.dividends || 0), 0)
  const interestTotal = months.reduce((s, m) => s + (m.interest || 0), 0)
  const ttm = data?.ttmTotal ?? dividendTotal + interestTotal
  const bySymbol = [...(data?.bySymbol ?? [])].sort((a, b) => b.total - a.total)

  const best = months.reduce<typeof months[number] | null>(
    (top, m) => (!top || (m.total || 0) > (top.total || 0) ? m : top),
    null,
  )

  const bars: MonthBar[] = months.map((m) => ({
    month: m.month,
    total: m.total ?? (m.dividends || 0) + (m.interest || 0),
    segments: [
      {
        id: 'dividends',
        label: 'Dividends',
        value: m.dividends || 0,
        color: DIVIDEND_COLOR,
      },
      {
        id: 'interest',
        label: 'Interest',
        value: m.interest || 0,
        color: INTEREST_COLOR,
      },
    ].filter((s) => s.value !== 0),
  }))

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title="Income"
        caption="Dividends and interest actually received over the last twelve months."
        meta={
          ttm > 0 ? (
            <span className="num">{formatCurrency(ttm, { currency, compact: true })}</span>
          ) : undefined
        }
      />

      {isLoading ? (
        <SkeletonChart height="h-28" />
      ) : error ? (
        <PanelUnavailable what="Income" onRetry={() => refetch()} />
      ) : (
        <div className="space-y-7">
          <StatStrip
            stats={[
              {
                label: 'Last 12 months',
                value: <Amount value={ttm} currency={currency} size="lg" />,
                sub: 'dividends and interest',
              },
              {
                label: 'Dividends',
                value: (
                  <Amount
                    value={dividendTotal}
                    currency={currency}
                    className="text-base font-medium"
                  />
                ),
                sub: `${bySymbol.length} paying ${
                  bySymbol.length === 1 ? 'holding' : 'holdings'
                }`,
              },
              {
                label: 'Interest',
                value: (
                  <Amount
                    value={interestTotal}
                    currency={currency}
                    className="text-base font-medium"
                  />
                ),
                sub: 'cash and settlement balances',
              },
            ]}
          />

          {months.length > 0 ? (
            <div className="space-y-3">
              <MonthBars
                bars={bars}
                currency={currency}
                ariaLabel={`Monthly income for the last ${months.length} months, totalling ${formatCurrency(
                  ttm,
                  { currency },
                )}.`}
              />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2 w-2"
                    style={{ background: DIVIDEND_COLOR }}
                  />
                  Dividends
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2 w-2"
                    style={{ background: INTEREST_COLOR }}
                  />
                  Interest
                </span>
                {best && (best.total || 0) > 0 && (
                  <span className="t-meta">
                    Best month {monthLabel(best.month, true)} ·{' '}
                    <span className="num">
                      {formatCurrency(best.total || 0, { currency })}
                    </span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="border-y border-border/60 py-6 text-sm text-muted-foreground">
              No dividends or interest have been reported for the last twelve
              months. Income appears here once a payment lands in a connected
              account.
            </p>
          )}

          {bySymbol.length > 0 && (
            <div>
              <p className="t-eyebrow mb-3">By holding</p>
              <ul className="list-none border-y border-border/60 p-0">
                {bySymbol.map((row) => (
                  <li
                    key={row.symbol}
                    className="flex items-baseline justify-between gap-4 border-b border-border/40 py-2.5 last:border-0"
                  >
                    <Link
                      to={`/holdings/${encodeURIComponent(row.symbol)}`}
                      className="min-w-0 truncate rounded text-sm font-medium"
                    >
                      {row.symbol}
                      {typeof row.count === 'number' && row.count > 0 && (
                        <span className="num ml-2 text-xs font-normal text-muted-foreground">
                          {row.count} {row.count === 1 ? 'payment' : 'payments'}
                        </span>
                      )}
                    </Link>
                    <Amount
                      value={row.total}
                      currency={currency}
                      className="shrink-0 text-sm font-medium"
                    />
                  </li>
                ))}
              </ul>
            </div>
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

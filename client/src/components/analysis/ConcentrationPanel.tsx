import { Link } from 'react-router-dom'
import { Amount } from '@/components/ui/Amount'
import { MarkerScale, Meter } from '@/components/ui/chart'
import { SectionHead, StatStrip } from '@/components/ui/data'
import { PanelUnavailable, SkeletonRows } from '@/components/ui/states'
import { useConcentration, warningText } from '@/hooks/useAnalytics'
import { chartColor, cn } from '@/lib/utils'

/**
 * How much of this portfolio rides on how few things.
 *
 * The temptation is to print the Herfindahl index and call it analysis.
 * Nutmeg and Binance both refuse to do that: they place the score on a
 * named track so the number's meaning is legible without a footnote, and
 * they lead with a sentence. Wealthfront goes further and states the
 * consequence in prose ("this portfolio has a very high chance of losing
 * a significant amount of money in any given year") under a plain rule
 * rather than inside an alarming red box — which is what makes it read as
 * candour instead of a warning banner people learn to dismiss.
 *
 * So: effective holdings on a scale, top-weight sentence, the flags as
 * prose, then the top positions with meters.
 */

/** Where `effectiveHoldings` sits on the concentrated → spread-out track. */
const SCALE_STOPS = ['1', '5', '15', '30', '50+']

function scaleFraction(effective: number): number {
  // Log-ish: the difference between 1 and 5 positions matters far more
  // than the difference between 40 and 50.
  const clamped = Math.max(1, Math.min(50, effective))
  return Math.log(clamped) / Math.log(50)
}

function toneFor(level: string): 'warn' | 'info' {
  const l = level.toLowerCase()
  return l === 'warn' || l === 'high' || l === 'error' ? 'warn' : 'info'
}

export function ConcentrationPanel({ headingId }: { headingId: string }) {
  const { data, isLoading, error, refetch } = useConcentration()

  const top = data?.top ?? []
  const flags = data?.flags ?? []
  const warnings = warningText(data?.warnings)
  const effective = data?.effectiveHoldings
  const leader = top[0]

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title="Concentration"
        caption="How much of the total rides on your largest positions."
      />

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : error ? (
        <PanelUnavailable what="Concentration analysis" onRetry={() => refetch()} />
      ) : top.length === 0 ? (
        <div className="border-y border-border/60 py-6">
          <p className="text-sm text-muted-foreground">
            Concentration needs at least one valued position to measure.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* One sentence first. */}
          {leader && (
            <p className="max-w-xl text-pretty text-sm leading-relaxed">
              <span className="font-semibold">{leader.label || leader.symbol}</span> is
              your largest position at{' '}
              <span className="num font-semibold">
                {(leader.percent ?? 0).toFixed(1)}%
              </span>
              {data?.top5Percent != null && (
                <>
                  , and your five largest hold{' '}
                  <span className="num font-semibold">
                    {data.top5Percent.toFixed(1)}%
                  </span>{' '}
                  of everything you own
                </>
              )}
              .
            </p>
          )}

          <StatStrip
            stats={[
              {
                label: 'Top 5',
                value: (
                  <span className="num text-hero-sm font-display">
                    {data?.top5Percent != null ? `${data.top5Percent.toFixed(1)}%` : '—'}
                  </span>
                ),
                sub: 'of total value',
              },
              {
                label: 'Top 10',
                value: (
                  <span className="num text-hero-sm font-display">
                    {data?.top10Percent != null
                      ? `${data.top10Percent.toFixed(1)}%`
                      : '—'}
                  </span>
                ),
                sub: 'of total value',
              },
              {
                label: 'Effective holdings',
                value: (
                  <span className="num text-hero-sm font-display">
                    {effective != null ? effective.toFixed(1) : '—'}
                  </span>
                ),
                sub:
                  data?.hhi != null
                    ? `HHI ${data.hhi.toFixed(3)}`
                    : 'equally weighted equivalent',
              },
            ]}
          />

          {/* The index, made legible. */}
          {effective != null && (
            <div className="max-w-md">
              <p className="t-eyebrow mb-3">Diversification</p>
              <MarkerScale
                fraction={scaleFraction(effective)}
                stops={SCALE_STOPS}
                valueLabel={`${effective.toFixed(1)} positions`}
              />
              <p className="mt-3 text-pretty text-[0.8125rem] leading-relaxed text-muted-foreground">
                Your {top.length > 1 ? 'holdings behave' : 'holding behaves'} like{' '}
                <span className="num">{effective.toFixed(1)}</span> equally sized
                positions. The further left this sits, the more your result depends on
                a handful of names.
              </p>
            </div>
          )}

          {/* Flags as prose under a hairline — candour, not an alarm. */}
          {flags.length > 0 && (
            <ul className="list-none space-y-3 border-t border-border/60 p-0 pt-5">
              {flags.map((flag) => {
                const tone = toneFor(flag.level ?? 'info')
                return (
                  <li key={flag.message} className="flex gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full',
                        tone === 'warn' ? 'bg-warn' : 'bg-muted-foreground/45',
                      )}
                    />
                    <p
                      className={cn(
                        'text-pretty text-sm leading-relaxed',
                        tone === 'warn' ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {flag.message}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          <div>
            <p className="t-eyebrow mb-3">Largest positions</p>
            <ol className="list-none border-y border-border/60 p-0">
              {top.map((position, i) => (
                <li
                  key={position.symbol}
                  className="animate-rise grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 border-b border-border/40 py-3 last:border-0 sm:grid-cols-[1.5rem_minmax(0,1fr)_7rem_4.5rem]"
                  style={{ animationDelay: `${40 + i * 25}ms` }}
                >
                  <span className="num text-xs text-muted-foreground">{i + 1}</span>

                  <Link
                    to={`/holdings/${encodeURIComponent(position.symbol)}`}
                    className="min-w-0 rounded"
                  >
                    <span className="block truncate text-sm font-semibold">
                      {position.symbol}
                    </span>
                    {position.label && position.label !== position.symbol && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {position.label}
                      </span>
                    )}
                  </Link>

                  <Amount
                    value={position.value}
                    className="text-right text-sm font-medium"
                  />

                  <div className="col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto sm:text-right">
                    <span className="num text-sm font-medium">
                      {(position.percent ?? 0).toFixed(1)}%
                    </span>
                    <Meter
                      percent={position.percent ?? 0}
                      color={chartColor(i)}
                      className="mt-1.5 sm:mt-1"
                      delayMs={120 + i * 35}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </div>

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

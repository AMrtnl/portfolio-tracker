import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Amount, Delta } from '@/components/ui/Amount'
import { SectionHead, Segmented } from '@/components/ui/data'
import { PanelUnavailable, SkeletonRows } from '@/components/ui/states'
import { useMovers, warningText, type Mover } from '@/hooks/useAnalytics'

/**
 * What moved today — inside this portfolio only.
 *
 * Copilot Money's "Your top movers today" is the idea: not a market
 * ticker, just the user's own positions ranked by today's move, so the
 * number is actionable rather than ambient. Copilot renders them as a
 * horizontally scrolling card row; Perplexity Finance's Gainers / Losers /
 * Active tabs put the same content in a hairline list instead, which suits
 * a page that already has a table on it — no cards in a read-only strip.
 *
 * Desktop shows both columns side by side; a phone gets a switch, because
 * two stacked five-row lists push everything else off the screen.
 */
export function MoversStrip({ headingId }: { headingId: string }) {
  const { data, isLoading, error, refetch } = useMovers()
  const [side, setSide] = useState<'gainers' | 'losers'>('gainers')

  const gainers = data?.gainers ?? []
  const losers = data?.losers ?? []
  const warnings = warningText(data?.warnings)
  const empty = gainers.length === 0 && losers.length === 0

  return (
    <section aria-labelledby={headingId}>
      <SectionHead
        id={headingId}
        title="Today’s movers"
        caption="The biggest moves among the positions you actually hold."
      >
        {!isLoading && !error && !empty && (
          <Segmented
            label="Which movers to show"
            value={side}
            options={[
              { value: 'gainers', label: 'Gainers' },
              { value: 'losers', label: 'Losers' },
            ]}
            onChange={setSide}
            className="sm:hidden"
          />
        )}
      </SectionHead>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : error ? (
        <PanelUnavailable what="Today’s movers" onRetry={() => refetch()} />
      ) : empty ? (
        <p className="border-y border-border/60 py-6 text-sm text-muted-foreground">
          No intraday moves have been reported yet today. This fills in once
          your providers return fresh quotes.
        </p>
      ) : (
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <MoverColumn
            title="Gainers"
            movers={gainers}
            className={side === 'gainers' ? '' : 'hidden sm:block'}
          />
          <MoverColumn
            title="Losers"
            movers={losers}
            className={side === 'losers' ? '' : 'hidden sm:block'}
          />
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="t-meta mt-3 list-none space-y-1 p-0">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MoverColumn({
  title,
  movers,
  className,
}: {
  title: string
  movers: Mover[]
  className?: string
}) {
  return (
    <div className={className}>
      <h3 className="t-eyebrow mb-2 hidden sm:block">{title}</h3>
      {movers.length === 0 ? (
        <p className="t-meta border-t border-border/60 pt-3">Nothing to report.</p>
      ) : (
        <ul className="list-none border-t border-border/60 p-0">
          {movers.slice(0, 5).map((mover, i) => (
            <li
              key={mover.symbol}
              className="animate-rise border-b border-border/40 last:border-0"
              style={{ animationDelay: `${40 + i * 30}ms` }}
            >
              <Link
                to={`/holdings/${encodeURIComponent(mover.symbol)}`}
                className="row-hover -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {mover.symbol}
                  </span>
                  {mover.name && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {mover.name}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <Delta
                    percent={mover.dayChangePercent ?? null}
                    variant="chip"
                    size="sm"
                  />
                  {mover.dayChange != null && (
                    <Amount
                      value={mover.dayChange}
                      className="mt-1 block text-xs text-muted-foreground"
                    />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

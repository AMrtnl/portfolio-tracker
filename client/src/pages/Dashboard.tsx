import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { PortfolioOverview } from '@/components/PortfolioOverview'
import { HoldingsTable } from '@/components/HoldingsTable'
import { MoversStrip } from '@/components/MoversStrip'
import { NewsList } from '@/components/NewsList'
import { PositionsList } from '@/components/PositionsList'
import { Button } from '@/components/ui/button'
import { Amount, Delta } from '@/components/ui/Amount'
import { Banner, EmptyState, SkeletonBlock, SkeletonRows } from '@/components/ui/states'
import { FreshnessNote, SectionHead } from '@/components/ui/data'
import { usePortfolio, type PortfolioSource } from '@/hooks/usePortfolio'
import { useAccounts } from '@/hooks/useAccounts'
import { useOverview } from '@/hooks/useAnalytics'
import { cn, freshness, providerName } from '@/lib/utils'

/** Mirrors the real hero + table geometry so the page doesn't reflow. */
function DashboardSkeleton() {
  return (
    <div className="measure px-5 pb-16 pt-9 sm:px-8 sm:pt-14" aria-hidden>
      <SkeletonBlock className="h-3 w-32" />
      <SkeletonBlock className="mt-4 h-14 w-72 max-w-full sm:h-[4.75rem] sm:w-[26rem]" />
      <SkeletonBlock className="mt-5 h-5 w-56" />
      <SkeletonBlock className="mt-3 h-3 w-40" />
      <SkeletonBlock className="mt-9 h-2.5 w-full rounded-full" />
      <div className="mt-4 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="mt-10 flex max-w-xl gap-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonBlock className="h-2.5 w-14" />
            <SkeletonBlock className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-14 space-y-3">
        <SkeletonBlock className="h-5 w-28" />
        <SkeletonRows rows={6} />
      </div>
    </div>
  )
}

/**
 * Where each number came from, and whether that source is healthy. Stale or
 * failing rows get an inline action rather than a silent timestamp — the
 * treatment Wealthfront and Rocket Money use on linked accounts.
 */
function SourcesSection({ sources }: { sources: PortfolioSource[] }) {
  return (
    <section aria-labelledby="sources-heading">
      <SectionHead
        id="sources-heading"
        title="Sources"
        caption="Each connected account's contribution to the total."
        meta={
          <Link
            to="/accounts"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Manage
          </Link>
        }
      />
      <ul className="list-none divide-y divide-border/60 border-y border-border/60 p-0">
        {sources.map((source) => {
          const failed = source.status === 'error' || Boolean(source.error)
          return (
            <li
              key={source.accountId}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{source.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {providerName(source.provider)}
                  {failed && (
                    <span className="text-destructive">
                      {' · '}
                      {source.error || 'Sync failed'}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Amount
                  value={source.valueUsd}
                  className={cn(
                    'text-sm font-medium',
                    failed && 'text-muted-foreground line-through',
                  )}
                />
                {failed && (
                  <Link
                    to="/accounts"
                    className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Fix
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Cost basis + unrealized P&L strip — Finary / Sumeria "chiffres clés". */
function LedgerStrip({
  costBasis,
  unrealizedPnl,
  unrealizedPnlPercent,
  cashValue,
  cashPercent,
}: {
  costBasis?: number | null
  unrealizedPnl?: number | null
  unrealizedPnlPercent?: number | null
  cashValue?: number | null
  cashPercent?: number | null
}) {
  if (
    costBasis == null &&
    unrealizedPnl == null &&
    cashValue == null
  ) {
    return null
  }

  return (
    <section aria-labelledby="ledger-heading" className="rule pt-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="ledger-heading" className="t-eyebrow">
          At a glance
        </h2>
        <Link
          to="/analysis"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Full analysis
        </Link>
      </div>
      <dl className="divide-rule flex max-w-2xl flex-wrap">
        {costBasis != null && (
          <div className="px-4 first:pl-0 sm:px-6">
            <dt className="t-eyebrow mb-1.5">Cost basis</dt>
            <dd>
              <Amount value={costBasis} className="text-sm font-medium" />
            </dd>
          </div>
        )}
        {unrealizedPnl != null && (
          <div className="px-4 sm:px-6">
            <dt className="t-eyebrow mb-1.5">Unrealized P&L</dt>
            <dd>
              <Delta
                amount={unrealizedPnl}
                percent={unrealizedPnlPercent ?? null}
                size="sm"
                className="font-medium"
              />
            </dd>
          </div>
        )}
        {cashValue != null && (
          <div className="px-4 sm:px-6">
            <dt className="t-eyebrow mb-1.5">Cash</dt>
            <dd>
              <Amount value={cashValue} className="text-sm font-medium" />
              {cashPercent != null && (
                <span className="num ml-1.5 text-xs text-muted-foreground">
                  {cashPercent.toFixed(1)}%
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}

export function Dashboard() {
  const { data: portfolio, isLoading, isFetching, error, refetch } = usePortfolio()
  const { data: accounts } = useAccounts()
  const { data: overview } = useOverview()
  const [justSynced, setJustSynced] = useState(false)
  const wasFetching = useRef(false)

  useEffect(() => {
    document.title = 'Portfolio — Meridian'
  }, [])

  // Acknowledge a completed refresh, then let the confirmation fade out.
  useEffect(() => {
    if (wasFetching.current && !isFetching && !isLoading) {
      setJustSynced(true)
      const t = setTimeout(() => setJustSynced(false), 2600)
      wasFetching.current = false
      return () => clearTimeout(t)
    }
    if (isFetching) wasFetching.current = true
  }, [isFetching, isLoading])

  if (isLoading) {
    return (
      <>
        <p role="status" aria-live="polite" className="sr-only">
          Syncing balances
        </p>
        <DashboardSkeleton />
      </>
    )
  }

  if (error) {
    const message =
      (error as { response?: { data?: { error?: string } } })?.response?.data
        ?.error ||
      (error as Error)?.message ||
      'The API may be offline, or a connected source returned an error.'

    return (
      <div className="measure px-5 py-8 sm:px-8">
        <EmptyState
          size="page"
          glyph="ledger"
          title="Couldn’t load your portfolio"
          description={message}
          action={
            <Button onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  if (!portfolio) return null

  const allocation = portfolio.assets.map((a) => ({
    label: a.asset,
    value: parseFloat(a.usdValue) || 0,
  }))
  const sources = portfolio.sources ?? []
  const failedSources = sources.filter(
    (s) => s.status === 'error' || Boolean(s.error),
  )
  const isStale = freshness(portfolio.lastUpdated) === 'stale'

  return (
    <article className="pb-16">
      <PortfolioOverview
        totalValue={portfolio.totalValue}
        pnl24h={portfolio.pnl24h}
        pnl7d={portfolio.pnl7d}
        pnl30d={portfolio.pnl30d}
        allocation={allocation}
        accountCount={accounts?.length ?? sources.length}
        lastUpdated={portfolio.lastUpdated}
        isFetching={isFetching}
        onRefresh={() => refetch()}
        justSynced={justSynced}
      />

      <div className="measure space-y-12 px-5 pt-10 sm:px-8 sm:pt-12">
        <LedgerStrip
          costBasis={overview?.costBasis}
          unrealizedPnl={overview?.unrealizedPnl}
          unrealizedPnlPercent={overview?.unrealizedPnlPercent}
          cashValue={overview?.cashValue}
          cashPercent={overview?.cashPercent}
        />

        {/* Partial failure is stated once, at the top, with a way out. */}
        {failedSources.length > 0 && (
          <Banner
            tone="warn"
            title={`${failedSources.length} of ${sources.length} sources didn’t report`}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/accounts">Review accounts</Link>
              </Button>
            }
          >
            Your total excludes{' '}
            {failedSources.map((s) => s.label).join(', ')}. Everything else is
            current.
          </Banner>
        )}

        {isStale && failedSources.length === 0 && (
          <Banner
            tone="info"
            title="These figures are more than a day old"
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Refresh now
              </Button>
            }
          >
            <FreshnessNote iso={portfolio.lastUpdated} prefix="Last read" />
          </Banner>
        )}

        <HoldingsTable headingId="holdings-heading" limit={12} />
        <MoversStrip headingId="movers-heading" />
        <NewsList headingId="news-heading" limit={8} />
        <PositionsList positions={portfolio.positions} />
        {sources.length > 0 && <SourcesSection sources={sources} />}
      </div>
    </article>
  )
}

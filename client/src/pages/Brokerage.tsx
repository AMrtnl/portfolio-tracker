import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Amount, Delta } from '@/components/ui/Amount'
import { Banner, EmptyState, SkeletonRows } from '@/components/ui/states'
import {
  FreshnessNote,
  RefreshButton,
  SectionHead,
} from '@/components/ui/data'
import { cn, formatCurrency, groupByMonth, relativeTime } from '@/lib/utils'
import {
  useSnaptradeAccountDetail,
  useSnaptradeAccounts,
  useSnaptradeActivities,
  useSnaptradeConnections,
  useSnaptradeOrders,
  useSnaptradeStatus,
  useSnaptradeImportAndInvalidate,
  SnapAccountVM,
} from '@/hooks/useSnaptrade'
import { useProviders, useSnaptradeConnect } from '@/hooks/useAccounts'

function money(amount: number | null | undefined, currency?: string | null) {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return formatCurrency(amount, { currency: currency || 'USD' })
}

function ConnectionBanner({
  configured,
  disabledCount,
  connectionCount,
  onRepair,
  repairing,
}: {
  configured: boolean
  disabledCount: number
  connectionCount: number
  onRepair: () => void
  repairing: boolean
}) {
  if (!configured) {
    return (
      <Banner tone="info" title="SnapTrade API keys required">
        Create a Personal key at{' '}
        <a
          href="https://dashboard.snaptrade.com/api-key"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          dashboard.snaptrade.com
        </a>
        , set <code className="num text-xs">SNAPTRADE_CLIENT_ID</code> and{' '}
        <code className="num text-xs">SNAPTRADE_CONSUMER_KEY</code> in{' '}
        <code className="num text-xs">.env</code>, then restart the server.
      </Banner>
    )
  }

  if (disabledCount > 0) {
    return (
      <Banner
        tone="warn"
        title={`${disabledCount} connection${disabledCount === 1 ? '' : 's'} disabled`}
        action={
          <Button size="sm" variant="outline" onClick={onRepair} disabled={repairing}>
            {repairing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden />
            )}
            Repair connection
          </Button>
        }
      >
        Figures below may be stale until you re-authorise in the SnapTrade
        portal.
      </Banner>
    )
  }

  if (connectionCount === 0) {
    return (
      <Banner
        tone="info"
        title="No brokerage connections yet"
        action={
          <Button size="sm" onClick={onRepair} disabled={repairing}>
            {repairing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden />
            )}
            Open connect portal
          </Button>
        }
      >
        Link a broker in SnapTrade, then import it here.
      </Banner>
    )
  }

  return null
}

/**
 * Account switcher. A left rail on desktop, a horizontally scrolling row of
 * cards on mobile — the shape Fidelity's "All accounts" switcher takes.
 */
function AccountPicker({
  accounts,
  selected,
  onSelect,
}: {
  accounts: SnapAccountVM[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ul
      className="-mx-5 flex list-none snap-x gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      aria-label="Brokerage accounts"
    >
      {accounts.map((a) => {
        const active = a.externalId === selected
        return (
          <li
            key={a.externalId}
            className="min-w-[15rem] shrink-0 snap-start lg:min-w-0 lg:shrink"
          >
            <button
              type="button"
              onClick={() => onSelect(a.externalId)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'w-full rounded-md border px-3.5 py-3 text-left transition-colors',
                active
                  ? 'border-primary/45 bg-primary/[0.06]'
                  : 'border-border/70 hover:border-border hover:bg-accent/40',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.institution}
                    {a.numberSuffix ? (
                      <span className="num"> · {a.numberSuffix}</span>
                    ) : null}
                  </p>
                  {a.accountType && (
                    <p className="t-eyebrow mt-1.5">{a.accountType}</p>
                  )}
                </div>
                {a.totalValue != null && (
                  <Amount
                    value={a.totalValue}
                    currency={a.currency}
                    compact
                    className="shrink-0 text-sm font-semibold"
                  />
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function Brokerage() {
  const { data: providers } = useProviders()
  const configured = Boolean(
    providers?.find((p) => p.id === 'snaptrade')?.configured,
  )
  const status = useSnaptradeStatus()
  const accountsQ = useSnaptradeAccounts(configured)
  const connectionsQ = useSnaptradeConnections(configured)
  const connect = useSnaptradeConnect()
  const importAccts = useSnaptradeImportAndInvalidate()

  const accounts = accountsQ.data?.accounts ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Brokerage'
  }, [])

  useEffect(() => {
    if (!selectedId && accounts.length > 0) {
      setSelectedId(accounts[0].externalId)
    }
  }, [accounts, selectedId])

  const detail = useSnaptradeAccountDetail(selectedId)
  const ordersQ = useSnaptradeOrders(selectedId)
  const activitiesQ = useSnaptradeActivities(selectedId)

  const disabledCount =
    status.data?.disabledConnectionCount ??
    connectionsQ.data?.connections.filter((c) => c.disabled).length ??
    0
  const connectionCount =
    status.data?.connectionCount ?? connectionsQ.data?.connections.length ?? 0

  function openPortal() {
    connect.mutate(undefined, {
      onSuccess: (data) => {
        if (data.redirectUrl) window.open(data.redirectUrl, '_blank', 'noopener')
      },
    })
  }

  function refreshAll() {
    void status.refetch()
    void accountsQ.refetch()
    void connectionsQ.refetch()
    void detail.refetch()
    void ordersQ.refetch()
    void activitiesQ.refetch()
  }

  const retrievedAt =
    detail.data?.retrievedAt ||
    accountsQ.data?.retrievedAt ||
    status.data?.retrievedAt

  const partialErrors = [
    ...(detail.data?.errors || []),
    detail.data?.balances.error,
    detail.data?.positions.error,
    ordersQ.isError ? (ordersQ.error as Error).message : null,
    activitiesQ.isError ? (activitiesQ.error as Error).message : null,
  ].filter(Boolean) as string[]

  const selected = accounts.find((a) => a.externalId === selectedId)
  const positions =
    detail.data?.positions.data.filter((p) => !p.cashEquivalent) ?? []
  const holdingsValue = positions.reduce((s, p) => s + (p.marketValue ?? 0), 0)
  const openPnl = positions.reduce((s, p) => s + (p.openPnl ?? 0), 0)
  const cash = (detail.data?.balances.data ?? []).reduce(
    (s, b) => s + (b.cash ?? 0),
    0,
  )
  const busy = accountsQ.isFetching || detail.isFetching

  return (
    <article>
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
            <RefreshButton
              onRefresh={refreshAll}
              busy={busy}
              label="Refresh brokerage data"
            />
            <Button
              size="sm"
              disabled={!configured || importAccts.isPending}
              onClick={() => importAccts.mutate()}
            >
              {importAccts.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              Import to portfolio
            </Button>
        </div>

        {retrievedAt && <FreshnessNote iso={retrievedAt} prefix="Read" className="mt-3" />}
      </header>

      <div className="space-y-6">
        <ConnectionBanner
          configured={configured}
          disabledCount={disabledCount}
          connectionCount={connectionCount}
          onRepair={openPortal}
          repairing={connect.isPending}
        />

        {importAccts.data?.message && (
          <p className="t-meta" role="status">
            {importAccts.data.message}
          </p>
        )}

        {partialErrors.length > 0 && (
          <Banner tone="warn" title="Some sections didn’t load">
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {partialErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Banner>
        )}
      </div>

      {!configured ? null : accountsQ.isLoading ? (
        <div className="mt-8">
          <p role="status" aria-live="polite" className="sr-only">
            Loading brokerage accounts
          </p>
          <SkeletonRows rows={4} />
        </div>
      ) : accountsQ.isError ? (
        <EmptyState
          size="page"
          glyph="link"
          title="Couldn’t reach SnapTrade"
          description={(accountsQ.error as Error).message}
          action={
            <Button variant="outline" onClick={() => accountsQ.refetch()}>
              Try again
            </Button>
          }
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          size="page"
          glyph="link"
          title="No brokerage accounts yet"
          description="Connect a broker in the SnapTrade portal, then import it into Meridian."
          action={
            <Button onClick={openPortal} disabled={connect.isPending}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Open connect portal
            </Button>
          }
        />
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-12">
          <section aria-labelledby="broker-accounts-heading" className="lg:sticky lg:top-20">
            <h2 id="broker-accounts-heading" className="t-eyebrow mb-3">
              Accounts
            </h2>
            <AccountPicker
              accounts={accounts}
              selected={selectedId}
              onSelect={setSelectedId}
            />
          </section>

          <div className="min-w-0 space-y-12">
            {detail.isLoading ? (
              <>
                <p role="status" aria-live="polite" className="sr-only">
                  Loading account detail
                </p>
                <SkeletonRows rows={5} />
              </>
            ) : (
              <>
                {/* Account summary strip: unboxed stat columns divided by
                 * hairlines, as on Quicken's web investments header. */}
                <section aria-labelledby="account-summary-heading">
                  <h2 id="account-summary-heading" className="sr-only">
                    {selected?.label ?? 'Account'} summary
                  </h2>
                  <dl className="divide-rule flex flex-wrap">
                    <div className="pr-6 sm:pr-8">
                      <dt className="t-eyebrow mb-2">Holdings value</dt>
                      <dd>
                        <Amount
                          value={holdingsValue}
                          currency={selected?.currency}
                          size="lg"
                        />
                      </dd>
                    </div>
                    <div className="px-6 sm:px-8">
                      <dt className="t-eyebrow mb-2">Cash</dt>
                      <dd className="num pt-1 text-base font-medium">
                        {money(cash, selected?.currency)}
                      </dd>
                    </div>
                    <div className="px-6 sm:px-8">
                      <dt className="t-eyebrow mb-2">Open P&amp;L</dt>
                      <dd className="pt-1">
                        <Delta amount={openPnl} currency={selected?.currency} />
                      </dd>
                    </div>
                  </dl>
                </section>

                <section aria-labelledby="cash-heading">
                  <SectionHead
                    id="cash-heading"
                    title="Cash and buying power"
                    meta={
                      <span className="num">
                        {detail.data?.balances.data.length ?? 0}{' '}
                        {(detail.data?.balances.data.length ?? 0) === 1
                          ? 'currency'
                          : 'currencies'}
                      </span>
                    }
                  />
                  {detail.data?.balances.error ? (
                    <Banner tone="error">{detail.data.balances.error}</Banner>
                  ) : (detail.data?.balances.data.length ?? 0) === 0 ? (
                    <div className="border-y border-border/60">
                      <EmptyState
                        glyph="ledger"
                        title="No cash balances reported"
                        description="This broker didn’t return a cash position for the account."
                      />
                    </div>
                  ) : (
                    <ul className="list-none divide-y divide-border/50 border-y border-border/60 p-0">
                      {detail.data?.balances.data.map((b) => (
                        <li
                          key={b.currency}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <span className="num text-sm font-medium">
                            {b.currency}
                          </span>
                          <span className="text-right">
                            <Amount
                              value={b.cash ?? 0}
                              currency={b.currency}
                              className="block text-sm font-semibold"
                            />
                            {b.buyingPower != null && (
                              <span className="num text-xs text-muted-foreground">
                                {money(b.buyingPower, b.currency)} buying power
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-labelledby="broker-positions-heading">
                  <SectionHead
                    id="broker-positions-heading"
                    title="Positions"
                    meta={
                      <span className="num">
                        {formatCurrency(holdingsValue, {
                          currency: selected?.currency,
                          compact: true,
                        })}{' '}
                        · {positions.length}
                      </span>
                    }
                  />
                  {detail.data?.positions.error ? (
                    <Banner tone="error">{detail.data.positions.error}</Banner>
                  ) : positions.length === 0 ? (
                    <div className="border-y border-border/60">
                      <EmptyState
                        glyph="holdings"
                        title="No positions in this account"
                        description="Cash-only accounts show their balance above."
                      />
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border/70">
                          <th scope="col" className="t-eyebrow py-2 pr-3 text-left">
                            Symbol
                          </th>
                          <th
                            scope="col"
                            className="t-eyebrow hidden py-2 px-3 text-right sm:table-cell"
                          >
                            Qty
                          </th>
                          <th
                            scope="col"
                            className="t-eyebrow hidden py-2 px-3 text-right sm:table-cell"
                          >
                            Price
                          </th>
                          <th scope="col" className="t-eyebrow py-2 pl-3 text-right">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((p) => (
                          <tr
                            key={p.symbol}
                            className="row-hover border-b border-border/40 last:border-0"
                          >
                            <th scope="row" className="min-w-0 py-2.5 pr-3 text-left">
                              <span className="block text-sm font-semibold">
                                {p.symbol}
                              </span>
                              {p.name && (
                                <span className="block max-w-[14rem] truncate text-xs font-normal text-muted-foreground">
                                  {p.name}
                                </span>
                              )}
                              <span className="num block text-xs font-normal text-muted-foreground sm:hidden">
                                {p.units} × {money(p.price, p.currency)}
                              </span>
                            </th>
                            <td className="num hidden py-2.5 px-3 text-right text-muted-foreground sm:table-cell">
                              {p.units}
                            </td>
                            <td className="num hidden py-2.5 px-3 text-right text-muted-foreground sm:table-cell">
                              {money(p.price, p.currency)}
                            </td>
                            <td className="py-2.5 pl-3 text-right">
                              <Amount
                                value={p.marketValue ?? 0}
                                currency={p.currency}
                                className="block text-sm font-semibold"
                              />
                              {p.openPnl != null && (
                                <Delta
                                  amount={p.openPnl}
                                  currency={p.currency}
                                  size="sm"
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <section aria-labelledby="orders-heading">
                  <SectionHead
                    id="orders-heading"
                    title="Recent orders"
                    caption="Last 24 hours reported by SnapTrade."
                  />
                  {ordersQ.isLoading ? (
                    <SkeletonRows rows={2} />
                  ) : ordersQ.isError ? (
                    <Banner tone="error">{(ordersQ.error as Error).message}</Banner>
                  ) : (ordersQ.data?.orders.length ?? 0) === 0 ? (
                    <div className="border-y border-border/60">
                      <EmptyState
                        glyph="activity"
                        title="No orders in the last 24 hours"
                      />
                    </div>
                  ) : (
                    <ul className="list-none divide-y divide-border/50 border-y border-border/60 p-0">
                      {ordersQ.data!.orders.map((o, i) => (
                        <li
                          key={o.brokerageOrderId || `${o.symbol}-${i}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              <span className="capitalize">
                                {o.action?.toLowerCase() || 'Order'}
                              </span>{' '}
                              {o.symbol || '—'}
                            </p>
                            <p className="t-meta">
                              {o.status}
                              {o.orderType ? ` · ${o.orderType}` : ''}
                              {o.timePlaced
                                ? ` · ${relativeTime(o.timePlaced)}`
                                : ''}
                            </p>
                          </div>
                          <div className="num text-right text-xs text-muted-foreground">
                            <p>
                              Qty {o.filledQuantity || o.totalQuantity || '—'}
                            </p>
                            {o.executionPrice ? (
                              <p className="text-foreground">
                                {money(parseFloat(o.executionPrice), o.currency)}
                              </p>
                            ) : o.limitPrice ? (
                              <p>
                                Limit{' '}
                                {money(parseFloat(o.limitPrice), o.currency)}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-labelledby="activities-heading">
                  <SectionHead
                    id="activities-heading"
                    title="Activity"
                    caption="Roughly the last 90 days. Brokers can take up to a day to report."
                    meta={
                      activitiesQ.data?.activities.length ? (
                        <span className="num">
                          {activitiesQ.data.activities.length} entries
                        </span>
                      ) : undefined
                    }
                  />
                  {activitiesQ.isLoading ? (
                    <SkeletonRows rows={3} />
                  ) : activitiesQ.isError ? (
                    <Banner tone="error">
                      {(activitiesQ.error as Error).message}
                    </Banner>
                  ) : (activitiesQ.data?.activities.length ?? 0) === 0 ? (
                    <div className="border-y border-border/60">
                      <EmptyState
                        glyph="activity"
                        title="Nothing recorded in this window"
                        description="Trades, dividends, and transfers will appear here as the broker reports them."
                      />
                    </div>
                  ) : (
                    /* Month groups with sticky headers, the way Betterment
                     * and Sumeria bucket transaction history. */
                    <div className="max-h-[32rem] overflow-y-auto border-y border-border/60">
                      {groupByMonth(
                        activitiesQ.data!.activities,
                        (a) => a.tradeDate,
                      ).map((group) => (
                        <div key={group.key}>
                          <h3 className="surface-chrome t-eyebrow sticky top-0 z-10 border-b border-border/50 py-2">
                            {group.label}
                          </h3>
                          <ul className="list-none divide-y divide-border/40 p-0">
                            {group.items.map((a, i) => (
                              <li
                                key={a.id || `${a.type}-${a.tradeDate}-${i}`}
                                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">
                                    <span className="capitalize">
                                      {(a.type || 'transaction').toLowerCase()}
                                    </span>
                                    {a.symbol && (
                                      <span className="num text-muted-foreground">
                                        {' '}
                                        · {a.symbol}
                                      </span>
                                    )}
                                  </p>
                                  <p className="t-meta max-w-lg truncate">
                                    {a.description ||
                                      (a.tradeDate
                                        ? new Date(
                                            a.tradeDate,
                                          ).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                          })
                                        : '')}
                                  </p>
                                </div>
                                {a.amount != null ? (
                                  <Amount
                                    value={a.amount}
                                    currency={a.currency ?? undefined}
                                    className={cn(
                                      'shrink-0 text-sm font-semibold',
                                      a.amount > 0 && 'text-gain',
                                    )}
                                  />
                                ) : (
                                  <span className="chip-neutral shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                                    No value
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, RotateCw } from 'lucide-react'
import { Banner, SkeletonRows } from '@/components/ui/states'
import { groupByMonth, relativeTime } from '@/lib/utils'
import { useMoney } from '@/wealth/format'
import { LogoAvatar } from '@/wealth/logos'
import {
  useSnaptradeAccountDetail,
  useSnaptradeAccounts,
  useSnaptradeActivities,
  useSnaptradeConnections,
  useSnaptradeOrders,
  useSnaptradeStatus,
  useSnaptradeImportAndInvalidate,
} from '@/hooks/useSnaptrade'
import { useProviders, useSnaptradeConnect } from '@/hooks/useAccounts'

/** What a brokerage needs before anything can load — a real sequence. */
function SetupSteps() {
  return (
    <section className="a-setup" aria-label="Connect SnapTrade">
      <div className="a-setuphead">
        <b>Connect a brokerage</b>
        <em>read-only</em>
      </div>
      <div className="a-step">
        <span className="a-stepnum">1</span>
        <span className="a-atext">
          <b>Create a free SnapTrade Personal key</b>
          <em>Sign up, enable 2FA, and link your brokers in their dashboard.</em>
        </span>
        <a
          href="https://dashboard.snaptrade.com/api-key"
          target="_blank"
          rel="noreferrer"
          className="ui-btn tinted sm"
        >
          Open
          <ExternalLink size={13} strokeWidth={2.5} />
        </a>
      </div>
      <div className="a-step">
        <span className="a-stepnum">2</span>
        <span className="a-atext">
          <b>Put the key in the server&rsquo;s .env</b>
          <em>
            <code>SNAPTRADE_CLIENT_ID</code> and <code>SNAPTRADE_CONSUMER_KEY</code> — they never
            reach the browser.
          </em>
        </span>
      </div>
      <div className="a-step">
        <span className="a-stepnum">3</span>
        <span className="a-atext">
          <b>Restart, then import to portfolio</b>
          <em>Positions land on the book next to everything else.</em>
        </span>
      </div>
    </section>
  )
}

export function Brokerage() {
  const { chf, pctStr } = useMoney()
  const { data: providers } = useProviders()
  const configured = Boolean(providers?.find((p) => p.id === 'snaptrade')?.configured)
  const status = useSnaptradeStatus()
  const accountsQ = useSnaptradeAccounts(configured)
  const connectionsQ = useSnaptradeConnections(configured)
  const connect = useSnaptradeConnect()
  const importAccts = useSnaptradeImportAndInvalidate()

  const accounts = useMemo(() => accountsQ.data?.accounts ?? [], [accountsQ.data])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Brokerage'
  }, [])

  useEffect(() => {
    if (!selectedId && accounts.length > 0) setSelectedId(accounts[0].externalId)
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
    detail.data?.retrievedAt || accountsQ.data?.retrievedAt || status.data?.retrievedAt

  const partialErrors = [
    ...(detail.data?.errors || []),
    detail.data?.balances.error,
    detail.data?.positions.error,
    ordersQ.isError ? (ordersQ.error as Error).message : null,
    activitiesQ.isError ? (activitiesQ.error as Error).message : null,
  ].filter(Boolean) as string[]

  const selected = accounts.find((a) => a.externalId === selectedId)
  const ccy = selected?.currency || 'USD'
  const positions = detail.data?.positions.data.filter((p) => !p.cashEquivalent) ?? []
  const holdingsValue = positions.reduce((s, p) => s + (p.marketValue ?? 0), 0)
  const openPnl = positions.reduce((s, p) => s + (p.openPnl ?? 0), 0)
  const cash = (detail.data?.balances.data ?? []).reduce((s, b) => s + (b.cash ?? 0), 0)
  const busy = accountsQ.isFetching || detail.isFetching
  const orders = ordersQ.data?.orders ?? []
  const activities = activitiesQ.data?.activities ?? []

  return (
    <>
      <div className="a-pagebar">
        <div className="a-header">
          {configured ? 'SnapTrade · read-only' : 'Not connected'}
          {configured && retrievedAt ? ` · read ${relativeTime(retrievedAt)}` : ''}
        </div>
        <div className="a-navbtns">
          <button
            type="button"
            className={`a-navbtn ${busy ? 'spin' : ''}`}
            onClick={refreshAll}
            aria-label="Refresh brokerage data"
            disabled={!configured || busy}
          >
            <RotateCw size={15} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="ui-btn tinted sm"
            disabled={!configured || importAccts.isPending}
            onClick={() => importAccts.mutate()}
          >
            {importAccts.isPending ? 'Importing…' : 'Import to portfolio'}
          </button>
        </div>
      </div>

      {!configured && <SetupSteps />}

      {configured && disabledCount > 0 && (
        <Banner
          tone="warn"
          title={`${disabledCount} connection${disabledCount === 1 ? '' : 's'} disabled`}
          action={
            <button
              type="button"
              className="ui-btn tinted sm"
              onClick={openPortal}
              disabled={connect.isPending}
            >
              Repair
            </button>
          }
        >
          Figures may be stale until you re-authorise in the SnapTrade portal.
        </Banner>
      )}

      {configured && connectionCount === 0 && (
        <Banner
          tone="info"
          title="No brokerage connections yet"
          action={
            <button
              type="button"
              className="ui-btn tinted sm"
              onClick={openPortal}
              disabled={connect.isPending}
            >
              Open portal
            </button>
          }
        >
          Link a broker in SnapTrade, then import it here.
        </Banner>
      )}

      {importAccts.data?.message && (
        <p className="a-insnote spaced" role="status">
          {importAccts.data.message}
        </p>
      )}

      {partialErrors.length > 0 && (
        <Banner tone="warn" title="Some sections didn’t load">
          {partialErrors.join(' · ')}
        </Banner>
      )}

      {!configured ? null : accountsQ.isLoading ? (
        <SkeletonRows rows={4} />
      ) : accountsQ.isError ? (
        <div className="ui-empty">
          <div className="ui-empty-icon">!</div>
          <b>Couldn’t reach SnapTrade</b>
          <p>{(accountsQ.error as Error).message}</p>
          <button type="button" className="ui-btn tinted sm" onClick={() => accountsQ.refetch()}>
            Try again
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty-icon">—</div>
          <b>No brokerage accounts yet</b>
          <p>Connect a broker in the SnapTrade portal, then import it into Meridian.</p>
          <button
            type="button"
            className="ui-btn primary sm"
            onClick={openPortal}
            disabled={connect.isPending}
          >
            Open connect portal
          </button>
        </div>
      ) : (
        <div className="a-desk">
          <div className="a-desk-primary">
            <section className="a-heroblock">
              <div className="a-hero bare">
                <div className="a-caption">{selected?.label ?? 'Account'} · holdings</div>
                <div className="a-value">
                  <span className="a-unit">{ccy}</span>
                  {chf(holdingsValue, false, ccy)}
                </div>
                <div className={`a-delta ${openPnl >= 0 ? 'gain' : 'loss'}`}>
                  {chf(openPnl, true, ccy)} open P&amp;L
                  {holdingsValue - openPnl > 0
                    ? ` · ${pctStr((openPnl / (holdingsValue - openPnl)) * 100)}`
                    : ''}
                </div>
              </div>
              <div className="a-statstrip">
                <div className="a-statcell">
                  <span>Cash</span>
                  <b>{chf(cash, false, ccy)}</b>
                </div>
                <div className="a-statcell">
                  <span>Positions</span>
                  <b>{positions.length}</b>
                </div>
                <div className="a-statcell">
                  <span>Institution</span>
                  <b>{selected?.institution ?? '—'}</b>
                </div>
                {selected?.accountType && (
                  <div className="a-statcell">
                    <span>Type</span>
                    <b>{selected.accountType}</b>
                  </div>
                )}
              </div>
            </section>

            {detail.isLoading ? (
              <SkeletonRows rows={5} />
            ) : (
              <>
                <div className="a-header">Positions</div>
                <section className="a-gcard">
                  {positions.length === 0 ? (
                    <p className="a-insnote spaced" style={{ paddingBottom: 12 }}>
                      No positions in this account — cash-only accounts show their balance above.
                    </p>
                  ) : (
                    positions.map((p) => (
                      <div key={p.symbol} className="a-arow">
                        <LogoAvatar symbol={p.symbol} name={p.name ?? undefined} color="#FFD84D" />
                        <span className="a-atext">
                          <b>{p.name || p.symbol}</b>
                          <em>
                            {p.symbol}
                            {p.units != null ? ` · ${p.units} ×` : ''}
                            {p.price != null ? ` ${chf(p.price, false, p.currency || ccy)}` : ''}
                          </em>
                        </span>
                        <span className="a-anum">
                          <b>{chf(p.marketValue ?? 0, false, p.currency || ccy)}</b>
                          {p.openPnl != null && (
                            <em className={`a-tag ${p.openPnl >= 0 ? 'gain' : 'loss'}`}>
                              {chf(p.openPnl, true, p.currency || ccy)}
                            </em>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </section>

                {(detail.data?.balances.data.length ?? 0) > 0 && (
                  <>
                    <div className="a-header">Cash &amp; buying power</div>
                    <section className="a-gcard">
                      {detail.data!.balances.data.map((b) => (
                        <div key={b.currency} className="a-arow">
                          <span className="a-ticker">{b.currency}</span>
                          <span className="a-atext">
                            <b>Cash</b>
                            {b.buyingPower != null && (
                              <em>{chf(b.buyingPower, false, b.currency)} buying power</em>
                            )}
                          </span>
                          <span className="a-anum">
                            <b>{chf(b.cash ?? 0, false, b.currency)}</b>
                          </span>
                        </div>
                      ))}
                    </section>
                  </>
                )}

                <div className="a-header">Recent orders</div>
                <section className="a-gcard">
                  {ordersQ.isLoading ? (
                    <SkeletonRows rows={2} />
                  ) : orders.length === 0 ? (
                    <p className="a-insnote spaced" style={{ paddingBottom: 12 }}>
                      No orders in the last 24 hours.
                    </p>
                  ) : (
                    orders.map((o, i) => (
                      <div key={o.brokerageOrderId || `${o.symbol}-${i}`} className="a-arow">
                        <span
                          className={`a-tag ${o.action?.toUpperCase() === 'BUY' ? 'gain' : 'loss'}`}
                        >
                          {o.action ? o.action.charAt(0) + o.action.slice(1).toLowerCase() : 'Order'}
                        </span>
                        <span className="a-atext">
                          <b>{o.symbol || '—'}</b>
                          <em>
                            {o.status}
                            {o.orderType ? ` · ${o.orderType}` : ''}
                            {o.timePlaced ? ` · ${relativeTime(o.timePlaced)}` : ''}
                          </em>
                        </span>
                        <span className="a-anum">
                          <b>
                            {o.executionPrice
                              ? chf(parseFloat(o.executionPrice), false, o.currency || ccy)
                              : o.limitPrice
                                ? `Limit ${chf(parseFloat(o.limitPrice), false, o.currency || ccy)}`
                                : '—'}
                          </b>
                          <em>Qty {o.filledQuantity || o.totalQuantity || '—'}</em>
                        </span>
                      </div>
                    ))
                  )}
                </section>

                <div className="a-header">Activity</div>
                {activitiesQ.isLoading ? (
                  <SkeletonRows rows={3} />
                ) : activities.length === 0 ? (
                  <section className="a-gcard">
                    <p className="a-insnote spaced" style={{ paddingBottom: 12 }}>
                      Nothing recorded in the last 90 days. Trades, dividends, and transfers
                      appear as the broker reports them.
                    </p>
                  </section>
                ) : (
                  groupByMonth(activities, (a) => a.tradeDate).map((group) => (
                    <div key={group.key}>
                      <div className="a-header sm">{group.label}</div>
                      <section className="a-gcard">
                        {group.items.map((a, i) => (
                          <div key={a.id || `${a.type}-${a.tradeDate}-${i}`} className="a-arow">
                            <span className="a-atext">
                              <b>
                                {(a.type || 'transaction').charAt(0).toUpperCase() +
                                  (a.type || 'transaction').slice(1).toLowerCase()}
                                {a.symbol ? ` · ${a.symbol}` : ''}
                              </b>
                              <em>{a.description || a.tradeDate || ''}</em>
                            </span>
                            <span className="a-anum">
                              {a.amount != null ? (
                                <b className={a.amount > 0 ? 'gain' : ''}>
                                  {chf(a.amount, true, a.currency || ccy)}
                                </b>
                              ) : (
                                <em className="a-tag flat">No value</em>
                              )}
                            </span>
                          </div>
                        ))}
                      </section>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          <aside className="a-desk-aside">
            <div className="a-header">Accounts</div>
            <section className="a-gcard">
              {accounts.map((a) => {
                const active = a.externalId === selectedId
                return (
                  <button
                    key={a.externalId}
                    type="button"
                    className={`a-arow tap ${active ? 'on' : ''}`}
                    onClick={() => setSelectedId(a.externalId)}
                    aria-current={active ? 'true' : undefined}
                  >
                    <LogoAvatar institution={a.institution} name={a.label} color="#FFD84D" />
                    <span className="a-atext">
                      <b>{a.label}</b>
                      <em>
                        {a.institution}
                        {a.numberSuffix ? ` · ${a.numberSuffix}` : ''}
                        {a.accountType ? ` · ${a.accountType}` : ''}
                      </em>
                    </span>
                    {a.totalValue != null && (
                      <span className="a-anum">
                        <b>{chf(a.totalValue, false, a.currency || ccy)}</b>
                      </span>
                    )}
                  </button>
                )
              })}
            </section>
          </aside>
        </div>
      )}
    </>
  )
}

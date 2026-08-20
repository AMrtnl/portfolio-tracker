import { Check, ChevronLeft, RotateCw, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { freshness, providerName, relativeTime } from '@/lib/utils'
import { useAccounts, type Account } from '@/hooks/useAccounts'

function methodOf(account: Account): { name: string; note: string; color: string } {
  if (account.provider === 'snaptrade') {
    return { name: 'Broker API', note: 'SnapTrade', color: '#4BD57E' }
  }
  if (account.provider === 'hyperliquid') {
    return { name: 'On-chain', note: 'Public address', color: '#A57BFF' }
  }
  return { name: 'Manual', note: 'You update this', color: '#8E8E93' }
}

function SyncDot({ account, spinning }: { account: Account; spinning: boolean }) {
  if (spinning) {
    return (
      <span className="s-dot spin">
        <RotateCw size={13} strokeWidth={2.6} />
      </span>
    )
  }
  if (account.status === 'error') {
    return (
      <span className="s-dot err">
        <X size={13} strokeWidth={3} />
      </span>
    )
  }
  if (account.provider === 'manual') {
    return <span className="s-dot manual" />
  }
  if (account.status === 'connected') {
    return (
      <span className="s-dot ok">
        <Check size={13} strokeWidth={3} />
      </span>
    )
  }
  return <span className="s-dot idle" />
}

export function SyncSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts()
  const qc = useQueryClient()
  const syncAll = useMutation({
    mutationFn: async () => {
      await Promise.allSettled(
        accounts
          .filter((a) => a.provider !== 'manual')
          .map((a) => axios.post(`/api/accounts/${a.id}/sync`)),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  if (!open) return null

  const live = accounts.filter((a) => a.provider !== 'manual')
  const manual = accounts.filter((a) => a.provider === 'manual')
  const failed = accounts.filter((a) => a.status === 'error')
  const stale = accounts.filter((a) => freshness(a.lastSyncedAt) === 'stale')

  return (
    <div className="a-sheet" role="dialog" aria-label="Connections">
      <div className="a-shell">
        <header className="a-detnav">
          <button type="button" className="a-back" onClick={onClose}>
            <ChevronLeft size={20} strokeWidth={2.5} />
            Back
          </button>
        </header>

        <div className="a-detid">
          <div>
            <h2 className="a-dettitle">Connections</h2>
            <p className="a-detsub">
              {accounts.length} {accounts.length === 1 ? 'source' : 'sources'}
              {failed.length > 0 && ` · ${failed.length} need attention`}
            </p>
          </div>
        </div>

        <section className="a-gcard pad">
          <div className="s-runhead">
            <div>
              <b>{syncAll.isPending ? 'Syncing…' : 'Refresh balances'}</b>
              <em>
                {stale.length > 0
                  ? `${stale.length} older than a day`
                  : 'Pull the latest from every live source'}
              </em>
            </div>
            <button
              type="button"
              className="ui-btn tinted sm"
              onClick={() => syncAll.mutate()}
              disabled={syncAll.isPending || live.length === 0}
            >
              {syncAll.isPending ? 'Working' : 'Sync all'}
            </button>
          </div>
          {syncAll.isPending && (
            <div className="s-progress">
              <i style={{ width: '70%' }} />
            </div>
          )}
        </section>

        {live.length > 0 && (
          <>
            <div className="a-header">Live</div>
            <section className="a-gcard">
              {live.map((a) => {
                const method = methodOf(a)
                return (
                  <div key={a.id} className="s-row">
                    <SyncDot account={a} spinning={syncAll.isPending} />
                    <span className="a-atext">
                      <b>
                        {a.label}
                        {a.status === 'error' && <i className="a-stale" title="Needs attention" />}
                      </b>
                      <em>
                        {a.status === 'error'
                          ? a.lastError || 'Sync failed'
                          : a.lastSyncedAt
                            ? `Last sync ${relativeTime(a.lastSyncedAt)}`
                            : 'Not synced yet'}
                      </em>
                    </span>
                    <span className="s-method" style={{ color: method.color, background: `${method.color}22` }}>
                      {method.name}
                    </span>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {manual.length > 0 && (
          <>
            <div className="a-header">Manual</div>
            <section className="a-gcard">
              {manual.map((a) => {
                const method = methodOf(a)
                return (
                  <div key={a.id} className="s-row">
                    <SyncDot account={a} spinning={false} />
                    <span className="a-atext">
                      <b>{a.label}</b>
                      <em>
                        {providerName(a.provider)}
                        {a.institution ? ` · ${a.institution}` : ''}
                      </em>
                    </span>
                    <span className="s-method" style={{ color: method.color, background: `${method.color}22` }}>
                      {method.name}
                    </span>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {accounts.length === 0 && (
          <p className="a-footnote">No accounts connected yet.</p>
        )}
      </div>
    </div>
  )
}

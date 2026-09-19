import { Check, ArrowsClockwise, X } from '@phosphor-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { freshness, providerName, relativeTime } from '@/lib/utils'
import { useAccounts, type Account } from '@/hooks/useAccounts'
import { FloatSheet } from '@/wealth/FloatSheet'

function methodOf(account: Account): { name: string; note: string; color: string } {
  if (account.provider === 'snaptrade') {
    return { name: 'Broker API', note: 'SnapTrade', color: '#4BD57E' }
  }
  if (account.provider === 'hyperliquid') {
    return { name: 'On-chain', note: 'Public address', color: '#A57BFF' }
  }
  if (account.provider === 'watch') {
    return { name: 'Watch-only', note: 'Public key · nothing to sign', color: '#F7931A' }
  }
  return { name: 'Manual', note: 'You update this', color: '#8E8E93' }
}

function SyncDot({ account, spinning }: { account: Account; spinning: boolean }) {
  if (spinning) {
    return (
      <span className="s-dot spin">
        <ArrowsClockwise size={13} />
      </span>
    )
  }
  if (account.status === 'error') {
    return (
      <span className="s-dot err">
        <X size={13} />
      </span>
    )
  }
  if (account.provider === 'manual') {
    return <span className="s-dot manual" />
  }
  if (account.status === 'connected') {
    return (
      <span className="s-dot ok">
        <Check size={13} />
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

  const live = accounts.filter((a) => a.provider !== 'manual')
  const manual = accounts.filter((a) => a.provider === 'manual')
  const failed = accounts.filter((a) => a.status === 'error')
  const stale = accounts.filter((a) => freshness(a.lastSyncedAt) === 'stale')

  return (
    <FloatSheet open={open} onClose={onClose} title="Connections">
      <p className="a-qlead">
        {accounts.length} {accounts.length === 1 ? 'source' : 'sources'} on the book
        {failed.length > 0
          ? ` · ${failed.length} ${failed.length === 1 ? 'needs' : 'need'} attention`
          : ''}
        . Live sources refresh on demand; manual ones stay as you last set them.
      </p>

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
          <p className="a-insnote spaced">No accounts connected yet.</p>
        )}
    </FloatSheet>
  )
}

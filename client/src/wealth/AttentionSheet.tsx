import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FloatSheet } from '@/wealth/FloatSheet'
import { useAccounts, useSyncAccount } from '@/hooks/useAccounts'
import { useRecurringSuggestions } from '@/hooks/useMoneyLedger'
import { useGoals } from '@/hooks/useGoals'
import { readDismissed } from '@/wealth/dismissed'
import { isDemoId } from '@/wealth/demo'
import { accountValue } from '@/wealth/classifyAccount'
import { goalStatus } from '@/wealth/goals'
import { useMoney } from '@/wealth/format'
import { freshness, relativeTime } from '@/lib/utils'

export interface AttentionItem {
  key: string
  tone: 'loss' | 'warn' | 'info'
  title: string
  sub: string
  action: string
  run: () => void
  busy?: boolean
  /** Navigating actions dismiss the sheet; in-place ones (sync) keep it open. */
  closes?: boolean
}

/**
 * Everything that needs a decision, in one list: broken or stale syncs,
 * recurring charges waiting for a yes, goals that have slipped.
 */
export function useAttention(): AttentionItem[] {
  const navigate = useNavigate()
  const { chf } = useMoney()
  const { data: accounts = [] } = useAccounts()
  const { data: suggestions = [] } = useRecurringSuggestions()
  const { data: goals = [] } = useGoals()
  const sync = useSyncAccount()

  return useMemo(() => {
    const items: AttentionItem[] = []
    const real = accounts.filter((a) => !isDemoId(a.id))

    for (const a of real) {
      if (a.status === 'error' || a.lastError) {
        items.push({
          key: `err-${a.id}`,
          tone: 'loss',
          title: `${a.label} needs repair`,
          sub: a.lastError || 'The last sync failed',
          action: 'Sync',
          run: () => sync.mutate(a.id),
          busy: sync.isPending && sync.variables === a.id,
        })
      } else if (a.provider !== 'manual' && freshness(a.lastSyncedAt) === 'stale') {
        items.push({
          key: `stale-${a.id}`,
          tone: 'warn',
          title: `${a.label} is out of date`,
          sub: a.lastSyncedAt ? `Last synced ${relativeTime(a.lastSyncedAt)}` : 'Never synced',
          action: 'Sync',
          run: () => sync.mutate(a.id),
          busy: sync.isPending && sync.variables === a.id,
        })
      }
    }

    const dismissed = readDismissed()
    const pending = suggestions.filter((s) => !dismissed.has(s.key))
    if (pending.length > 0) {
      items.push({
        key: 'recurring',
        tone: 'info',
        title: `${pending.length} recurring ${pending.length === 1 ? 'charge' : 'charges'} detected`,
        sub: pending
          .slice(0, 3)
          .map((s) => s.name)
          .join(' · '),
        action: 'Review',
        run: () => navigate('/subscriptions'),
        closes: true,
      })
    }

    for (const goal of goals) {
      const current = goal.accountIds.reduce((s, id) => {
        const a = accounts.find((x) => x.id === id)
        return s + (a ? Math.max(accountValue(a), 0) : 0)
      }, 0)
      const status = goalStatus(goal, current)
      if (status.state !== 'behind' || status.needed == null) continue
      items.push({
        key: `goal-${goal.id}`,
        tone: 'warn',
        title: `${goal.name} is behind`,
        sub: `Needs ${chf(status.needed - goal.monthlyContribution)} more a month to land on time`,
        action: 'Open',
        run: () => navigate('/goals'),
        closes: true,
      })
    }

    return items
  }, [accounts, suggestions, goals, sync, navigate, chf])
}

export function AttentionSheet({
  open,
  onClose,
  items,
}: {
  open: boolean
  onClose: () => void
  items: AttentionItem[]
}) {
  return (
    <FloatSheet open={open} onClose={onClose} title="Needs attention">
      {items.length === 0 ? (
        <section className="a-gcard pad a-goalempty">
          <b>Nothing needs you right now.</b>
          <p className="a-insnote">
            Failed or stale syncs, recurring charges waiting for a decision, and goals that
            slip all land here.
          </p>
        </section>
      ) : (
        <>
          <p className="a-qlead">
            {items.length} {items.length === 1 ? 'thing' : 'things'} to look at. Each one has a
            single next step.
          </p>
          <section className="a-gcard">
            {items.map((it) => (
              <div key={it.key} className="a-arow">
                <span className={`a-tonedot ${it.tone}`} aria-hidden />
                <span className="a-atext">
                  <b>{it.title}</b>
                  <em>{it.sub}</em>
                </span>
                <button
                  type="button"
                  className="ui-btn tinted sm"
                  onClick={() => {
                    it.run()
                    if (it.closes) onClose()
                  }}
                  disabled={it.busy}
                >
                  {it.busy ? 'Syncing…' : it.action}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </FloatSheet>
  )
}

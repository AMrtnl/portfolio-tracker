import { useMemo } from 'react'
import { useAccounts, type Account } from '@/hooks/useAccounts'
import { useDemo } from '@/wealth/DemoContext'
import { useMoney } from '@/wealth/format'
import { DEMO_ACCOUNT_CHANGE_12M, isDemoId } from '@/wealth/demo'
import { freshness, type Freshness } from '@/lib/utils'
import type { ClassId } from '@/wh/Token'
import { accountBucket, accountClassId, accountKindLabel, holdingBucket, type Bucket } from './classify'

export interface BookAccount {
  account: Account
  id: string
  name: string
  classId: ClassId
  /** What it is, in a word or two. */
  kind: string
  liability: boolean
  /** Absolute value, converted into the display currency. */
  value: number
  /** Share of everything you own; null for debts. */
  share: number | null
  /** Twelve-month change in percent when a source reports one. */
  change12m: number | null
  /** The note that stands where a change would: "valued Mar 2026", "owed". */
  note: string | null
  freshness: Freshness
  /** "2 min", "1 h", "Mar 2026". */
  freshLabel: string
  broken: boolean
  sample: boolean
}

export interface Book {
  accounts: BookAccount[]
  assets: BookAccount[]
  liabilities: BookAccount[]
  /** Totals in the display currency. */
  own: number
  owe: number
  net: number
  liquid: number
  cash: number
  buckets: Array<{ bucket: Bucket; value: number; percent: number }>
  synced: number
  broken: BookAccount[]
  stale: BookAccount[]
  loading: boolean
  empty: boolean
  sampleOn: boolean
  hasLive: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2 min", "1 h", "3 d", or the month for anything older. */
export function freshLabel(iso?: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'never'
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  if (days < 45) return `${days} d`
  const d = new Date(then)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function monthLabel(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** The whole ledger, classified and totalled in the display currency: what every screen starts from. */
export function useBook(): Book {
  const { enabled: sampleOn } = useDemo()
  const { data: accounts, isLoading } = useAccounts()
  const { toDisplay } = useMoney()

  return useMemo(() => {
    const list = accounts ?? []
    const rows: BookAccount[] = list.map((a) => {
      const liability = a.kind === 'liability' || a.type === 'loan'
      const value = toDisplay(Math.abs(a.totalValueUsd ?? 0), a.currency)
      const classId = accountClassId(a)
      const fresh = freshness(a.lastSyncedAt)
      const change12m = DEMO_ACCOUNT_CHANGE_12M[a.id] ?? null
      const valued = monthLabel(a.lastSyncedAt)
      const note = liability ? 'owed' : change12m != null ? null : classId === 'property' ? (valued ? `valued ${valued}` : 'by hand') : a.provider === 'manual' ? 'by hand' : null
      return {
        account: a,
        id: a.id,
        name: a.label,
        classId,
        kind: a.notes || accountKindLabel(a),
        liability,
        value,
        share: null,
        change12m,
        note,
        freshness: fresh,
        freshLabel: classId === 'property' ? valued ?? 'by hand' : freshLabel(a.lastSyncedAt),
        broken: a.status === 'error' || Boolean(a.lastError),
        sample: isDemoId(a.id),
      }
    })
    const assets = rows.filter((r) => !r.liability)
    const liabilities = rows.filter((r) => r.liability)
    const own = assets.reduce((s, r) => s + r.value, 0)
    const owe = liabilities.reduce((s, r) => s + r.value, 0)
    for (const r of assets) r.share = own ? (r.value / own) * 100 : null

    // Buckets: an account's own positions decide where its money sits; the rest falls to the account's class.
    const totals: Record<Bucket, number> = { property: 0, equitiesAndFunds: 0, pension: 0, cash: 0, crypto: 0 }
    for (const r of assets) {
      let covered = 0
      for (const h of r.account.holdings ?? []) {
        const v = toDisplay(h.quantity * h.priceUsd, r.account.currency)
        if (v <= 0) continue
        totals[holdingBucket(h)] += v
        covered += v
      }
      const rest = r.value - covered
      if (rest > 0) totals[accountBucket(r.account)] += rest
    }
    const bucketTotal = Object.values(totals).reduce((s, v) => s + v, 0) || 1
    const buckets = (Object.keys(totals) as Bucket[])
      .map((bucket) => ({ bucket, value: totals[bucket], percent: (totals[bucket] / bucketTotal) * 100 }))
      .filter((b) => b.value > 0)

    const broken = rows.filter((r) => r.broken && !r.sample)
    const stale = rows.filter((r) => !r.broken && r.account.provider !== 'manual' && r.freshness === 'stale' && !r.sample)
    const hasLive = rows.some((r) => !r.sample)

    return {
      accounts: rows,
      assets,
      liabilities,
      own,
      owe,
      net: own - owe,
      liquid: own - totals.property - totals.pension,
      cash: totals.cash,
      buckets,
      synced: rows.length - broken.length,
      broken,
      stale,
      loading: isLoading,
      empty: !isLoading && rows.length === 0,
      sampleOn,
      hasLive,
    }
  }, [accounts, isLoading, sampleOn, toDisplay])
}

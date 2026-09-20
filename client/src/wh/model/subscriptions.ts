import { useMemo } from 'react'
import { useCategories, useSubscriptions, type Subscription } from '@/hooks/useMoneyLedger'
import { useDemo } from '@/wealth/DemoContext'
import { chargeDay, monthlyEquivalent } from '@/wealth/calendar'
import { DEMO_SUBSCRIPTION_ALERTS, DEMO_SUBSCRIPTION_HISTORY, DEMO_SUBSCRIPTION_NOTES, isDemoId } from '@/wealth/demo'
import { ICONS, type IconName } from '@/wh/icons'
import type { ClassId } from '@/wh/Token'
import { useBook } from './book'

export interface SubscriptionRow {
  sub: Subscription
  id: string
  name: string
  plan: string
  classId: ClassId
  kind: string
  monthly: number
  yearly: number
  since: string
  /** "renews 2 Oct", "ends 31 Jan". */
  next: string
  nextDate: Date | null
  /** Red when set: "up 2.00 since March". */
  flag: string | null
  sample: boolean
}

export interface SubscriptionAlert {
  kind: 'priceRise' | 'overlap'
  title: string
  text: string
}

export interface SubscriptionsView {
  rows: SubscriptionRow[]
  count: number
  monthly: number
  yearly: number
  history: number[]
  historyFrom: string
  historyTo: string
  change12m: number | null
  byKind: Array<{ id: string; name: string; amount: number; icon: IconName }>
  alerts: SubscriptionAlert[]
  next30: Array<{ row: SubscriptionRow; date: Date }>
  loading: boolean
}

const KIND_CLASS: Record<string, ClassId> = { media: 'media', telecom: 'telecom', health: 'health', software: 'software', essentials: 'subscription', transport: 'subscription', home: 'subscription' }
const KIND_ICON: Record<string, IconName> = { media: ICONS.kind.media, telecom: ICONS.kind.telecom, health: ICONS.kind.health, software: ICONS.kind.software, essentials: ICONS.nav.subscriptions, transport: ICONS.spending.transport, home: ICONS.spending.housing }
const KIND_NAME: Record<string, string> = { media: 'Video and music', telecom: 'Telecom', health: 'Health', software: 'Software and storage', essentials: 'Essentials', transport: 'Transport', home: 'Home' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function nextCharge(sub: Subscription, today: Date): Date | null {
  for (let k = 0; k < 13; k++) {
    const d = new Date(today.getFullYear(), today.getMonth() + k, 1)
    const day = chargeDay(sub, d.getFullYear(), d.getMonth())
    if (!day) continue
    const when = new Date(d.getFullYear(), d.getMonth(), day)
    if (when >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) return when
  }
  return null
}

function sinceLabel(iso: string, today: Date): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  const months = (today.getFullYear() - d.getFullYear()) * 12 + today.getMonth() - d.getMonth()
  return months < 12 ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : String(d.getFullYear())
}

/** Everything that renews by itself: totals, creep over twelve months, kinds, alerts and what is due soon. */
export function useSubscriptionsView(): SubscriptionsView {
  const { enabled: sampleOn } = useDemo()
  const book = useBook()
  const { data, isLoading } = useSubscriptions()
  const { data: cats } = useCategories()

  return useMemo(() => {
    const today = new Date()
    const subs = data?.subscriptions ?? []
    const catNames = new Map((cats?.subscriptions ?? data?.categories ?? []).map((c) => [c.id, c.name]))
    const fixture = sampleOn && !book.hasLive

    const rows: SubscriptionRow[] = subs.map((s) => {
      const note = isDemoId(s.id) ? DEMO_SUBSCRIPTION_NOTES[s.name] : undefined
      const monthly = monthlyEquivalent(s)
      const nextDate = nextCharge(s, today)
      const cycleWord = s.cycle === 'monthly' ? 'monthly' : s.cycle === 'quarterly' ? 'quarterly' : 'yearly'
      const plan = s.plan ? (/monthly|yearly|quarterly|plan/i.test(s.plan) ? s.plan : `${s.plan}, ${cycleWord}`) : cycleWord[0].toUpperCase() + cycleWord.slice(1)
      let next = nextDate ? `renews ${nextDate.getDate()} ${MONTHS[nextDate.getMonth()]}` : '—'
      if (note?.next) next = /^\d/.test(note.next) ? `renews ${note.next}` : note.next
      return {
        sub: s,
        id: s.id,
        name: s.name,
        plan,
        classId: KIND_CLASS[s.cat] ?? 'subscription',
        kind: KIND_NAME[s.cat] ?? catNames.get(s.cat) ?? 'Other',
        monthly,
        yearly: monthly * 12,
        since: note?.since ?? sinceLabel(s.createdAt, today),
        next,
        nextDate,
        flag: note?.flag ?? null,
        sample: isDemoId(s.id),
      }
    })
    rows.sort((a, b) => b.monthly - a.monthly)

    const monthly = rows.reduce((s, r) => s + r.monthly, 0)

    // Twelve months of creep: the fixture's, or what the ledger says existed each month.
    let history: number[]
    if (fixture) history = DEMO_SUBSCRIPTION_HISTORY
    else {
      history = []
      for (let k = 11; k >= 0; k--) {
        const d = new Date(today.getFullYear(), today.getMonth() - k + 1, 0)
        history.push(rows.filter((r) => new Date(r.sub.createdAt) <= d).reduce((s, r) => s + r.monthly, 0))
      }
    }
    const first = new Date(today.getFullYear(), today.getMonth() - 11, 1)
    const change12m = history.length > 1 && history[0] ? ((history[history.length - 1] - history[0]) / history[0]) * 100 : null

    const kinds = new Map<string, number>()
    for (const r of rows) kinds.set(r.sub.cat, (kinds.get(r.sub.cat) ?? 0) + r.monthly)
    const byKind = [...kinds.entries()]
      .map(([id, amount]) => ({ id, name: KIND_NAME[id] ?? catNames.get(id) ?? 'Other', amount, icon: KIND_ICON[id] ?? ICONS.nav.subscriptions }))
      .sort((a, b) => b.amount - a.amount)

    let alerts: SubscriptionAlert[]
    if (fixture) alerts = DEMO_SUBSCRIPTION_ALERTS.map((a) => ({ kind: a.kind, title: a.kind === 'priceRise' ? 'Price rise' : 'Overlap', text: a.text }))
    else {
      alerts = []
      const media = rows.filter((r) => r.sub.cat === 'media')
      if (media.length >= 2) {
        const cheaper = [...media].sort((a, b) => a.monthly - b.monthly)[0]
        alerts.push({
          kind: 'overlap',
          title: 'Overlap',
          text: `${media[0].name} and ${media[1].name} are both video and music. ${cheaper.name} costs you CHF ${Math.round(cheaper.yearly)} a year.`,
        })
      }
    }

    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)
    const next30 = rows
      .filter((r) => r.nextDate && r.nextDate <= horizon)
      .map((r) => ({ row: r, date: r.nextDate! }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return {
      rows,
      count: rows.length,
      monthly,
      yearly: monthly * 12,
      history,
      historyFrom: `${MONTHS[first.getMonth()]} ${first.getFullYear()}`,
      historyTo: `${MONTHS[today.getMonth()]} ${today.getFullYear()}`,
      change12m,
      byKind,
      alerts,
      next30,
      loading: isLoading && !subs.length,
    }
  }, [data, isLoading, cats, sampleOn, book.hasLive])
}

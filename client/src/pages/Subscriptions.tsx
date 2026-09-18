import { useMemo, useState, type FormEvent } from 'react'
import { CaretLeft, CaretRight, Plus, Sparkle, Trash } from '@phosphor-icons/react'
import { FloatSheet } from '@/wealth/FloatSheet'
import { useMoney } from '@/wealth/format'
import { Money } from '@/wealth/Money'
import { isDemoId } from '@/wealth/demo'
import { LogoAvatar } from '@/wealth/logos'
import {
  MONTHS,
  WEEKDAYS,
  chargeDay,
  monthGrid,
  monthlyEquivalent,
} from '@/wealth/calendar'
import {
  subCatOf,
  useAddSubscription,
  useCategories,
  useDeleteSubscription,
  useRecurringSuggestions,
  useSubscriptions,
  type BillingCycle,
  type RecurringSuggestion,
} from '@/hooks/useMoneyLedger'

import { readDismissed, writeDismissed } from '@/wealth/dismissed'

function cycleLabel(cycle: BillingCycle): string {
  return cycle === 'monthly' ? 'Monthly' : cycle === 'quarterly' ? 'Every 3 months' : 'Yearly'
}

function cycleTag(cycle: BillingCycle): string {
  return cycle === 'monthly' ? 'mo' : cycle === 'quarterly' ? '3 mo' : 'yr'
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function Subscriptions() {
  const { chf, hidden, unit } = useMoney()
  const { data } = useSubscriptions()
  const { data: cats } = useCategories()
  const { data: suggestions } = useRecurringSuggestions()
  const addSub = useAddSubscription()
  const delSub = useDeleteSubscription()
  const subs = useMemo(() => data?.subscriptions ?? [], [data])
  const subCats = cats?.subscriptions ?? data?.categories

  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selDay, setSelDay] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [fromKey, setFromKey] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed)
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('')
  const [amount, setAmount] = useState('')
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [day, setDay] = useState(String(today.getDate()))
  const [cat, setCat] = useState('essentials')

  const detected = (suggestions ?? []).filter((s) => !dismissed.has(s.key))

  const dismiss = (key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(key)
      writeDismissed(next)
      return next
    })
  }

  const openSheet = (s?: RecurringSuggestion) => {
    setName(s?.name ?? '')
    setPlan('')
    setAmount(s ? String(s.amount) : '')
    setCycle(s?.cycle ?? 'monthly')
    setDay(String(s?.day ?? today.getDate()))
    setCat(s?.cat ?? 'essentials')
    setFromKey(s?.key ?? null)
    setAdding(true)
  }

  const step = (dir: number) => {
    setSelDay(null)
    let m = month + dir
    let y = year
    if (m < 0) {
      m = 11
      y -= 1
    }
    if (m > 11) {
      m = 0
      y += 1
    }
    setMonth(m)
    setYear(y)
  }

  const byDay = useMemo(() => {
    const map: Record<number, typeof subs> = {}
    for (const s of subs) {
      const d = chargeDay(s, year, month)
      if (d) (map[d] = map[d] || []).push(s)
    }
    return map
  }, [subs, year, month])

  const monthCharges = Object.values(byDay).flat()
  const monthTotal = monthCharges.reduce((s, x) => s + x.amount, 0)
  const monthlyRun = subs.reduce((s, x) => s + monthlyEquivalent(x), 0)
  const yearlyRun = monthlyRun * 12
  const grid = useMemo(() => monthGrid(year, month), [year, month])
  const isThisMonth = year === today.getFullYear() && month === today.getMonth()

  const upcoming = useMemo(() => {
    const out: Array<{ sub: (typeof subs)[number]; when: Date }> = []
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    for (let k = 0; k < 3; k++) {
      const d = new Date(today.getFullYear(), today.getMonth() + k, 1)
      for (const s of subs) {
        const charge = chargeDay(s, d.getFullYear(), d.getMonth())
        if (!charge) continue
        const when = new Date(d.getFullYear(), d.getMonth(), charge)
        if (when >= start) out.push({ sub: s, when })
      }
    }
    return out.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 4)
  }, [subs, today])

  const daysAway = (d: Date) =>
    Math.round(
      (d.getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
        864e5,
    )

  const selCharges = selDay ? byDay[selDay] || [] : null
  const sorted = [...subs].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    const d = parseInt(day, 10)
    if (!name.trim() || !Number.isFinite(n) || n <= 0 || !Number.isFinite(d)) return
    addSub.mutate(
      {
        name: name.trim(),
        plan: plan.trim() || undefined,
        amount: n,
        cycle,
        day: d,
        month: cycle === 'monthly' ? undefined : today.getMonth(),
        cat,
      },
      {
        onSuccess: () => {
          if (fromKey) dismiss(fromKey)
          setAdding(false)
        },
      },
    )
  }

  return (
    <>
      <div className="a-pagebar">
        <div className="a-header">Recurring charges</div>
        <button type="button" className="ui-btn tinted sm" onClick={() => openSheet()}>
          <Plus size={15} />
          Add subscription
        </button>
      </div>

      {detected.length > 0 && (
        <section className="a-detect" aria-label="Detected recurring charges">
          <div className="a-detecthead">
            <b>
              <Sparkle size={14} aria-hidden /> Detected in your
              transactions
            </b>
            <em>
              {detected.length} recurring {detected.length === 1 ? 'charge' : 'charges'} not
              tracked yet. Add as-is, adjust first, or dismiss.
            </em>
          </div>
          {detected.map((s) => {
            const c = subCatOf(s.cat, subCats)
            return (
              <div key={s.key} className="a-arow">
                <LogoAvatar name={s.name} color={c.color} />
                <span className="a-atext">
                  <b>{s.name}</b>
                  <em>
                    {cycleLabel(s.cycle)} · seen {s.occurrences}× · last {shortDate(s.lastDate)}
                  </em>
                </span>
                <span className="a-anum">
                  <b>{chf(s.amount)}</b>
                  <em className={`a-tag cycle ${s.cycle}`}>{cycleTag(s.cycle)}</em>
                </span>
                <span className="a-rowactions">
                  <button type="button" className="ui-btn tinted sm" onClick={() => openSheet(s)}>
                    Add
                  </button>
                  <button type="button" className="ui-btn ghost sm" onClick={() => dismiss(s.key)}>
                    Dismiss
                  </button>
                </span>
              </div>
            )
          })}
        </section>
      )}

      <div className="a-desk">
        <div className="a-desk-primary">
          <section className="a-heroblock">
            <div className="a-herotop">
              <div className="a-hero bare">
                <div className="a-caption">
                  {MONTHS[month]} {year} · Due
                </div>
                <div className="a-value">
                  <span className="a-unit">{unit()}</span>
                  <Money value={monthTotal} />
                </div>
                <div className="a-delta muted">
                  {monthCharges.length} {monthCharges.length === 1 ? 'charge' : 'charges'}
                  <span className="a-period">{chf(monthlyRun)}/mo average</span>
                </div>
              </div>
              <div className="a-monthnav">
                <button
                  type="button"
                  className="a-calnav"
                  onClick={() => step(-1)}
                  aria-label="Previous month"
                >
                  <CaretLeft size={17} />
                </button>
                <span className="a-calmonth">
                  {MONTHS[month].slice(0, 3)} {year}
                </span>
                <button
                  type="button"
                  className="a-calnav"
                  onClick={() => step(1)}
                  aria-label="Next month"
                >
                  <CaretRight size={17} />
                </button>
              </div>
            </div>
          </section>

          <section className="a-gcard pad">
            <div className="a-weekdays">
              {WEEKDAYS.map((d, i) => (
                <span key={`${d}-${i}`}>{d}</span>
              ))}
            </div>

            <div className="a-grid">
              {grid.map((cell, i) => {
                const charges = cell.outside ? null : byDay[cell.day]
                const isToday = isThisMonth && !cell.outside && cell.day === today.getDate()
                const on = selDay === cell.day && !cell.outside
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={cell.outside || !charges}
                    className={`a-cell ${cell.outside ? 'out' : ''} ${charges ? 'has' : ''} ${on ? 'on' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => setSelDay(on ? null : cell.day)}
                  >
                    <span className="a-cellnum">{cell.day}</span>
                    {charges && (
                      <span className="a-cellDots">
                        {charges.slice(0, 3).map((s) => (
                          <i key={s.id} style={{ background: subCatOf(s.cat, subCats).color }} />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="a-daypanel">
              {selCharges && selDay ? (
                <>
                  <div className="a-daytitle">
                    {selDay} {MONTHS[month]}
                    <b>{chf(selCharges.reduce((s, x) => s + x.amount, 0))}</b>
                  </div>
                  {selCharges.map((s) => {
                    const c = subCatOf(s.cat, subCats)
                    return (
                      <div key={s.id} className="a-subrow tight">
                        <LogoAvatar name={s.name} color={c.color} />
                        <span className="a-atext">
                          <b>{s.name}</b>
                          <em>{s.plan}</em>
                        </span>
                        <span className="a-anum">
                          <b>{chf(s.amount)}</b>
                        </span>
                      </div>
                    )
                  })}
                </>
              ) : (
                <>
                  <div className="a-daytitle">Up next</div>
                  {upcoming.length === 0 && (
                    <p className="a-insnote">Nothing due. Add the bills that repeat.</p>
                  )}
                  {upcoming.map(({ sub, when }) => {
                    const c = subCatOf(sub.cat, subCats)
                    const away = daysAway(when)
                    return (
                      <div key={`${sub.id}${when.toISOString()}`} className="a-subrow tight">
                        <LogoAvatar name={sub.name} color={c.color} />
                        <span className="a-atext">
                          <b>{sub.name}</b>
                          <em>
                            {away === 0 ? 'Today' : `in ${away} days`} · {when.getDate()}{' '}
                            {MONTHS[when.getMonth()].slice(0, 3)}
                          </em>
                        </span>
                        <span className="a-anum">
                          <b>{chf(sub.amount)}</b>
                        </span>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </section>

          <div className="a-stats">
            <div className="a-stat">
              <span>Monthly</span>
              <b><Money value={monthlyRun} /></b>
            </div>
            <div className="a-stat">
              <span>Yearly</span>
              <b><Money value={yearlyRun} /></b>
            </div>
            <div className="a-stat">
              <span>Active</span>
              <b>{hidden ? '••' : subs.length}</b>
            </div>
          </div>
        </div>

        <aside className="a-desk-aside">
          <div className="a-header">All subscriptions</div>
          <section className="a-gcard">
            {sorted.length === 0 && (
              <p className="a-insnote spaced" style={{ paddingBottom: 12 }}>
                Nothing tracked yet. Add one, or import a statement on Cash flow and let
                Wealth Hub detect them.
              </p>
            )}
            {sorted.map((s) => {
              const c = subCatOf(s.cat, subCats)
              return (
                <div key={s.id} className="a-arow">
                  <LogoAvatar name={s.name} color={c.color} />
                  <span className="a-atext">
                    <b>{s.name}</b>
                    <em>
                      {s.plan ? `${s.plan} · ` : ''}day {s.day}
                    </em>
                  </span>
                  <span className="a-anum">
                    <b>{chf(s.amount)}</b>
                    <em className={`a-tag cycle ${s.cycle}`}>{cycleTag(s.cycle)}</em>
                  </span>
                  {!isDemoId(s.id) && (
                    <button
                      type="button"
                      className="a-navbtn ghost"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => delSub.mutate(s.id)}
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        </aside>
      </div>

      <FloatSheet
        open={adding}
        title={fromKey ? 'Confirm subscription' : 'Add subscription'}
        onClose={() => setAdding(false)}
      >
        {fromKey && (
          <p className="a-qlead">
            Detected from your transactions — check the details and save.
          </p>
        )}
        <form onSubmit={submit} className="a-form" aria-label="Add subscription">
          <label className="ui-tf">
            <span className="ui-tf-label">Name</span>
            <span className="ui-tf-box">
              <input
                required
                autoFocus
                placeholder="Netflix, Swisscom…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </span>
          </label>
          <label className="ui-tf">
            <span className="ui-tf-label">Plan</span>
            <span className="ui-tf-box">
              <input placeholder="Optional" value={plan} onChange={(e) => setPlan(e.target.value)} />
            </span>
          </label>
          <label className="ui-amount">
            <span className="ui-tf-label">Amount</span>
            <span className="ui-amount-box">
              <em>USD</em>
              <input
                required
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount"
              />
            </span>
          </label>
          <div className="a-formrow">
            <label className="ui-tf">
              <span className="ui-tf-label">Billing</span>
              <span className="ui-tf-box">
                <select value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </span>
            </label>
            <label className="ui-tf">
              <span className="ui-tf-label">Day of month</span>
              <span className="ui-tf-box">
                <input
                  required
                  inputMode="numeric"
                  placeholder="1–31"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </span>
            </label>
          </div>
          <label className="ui-tf">
            <span className="ui-tf-label">Category</span>
            <span className="ui-tf-box">
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                {(subCats ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <button type="submit" className="ui-btn primary md full" disabled={addSub.isPending}>
            {addSub.isPending ? 'Saving…' : fromKey ? 'Confirm and track' : 'Add subscription'}
          </button>
        </form>
      </FloatSheet>
    </>
  )
}

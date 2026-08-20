import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useMoney } from '@/wealth/format'
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
  useSubscriptions,
  type BillingCycle,
} from '@/hooks/useMoneyLedger'

const fieldClass =
  'w-full rounded-[14px] border-[0.5px] border-white/[0.07] bg-[rgba(118,118,128,0.18)] px-3.5 py-3 text-[15px] font-semibold text-white placeholder:text-white/30'

export function Subscriptions() {
  const { chf, hidden } = useMoney()
  const { data } = useSubscriptions()
  const { data: cats } = useCategories()
  const addSub = useAddSubscription()
  const delSub = useDeleteSubscription()
  const subs = data?.subscriptions ?? []
  const subCats = cats?.subscriptions ?? data?.categories

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selDay, setSelDay] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('')
  const [amount, setAmount] = useState('')
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [day, setDay] = useState(String(today.getDate()))
  const [cat, setCat] = useState('essentials')

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
          setName('')
          setPlan('')
          setAmount('')
          setAdding(false)
        },
      },
    )
  }

  return (
    <div className="a-desk">
      <div className="a-desk-primary">
      <section className="a-card">
        <div className="a-hero">
          <div className="a-caption">
            {MONTHS[month]} {year} · Due
          </div>
          <div className="a-value">
            <span className="a-unit">USD</span>
            {chf(monthTotal)}
          </div>
          <div className="a-delta muted">
            {monthCharges.length} {monthCharges.length === 1 ? 'charge' : 'charges'}
            <span className="a-period">{chf(monthlyRun)}/mo average</span>
          </div>
        </div>

        <div className="a-calhead">
          <button type="button" className="a-calnav" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronLeft size={17} strokeWidth={2.5} />
          </button>
          <span className="a-calmonth">
            {MONTHS[month]} {year}
          </span>
          <button type="button" className="a-calnav" onClick={() => step(1)} aria-label="Next month">
            <ChevronRight size={17} strokeWidth={2.5} />
          </button>
        </div>

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
          <b>{chf(monthlyRun)}</b>
        </div>
        <div className="a-stat">
          <span>Yearly</span>
          <b>{chf(yearlyRun)}</b>
        </div>
        <div className="a-stat">
          <span>Active</span>
          <b>{hidden ? '••' : subs.length}</b>
        </div>
      </div>
      </div>

      <aside className="a-desk-aside">
      {sorted.length > 0 && (
        <>
          <div className="a-header">All subscriptions</div>
          <section className="a-gcard pad">
            {sorted.map((s) => {
              const c = subCatOf(s.cat, subCats)
              return (
                <div key={s.id} className="a-subrow">
                  <LogoAvatar name={s.name} color={c.color} />
                  <span className="a-atext">
                    <b>{s.name}</b>
                    <em>
                      {s.plan ? `${s.plan} · ` : ''}day {s.day}
                    </em>
                  </span>
                  <span className="a-anum">
                    <b>{chf(s.amount)}</b>
                    <em className={`a-tag cycle ${s.cycle}`}>
                      {s.cycle === 'monthly' ? 'mo' : s.cycle === 'quarterly' ? '3 mo' : 'yr'}
                    </em>
                  </span>
                  {!isDemoId(s.id) && (
                    <button
                      type="button"
                      className="a-navbtn"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => delSub.mutate(s.id)}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        </>
      )}

      {adding ? (
        <section className="a-gcard pad">
          <form onSubmit={submit} className="space-y-3 px-2 py-1" aria-label="Add subscription">
            <input
              required
              className={fieldClass}
              placeholder="Name · Netflix, Swisscom…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Plan · optional"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            />
            <input
              required
              inputMode="decimal"
              className={fieldClass}
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className={fieldClass}
                value={cycle}
                onChange={(e) => setCycle(e.target.value as BillingCycle)}
                aria-label="Billing cycle"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                required
                inputMode="numeric"
                className={fieldClass}
                placeholder="Day of month"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                aria-label="Day of month"
              />
            </div>
            <select
              className={fieldClass}
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              aria-label="Category"
            >
              {(subCats ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="ui-btn primary" disabled={addSub.isPending}>
              {addSub.isPending ? 'Saving…' : 'Add subscription'}
            </button>
            <button type="button" className="ui-btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </form>
        </section>
      ) : (
        <button type="button" className="a-add" onClick={() => setAdding(true)}>
          <Plus size={17} strokeWidth={2.5} />
          Add subscription
        </button>
      )}
      </aside>
    </div>
  )
}

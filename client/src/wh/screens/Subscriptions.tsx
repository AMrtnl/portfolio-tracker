import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Token } from '@/wh/Token'
import { Button, Field, RoundButton } from '@/wh/controls'
import { Card, Note } from '@/wh/layout'
import { CreepBars, Meter } from '@/wh/charts'
import { useFigures } from '@/wh/format'
import { useSubscriptionsView, type SubscriptionRow } from '@/wh/data/subscriptions'
import { useDesktop } from '@/wh/useMediaQuery'
import { useAddSubscription, useCategories, useDeleteSubscription, type BillingCycle } from '@/hooks/useMoneyLedger'
import { FloatSheet } from '@/wealth/FloatSheet'
import { Menu } from '@/wh/Menu'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
type Sort = 'cost' | 'name' | 'next'

function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: cats } = useCategories()
  const add = useAddSubscription()
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('')
  const [amount, setAmount] = useState('')
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [day, setDay] = useState(String(new Date().getDate()))
  const [cat, setCat] = useState('media')
  function submit(e: FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    const d = parseInt(day, 10)
    if (!name.trim() || !Number.isFinite(n) || n <= 0 || !Number.isFinite(d)) return
    add.mutate(
      { name: name.trim(), plan: plan.trim() || undefined, amount: n, cycle, day: Math.min(31, Math.max(1, d)), month: cycle === 'monthly' ? undefined : new Date().getMonth(), cat },
      {
        onSuccess: () => {
          setName('')
          setPlan('')
          setAmount('')
          onClose()
        },
      },
    )
  }
  return (
    <FloatSheet open={open} onClose={onClose} title="Add a subscription">
      <form onSubmit={submit} className="wh-form" style={{ paddingTop: 8 }} aria-label="Add a subscription">
        <Field icon={ICONS.nav.subscriptions} label="Name" required placeholder="Netflix, Swisscom, the gym" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="wh-form-row">
          <Field icon={ICONS.action.edit} label="Plan" placeholder="Optional" value={plan} onChange={(e) => setPlan(e.target.value)} />
          <Field icon={ICONS.figure.moneyOut} label="Price" required inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="wh-form-row">
          <Field icon={ICONS.status.stale} label="Renews" as="select" value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </Field>
          <Field icon={ICONS.evidence.horizon} label="Day of month" required inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <Field icon={ICONS.sector.diversified} label="Kind" as="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          {(cats?.subscriptions ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Field>
        {add.isError && <p className="wh-err">Could not save this. Try again.</p>}
        <div className="wh-form-actions">
          <Button type="submit" icon={ICONS.action.add} disabled={add.isPending}>
            {add.isPending ? 'Saving' : 'Add subscription'}
          </Button>
          <Button variant="tertiary" onClick={onClose}>
            Not now
          </Button>
        </div>
      </form>
    </FloatSheet>
  )
}

function SubToken({ r, size }: { r: SubscriptionRow; size: number }) {
  return <Token name={r.name} classId={r.classId} size={size} classOnly={r.classId === 'health'} />
}

export function Subscriptions() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const view = useSubscriptionsView()
  const { money, unit } = useFigures()
  const remove = useDeleteSubscription()
  const [addOpen, setAddOpen] = useState(false)
  const [sort, setSort] = useState<Sort>('cost')

  useEffect(() => {
    document.title = 'Subscriptions · Wealth Hub'
  }, [])

  const rows = [...view.rows].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'next' ? (a.nextDate?.getTime() ?? Infinity) - (b.nextDate?.getTime() ?? Infinity) : b.monthly - a.monthly))
  const changeChip = view.change12m != null && Math.abs(view.change12m) >= 0.5 && (
    <span className={`wh-chip ${view.change12m > 0 ? 'owed' : 'gain'}`}>
      <Icon name={view.change12m > 0 ? ICONS.status.up : ICONS.status.down} size={18} />
      {Math.abs(view.change12m).toFixed(0)}% in 12 months
    </span>
  )
  const summary = (
    <Card kind="bare" style={{ padding: desktop ? '20px 24px' : '18px 18px 14px', flex: '1.5 1 0' }}>
      <div className="wh-sub-head">
        <div>
          <div className="wh-sub-count">{view.count} active{desktop ? (view.count === 1 ? ' subscription' : ' subscriptions') : ''}</div>
          <div className="wh-figure" style={{ fontSize: desktop ? 46 : 36 }}>
            {unit} {money(view.monthly, undefined, { digits: 2 })}
          </div>
          <div className="wh-sub-unit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>
              a month, {desktop ? `${unit} ` : ''}
              {money(view.yearly)} a year
            </span>
            {!desktop && changeChip}
          </div>
        </div>
        {desktop && changeChip}
      </div>
      {view.history.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <CreepBars values={view.history} width={520} height={110} />
          <div className="wh-creep-caps">
            <span>{desktop ? `${view.historyFrom}, ${unit} ${Math.round(view.history[0])}` : view.historyFrom}</span>
            <span>{desktop ? `${view.historyTo}, ${unit} ${Math.round(view.history[view.history.length - 1])}` : view.historyTo}</span>
          </div>
        </div>
      )}
    </Card>
  )
  const alerts = view.alerts.map((a) =>
    a.kind === 'priceRise' ? (
      <Note key={a.text} tone="risk" icon={ICONS.evidence.return} title={desktop ? a.title : undefined}>
        {a.text}
      </Note>
    ) : (
      <Note key={a.text} tone="insight" icon={ICONS.grow.overlap} title={desktop ? a.title : undefined}>
        {a.text}
      </Note>
    ),
  )
  const rowMenu = (r: SubscriptionRow) =>
    r.sample ? null : (
      <Menu
        label={`Actions for ${r.name}`}
        items={[{ key: 'remove', label: 'Remove', icon: ICONS.ui.remove, onSelect: () => remove.mutate(r.id) }]}
        trigger={(props) => <RoundButton icon={ICONS.ui.more} label={`Actions for ${r.name}`} flat {...props} />}
      />
    )
  const empty = !view.loading && view.count === 0

  if (!desktop) {
    return (
      <div className="wh-screen">
        <ScreenHeader
          title="Subscriptions"
          stacked
          lead={<RoundButton icon={ICONS.ui.back} label="Back to cash flow" onClick={() => navigate('/cashflow')} />}
          actions={
            <>
              <Menu
                label="Sort"
                items={[
                  { key: 'cost', label: 'By cost', on: sort === 'cost', onSelect: () => setSort('cost') },
                  { key: 'next', label: 'By next renewal', on: sort === 'next', onSelect: () => setSort('next') },
                  { key: 'name', label: 'By name', on: sort === 'name', onSelect: () => setSort('name') },
                ]}
                trigger={(props) => <RoundButton icon={ICONS.action.sort} label="Sort" {...props} />}
              />
              <RoundButton icon={ICONS.action.add} label="Add a subscription" onClick={() => setAddOpen(true)} />
            </>
          }
        />
        {summary}
        {alerts}
        <Card kind="bare" style={{ padding: '4px 16px', borderRadius: 26 }}>
          {empty && <p className="wh-body" style={{ padding: '14px 0' }}>Nothing renews yet. Add the charges that repeat.</p>}
          {rows.map((r) => (
            <div key={r.id} className="wh-row compact">
              <SubToken r={r} size={46} />
              <span className="wh-row-text">
                <span className="wh-row-title">{r.name}</span>
                <span className="wh-row-sub">{r.plan}</span>
              </span>
              <span className="wh-row-num">
                <span className="wh-row-value">{money(r.sub.amount, undefined, { digits: 2 })}</span>
                <span className={`wh-row-delta${r.flag ? ' wh-owed' : ''}`}>{r.flag ?? r.next}</span>
              </span>
              {rowMenu(r)}
            </div>
          ))}
        </Card>
        <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    )
  }

  return (
    <div className="wh-screen">
      <ScreenHeader
        title="Subscriptions"
        subtitle="Everything that renews by itself, found in your bank and card transactions."
        actions={
          <Button icon={ICONS.action.add} size="sm" onClick={() => setAddOpen(true)}>
            Add
          </Button>
        }
      />
      <div className="wh-grid wide-side">
        <div className="wh-col">
          <div style={{ display: 'flex', gap: 20 }}>
            {summary}
            <Card kind="bare" style={{ padding: '18px 22px 8px', flex: '1 1 0', minWidth: 0 }}>
              <h2 className="wh-h2" style={{ marginBottom: 4 }}>
                By kind
              </h2>
              {view.byKind.map((k) => (
                <div key={k.id} className="wh-meterrow" style={{ padding: '9px 0' }}>
                  <Icon name={k.icon} size={20} />
                  <span className="wh-meterrow-label">{k.name}</span>
                  <Meter pct={view.monthly ? (k.amount / view.monthly) * 100 : 0} scale={1.6} label={`${k.name} ${money(k.amount, undefined, { digits: 2 })}`} />
                  <span className="wh-meterrow-pct">{money(k.amount, undefined, { digits: 2 })}</span>
                </div>
              ))}
              {view.byKind.length === 0 && <p className="wh-caption" style={{ padding: '10px 0' }}>Nothing yet.</p>}
            </Card>
          </div>
          <Card kind="bare" style={{ padding: '10px 24px' }}>
            <div className="wh-thead">
              <span className="wh-cell lead" style={{ flex: '2.4 1 0' }}>
                Subscription
              </span>
              <span className="wh-cell">A month</span>
              <span className="wh-cell">A year</span>
              <span className="wh-cell">Since</span>
              <span className="wh-cell" style={{ flex: '1.4 1 0' }}>
                Next
              </span>
              <span style={{ width: 44, flex: '0 0 auto' }} />
            </div>
            {empty && <p className="wh-body" style={{ padding: '14px 0' }}>Nothing renews yet. Add the charges that repeat, or paste a statement on Cash flow and the detector finds them.</p>}
            {rows.map((r) => (
              <div key={r.id} className="wh-trow" style={{ padding: '7px 0' }}>
                <span className="wh-cell lead" style={{ flex: '2.4 1 0' }}>
                  <span className="wh-cell-name">
                    <SubToken r={r} size={36} />
                    <span>
                      <b>{r.name}</b>
                      <small>{r.plan}</small>
                    </span>
                  </span>
                </span>
                <span className="wh-cell">{money(r.monthly, undefined, { digits: 2 })}</span>
                <span className="wh-cell">{money(r.yearly)}</span>
                <span className="wh-cell">{r.since}</span>
                <span className={`wh-cell ${r.flag ? 'wh-owed' : 'wh-muted'}`} style={{ flex: '1.4 1 0' }}>
                  {r.flag ?? r.next}
                </span>
                <span style={{ width: 44, flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end' }}>{rowMenu(r)}</span>
              </div>
            ))}
          </Card>
        </div>
        <div className="wh-col" style={{ gap: 16 }}>
          {alerts}
          <Card kind="bare" style={{ padding: '18px 22px 10px' }}>
            <h2 className="wh-h2" style={{ marginBottom: 8 }}>
              Next 30 days
            </h2>
            {view.next30.length === 0 && <p className="wh-caption" style={{ padding: '8px 0' }}>Nothing due in the next 30 days.</p>}
            {view.next30.map(({ row, date }) => (
              <div key={row.id} className="wh-next">
                <span className="wh-next-date">
                  <b>{date.getDate()}</b>
                  <span>{MONTHS[date.getMonth()]}</span>
                </span>
                <span className="wh-next-name">{row.name}</span>
                <span className="wh-next-amount">{money(row.sub.amount, undefined, { digits: 2 })}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

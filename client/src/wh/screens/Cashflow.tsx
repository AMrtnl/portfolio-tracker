import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/wh/Icon'
import { ICONS } from '@/wh/icons'
import { Button, Field, RoundButton, Segmented } from '@/wh/controls'
import { Card, Note } from '@/wh/layout'
import { Meter, CashflowChart, CashflowLegend } from '@/wh/charts'
import { useFigures } from '@/wh/format'
import { PERIODS, useCashflowView, type Period } from '@/wh/data/cashflow'
import { useSubscriptionsView } from '@/wh/data/subscriptions'
import { useDesktop } from '@/wh/useMediaQuery'
import { useAddTransaction, useCategories, useImportStatement, type TxKind } from '@/hooks/useMoneyLedger'
import { FloatSheet } from '@/wealth/FloatSheet'
import { ScreenHeader } from './ScreenHeader'
import '@/wh/screens/screens.css'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Log money in or out by hand, or paste a bank statement. */
function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: cats } = useCategories()
  const add = useAddTransaction()
  const importStatement = useImportStatement()
  const [mode, setMode] = useState<'log' | 'import'>('log')
  const [kind, setKind] = useState<TxKind>('spend')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('groceries')
  const [date, setDate] = useState(todayIso)
  const [note, setNote] = useState('')
  const [csv, setCsv] = useState('')
  const list = kind === 'income' ? cats?.income : cats?.spend

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) return
    add.mutate(
      { date, kind, amount: n, category, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setAmount('')
          setNote('')
          onClose()
        },
      },
    )
  }

  return (
    <FloatSheet open={open} onClose={onClose} title={mode === 'log' ? 'Log a transaction' : 'Import a statement'}>
      <div className="wh-form" style={{ paddingTop: 8 }}>
        <Segmented
          options={[
            { value: 'log', label: 'By hand' },
            { value: 'import', label: 'Paste a statement' },
          ]}
          value={mode}
          onChange={setMode}
          label="How"
        />
        {mode === 'log' ? (
          <form onSubmit={submit} className="wh-form" aria-label="Log a transaction">
            <Segmented
              options={[
                { value: 'spend', label: 'Money out' },
                { value: 'income', label: 'Money in' },
              ]}
              value={kind}
              onChange={(k) => {
                setKind(k)
                setCategory(k === 'income' ? 'salary' : 'groceries')
              }}
              label="Direction"
            />
            <Field icon={ICONS.figure.moneyOut} label="Amount" inputMode="decimal" required placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Field icon={ICONS.sector.diversified} label="Category" as="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(list ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Field>
            <div className="wh-form-row">
              <Field icon={ICONS.evidence.horizon} label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Field icon={ICONS.action.edit} label="Note" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {add.isError && <p className="wh-err">Could not save this. Try again.</p>}
            <div className="wh-form-actions">
              <Button type="submit" icon={ICONS.action.add} disabled={add.isPending}>
                {add.isPending ? 'Saving' : kind === 'income' ? 'Log money in' : 'Log money out'}
              </Button>
              <Button variant="tertiary" onClick={onClose}>
                Not now
              </Button>
            </div>
          </form>
        ) : (
          <form
            className="wh-form"
            aria-label="Import a statement"
            onSubmit={(e) => {
              e.preventDefault()
              if (csv.trim()) importStatement.mutate(csv, { onSuccess: () => setCsv('') })
            }}
          >
            <Field icon={ICONS.account.csvImport} label="Statement, as CSV" as="textarea" rows={8} placeholder="Date, description, amount, one line per movement" value={csv} onChange={(e) => setCsv(e.target.value)} hint="Every line is categorised and deduplicated. Nothing is sent anywhere but this app." />
            {importStatement.data && (
              <p className="wh-ok">
                <Icon name={ICONS.ui.check} size={18} />
                {importStatement.data.imported} imported, {importStatement.data.skipped} already there{importStatement.data.unreadable ? `, ${importStatement.data.unreadable} unreadable` : ''}.
              </p>
            )}
            {importStatement.isError && <p className="wh-err">The statement could not be read.</p>}
            <div className="wh-form-actions">
              <Button type="submit" icon={ICONS.account.csvImport} disabled={importStatement.isPending || !csv.trim()}>
                {importStatement.isPending ? 'Reading' : 'Import'}
              </Button>
              <Button variant="tertiary" onClick={onClose}>
                Done
              </Button>
            </div>
          </form>
        )}
      </div>
    </FloatSheet>
  )
}

export function Cashflow() {
  const desktop = useDesktop()
  const [period, setPeriod] = useState<Period>('Monthly')
  const view = useCashflowView(period)
  const subs = useSubscriptionsView()
  const priceRises = subs.alerts.filter((a) => a.kind === 'priceRise').length
  const { money, headline, unit } = useFigures()
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    document.title = 'Cash flow · Wealth Hub'
  }, [])

  const chart = (
    <CashflowChart months={view.labels} ins={view.ins} outs={view.outs} position={view.position} forecastFrom={view.forecastFrom} nowIndex={view.nowIndex} width={900} height={desktop ? 250 : 120} />
  )
  const whereCard = (
    <Card kind="bare" style={{ padding: desktop ? '16px 22px 8px' : '14px 16px 6px' }}>
      <div className="wh-card-head" style={{ marginBottom: 4 }}>
        <h2 className="wh-card-title sm">Where {view.current.label} went</h2>
        {!desktop && <span className="wh-caption">{unit}</span>}
      </div>
      {view.categories.length === 0 && <p className="wh-caption" style={{ padding: '10px 0' }}>Nothing logged this month yet.</p>}
      {(desktop ? view.categories : view.categories.slice(0, 4)).map((c) => (
        <div key={c.id} className="wh-meterrow" style={{ padding: '7px 0' }}>
          <Icon name={c.icon} size={20} />
          <span className="wh-meterrow-label">{c.name}</span>
          <Meter pct={view.current.out ? (c.amount / view.current.out) * 100 : 0} label={`${c.name} ${money(c.amount)}`} />
          <span className="wh-meterrow-pct">{money(c.amount)}</span>
        </div>
      ))}
    </Card>
  )
  const trio = (
    <div className="wh-cf-trio" style={{ borderTop: desktop ? '1px solid var(--wh-rule)' : 0, marginTop: desktop ? 12 : 0, paddingTop: desktop ? 4 : 0 }}>
      {[
        { icon: ICONS.figure.moneyIn, tint: 'gain', label: `In, ${view.current.label}`, value: money(view.current.in) },
        { icon: ICONS.figure.moneyOut, tint: 'owed', label: `Out, ${view.current.label}`, value: money(view.current.out) },
        { icon: ICONS.figure.kept, tint: 'ultra', label: `Kept, ${Math.round(view.current.keptPct)}% of income`, value: money(view.current.kept) },
      ].map((s) => (
        <div key={s.label} className="wh-cf-stat">
          <span className={`wh-cf-stat-tile wh-tint-${s.tint}`} style={{ background: 'var(--wh-token-bg)', color: 'var(--wh-token-fg)', width: 34, height: 34, borderRadius: 11 }}>
            <Icon name={s.icon} size={20} />
          </span>
          <span>
            <span className="wh-cf-stat-label">{s.label}</span>
            <span className="wh-cf-stat-value" style={{ display: 'block' }}>
              {s.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  )

  if (!desktop) {
    return (
      <div className="wh-screen">
        <ScreenHeader title="Cash flow" actions={<RoundButton icon={ICONS.action.edit} label="Log a transaction" onClick={() => setLogOpen(true)} />} />
        <Card kind="bare" style={{ padding: 16, borderRadius: 26 }}>
          <div className="wh-cf-phone" style={{ marginBottom: 14 }}>
            {[
              { icon: ICONS.figure.moneyIn, cls: 'wh-gain', label: 'In', value: money(view.current.in) },
              { icon: ICONS.figure.moneyOut, cls: 'wh-owed', label: 'Out', value: money(view.current.out) },
              { icon: ICONS.figure.kept, cls: 'wh-gain', label: 'Kept', value: money(view.current.kept) },
            ].map((s) => (
              <div key={s.label} style={{ flex: '1 1 0' }}>
                <div className={`wh-caption ${s.cls}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name={s.icon} size={16} />
                  {s.label}
                </div>
                <div className={`wh-figure sm${s.label === 'Kept' ? ' wh-gain' : ''}`} style={{ marginTop: 2 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          {view.hasActivity ? chart : <p className="wh-caption">No cash flow yet. Log money in or out and the bars fill in from there.</p>}
          <div style={{ marginTop: 10 }}>
            <CashflowLegend />
          </div>
        </Card>
        {whereCard}
        <Link to="/subscriptions" className="wh-row tap" style={{ padding: '14px 18px', borderRadius: 24, background: 'var(--wh-card)', boxShadow: 'var(--wh-shadow)', border: 0 }}>
          <span className="wh-token class wh-tint-ultra" style={{ ['--wh-token' as string]: '46px' }} aria-hidden="true">
            <span className="wh-token-tile">
              <Icon name={ICONS.nav.subscriptions} size={25} filled />
            </span>
          </span>
          <span className="wh-row-text">
            <span className="wh-row-title">Subscriptions</span>
            <span className={`wh-row-sub${priceRises ? ' wh-owed' : ''}`}>{priceRises ? `${priceRises} price ${priceRises === 1 ? 'rise' : 'rises'} this year` : 'Everything that renews by itself'}</span>
          </span>
          <span className="wh-row-num">
            <span className="wh-row-value">{money(view.subscriptionsMonthly, undefined, { digits: 2 })}</span>
            <span className="wh-row-delta">a month</span>
          </span>
          <Icon name={ICONS.ui.chevronRight} size={18} className="wh-row-chev" />
        </Link>
        <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
      </div>
    )
  }

  return (
    <div className="wh-screen">
      <ScreenHeader
        title="Cash flow"
        subtitle="Money in, money out, and where your cash is heading."
        actions={
          <>
            <div style={{ width: 300 }}>
              <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Period" />
            </div>
            <Button icon={ICONS.action.edit} size="sm" onClick={() => setLogOpen(true)}>
              Log
            </Button>
          </>
        }
      />
      <div className="wh-grid wide-side">
        <div className="wh-col">
          <Card kind="bare" style={{ padding: '20px 24px' }}>
            <div className="wh-cf-head">
              <CashflowLegend />
              <span className="wh-cf-source">{unit}, household accounts</span>
            </div>
            {view.hasActivity ? chart : <Note tone="plain">No cash flow yet. Log money in or out, or paste a bank statement, and the bars fill in from there.</Note>}
          </Card>
          {view.table.length > 0 && (
            <Card kind="bare" style={{ padding: '10px 24px' }}>
              <div className="wh-cf-scroll">
                <table className="wh-cf-table">
                  <thead>
                    <tr>
                      <th />
                      {view.table.map((t) => (
                        <th key={t.label} className={t.forecast ? 'forecast' : t.now ? 'now' : ''}>
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <Icon name={ICONS.figure.opening} size={18} className="wh-muted" />
                        Opening
                      </td>
                      {view.table.map((t) => (
                        <td key={t.label} className={t.forecast ? 'forecast' : t.now ? 'now' : ''}>
                          {money(t.opening)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>
                        <Icon name={ICONS.figure.moneyIn} size={18} className="wh-gain" />
                        Money in
                      </td>
                      {view.table.map((t) => (
                        <td key={t.label} className={t.forecast ? 'forecast' : t.now ? 'now' : ''}>
                          {money(t.in)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>
                        <Icon name={ICONS.figure.moneyOut} size={18} className="wh-owed" />
                        Money out
                      </td>
                      {view.table.map((t) => (
                        <td key={t.label} className={t.forecast ? 'forecast' : t.now ? 'now' : ''}>
                          {money(-t.out)}
                        </td>
                      ))}
                    </tr>
                    <tr className="total">
                      <td>
                        <Icon name={ICONS.figure.kept} size={18} />
                        Closing
                      </td>
                      {view.table.map((t) => (
                        <td key={t.label} className={t.forecast ? 'forecast' : t.now ? 'now' : ''}>
                          {money(t.closing)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <div className="wh-col">
          <Card kind="bare" style={{ padding: '18px 22px 10px' }}>
            <div className="wh-cf-today">
              <span>Cash today</span>
              <span>{view.asOf}</span>
            </div>
            <div className="wh-figure lg" style={{ marginTop: 2 }}>
              {headline(view.cashToday)}
            </div>
            {trio}
          </Card>
          {whereCard}
        </div>
      </div>
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  )
}

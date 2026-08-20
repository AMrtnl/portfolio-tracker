import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { FlowBars } from '@/wealth/charts'
import { useMoney } from '@/wealth/format'
import { GAIN, LOSS } from '@/wealth/tokens'
import { isDemoId } from '@/wealth/demo'
import {
  useAddTransaction,
  useCashflow,
  useCategories,
  useDeleteTransaction,
  useTransactions,
  type TxKind,
} from '@/hooks/useMoneyLedger'

const fieldClass =
  'w-full rounded-[14px] border-[0.5px] border-white/[0.07] bg-[rgba(118,118,128,0.18)] px-3.5 py-3 text-[15px] font-semibold text-white placeholder:text-white/30'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Cashflow() {
  const { chf } = useMoney()
  const { data, isLoading } = useCashflow(6)
  const { data: cats } = useCategories()
  const { data: txs } = useTransactions()
  const addTx = useAddTransaction()
  const delTx = useDeleteTransaction()
  const [cur, setCur] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<TxKind>('spend')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('groceries')
  const [date, setDate] = useState(todayIso)
  const [note, setNote] = useState('')

  const months = data?.months ?? []
  const month = months[cur ?? months.length - 1]
  const prev = months[(cur ?? months.length - 1) - 1]
  const saved = month ? month.income - month.spend : 0
  const rate = month && month.income > 0 ? (saved / month.income) * 100 : 0
  const avgRate = useMemo(() => {
    const withIncome = months.filter((m) => m.income > 0)
    if (!withIncome.length) return 0
    return (
      (withIncome.reduce((s, m) => s + (m.income - m.spend) / m.income, 0) /
        withIncome.length) *
      100
    )
  }, [months])
  const spendTotal = (data?.categories ?? []).reduce((s, c) => s + c.amount, 0)
  const catList = kind === 'income' ? cats?.income : cats?.spend
  const recent = (txs ?? []).slice(0, 8)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) return
    addTx.mutate(
      {
        date,
        kind,
        amount: n,
        category,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          setAmount('')
          setNote('')
          setAdding(false)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <section className="a-card" aria-hidden>
        <div className="a-hero">
          <span className="ui-skel" style={{ width: 88, height: 14, borderRadius: 7 }} />
        </div>
      </section>
    )
  }

  return (
    <div className="a-desk">
      <div className="a-desk-primary">
        <section className="a-card">
          <div className="a-hero">
            <div className="a-caption">
              {month
                ? `${month.label} · ${cur != null ? 'Saved' : 'Saved this month'}`
                : 'Saved this month'}
            </div>
            <div className="a-value">
              <span className="a-unit">USD</span>
              {chf(saved)}
            </div>
            <div className={`a-delta ${rate >= 0 ? 'gain' : 'loss'} ${!month?.income ? 'muted' : ''}`}>
              {month?.income ? (
                <>
                  <span className="a-tri">{rate >= 0 ? '▲' : '▼'}</span>
                  {rate.toFixed(1)}% savings rate
                  <span className="a-period">avg {avgRate.toFixed(0)}%</span>
                </>
              ) : (
                'Log income and spending to see your rate'
              )}
            </div>
          </div>

          {data?.hasActivity && months.length > 0 ? (
            <>
              <FlowBars data={months} onScrub={setCur} />
              <div className="a-keys">
                <span className="a-key static">
                  <span className="a-dot" style={{ background: GAIN }} />
                  Income
                </span>
                <span className="a-key static">
                  <span className="a-dot" style={{ background: LOSS }} />
                  Spending
                </span>
              </div>
            </>
          ) : (
            <p className="a-insnote spaced">
              No cash flow yet. Add a salary deposit or a grocery run and the bars
              fill in from there.
            </p>
          )}
        </section>

        <div className="a-stats">
          <div className="a-stat">
            <span>Income</span>
            <b className="gain">{chf(month?.income ?? 0)}</b>
          </div>
          <div className="a-stat">
            <span>Spent</span>
            <b className="loss">{chf(month?.spend ?? 0)}</b>
          </div>
          <div className="a-stat">
            <span>vs. prev</span>
            <b
              className={
                !prev
                  ? ''
                  : (month?.spend ?? 0) <= prev.spend
                    ? 'gain'
                    : 'loss'
              }
            >
              {prev ? chf((month?.spend ?? 0) - prev.spend, true) : '—'}
            </b>
          </div>
        </div>
      </div>

      <aside className="a-desk-aside">
        {spendTotal > 0 && (
          <>
            <div className="a-header">Where it goes</div>
            <section className="a-gcard pad">
              {[...(data?.categories ?? [])]
                .sort((a, b) => b.amount - a.amount)
                .map((c) => (
                  <div key={c.id} className="a-catrow">
                    <span className="a-catname">
                      <span className="a-dot" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="a-catbar">
                      <i
                        style={{
                          width: `${(c.amount / spendTotal) * 100}%`,
                          background: c.color,
                        }}
                      />
                    </span>
                    <span className="a-catval">{chf(c.amount)}</span>
                  </div>
                ))}
            </section>
          </>
        )}

        {recent.length > 0 && (
          <>
            <div className="a-header">Recent</div>
            <section className="a-gcard pad">
              {recent.map((t) => (
                <div key={t.id} className="a-subrow">
                  <span
                    className="a-av"
                    style={{
                      background: t.kind === 'income' ? 'rgba(48,209,88,.18)' : 'rgba(255,69,58,.18)',
                      color: t.kind === 'income' ? GAIN : LOSS,
                    }}
                  >
                    {t.kind === 'income' ? '+' : '−'}
                  </span>
                  <span className="a-atext">
                    <b>{t.note || t.category}</b>
                    <em>
                      {t.date} · {t.category}
                    </em>
                  </span>
                  <span className="a-anum">
                    <b className={t.kind === 'income' ? 'gain' : 'loss'}>
                      {t.kind === 'income' ? '+' : '−'}
                      {chf(t.amount)}
                    </b>
                  </span>
                  {!isDemoId(t.id) && (
                    <button
                      type="button"
                      className="a-navbtn"
                      aria-label={`Delete ${t.note || t.category}`}
                      onClick={() => delTx.mutate(t.id)}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          </>
        )}

        {adding ? (
          <section className="a-gcard pad">
            <form onSubmit={submit} className="space-y-3 px-2 py-1" aria-label="Add transaction">
              <div
                className="a-seg tight"
                style={{ '--i': kind === 'spend' ? 0 : 1, '--n': 2 } as React.CSSProperties}
              >
                <span className="a-thumb" />
                <button
                  type="button"
                  className={`a-segbtn ${kind === 'spend' ? 'on' : ''}`}
                  onClick={() => {
                    setKind('spend')
                    setCategory('groceries')
                  }}
                >
                  Spend
                </button>
                <button
                  type="button"
                  className={`a-segbtn ${kind === 'income' ? 'on' : ''}`}
                  onClick={() => {
                    setKind('income')
                    setCategory('salary')
                  }}
                >
                  Income
                </button>
              </div>
              <input
                required
                inputMode="decimal"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={fieldClass}
                aria-label="Amount"
              />
              <select
                className={fieldClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Category"
              >
                {(catList ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className={fieldClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Date"
              />
              <input
                className={fieldClass}
                placeholder="Note · optional"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="submit" className="ui-btn primary full" disabled={addTx.isPending}>
                {addTx.isPending ? 'Saving…' : kind === 'income' ? 'Add income' : 'Add spend'}
              </button>
              <button type="button" className="ui-btn ghost full" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </form>
          </section>
        ) : (
          <button type="button" className="a-add" onClick={() => setAdding(true)}>
            <Plus size={17} strokeWidth={2.5} />
            Add transaction
          </button>
        )}
      </aside>
    </div>
  )
}

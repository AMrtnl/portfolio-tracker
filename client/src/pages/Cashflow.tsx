import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Plus, Trash, UploadSimple } from '@phosphor-icons/react'
import { FlowBars } from '@/wealth/charts'
import { FloatSheet } from '@/wealth/FloatSheet'
import { useMoney } from '@/wealth/format'
import { Money } from '@/wealth/Money'
import { GAIN, LOSS } from '@/wealth/tokens'
import { isDemoId } from '@/wealth/demo'
import { useBudgets, useSetBudgets, type MoneyCategory } from '@/hooks/useMoneyLedger'
import {
  useAddTransaction,
  useCashflow,
  useCategories,
  useCategorySuggestion,
  useDeleteTransaction,
  useImportStatement,
  useTransactions,
  type TxKind,
} from '@/hooks/useMoneyLedger'

const CSV_PLACEHOLDER = `Datum;Buchungstext;Betrag
01.09.2026;MIGROS ZUERICH;-54.30
25.09.2026;Lohn September;6'500.00`

type Filter = 'all' | TxKind

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'spend', label: 'Spending' },
]

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function niceDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function Cashflow() {
  const { chf, unit } = useMoney()
  const { data, isLoading } = useCashflow(6)
  const { data: cats } = useCategories()
  const { data: txs } = useTransactions()
  const addTx = useAddTransaction()
  const delTx = useDeleteTransaction()
  const importCsv = useImportStatement()
  const [cur, setCur] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'log' | 'import'>('log')
  const [filter, setFilter] = useState<Filter>('all')
  const [showAll, setShowAll] = useState(false)
  const [kind, setKind] = useState<TxKind>('spend')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('groceries')
  const [catTouched, setCatTouched] = useState(false)
  const [date, setDate] = useState(todayIso)
  const [note, setNote] = useState('')
  const [csv, setCsv] = useState('')
  const [targetsOpen, setTargetsOpen] = useState(false)
  const { data: budgets = {} } = useBudgets()

  // The server guesses a category from the note; it only fills the field
  // until the user picks one by hand.
  const { data: guessed } = useCategorySuggestion(note, kind)
  useEffect(() => {
    if (guessed && !catTouched) setCategory(guessed)
  }, [guessed, catTouched])

  const months = useMemo(() => data?.months ?? [], [data])
  const idx = cur ?? months.length - 1
  const month = months[idx]
  const prev = months[idx - 1]
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
  const catName = (id: string) =>
    [...(cats?.income ?? []), ...(cats?.spend ?? [])].find((c) => c.id === id)?.name ?? id

  const list = (txs ?? []).filter((t) => filter === 'all' || t.kind === filter)
  const shown = showAll ? list : list.slice(0, 12)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) return
    addTx.mutate(
      { date, kind, amount: n, category, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setAmount('')
          setNote('')
          setCatTouched(false)
          setAdding(false)
        },
      },
    )
  }

  function switchKind(next: TxKind) {
    setKind(next)
    setCatTouched(false)
    setCategory(next === 'income' ? 'salary' : 'groceries')
  }

  function closeSheet() {
    setAdding(false)
    importCsv.reset()
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then(setCsv)
    e.target.value = ''
  }

  if (isLoading) {
    return (
      <section className="a-heroblock" aria-hidden>
        <div className="a-hero bare">
          <span className="ui-skel" style={{ width: 88, height: 14, borderRadius: 7 }} />
          <span
            className="ui-skel"
            style={{ width: 180, height: 36, borderRadius: 10, marginTop: 12 }}
          />
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="a-pagebar">
        <div className="a-header">Last 6 months</div>
        <button type="button" className="ui-btn tinted sm" onClick={() => setAdding(true)}>
          <Plus size={15} />
          Add transaction
        </button>
      </div>

      <div className="a-desk">
        <div className="a-desk-primary">
          <section className="a-heroblock">
            <div className="a-hero bare">
              <div className="a-caption">
                {month ? `${month.label} · Saved` : 'Saved this month'}
              </div>
              <div className="a-value">
                <span className="a-unit">{unit()}</span>
                <Money value={saved} animated={cur == null} />
              </div>
              <div
                className={`a-delta ${rate >= 0 ? 'gain' : 'loss'} ${!month?.income ? 'muted' : ''}`}
              >
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
                <FlowBars data={months} height={200} onScrub={setCur} />
                <div className="a-chartfoot">
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
                </div>
              </>
            ) : (
              <p className="a-insnote spaced">
                No cash flow yet. Add a salary deposit or a grocery run and the bars fill in
                from there.
              </p>
            )}
          </section>

          <div className="a-stats">
            <div className="a-stat">
              <span>Income</span>
              <b className="gain"><Money value={month?.income ?? 0} /></b>
            </div>
            <div className="a-stat">
              <span>Spent</span>
              <b className="loss"><Money value={month?.spend ?? 0} /></b>
            </div>
            <div className="a-stat">
              <span>vs. previous month</span>
              <b
                className={
                  !prev ? '' : (month?.spend ?? 0) <= prev.spend ? 'gain' : 'loss'
                }
              >
                {prev ? chf((month?.spend ?? 0) - prev.spend, true) : '—'}
              </b>
            </div>
          </div>

          <div className="a-sechead">
            <div className="a-header">Transactions</div>
            <div className="a-pills" role="tablist" aria-label="Filter transactions">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  className={`a-pill ${filter === f.value ? 'on' : ''}`}
                  onClick={() => {
                    setFilter(f.value)
                    setShowAll(false)
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <section className="a-gcard">
            {shown.length === 0 ? (
              <p className="a-insnote spaced" style={{ paddingBottom: 12 }}>
                Nothing here yet. Add a transaction to start the ledger.
              </p>
            ) : (
              shown.map((t) => (
                <div key={t.id} className="a-arow">
                  <span
                    className="a-av"
                    style={{
                      background:
                        t.kind === 'income' ? 'rgba(48,209,88,.18)' : 'rgba(255,69,58,.18)',
                      color: t.kind === 'income' ? GAIN : LOSS,
                    }}
                  >
                    {t.kind === 'income' ? '+' : '−'}
                  </span>
                  <span className="a-atext">
                    <b>{t.note || catName(t.category)}</b>
                    <em>
                      {niceDate(t.date)} · {catName(t.category)}
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
                      className="a-navbtn ghost"
                      aria-label={`Delete ${t.note || catName(t.category)}`}
                      onClick={() => delTx.mutate(t.id)}
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
            {list.length > shown.length && (
              <button type="button" className="a-more" onClick={() => setShowAll(true)}>
                Show all {list.length}
              </button>
            )}
          </section>
        </div>

        <aside className="a-desk-aside">
          {spendTotal > 0 && (
            <>
              <div className="a-pagebar">
                <div className="a-header">Where it goes</div>
                <button type="button" className="a-more" onClick={() => setTargetsOpen(true)}>
                  Targets
                </button>
              </div>
              <section className="a-gcard pad">
                {[...(data?.categories ?? [])]
                  .sort((a, b) => b.amount - a.amount)
                  .map((c) => {
                    const budget = budgets[c.id]
                    const over = budget != null && c.amount > budget
                    // With a target the bar fills against it; otherwise against the month.
                    const width = budget
                      ? Math.min(c.amount / budget, 1) * 100
                      : spendTotal
                        ? (c.amount / spendTotal) * 100
                        : 0
                    return (
                      <div key={c.id} className="a-catrow">
                        <span className="a-catname">
                          <span className="a-dot" style={{ background: c.color }} />
                          {c.name}
                        </span>
                        <span className="a-catbar">
                          <i
                            className={over ? 'over' : undefined}
                            style={{ width: `${width}%`, background: c.color }}
                          />
                        </span>
                        <span className="a-catval">
                          {chf(c.amount)}
                          {budget ? <em> / {chf(budget)}</em> : null}
                        </span>
                      </div>
                    )
                  })}
              </section>
              <BudgetTargetsSheet
                open={targetsOpen}
                onClose={() => setTargetsOpen(false)}
                categories={cats?.spend ?? []}
                averages={data?.averages ?? {}}
                budgets={budgets}
              />
            </>
          )}
        </aside>
      </div>

      <FloatSheet
        open={adding}
        title={
          mode === 'import'
            ? 'Import a statement'
            : kind === 'income'
              ? 'Add income'
              : 'Add spending'
        }
        onClose={closeSheet}
      >
        <div className="a-pills wrap" role="tablist" aria-label="How to add">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'log'}
            className={`a-pill ${mode === 'log' ? 'on' : ''}`}
            onClick={() => setMode('log')}
          >
            Log one
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'import'}
            className={`a-pill ${mode === 'import' ? 'on' : ''}`}
            onClick={() => setMode('import')}
          >
            Import statement
          </button>
        </div>

        {mode === 'import' ? (
          <div className="a-import">
            <p className="a-importnote">
              Export a CSV from your bank — any layout works, the dates, amounts, and
              descriptions are detected. Every line is categorised automatically and
              duplicates are skipped, so re-importing is safe.
            </p>
            <label className="ui-btn secondary sm a-filepick">
              <UploadSimple size={14} />
              Choose a CSV file
              <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} />
            </label>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={CSV_PLACEHOLDER}
              aria-label="Statement CSV"
              spellCheck={false}
            />
            {importCsv.data && (
              <p className="a-importnote">
                <b className="gain">{importCsv.data.imported} imported</b>
                {importCsv.data.skipped > 0 && ` · ${importCsv.data.skipped} duplicates skipped`}
                {importCsv.data.unreadable > 0 &&
                  ` · ${importCsv.data.unreadable} unreadable ${importCsv.data.unreadable === 1 ? 'line' : 'lines'}`}
                {importCsv.data.errors[0] ? ` — ${importCsv.data.errors[0]}` : ''}
              </p>
            )}
            {importCsv.isError && (
              <p className="a-importnote loss">
                {(importCsv.error as { response?: { data?: { error?: string } } })?.response
                  ?.data?.error || 'Could not read that statement.'}
              </p>
            )}
            {importCsv.data ? (
              <button type="button" className="ui-btn primary md full" onClick={closeSheet}>
                Done
              </button>
            ) : (
              <button
                type="button"
                className="ui-btn primary md full"
                disabled={!csv.trim() || importCsv.isPending}
                onClick={() => importCsv.mutate(csv)}
              >
                {importCsv.isPending ? 'Reading…' : 'Import'}
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="a-form" aria-label="Add transaction">
            <div className="a-pills wrap" role="tablist" aria-label="Kind">
              <button
                type="button"
                role="tab"
                aria-selected={kind === 'spend'}
                className={`a-pill ${kind === 'spend' ? 'on' : ''}`}
                onClick={() => switchKind('spend')}
              >
                Spending
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={kind === 'income'}
                className={`a-pill ${kind === 'income' ? 'on' : ''}`}
                onClick={() => switchKind('income')}
              >
                Income
              </button>
            </div>

            <label className="ui-amount">
              <span className="ui-tf-label">Amount</span>
              <span className="ui-amount-box">
                <em>USD</em>
                <input
                  required
                  autoFocus
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="Amount"
                />
              </span>
            </label>

            <label className="ui-tf">
              <span className="ui-tf-label">Note</span>
              <span className="ui-tf-box">
                <input
                  placeholder="Migros, SBB, Netflix… the category follows"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </span>
            </label>

            <label className="ui-tf">
              <span className="ui-tf-label">Category</span>
              <span className="ui-tf-box">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    setCatTouched(true)
                  }}
                >
                  {(catList ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </span>
              {guessed && guessed === category && !catTouched && (
                <span className="ui-tf-hint">Suggested from the note</span>
              )}
            </label>

            <label className="ui-tf">
              <span className="ui-tf-label">Date</span>
              <span className="ui-tf-box">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </span>
            </label>

            <button type="submit" className="ui-btn primary md full" disabled={addTx.isPending}>
              {addTx.isPending ? 'Saving…' : kind === 'income' ? 'Add income' : 'Add spending'}
            </button>
          </form>
        )}
      </FloatSheet>
    </>
  )
}

/** Monthly ceiling per spend category, shown against the running average. */
function BudgetTargetsSheet({
  open,
  onClose,
  categories,
  averages,
  budgets,
}: {
  open: boolean
  onClose: () => void
  categories: MoneyCategory[]
  averages: Record<string, number>
  budgets: Record<string, number>
}) {
  const { chf, unit } = useMoney()
  const save = useSetBudgets()
  // Drafts start from what is saved and only diverge once the user types.
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const values =
    draft ??
    Object.fromEntries(
      categories.map((c) => [c.id, budgets[c.id] != null ? String(budgets[c.id]) : '']),
    )

  function close() {
    setDraft(null)
    save.reset()
    onClose()
  }

  function submit() {
    const patch: Record<string, number | null> = {}
    for (const c of categories) {
      const raw = (values[c.id] ?? '').trim()
      if (raw === '') {
        if (budgets[c.id] != null) patch[c.id] = null
        continue
      }
      const n = parseFloat(raw)
      if (Number.isFinite(n) && n >= 0) patch[c.id] = n
    }
    save.mutate(patch, { onSuccess: close })
  }

  return (
    <FloatSheet open={open} title="Budget targets" onClose={close}>
      <p className="a-qlead">
        A monthly ceiling per category. The bars in &ldquo;Where it goes&rdquo; fill against
        it and turn red when a month runs over.
      </p>
      <section className="a-gcard">
        {categories.map((c) => (
          <div key={c.id} className="a-budgetrow">
            <span className="a-atext">
              <b>
                <span className="a-dot" style={{ background: c.color }} />
                {c.name}
              </b>
              <em>
                {averages[c.id]
                  ? `Averages ${chf(averages[c.id])} a month`
                  : 'Nothing in this period'}
              </em>
            </span>
            <input
              inputMode="decimal"
              placeholder={unit()}
              value={values[c.id] ?? ''}
              onChange={(e) => setDraft({ ...values, [c.id]: e.target.value })}
              aria-label={`${c.name} monthly target`}
            />
          </div>
        ))}
      </section>
      {save.isError && (
        <p className="a-insnote" role="alert">
          Could not save the targets.
        </p>
      )}
      <button
        type="button"
        className="ui-btn primary md full"
        disabled={save.isPending}
        onClick={submit}
      >
        {save.isPending ? 'Saving…' : 'Save targets'}
      </button>
    </FloatSheet>
  )
}

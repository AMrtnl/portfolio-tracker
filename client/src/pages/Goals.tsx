import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PencilSimple, Plus, Trash, Check } from '@phosphor-icons/react'
import { FloatSheet } from '@/wealth/FloatSheet'
import { Ring } from '@/wealth/charts'
import { Money } from '@/wealth/Money'
import { useMoney } from '@/wealth/format'
import { useQuickLook } from '@/wealth/QuickLook'
import { isDemoId } from '@/wealth/demo'
import { accountValue, isLiability } from '@/wealth/classifyAccount'
import {
  GOAL_COLORS,
  STATE_COPY,
  goalStatus,
  monthLabel,
  type GoalStatus,
} from '@/wealth/goals'
import { useAccounts, type Account } from '@/hooks/useAccounts'
import {
  useAddGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
  type Goal,
  type GoalInput,
} from '@/hooks/useGoals'

const RETURNS = [
  { value: 0, label: 'Cash · 0%' },
  { value: 0.02, label: 'Bonds · 2%' },
  { value: 0.04, label: 'Balanced · 4%' },
  { value: 0.06, label: 'Stocks · 6%' },
]

interface GoalRow {
  goal: Goal
  status: GoalStatus
  color: string
  funding: Account[]
}

/** The one-line story under each goal's name. */
function storyFor(row: GoalRow, chf: (n: number) => string): string {
  const { goal, status } = row
  if (status.state === 'funded') return 'Target reached — keep it, or raise the bar.'
  if (status.state === 'behind' && status.needed != null) {
    const more = status.needed - goal.monthlyContribution
    return `Needs ${chf(more)} more a month to land ${goal.targetDate ? `by ${monthLabel(new Date(goal.targetDate))}` : 'on time'}.`
  }
  if (status.etaDate) return `At this pace, funded by ${monthLabel(status.etaDate)}.`
  if (goal.monthlyContribution <= 0) return 'Add a monthly contribution to see a date.'
  return 'Not reachable at this pace within fifty years.'
}

export function Goals() {
  const { data: goals = [], isLoading } = useGoals()
  const { data: accounts = [] } = useAccounts()
  const { chf } = useMoney()
  const { look } = useQuickLook()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const del = useDeleteGoal()

  useEffect(() => {
    document.title = 'Goals'
  }, [])

  // ⌘K "New goal" lands here with ?new=1.
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing('new')
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const assets = useMemo(() => accounts.filter((a) => !isLiability(a)), [accounts])

  const rows = useMemo<GoalRow[]>(
    () =>
      goals.map((goal, i) => {
        const funding = goal.accountIds
          .map((id) => accounts.find((a) => a.id === id))
          .filter((a): a is Account => Boolean(a))
        const current = funding.reduce((s, a) => s + Math.max(accountValue(a), 0), 0)
        return {
          goal,
          status: goalStatus(goal, current),
          color: GOAL_COLORS[i % GOAL_COLORS.length],
          funding,
        }
      }),
    [goals, accounts],
  )

  const totalTarget = rows.reduce((s, r) => s + r.goal.targetAmount, 0)
  const totalCurrent = rows.reduce((s, r) => s + Math.min(r.status.current, r.goal.targetAmount), 0)
  const totalMonthly = rows.reduce((s, r) => s + r.goal.monthlyContribution, 0)
  const behind = rows.filter((r) => r.status.state === 'behind')
  const next = rows
    .filter((r) => r.status.etaDate && r.status.state !== 'funded')
    .sort((a, b) => a.status.etaDate!.getTime() - b.status.etaDate!.getTime())[0]

  return (
    <>
      <div className="a-pagebar">
        <div className="a-header">
          {rows.length
            ? `${rows.length} ${rows.length === 1 ? 'goal' : 'goals'} · ${chf(totalMonthly)} a month`
            : 'Give your money a job'}
        </div>
        <button type="button" className="ui-btn tinted sm" onClick={() => setEditing('new')}>
          <Plus size={15} />
          New goal
        </button>
      </div>

      <div className="a-desk">
        <div className="a-desk-primary">
          {isLoading && rows.length === 0 ? (
            <div className="a-goals" style={{ minHeight: 240 }} aria-hidden />
          ) : rows.length === 0 ? (
            <section className="a-gcard pad a-goalempty">
              <b>Nothing is earmarked yet.</b>
              <p className="a-insnote">
                A goal is a target, a date, and the accounts that fund it. Wealth Hub works out
                what it takes each month and tells you when you drift.
              </p>
              <button type="button" className="ui-btn primary md" onClick={() => setEditing('new')}>
                <Plus size={15} />
                Create your first goal
              </button>
            </section>
          ) : (
            <div className="a-goals">
              {rows.map((row) => {
                const { goal, status, color, funding } = row
                const demo = isDemoId(goal.id)
                const state = STATE_COPY[status.state]
                return (
                  <section key={goal.id} className="a-gcard pad a-goalcard">
                    <div className="a-goalhead">
                      <Ring pct={status.pct} color={color} size={54} stroke={6} label={`${status.pct.toFixed(0)}%`} />
                      <span className="a-atext">
                        <b>
                          {goal.name}
                          {demo && <span className="ui-tag flat">Sample</span>}
                        </b>
                        <em>{storyFor(row, chf)}</em>
                      </span>
                      <span className={`a-tag ${state.tone}`}>{state.label}</span>
                    </div>

                    <div className="a-goalvalue">
                      <Money value={status.current} />
                      <em>of {chf(goal.targetAmount)}</em>
                    </div>
                    <div className="a-catbar">
                      <i style={{ width: `${status.pct}%`, background: color }} />
                    </div>

                    <div className="a-goalmeta">
                      <div>
                        <span>Target date</span>
                        <b>
                          {goal.targetDate
                            ? `${monthLabel(new Date(goal.targetDate))} · ${status.months} mo`
                            : 'Whenever'}
                        </b>
                      </div>
                      <div>
                        <span>Contribution</span>
                        <b>{chf(goal.monthlyContribution)} / mo</b>
                      </div>
                      <div>
                        <span>Needed</span>
                        <b>{status.needed != null ? `${chf(status.needed)} / mo` : '—'}</b>
                      </div>
                      <div>
                        <span>At this pace</span>
                        <b>
                          {status.state === 'funded'
                            ? 'Done'
                            : status.etaDate
                              ? monthLabel(status.etaDate)
                              : 'Not reached'}
                        </b>
                      </div>
                    </div>

                    <div className="a-goalfoot">
                      <div className="a-goalfund" aria-label="Funded by">
                        {funding.length === 0 && <span className="a-insnote">No funding account yet</span>}
                        {funding.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => look({ kind: 'account', id: a.id })}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                      {!demo && (
                        <div className="a-rowactions">
                          <button
                            type="button"
                            className="a-navbtn ghost"
                            onClick={() => setEditing(goal)}
                            aria-label={`Edit ${goal.name}`}
                          >
                            <PencilSimple size={16} />
                          </button>
                          <button
                            type="button"
                            className="a-navbtn ghost"
                            onClick={() => del.mutate(goal.id)}
                            aria-label={`Delete ${goal.name}`}
                            disabled={del.isPending}
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <aside className="a-desk-aside">
          <div className="a-header">All goals <em>Across everything you are saving for</em></div>
          <section className="a-gcard pad">
            <div className="a-healthrow">
              <span>Funded</span>
              <span className="a-catbar">
                <i
                  style={{
                    width: `${totalTarget ? (totalCurrent / totalTarget) * 100 : 0}%`,
                    background: 'var(--accent)',
                  }}
                />
              </span>
              <b>{totalTarget ? ((totalCurrent / totalTarget) * 100).toFixed(0) : 0}%</b>
            </div>
            <div className="a-fields spaced">
              <div className="a-field">
                <span>Committed</span>
                <b>{chf(totalMonthly)} / mo</b>
              </div>
              <div className="a-field">
                <span>Behind</span>
                <b>{behind.length ? `${behind.length} ${behind.length === 1 ? 'goal' : 'goals'}` : 'None'}</b>
              </div>
              <div className="a-field wide">
                <span>Next to land</span>
                <b>{next ? `${next.goal.name} · ${monthLabel(next.status.etaDate!)}` : '—'}</b>
              </div>
            </div>
          </section>

          <div className="a-header">How it works</div>
          <section className="a-gcard pad">
            <p className="a-insnote">
              Progress is the live balance of the funding accounts, so a goal moves when the
              market does. <b>Needed</b> is the monthly amount that lands on the date with the
              return you chose; <b>At this pace</b> projects your actual contribution forward.
            </p>
          </section>
        </aside>
      </div>

      <FloatSheet
        open={editing !== null}
        title={editing === 'new' ? 'New goal' : 'Edit goal'}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <GoalForm
            key={editing === 'new' ? 'new' : editing.id}
            goal={editing === 'new' ? undefined : editing}
            accounts={assets}
            onDone={() => setEditing(null)}
          />
        )}
      </FloatSheet>
    </>
  )
}

function GoalForm({
  goal,
  accounts,
  onDone,
}: {
  goal?: Goal
  accounts: Account[]
  onDone: () => void
}) {
  const { chf, unit } = useMoney()
  const add = useAddGoal()
  const update = useUpdateGoal()
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : '')
  const [date, setDate] = useState(goal?.targetDate ?? '')
  const [monthly, setMonthly] = useState(goal ? String(goal.monthlyContribution) : '')
  const [ret, setRet] = useState(goal?.expectedReturn ?? 0.02)
  const [ids, setIds] = useState<Set<string>>(() => new Set(goal?.accountIds ?? []))
  const pending = add.isPending || update.isPending
  const error = add.error ?? update.error

  const targetNum = parseFloat(target)
  const valid = name.trim().length > 0 && Number.isFinite(targetNum) && targetNum > 0

  function toggle(id: string) {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const input: GoalInput = {
      name: name.trim(),
      targetAmount: targetNum,
      targetDate: date || null,
      accountIds: [...ids],
      monthlyContribution: parseFloat(monthly) || 0,
      expectedReturn: ret,
    }
    if (goal) update.mutate({ id: goal.id, ...input }, { onSuccess: onDone })
    else add.mutate(input, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="a-form" aria-label={goal ? 'Edit goal' : 'New goal'}>
      <label className="ui-tf">
        <span className="ui-tf-label">Name</span>
        <span className="ui-tf-box">
          <input
            autoFocus
            required
            placeholder="Emergency fund, deposit, sabbatical…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </span>
      </label>

      <div className="a-formrow">
        <label className="ui-amount">
          <span className="ui-tf-label">Target</span>
          <span className="ui-amount-box">
            <em>{unit()}</em>
            <input
              required
              inputMode="decimal"
              placeholder="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Target amount"
            />
          </span>
        </label>
        <label className="ui-tf">
          <span className="ui-tf-label">By</span>
          <span className="ui-tf-box">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </span>
        </label>
      </div>

      <label className="ui-amount">
        <span className="ui-tf-label">Monthly contribution</span>
        <span className="ui-amount-box">
          <em>{unit()}</em>
          <input
            inputMode="decimal"
            placeholder="0"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            aria-label="Monthly contribution"
          />
        </span>
      </label>

      <div>
        <span className="ui-tf-label">Expected return</span>
        <div className="a-pills wrap" role="radiogroup" aria-label="Expected return">
          {RETURNS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={ret === r.value}
              className={`a-pill ${ret === r.value ? 'on' : ''}`}
              onClick={() => setRet(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="ui-tf-label">Funded by</span>
        <section className="a-gcard">
          {accounts.length === 0 && (
            <p className="a-insnote spaced">Add an account first and it will show up here.</p>
          )}
          {accounts.map((a) => {
            const on = ids.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                className={`a-arow tap ${on ? 'on' : ''}`}
                onClick={() => toggle(a.id)}
                aria-pressed={on}
              >
                <span className="a-atext">
                  <b>{a.label}</b>
                  <em>{a.institution || a.type}</em>
                </span>
                <span className="a-anum">
                  <b>{chf(accountValue(a))}</b>
                </span>
                {on && <Check size={16} weight="bold" className="a-rowcheck" />}
              </button>
            )
          })}
        </section>
      </div>

      {error && (
        <p className="a-insnote" role="alert">
          {(error as { response?: { data?: { error?: string } } }).response?.data?.error ||
            'Could not save the goal.'}
        </p>
      )}

      <button type="submit" className="ui-btn primary md full" disabled={!valid || pending}>
        {pending ? 'Saving…' : goal ? 'Save changes' : 'Create goal'}
      </button>
    </form>
  )
}

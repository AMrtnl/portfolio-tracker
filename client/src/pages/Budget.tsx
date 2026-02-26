import { useState } from 'react'
import { useBudgetSummary, useSubscriptions, useAddSubscription, useDeleteSubscription } from '@/hooks/useBudget'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PiggyBank, Plus, Trash2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addDays } from 'date-fns'

const CATEGORY_COLORS: Record<string, string> = {
  STREAMING: '#3B82F6', SOFTWARE: '#8B5CF6', FITNESS: '#10B981',
  FINANCE: '#F59E0B', OTHER: '#6B7280',
}

const CADENCE_OPTIONS = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY']
const CATEGORY_OPTIONS = ['STREAMING', 'SOFTWARE', 'FITNESS', 'FINANCE', 'OTHER']

function AddSubModal({ onClose }: { onClose: () => void }) {
  const add = useAddSubscription()
  const [form, setForm] = useState({
    name: '', amount: '', currency: 'USD', cadence: 'MONTHLY',
    category: 'SOFTWARE', nextBilling: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  })

  function submit() {
    add.mutate({ ...form, amount: parseFloat(form.amount) }, {
      onSuccess: () => onClose(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">Add Subscription</h3>
        <div className="space-y-3">
          {[
            { key: 'name', label: 'Name', type: 'text', placeholder: 'Netflix, Spotify…' },
            { key: 'amount', label: 'Amount', type: 'number', placeholder: '9.99' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'cadence', options: CADENCE_OPTIONS, label: 'Cadence' },
              { key: 'category', options: CATEGORY_OPTIONS, label: 'Category' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                <select
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Next Billing</label>
            <input
              type="date"
              value={form.nextBilling}
              onChange={e => setForm(p => ({ ...p, nextBilling: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={!form.name || !form.amount || add.isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {add.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Budget() {
  const { data: summary } = useBudgetSummary()
  const { data: subs = [] } = useSubscriptions()
  const deleteSub = useDeleteSubscription()
  const [showModal, setShowModal] = useState(false)

  const totalMonthly = summary?.totalMonthly ?? 0
  const totalAnnual = summary?.totalAnnual ?? 0
  const byCategory = summary?.byCategory ?? {}
  const upcoming = summary?.upcomingRenewals ?? []
  const cashFlow = summary?.cashFlowHistory ?? []

  const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value: value as number }))

  return (
    <div className="p-6 space-y-6">
      {showModal && <AddSubModal onClose={() => setShowModal(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Subscriptions, recurring expenses, and cash flow</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Subscription
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Expenses', value: `$${totalMonthly.toFixed(2)}`, sub: 'All subscriptions' },
          { label: 'Annual Expenses', value: `$${totalAnnual.toFixed(0)}`, sub: 'Projected yearly cost' },
          { label: 'Subscriptions', value: subs.length.toString(), sub: 'Active services' },
          { label: 'Upcoming (30d)', value: upcoming.length.toString(), sub: 'Renewals this month' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-xl font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash flow */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Monthly Expense Trend</h3>
          {cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashFlow}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip formatter={(v: any) => [`$${parseFloat(v).toFixed(2)}`, 'Expenses']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="expenses" fill="#EF4444" radius={4} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Add subscriptions to see trends</div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">By Category</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                    {categoryData.map((d, i) => <Cell key={i} fill={CATEGORY_COLORS[d.name] ?? '#6B7280'} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`$${parseFloat(v).toFixed(2)}/mo`, '']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[d.name] ?? '#6B7280' }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-semibold">${d.value.toFixed(0)}/mo</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm text-center">
              <div>
                <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No subscriptions yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming renewals */}
      {upcoming.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" />Upcoming Renewals (30 days)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.map((s: any) => {
              const daysLeft = Math.ceil((new Date(s.nextBilling).getTime() - Date.now()) / 86400000)
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0" style={{ background: CATEGORY_COLORS[s.category] + '30', color: CATEGORY_COLORS[s.category] }}>
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{daysLeft}d · ${s.amount} {s.cadence.toLowerCase()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Subscriptions list */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">All Subscriptions</h3>
        {subs.length > 0 ? (
          <div className="space-y-2">
            {subs.map((s: any) => (
              <div key={s.id} className="flex items-center gap-4 p-3 hover:bg-secondary/40 rounded-lg transition-colors group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0" style={{ background: (CATEGORY_COLORS[s.category] ?? '#6B7280') + '30', color: CATEGORY_COLORS[s.category] ?? '#6B7280' }}>
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.category} · Next: {format(new Date(s.nextBilling), 'MMM d, yyyy')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">${s.amount} <span className="text-muted-foreground font-normal text-xs">{s.cadence.toLowerCase()}</span></p>
                  <p className="text-xs text-muted-foreground">${s.monthlyEquivalent.toFixed(2)}/mo</p>
                </div>
                <button onClick={() => deleteSub.mutate(s.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No subscriptions yet. Click "Add Subscription" to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { usePortfolio, usePortfolioHistory } from '@/hooks/usePortfolio'
import { useCryptoPrices } from '@/hooks/useMarketData'
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { format } from 'date-fns'
import { LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Analytics() {
  const { data: portfolio } = usePortfolio()
  const { data: history = [] } = usePortfolioHistory(90)
  const { data: prices = [] } = useCryptoPrices()

  const chartData = history.map((h: any) => ({
    date: format(new Date(h.date), 'MMM d'),
    value: h.totalValue,
  }))

  const positions = portfolio?.positions ?? []
  const positionPnL = positions
    .map(p => ({ asset: p.asset, pnl: parseFloat(p.pnl), pct: parseFloat(p.pnlPercent) }))
    .sort((a, b) => b.pnl - a.pnl)

  const totalValue = portfolio?.totalValue ?? 0
  const breakdown = portfolio?.breakdown ?? {}
  const allocationData = Object.entries(breakdown)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ name: k, value: v as number, pct: totalValue > 0 ? ((v as number) / totalValue) * 100 : 0 }))

  // Simple risk metrics
  const returns = chartData.map((d, i) => {
    if (i === 0) return 0
    return chartData[i - 1].value > 0 ? ((d.value - chartData[i - 1].value) / chartData[i - 1].value) * 100 : 0
  }).slice(1)
  const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0
  const variance = returns.length > 0 ? returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length : 0
  const stdDev = Math.sqrt(variance)
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0
  const maxDrawdown = returns.length > 0 ? Math.min(...returns) : 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Performance attribution and risk metrics</p>
      </div>

      {/* Risk metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Sharpe Ratio (est.)', value: sharpe.toFixed(2), sub: '>1 is good', ok: sharpe > 1 },
          { label: 'Daily StdDev', value: `${stdDev.toFixed(2)}%`, sub: 'Volatility', ok: null },
          { label: 'Max Daily Drawdown', value: `${maxDrawdown.toFixed(2)}%`, sub: '90d window', ok: false },
          { label: 'Avg Daily Return', value: `${avgReturn.toFixed(3)}%`, sub: '90d', ok: avgReturn > 0 },
        ].map(m => (
          <div key={m.label} className="stat-card">
            <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
            <p className={cn('text-xl font-bold', m.ok === true ? 'gain' : m.ok === false && m.value !== '0.00%' ? 'loss' : '')}>{m.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Performance chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">90-Day Performance</h3>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="perf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [`$${parseFloat(v).toLocaleString()}`, 'Portfolio Value']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} fill="url(#perf)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <LineChart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Collecting data — check back after 24 hours</p>
            </div>
          </div>
        )}
      </div>

      {/* Position PnL + Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {positionPnL.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Position PnL Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={positionPnL.slice(0, 8)} layout="vertical">
                <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="asset" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} width={60} />
                <Tooltip formatter={(v: any) => [`$${parseFloat(v).toFixed(2)}`, 'PnL']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="pnl" radius={3}>
                  {positionPnL.slice(0, 8).map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10B981' : '#EF4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {allocationData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Asset Class Allocation</h3>
            <div className="space-y-3">
              {allocationData.map(a => (
                <div key={a.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium">{a.name}</span>
                    <span className="text-muted-foreground">{a.pct.toFixed(1)}% · ${a.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${a.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Price movers */}
      {prices.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Market Movers (24h)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...prices].sort((a: any, b: any) => Math.abs(b.change24hPercent) - Math.abs(a.change24hPercent)).slice(0, 8).map((p: any) => (
              <div key={p.symbol} className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg">
                <div>
                  <p className="font-semibold text-sm">{p.symbol}</p>
                  <p className="text-xs text-muted-foreground">${p.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                </div>
                <span className={cn('text-sm font-bold px-2 py-1 rounded', p.change24hPercent >= 0 ? 'gain-bg' : 'loss-bg')}>
                  {p.change24hPercent >= 0 ? '+' : ''}{p.change24hPercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

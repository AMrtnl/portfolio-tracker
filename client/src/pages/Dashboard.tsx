import { usePortfolio, usePortfolioHistory } from '@/hooks/usePortfolio'
import { useCryptoPrices } from '@/hooks/useMarketData'
import { cn } from '@/lib/utils'
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, BarChart3, Globe, Zap } from 'lucide-react'
import { format } from 'date-fns'

const ALLOCATION_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

function StatCard({ label, value, sub, positive, icon: Icon }: any) {
  return (
    <div className="stat-card flex gap-4 items-start">
      <div className="p-2.5 rounded-lg bg-secondary">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <p className="text-xl font-bold tracking-tight truncate">{value}</p>
        {sub !== undefined && (
          <p className={cn('text-xs font-semibold mt-0.5', positive === true ? 'gain' : positive === false ? 'loss' : 'text-muted-foreground')}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { data: portfolio, isLoading } = usePortfolio()
  const { data: history = [] } = usePortfolioHistory(90)
  const { data: prices = [] } = useCryptoPrices()

  const total = portfolio?.totalValue ?? 0
  const pnl24h = portfolio?.pnl24h ?? 0
  const pnl24hPct = portfolio?.pnl24hPercent ?? 0
  const breakdown = portfolio?.breakdown ?? { crypto: 0, tradfi: 0, cash: 0, predictions: 0, defi: 0 }

  const allocationData = [
    { name: 'Crypto', value: breakdown.crypto },
    { name: 'TradFi', value: breakdown.tradfi },
    { name: 'DeFi', value: breakdown.defi },
    { name: 'Predictions', value: breakdown.predictions },
    { name: 'Cash', value: breakdown.cash },
  ].filter(d => d.value > 0)

  const chartData = history.map((h: any) => ({
    date: format(new Date(h.date), 'MMM d'),
    value: h.totalValue,
  }))

  const topPositions = (portfolio?.positions ?? []).slice(0, 5)
  const topBalances = (portfolio?.balances ?? [])
    .sort((a: any, b: any) => parseFloat(b.usdValue) - parseFloat(a.usdValue))
    .slice(0, 6)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card h-24 skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 skeleton rounded-xl" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {portfolio?.lastUpdated ? `Updated ${format(new Date(portfolio.lastUpdated), 'HH:mm')}` : 'Connecting…'}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Net Worth" value={`$${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} sub={total === 0 ? 'Connect accounts to start' : undefined} icon={Wallet} />
        <StatCard label="24h P&L" value={`${pnl24h >= 0 ? '+' : ''}$${Math.abs(pnl24h).toFixed(2)}`} sub={`${pnl24h >= 0 ? '+' : ''}${pnl24hPct.toFixed(2)}%`} positive={pnl24h >= 0} icon={pnl24h >= 0 ? TrendingUp : TrendingDown} />
        <StatCard label="Open Positions" value={(portfolio?.positions ?? []).length.toString()} sub={`${(portfolio?.balances ?? []).length} assets`} icon={BarChart3} />
        <StatCard label="Crypto Allocation" value={total > 0 ? `${((breakdown.crypto / total) * 100).toFixed(0)}%` : '—'} sub={`$${breakdown.crypto.toFixed(0)}`} icon={Globe} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Portfolio Performance (90d)</h3>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`$${parseFloat(v).toLocaleString()}`, 'Value']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
              <Zap className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Performance data will appear after 24h</p>
              <p className="text-xs mt-1 opacity-60">Connect accounts to start tracking</p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Allocation</h3>
          {allocationData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={allocationData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {allocationData.map((_, i) => <Cell key={i} fill={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`$${parseFloat(v).toFixed(2)}`, '']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {allocationData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-semibold">{total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm text-center">
              <div>
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No accounts connected</p>
                <p className="text-xs mt-1 opacity-60">Visit Accounts to add integrations</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Holdings + Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Top Holdings</h3>
          {topBalances.length > 0 ? (
            <div className="space-y-3">
              {topBalances.map((b: any) => {
                const usd = parseFloat(b.usdValue ?? 0)
                const pct = total > 0 ? (usd / total) * 100 : 0
                return (
                  <div key={`${b.asset}-${b.platform}`} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                      {b.asset.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{b.asset}</span>
                        <span className="font-semibold">${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                        <span>{b.platform}</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No assets. Connect accounts in the Accounts page.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Active Positions</h3>
          {topPositions.length > 0 ? (
            <div className="space-y-3">
              {topPositions.map((p: any, i: number) => {
                const pnl = parseFloat(p.pnl)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded shrink-0', p.side === 'LONG' ? 'gain-bg' : 'loss-bg')}>
                      {p.side}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{p.asset}</span>
                        <span className={cn('font-semibold text-xs', pnl >= 0 ? 'gain' : 'loss')}>
                          {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.platform} · {p.type} · {parseFloat(p.pnlPercent).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open positions.</p>
          )}
        </div>
      </div>

      {/* Live prices ticker */}
      {prices.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Crypto Market</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {prices.slice(0, 8).map((p: any) => (
              <div key={p.symbol} className="text-center p-2 rounded-lg bg-secondary/50">
                <p className="text-xs font-bold">{p.symbol}</p>
                <p className="text-sm font-semibold mt-0.5">
                  ${p.price < 1 ? p.price.toFixed(4) : p.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className={cn('text-xs font-medium', p.change24hPercent >= 0 ? 'gain' : 'loss')}>
                  {p.change24hPercent >= 0 ? '+' : ''}{p.change24hPercent.toFixed(2)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

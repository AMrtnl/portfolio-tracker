import { usePortfolio } from '@/hooks/usePortfolio'
import { cn } from '@/lib/utils'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

const EXCHANGE_ICONS: Record<string, string> = {
  hyperliquid: 'HL', binance: 'BN', bybit: 'BY', bitget: 'BG',
  coinbase: 'CB', kraken: 'KR', okx: 'OK', gate: 'GT',
}

export function Crypto() {
  const { data: portfolio, isLoading } = usePortfolio()

  const cryptoBalances = (portfolio?.balances ?? []).filter(b =>
    ['hyperliquid', 'binance', 'bybit', 'bitget', 'coinbase', 'kraken', 'okx', 'gate'].includes(b.platform ?? '')
  )
  const cryptoPositions = (portfolio?.positions ?? []).filter(p =>
    ['hyperliquid', 'binance', 'bybit', 'bitget', 'okx'].includes(p.platform ?? '')
  )

  // Group by platform
  const byPlatform = cryptoBalances.reduce<Record<string, { total: number; assets: typeof cryptoBalances }>>((acc, b) => {
    const p = b.platform ?? 'unknown'
    if (!acc[p]) acc[p] = { total: 0, assets: [] }
    acc[p].total += parseFloat(b.usdValue ?? '0')
    acc[p].assets.push(b)
    return acc
  }, {})

  const platformData = Object.entries(byPlatform).map(([name, data]) => ({
    name, total: data.total, assets: data.assets,
  })).sort((a, b) => b.total - a.total)

  const totalCrypto = platformData.reduce((s, p) => s + p.total, 0)
  const totalPnL = cryptoPositions.reduce((s, p) => s + parseFloat(p.pnl ?? '0'), 0)

  if (isLoading) return <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 skeleton rounded-xl" />)}</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crypto</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All exchange accounts and DeFi positions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Crypto', value: `$${totalCrypto.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: `${cryptoBalances.length} assets`, icon: Activity },
          { label: 'Open Positions', value: cryptoPositions.length.toString(), sub: `Unrealized PnL`, icon: TrendingUp },
          { label: 'Total PnL', value: `${totalPnL >= 0 ? '+' : ''}$${Math.abs(totalPnL).toFixed(2)}`, sub: 'All open positions', positive: totalPnL >= 0, icon: totalPnL >= 0 ? TrendingUp : TrendingDown },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className="text-xl font-bold">{c.value}</p>
            <p className={cn('text-xs mt-0.5', c.positive === true ? 'gain' : c.positive === false ? 'loss' : 'text-muted-foreground')}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Exchange breakdown chart */}
      {platformData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Balance by Exchange</h3>
          <div className="flex gap-6">
            <ResponsiveContainer width="60%" height={200}>
              <BarChart data={platformData} layout="vertical">
                <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={(v: any) => [`$${parseFloat(v).toLocaleString()}`, 'Balance']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="total" radius={4}>
                  {platformData.map((_, i) => <Cell key={i} fill="#3B82F6" opacity={1 - i * 0.1} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {platformData.map(p => (
                <div key={p.name} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-xs font-bold">{EXCHANGE_ICONS[p.name] ?? p.name.slice(0, 2).toUpperCase()}</span>
                    <span className="capitalize font-medium">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${p.total.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">{totalCrypto > 0 ? `${((p.total / totalCrypto) * 100).toFixed(1)}%` : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Positions table */}
      {cryptoPositions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Open Positions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  {['Asset', 'Side', 'Size', 'Entry', 'Mark', 'PnL', 'PnL %', 'Exchange'].map(h => (
                    <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cryptoPositions.map((p, i) => {
                  const pnl = parseFloat(p.pnl)
                  return (
                    <tr key={i} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 pr-4 font-semibold">{p.asset}</td>
                      <td className="pr-4"><span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', p.side === 'LONG' ? 'gain-bg' : 'loss-bg')}>{p.side}</span></td>
                      <td className="pr-4">{parseFloat(p.size).toFixed(4)}</td>
                      <td className="pr-4">${parseFloat(p.entryPrice).toLocaleString()}</td>
                      <td className="pr-4">${parseFloat(p.markPrice).toLocaleString()}</td>
                      <td className={cn('pr-4 font-semibold', pnl >= 0 ? 'gain' : 'loss')}>{pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}</td>
                      <td className={cn('pr-4', pnl >= 0 ? 'gain' : 'loss')}>{parseFloat(p.pnlPercent).toFixed(2)}%</td>
                      <td className="text-muted-foreground capitalize">{p.platform}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assets grid */}
      {cryptoBalances.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">All Assets</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cryptoBalances
              .sort((a, b) => parseFloat(b.usdValue ?? '0') - parseFloat(a.usdValue ?? '0'))
              .map((b, i) => (
                <div key={i} className="bg-secondary/40 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm">{b.asset}</span>
                    <span className="text-xs text-muted-foreground capitalize">{b.platform}</span>
                  </div>
                  <p className="text-base font-semibold mt-1">${parseFloat(b.usdValue ?? '0').toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">{parseFloat(b.amount).toFixed(6)} {b.asset}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {cryptoBalances.length === 0 && cryptoPositions.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold">No crypto accounts connected</p>
          <p className="text-sm text-muted-foreground mt-1">Go to Accounts to connect Hyperliquid, Binance, Bybit, and more.</p>
        </div>
      )}
    </div>
  )
}

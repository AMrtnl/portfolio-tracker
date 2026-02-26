import { usePortfolio } from '@/hooks/usePortfolio'
import { cn } from '@/lib/utils'
import { Building2, TrendingUp, TrendingDown } from 'lucide-react'

const BROKER_ICONS: Record<string, string> = {
  ibkr: 'IB', schwab: 'CS', swissquote: 'SQ', 'six-blink': '6B',
}
const BROKER_NAMES: Record<string, string> = {
  ibkr: 'Interactive Brokers', schwab: 'Charles Schwab', swissquote: 'Swissquote', 'six-blink': 'Six B-Link',
}

export function TradFi() {
  const { data: portfolio, isLoading } = usePortfolio()

  const tradfiPlatforms = ['ibkr', 'schwab', 'swissquote', 'six-blink']
  const tradfiBalances = (portfolio?.balances ?? []).filter(b => tradfiPlatforms.includes(b.platform ?? ''))
  const tradfiPositions = (portfolio?.positions ?? []).filter(p => tradfiPlatforms.includes(p.platform ?? ''))

  const totalTradFi = tradfiBalances.reduce((s, b) => s + parseFloat(b.usdValue ?? '0'), 0)
  const totalPnL = tradfiPositions.reduce((s, p) => s + parseFloat(p.pnl ?? '0'), 0)

  const byPlatform = tradfiPlatforms.reduce<Record<string, { cash: number; positions: typeof tradfiPositions }>>((acc, p) => {
    acc[p] = {
      cash: tradfiBalances.filter(b => b.platform === p).reduce((s, b) => s + parseFloat(b.usdValue ?? '0'), 0),
      positions: tradfiPositions.filter(pos => pos.platform === p),
    }
    return acc
  }, {})

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Traditional Finance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Brokers, banks, and institutional accounts</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Total TradFi Value</p>
          <p className="text-xl font-bold">${totalTradFi.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tradfiBalances.length} accounts</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Holdings</p>
          <p className="text-xl font-bold">{tradfiPositions.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Across all brokers</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Unrealized PnL</p>
          <p className={cn('text-xl font-bold', totalPnL >= 0 ? 'gain' : 'loss')}>
            {totalPnL >= 0 ? '+' : ''}${Math.abs(totalPnL).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Open positions</p>
        </div>
      </div>

      {/* Broker cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tradfiPlatforms.map(platform => {
          const data = byPlatform[platform]
          const isConnected = data.cash > 0 || data.positions.length > 0
          return (
            <div key={platform} className={cn('bg-card border rounded-xl p-5', isConnected ? 'border-border' : 'border-border/50 opacity-60')}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center font-bold text-sm">
                  {BROKER_ICONS[platform]}
                </div>
                <div>
                  <p className="font-semibold">{BROKER_NAMES[platform]}</p>
                  <p className="text-xs text-muted-foreground">{isConnected ? 'Connected' : 'Not connected'}</p>
                </div>
              </div>

              {isConnected ? (
                <>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted-foreground">Cash / Balance</span>
                    <span className="font-semibold">${data.cash.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {data.positions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">{data.positions.length} positions</p>
                      {data.positions.slice(0, 4).map((p, i) => {
                        const pnl = parseFloat(p.pnl)
                        return (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="font-medium">{p.asset}</span>
                            <span className={pnl >= 0 ? 'gain' : 'loss'}>{pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {platform === 'ibkr' && 'Run the IBKR Client Portal Gateway on localhost:5000 and add your account in Settings.'}
                  {platform === 'schwab' && 'Register at developer.schwab.com and add OAuth credentials in Settings.'}
                  {platform === 'swissquote' && 'Add your Swissquote OAuth credentials in Settings.'}
                  {platform === 'six-blink' && 'Enterprise registration with Six Group required. Contact Six Group for B-Link access.'}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Holdings table */}
      {tradfiPositions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">All Holdings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  {['Symbol', 'Type', 'Size', 'Entry', 'Mark', 'PnL', 'PnL%', 'Broker'].map(h => (
                    <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tradfiPositions.map((p, i) => {
                  const pnl = parseFloat(p.pnl)
                  return (
                    <tr key={i} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 pr-4 font-semibold">{p.asset}</td>
                      <td className="pr-4 text-muted-foreground text-xs">{p.type}</td>
                      <td className="pr-4">{p.size}</td>
                      <td className="pr-4">${parseFloat(p.entryPrice).toLocaleString()}</td>
                      <td className="pr-4">${parseFloat(p.markPrice).toLocaleString()}</td>
                      <td className={cn('pr-4 font-semibold', pnl >= 0 ? 'gain' : 'loss')}>{pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}</td>
                      <td className={cn('pr-4', pnl >= 0 ? 'gain' : 'loss')}>{parseFloat(p.pnlPercent).toFixed(2)}%</td>
                      <td className="text-muted-foreground capitalize">{BROKER_NAMES[p.platform ?? ''] ?? p.platform}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalTradFi === 0 && tradfiPositions.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold">No TradFi accounts connected</p>
          <p className="text-sm text-muted-foreground mt-1">Connect IBKR, Schwab, or Swissquote in the Accounts page.</p>
        </div>
      )}
    </div>
  )
}

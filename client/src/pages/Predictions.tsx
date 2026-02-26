import { usePortfolio } from '@/hooks/usePortfolio'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Target } from 'lucide-react'

export function Predictions() {
  const { data: portfolio, isLoading } = usePortfolio()

  const predPlatforms = ['polymarket', 'kalshi']
  const predBalances = (portfolio?.balances ?? []).filter(b => predPlatforms.includes(b.platform ?? ''))
  const predPositions = (portfolio?.positions ?? []).filter(p => predPlatforms.includes(p.platform ?? ''))

  const totalBalance = predBalances.reduce((s, b) => s + parseFloat(b.usdValue ?? '0'), 0)
  const totalPnL = predPositions.reduce((s, p) => s + parseFloat(p.pnl ?? '0'), 0)

  if (isLoading) return <div className="p-6"><div className="h-64 skeleton rounded-xl" /></div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prediction Markets</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Polymarket and Kalshi positions</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
          <p className="text-xl font-bold">${totalBalance.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Open Positions</p>
          <p className="text-xl font-bold">{predPositions.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">Unrealized PnL</p>
          <p className={cn('text-xl font-bold', totalPnL >= 0 ? 'gain' : 'loss')}>
            {totalPnL >= 0 ? '+' : ''}${Math.abs(totalPnL).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { id: 'polymarket', name: 'Polymarket', description: 'Decentralized prediction market on Polygon. Requires EVM wallet.', icon: '🔮' },
          { id: 'kalshi', name: 'Kalshi', description: 'CFTC-regulated prediction market. Requires Kalshi account and API key.', icon: '📊' },
        ].map(platform => {
          const bal = predBalances.filter(b => b.platform === platform.id)
          const pos = predPositions.filter(p => p.platform === platform.id)
          const isConnected = bal.length > 0 || pos.length > 0
          const platformBalance = bal.reduce((s, b) => s + parseFloat(b.usdValue ?? '0'), 0)
          return (
            <div key={platform.id} className={cn('bg-card border rounded-xl p-5', isConnected ? 'border-border' : 'border-border/50 opacity-60')}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{platform.icon}</span>
                <div>
                  <p className="font-semibold">{platform.name}</p>
                  <p className="text-xs text-muted-foreground">{isConnected ? `Connected · $${platformBalance.toFixed(2)} balance` : 'Not connected'}</p>
                </div>
              </div>
              {isConnected ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{pos.length} open position{pos.length !== 1 ? 's' : ''}</p>
                  {pos.slice(0, 3).map((p, i) => {
                    const pnl = parseFloat(p.pnl)
                    const price = parseFloat(p.markPrice)
                    return (
                      <div key={i} className="bg-secondary/40 rounded-lg p-2.5">
                        <p className="text-xs font-medium truncate">{p.asset}</p>
                        <div className="flex justify-between mt-1 text-xs">
                          <span className="text-muted-foreground">
                            {p.side === 'LONG' ? 'YES' : 'NO'} · {(price * 100).toFixed(0)}¢
                          </span>
                          <span className={pnl >= 0 ? 'gain' : 'loss'}>{pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}</span>
                        </div>
                        {/* Probability bar */}
                        <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(price * 100).toFixed(0)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{platform.description}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* All positions table */}
      {predPositions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">All Positions</h3>
          <div className="space-y-3">
            {predPositions.map((p, i) => {
              const pnl = parseFloat(p.pnl)
              const price = parseFloat(p.markPrice)
              return (
                <div key={i} className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.asset}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground capitalize">{p.platform}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs font-medium">{p.side === 'LONG' ? 'YES' : 'NO'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Probability</p>
                        <p className="font-semibold text-sm">{(price * 100).toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">PnL</p>
                        <p className={cn('font-semibold text-sm', pnl >= 0 ? 'gain' : 'loss')}>
                          {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Size</p>
                        <p className="font-semibold text-sm">{parseFloat(p.size).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {predBalances.length === 0 && predPositions.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Target className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold">No prediction market accounts connected</p>
          <p className="text-sm text-muted-foreground mt-1">Connect Polymarket or Kalshi in the Accounts page.</p>
        </div>
      )}
    </div>
  )
}

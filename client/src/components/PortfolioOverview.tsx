import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react'

interface PortfolioOverviewProps {
  totalValue: string
  pnl24h: string
  pnl7d: string
  pnl30d: string
}

export function PortfolioOverview({ totalValue, pnl24h, pnl7d, pnl30d }: PortfolioOverviewProps) {
  const pnl24hNum = parseFloat(pnl24h)
  const pnl7dNum = parseFloat(pnl7d)
  const pnl30dNum = parseFloat(pnl30d)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          <p className="text-xs text-muted-foreground">Across all protocols</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">24h PnL</CardTitle>
          {pnl24hNum >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${pnl24hNum >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {formatPercent(pnl24hNum)}
          </div>
          <p className="text-xs text-muted-foreground">Last 24 hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">7d PnL</CardTitle>
          {pnl7dNum >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${pnl7dNum >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {formatPercent(pnl7dNum)}
          </div>
          <p className="text-xs text-muted-foreground">Last 7 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">30d PnL</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${pnl30dNum >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {formatPercent(pnl30dNum)}
          </div>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>
    </div>
  )
}

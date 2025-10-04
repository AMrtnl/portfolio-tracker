import { PortfolioOverview } from '@/components/PortfolioOverview'
import { AssetsList } from '@/components/AssetsList'
import { PositionsList } from '@/components/PositionsList'
import { usePortfolio } from '@/hooks/usePortfolio'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Dashboard() {
  const { data: portfolio, isLoading, error, refetch } = usePortfolio()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-500">Error loading portfolio data</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (!portfolio) {
    return null
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Portfolio Dashboard</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <PortfolioOverview
        totalValue={portfolio.totalValue}
        pnl24h={portfolio.pnl24h}
        pnl7d={portfolio.pnl7d}
        pnl30d={portfolio.pnl30d}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <AssetsList assets={portfolio.assets} />
        <PositionsList positions={portfolio.positions} />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(portfolio.lastUpdated).toLocaleString()}
      </p>
    </div>
  )
}

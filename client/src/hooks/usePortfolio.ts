import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export interface Balance {
  asset: string
  amount: string
  usdValue: string
  chain: string
}

export interface Position {
  asset: string
  size: string
  entryPrice: string
  markPrice: string
  pnl: string
  pnlPercent: string
  leverage: string
  side: 'LONG' | 'SHORT'
  type: 'PERPETUAL' | 'FUTURE' | 'OPTION'
  protocol: string
}

export interface PortfolioSummary {
  totalValue: string
  pnl24h: string
  pnl7d: string
  pnl30d: string
  assets: Balance[]
  positions: Position[]
  lastUpdated: string
}

export function usePortfolio() {
  return useQuery<PortfolioSummary>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data } = await axios.get('/api/portfolio')
      return data
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

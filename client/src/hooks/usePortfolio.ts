import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export interface Balance {
  asset: string
  amount: string
  usdValue: string
  chain: string
  accountId?: string
  accountLabel?: string
  provider?: string
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
  type: 'PERPETUAL' | 'FUTURE' | 'OPTION' | 'EQUITY'
  protocol: string
  accountId?: string
  accountLabel?: string
  provider?: string
}

export interface PortfolioSource {
  accountId: string
  label: string
  provider: string
  type: string
  valueUsd: number
  status: string
  error?: string
}

export interface PortfolioSummary {
  totalValue: string
  pnl24h: string
  pnl7d: string
  pnl30d: string
  assets: Balance[]
  positions: Position[]
  sources?: PortfolioSource[]
  lastUpdated: string
}

export function usePortfolio(opts?: { enabled?: boolean }) {
  return useQuery<PortfolioSummary>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data } = await axios.get('/api/portfolio')
      return data
    },
    enabled: opts?.enabled ?? true,
    refetchInterval: 30000,
  })
}

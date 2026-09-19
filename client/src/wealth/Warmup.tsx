import { useAccounts, useProviders } from '@/hooks/useAccounts'
import { useSettings } from '@/hooks/useSettings'
import { usePortfolio } from '@/hooks/usePortfolio'
import {
  useAllocation,
  useAnalyticsHoldings,
  useConcentration,
  useFlows,
  useHistory,
  useIncome,
  useMovers,
  useNews,
  useOverview,
} from '@/hooks/useAnalytics'
import {
  useBudgets,
  useCashflow,
  useCategories,
  useRecurringSuggestions,
  useSubscriptions,
  useTransactions,
} from '@/hooks/useMoneyLedger'
import { useGoals } from '@/hooks/useGoals'
import { isDemoId } from '@/wealth/demo'

/**
 * Mounted once in the shell: subscribes every query the pages need so the
 * whole book loads in parallel at start and every page opens from cache.
 * Nothing renders; the query cache is the product.
 */
export function Warmup() {
  const { data: accounts } = useAccounts()
  const hasLive = (accounts ?? []).some((a) => !isDemoId(a.id))
  useProviders()
  useSettings()
  usePortfolio({ enabled: hasLive })
  useOverview()
  useAllocation('assetClass')
  useAllocation('region')
  useAllocation('sector')
  useConcentration()
  useAnalyticsHoldings()
  useHistory('3m')
  useIncome(12)
  useFlows(12)
  useMovers()
  useNews(6)
  useCashflow(6)
  useTransactions()
  useSubscriptions()
  useRecurringSuggestions()
  useGoals()
  useBudgets()
  useCategories()
  return null
}

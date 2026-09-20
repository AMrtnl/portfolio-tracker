import { useMemo } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useAnalyticsHoldings, type AnalyticsHolding } from '@/hooks/useAnalytics'
import { isDemoId } from '@/wealth/demo'

/**
 * Live analytics holdings merged with holdings carried on the accounts
 * themselves (manual books and the sample household), deduped per
 * symbol + account. Live data always wins on collision.
 */
export function useMergedHoldings(): AnalyticsHolding[] {
  const { data: accounts } = useAccounts()
  const { data: holdings } = useAnalyticsHoldings()

  return useMemo(() => {
    const fromAccounts: AnalyticsHolding[] = []
    for (const a of accounts ?? []) {
      for (const h of a.holdings ?? []) {
        fromAccounts.push({
          symbol: h.symbol,
          name: h.name,
          units: h.quantity,
          price: h.priceUsd,
          marketValue: h.quantity * h.priceUsd,
          accountId: a.id,
          accountLabel: a.label,
          currency: a.currency,
          assetClass: h.assetClass,
        })
      }
    }
    const live = holdings?.holdings ?? []
    if (!live.length) return fromAccounts
    const seen = new Set(live.map((h) => `${h.symbol}-${h.accountId}`))
    return [
      ...live,
      ...fromAccounts.filter(
        (h) => isDemoId(h.accountId) && !seen.has(`${h.symbol}-${h.accountId}`),
      ),
    ]
  }, [accounts, holdings])
}

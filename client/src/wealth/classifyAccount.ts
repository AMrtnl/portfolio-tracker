import type { Account } from '@/hooks/useAccounts'
import { classOf, type AssetClassId } from '@/wealth/tokens'

export function isLiability(account: Account): boolean {
  return account.kind === 'liability' || account.type === 'loan'
}

export function accountClass(account: Account): AssetClassId {
  if (account.bookClass) return account.bookClass
  if (account.type === 'crypto_wallet') return 'crypto'
  if (account.type === 'bank') return 'cash'
  if (account.type === 'pension') return 'pension'
  if (account.type === 'estate') return 'estate'
  if (account.type === 'broker') return 'stocks'
  const holdings = account.holdings ?? []
  if (holdings.length) {
    const counts: Record<string, number> = {}
    for (const h of holdings) {
      const id = classOf(h.assetClass).id
      counts[id] = (counts[id] || 0) + h.quantity * h.priceUsd
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (top) return top[0] as AssetClassId
  }
  return 'other'
}

export function accountValue(account: Account): number {
  return Math.abs(account.totalValueUsd ?? 0)
}

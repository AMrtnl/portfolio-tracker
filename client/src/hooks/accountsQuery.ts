import axios from 'axios'
import type { Account } from './useAccounts'

/**
 * The one query for the server's account list. Shared by useAccounts and the
 * sample-household switch, so both read the same cache entry and the request
 * goes out once.
 */
export const ACCOUNTS_KEY = ['accounts'] as const

export async function fetchAccounts(): Promise<Account[]> {
  const { data } = await axios.get('/api/accounts')
  return (data.accounts as Account[]).map((a) => ({
    ...a,
    // Compat for older UI that read .address
    address: a.externalId || a.maskedIdentifier || '',
  }))
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export type AccountType = 'crypto_wallet' | 'broker' | 'bank' | 'manual'
export type ProviderId = 'hyperliquid' | 'snaptrade' | 'manual'
export type AccountStatus =
  | 'connected'
  | 'pending'
  | 'error'
  | 'disconnected'
  | 'unconfigured'

export interface Holding {
  symbol: string
  name?: string
  quantity: number
  priceUsd: number
  assetClass?: 'equity' | 'etf' | 'crypto' | 'cash' | 'other'
}

export interface Account {
  id: string
  label: string
  type: AccountType
  provider: ProviderId
  status: AccountStatus
  externalId?: string
  maskedIdentifier?: string
  institution?: string
  currency: string
  lastSyncedAt?: string
  lastError?: string
  createdAt: string
  live?: boolean
  holdings?: Holding[]
  totalValueUsd?: number
  /** @deprecated legacy field — prefer maskedIdentifier / externalId */
  address?: string
}

export interface ProviderInfo {
  id: ProviderId
  name: string
  description: string
  accountTypes: AccountType[]
  configured: boolean
  coverage: string
  connectMode: 'mnemonic' | 'oauth' | 'manual' | 'import'
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['accounts'] })
  qc.invalidateQueries({ queryKey: ['walletStatus'] })
  qc.invalidateQueries({ queryKey: ['portfolio'] })
  qc.invalidateQueries({ queryKey: ['providers'] })
  qc.invalidateQueries({ queryKey: ['snaptrade'] })
}

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await axios.get('/api/accounts')
      return (data.accounts as Account[]).map((a) => ({
        ...a,
        // Compat for older UI that read .address
        address: a.externalId || a.maskedIdentifier || '',
      }))
    },
  })
}

export function useProviders() {
  return useQuery<ProviderInfo[]>({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data } = await axios.get('/api/providers')
      return data.providers
    },
  })
}

export function useAddCryptoAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { label: string; mnemonic: string }) => {
      const { data } = await axios.post('/api/accounts', payload)
      return data as Account
    },
    onSuccess: () => invalidateAll(qc),
  })
}

/** @deprecated alias */
export const useAddAccount = useAddCryptoAccount

export function useAddManualAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      label: string
      institution?: string
      type?: 'manual' | 'broker' | 'bank'
      holdings?: Holding[]
    }) => {
      const { data } = await axios.post('/api/accounts/manual', payload)
      return data as Account
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useSnaptradeConnect() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post('/api/accounts/snaptrade/connect')
      return data as { redirectUrl?: string; message?: string }
    },
  })
}

export function useSnaptradeImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post('/api/accounts/snaptrade/import')
      return data as { imported: Account[]; message?: string }
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useSyncAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post(`/api/accounts/${id}/sync`)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useRenameAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      await axios.patch(`/api/accounts/${id}`, { label })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useUpdateManualHoldings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      holdings,
      institution,
      label,
    }: {
      id: string
      holdings: Holding[]
      institution?: string
      label?: string
    }) => {
      const { data } = await axios.patch(`/api/accounts/${id}`, {
        holdings,
        institution,
        label,
      })
      return data as Account
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/accounts/${id}`)
    },
    onSuccess: () => invalidateAll(qc),
  })
}

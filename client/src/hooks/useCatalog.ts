import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

/** One category of the catalogue: banks, brokers, and so on. */
export type CategoryId = 'banks' | 'brokers' | 'exchanges' | 'wallets' | 'pensions' | 'property' | 'debts'
export type Method = 'link' | 'key' | 'manual'
export type ConnectorId = 'snaptrade' | 'gocardless' | 'watch' | 'manual'
export type ManualKind = 'bank' | 'broker' | 'pension' | 'property' | 'loan' | 'holdings'

export interface CatalogInstitution {
  id: string
  name: string
  logo?: string
  domain?: string
  countries: string[]
  category: CategoryId
  /** link = an aggregator redirect, key = a public key or address, manual = a figure by hand. */
  method: Method
  connector: ConnectorId
  /** The connector is configured on this server. */
  available: boolean
  /** SnapTrade brokerage slug or GoCardless institution id. */
  ref?: string
  manualKind?: ManualKind
  note?: string
}

export interface CatalogCategory {
  id: CategoryId
  name: string
  description: string
  institutions: CatalogInstitution[]
}

export interface Catalog {
  country: string
  countries: Array<{ code: string; name: string }>
  connectors: Array<{ id: ConnectorId; name: string; configured: boolean; coverage: string }>
  categories: CatalogCategory[]
}

export function useCatalog(country: string) {
  return useQuery({
    queryKey: ['catalog', country],
    queryFn: async () => {
      const { data } = await axios.get('/api/catalog', { params: { country } })
      return data as Catalog
    },
    staleTime: 10 * 60_000,
  })
}

function invalidateBook(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['accounts'] })
  qc.invalidateQueries({ queryKey: ['portfolio'] })
  qc.invalidateQueries({ queryKey: ['analytics'] })
  qc.invalidateQueries({ queryKey: ['billing'] })
}

/** Opens a bank's open-banking consent page; the bank sends the person back to `redirect`. */
export function useGocardlessStart() {
  return useMutation({
    mutationFn: async (input: { institutionId: string; redirect: string }) => {
      const { data } = await axios.post('/api/connect/gocardless/start', input)
      return data as { url: string; reference: string }
    },
  })
}

/** Back from the bank: turn the consent into accounts on the ledger. */
export function useGocardlessFinish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reference: string) => {
      const { data } = await axios.post('/api/connect/gocardless/finish', { reference })
      return data as { imported: Array<{ id: string; label: string }>; institution: string }
    },
    onSuccess: () => invalidateBook(qc),
  })
}

/** Pulls a bank account's transactions into the cash-flow ledger, categorised and deduplicated. */
export function useImportTransactions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; days?: number }) => {
      const { data } = await axios.post(`/api/accounts/${input.id}/transactions/import`, { days: input.days })
      return data as { imported: number; skipped: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['money'] })
      qc.invalidateQueries({ queryKey: ['cashflow'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

/** A 402 from any connect route: the plan's live-connection slots are used up. */
export function isPlanLimit(err: unknown): boolean {
  const e = err as { response?: { status?: number; data?: { upgrade?: boolean } } }
  return e?.response?.status === 402 || Boolean(e?.response?.data?.upgrade)
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export interface SnapAccountVM {
  externalId: string
  label: string
  institution: string
  numberSuffix?: string
  accountType?: string | null
  accountCategory?: string | null
  status?: string | null
  currency: string
  totalValue?: number | null
  isPaper: boolean
  holdingsUnavailable?: boolean
  lastHoldingsSync?: string | null
  brokerageAuthorizationId?: string
}

export interface SnapBalanceVM {
  currency: string
  cash: number | null
  buyingPower: number | null
}

export interface SnapPositionVM {
  symbol: string
  name?: string | null
  units: number
  price: number | null
  averageCost: number | null
  marketValue: number | null
  currency: string
  openPnl: number | null
  cashEquivalent: boolean
}

export interface SnapOrderVM {
  brokerageOrderId?: string
  symbol?: string
  action?: string
  status?: string
  orderType?: string | null
  totalQuantity?: string | null
  filledQuantity?: string | null
  limitPrice?: string | null
  executionPrice?: string | null
  timePlaced?: string
  timeExecuted?: string | null
  currency?: string | null
}

export interface SnapActivityVM {
  id?: string
  type?: string
  symbol?: string | null
  description?: string
  amount: number | null
  units: number | null
  price: number | null
  currency: string | null
  tradeDate?: string | null
  settlementDate?: string | null
  fee: number | null
  institution?: string
}

export interface SnapConnectionVM {
  id: string
  name: string
  brokerageName: string
  brokerageSlug?: string
  type?: string
  disabled: boolean
  disabledDate?: string | null
  dataFreshnessMode?: string
  createdDate?: string
}

export interface SnapStatus {
  configured: boolean
  accountCount: number
  connectionCount: number
  disabledConnectionCount: number
  errors?: string[]
  retrievedAt: string
}

export interface SnapAccountDetail {
  account: SnapAccountVM | null
  balances: { data: SnapBalanceVM[]; error?: string }
  positions: { data: SnapPositionVM[]; error?: string }
  retrievedAt: string
  errors: string[]
}

function axiosMessage(err: unknown): string {
  const e = err as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return (
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.message ||
    'Request failed'
  )
}

export function useSnaptradeStatus() {
  return useQuery({
    queryKey: ['snaptrade', 'status'],
    queryFn: async () => {
      const { data } = await axios.get('/api/snaptrade/status')
      return data as SnapStatus
    },
    staleTime: 30_000,
  })
}

export function useSnaptradeAccounts(enabled = true) {
  return useQuery({
    queryKey: ['snaptrade', 'accounts'],
    enabled,
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/snaptrade/accounts')
        return {
          accounts: data.accounts as SnapAccountVM[],
          retrievedAt: data.retrievedAt as string,
        }
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status
        if (status === 503) {
          return { accounts: [] as SnapAccountVM[], retrievedAt: new Date().toISOString(), unconfigured: true }
        }
        throw new Error(axiosMessage(err))
      }
    },
  })
}

export function useSnaptradeConnections(enabled = true) {
  return useQuery({
    queryKey: ['snaptrade', 'connections'],
    enabled,
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/snaptrade/connections')
        return {
          connections: data.connections as SnapConnectionVM[],
          retrievedAt: data.retrievedAt as string,
        }
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status
        if (status === 503) {
          return {
            connections: [] as SnapConnectionVM[],
            retrievedAt: new Date().toISOString(),
            unconfigured: true,
          }
        }
        throw new Error(axiosMessage(err))
      }
    },
  })
}

export function useSnaptradeAccountDetail(externalId: string | null) {
  return useQuery({
    queryKey: ['snaptrade', 'account', externalId],
    enabled: Boolean(externalId),
    queryFn: async () => {
      const { data } = await axios.get(
        `/api/snaptrade/accounts/${externalId}`,
      )
      return data as SnapAccountDetail
    },
  })
}

export function useSnaptradeOrders(externalId: string | null) {
  return useQuery({
    queryKey: ['snaptrade', 'orders', externalId],
    enabled: Boolean(externalId),
    queryFn: async () => {
      try {
        const { data } = await axios.get(
          `/api/snaptrade/accounts/${externalId}/orders`,
        )
        return {
          orders: (data.orders || []) as SnapOrderVM[],
          retrievedAt: data.retrievedAt as string,
        }
      } catch (err) {
        throw new Error(axiosMessage(err))
      }
    },
  })
}

export function useSnaptradeActivities(externalId: string | null) {
  return useQuery({
    queryKey: ['snaptrade', 'activities', externalId],
    enabled: Boolean(externalId),
    queryFn: async () => {
      try {
        const { data } = await axios.get(
          `/api/snaptrade/accounts/${externalId}/activities`,
        )
        return {
          activities: (data.activities || []) as SnapActivityVM[],
          retrievedAt: data.retrievedAt as string,
        }
      } catch (err) {
        throw new Error(axiosMessage(err))
      }
    },
  })
}

export function useSnaptradeImportAndInvalidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post('/api/accounts/snaptrade/import')
      return data as { imported: unknown[]; message?: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['walletStatus'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['snaptrade'] })
    },
  })
}

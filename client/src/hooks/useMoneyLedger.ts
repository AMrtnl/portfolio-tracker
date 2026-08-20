import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useDemo } from '@/wealth/DemoContext'
import {
  buildCashflow,
  mergeSubscriptions,
  mergeTransactions,
} from '@/wealth/demo'

export type TxKind = 'income' | 'spend'
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

export interface MoneyCategory {
  id: string
  name: string
  color: string
}

export interface MoneyTransaction {
  id: string
  date: string
  kind: TxKind
  amount: number
  category: string
  note?: string
  createdAt: string
}

export interface Subscription {
  id: string
  name: string
  plan?: string
  amount: number
  cycle: BillingCycle
  day: number
  month?: number
  cat: string
  createdAt: string
}

export interface CashflowMonth {
  key: string
  label: string
  year: number
  month: number
  income: number
  spend: number
}

export interface CashflowResponse {
  months: CashflowMonth[]
  categories: Array<{ id: string; name: string; color: string; amount: number }>
  hasActivity: boolean
  retrievedAt: string
}

const SPEND_FALLBACK: MoneyCategory[] = [
  { id: 'housing', name: 'Housing', color: '#FF9F45' },
  { id: 'insurance', name: 'Insurance', color: '#4BD57E' },
  { id: 'groceries', name: 'Groceries', color: '#FFD84D' },
  { id: 'subscriptions', name: 'Subscriptions', color: '#A57BFF' },
  { id: 'transport', name: 'Transport', color: '#3ABEFF' },
  { id: 'leisure', name: 'Leisure', color: '#FF5C48' },
  { id: 'other', name: 'Other', color: '#8E8E93' },
]

const INCOME_FALLBACK: MoneyCategory[] = [
  { id: 'salary', name: 'Salary', color: '#30D158' },
  { id: 'bonus', name: 'Bonus', color: '#4BD57E' },
  { id: 'other-income', name: 'Other', color: '#8E8E93' },
]

const SUB_FALLBACK: MoneyCategory[] = [
  { id: 'essentials', name: 'Essentials', color: '#4BD57E' },
  { id: 'telecom', name: 'Telecom', color: '#3ABEFF' },
  { id: 'transport', name: 'Transport', color: '#FFD84D' },
  { id: 'software', name: 'Software', color: '#A57BFF' },
  { id: 'media', name: 'Media', color: '#FF5C48' },
  { id: 'home', name: 'Home', color: '#FF9F45' },
]

export function useCategories() {
  return useQuery({
    queryKey: ['money', 'categories'],
    queryFn: async () => {
      const { data } = await axios.get('/api/money/categories')
      return data as {
        spend: MoneyCategory[]
        income: MoneyCategory[]
        subscriptions: MoneyCategory[]
      }
    },
    placeholderData: {
      spend: SPEND_FALLBACK,
      income: INCOME_FALLBACK,
      subscriptions: SUB_FALLBACK,
    },
  })
}

export function useCashflow(months = 6) {
  const { enabled } = useDemo()
  const query = useQuery({
    queryKey: ['money', 'cashflow', months],
    queryFn: async () => {
      const { data } = await axios.get('/api/money/cashflow', { params: { months } })
      return data as CashflowResponse
    },
  })
  const txs = useQuery({
    queryKey: ['money', 'transactions'],
    queryFn: async () => {
      const { data } = await axios.get('/api/money/transactions')
      return data.transactions as MoneyTransaction[]
    },
  })
  if (!enabled) return query
  return {
    ...query,
    isLoading: txs.isLoading && !txs.data,
    data: buildCashflow(mergeTransactions(txs.data, true), months),
  }
}

export function useTransactions() {
  const { enabled } = useDemo()
  const query = useQuery({
    queryKey: ['money', 'transactions'],
    queryFn: async () => {
      const { data } = await axios.get('/api/money/transactions')
      return data.transactions as MoneyTransaction[]
    },
  })
  return {
    ...query,
    data: mergeTransactions(query.data, enabled),
  }
}

export function useAddTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      date: string
      kind: TxKind
      amount: number
      category: string
      note?: string
    }) => {
      const { data } = await axios.post('/api/money/transactions', payload)
      return data as MoneyTransaction
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['money'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/money/transactions/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['money'] })
    },
  })
}

export function useSubscriptions() {
  const { enabled } = useDemo()
  const query = useQuery({
    queryKey: ['money', 'subscriptions'],
    queryFn: async () => {
      const { data } = await axios.get('/api/money/subscriptions')
      return data as { subscriptions: Subscription[]; categories: MoneyCategory[] }
    },
  })
  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          subscriptions: mergeSubscriptions(query.data.subscriptions, enabled),
        }
      : enabled
        ? {
            subscriptions: mergeSubscriptions([], true),
            categories: SUB_FALLBACK,
          }
        : query.data,
  }
}

export function useAddSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      plan?: string
      amount: number
      cycle: BillingCycle
      day: number
      month?: number
      cat: string
    }) => {
      const { data } = await axios.post('/api/money/subscriptions', payload)
      return data as Subscription
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['money'] })
    },
  })
}

export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/money/subscriptions/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['money'] })
    },
  })
}

export function subCatOf(
  id: string | undefined,
  cats?: MoneyCategory[],
): MoneyCategory {
  const list = cats?.length ? cats : SUB_FALLBACK
  return list.find((c) => c.id === id) || list[0]
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export function useBudgetSummary() {
  return useQuery({
    queryKey: ['budget-summary'],
    queryFn: () => axios.get('/api/budget/summary').then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => axios.get('/api/budget/subscriptions').then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useAddSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => axios.post('/api/budget/subscriptions', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => axios.delete(`/api/budget/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

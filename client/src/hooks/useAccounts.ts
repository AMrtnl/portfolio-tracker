import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => axios.get('/api/accounts').then(r => r.data),
  })
}

export function useAddAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => axios.post('/api/accounts', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => axios.delete(`/api/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useToggleAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axios.patch(`/api/accounts/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

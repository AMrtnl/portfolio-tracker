import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export interface WalletStatus {
  initialized: boolean
  accountCount?: number
  address?: string | null
}

export function useWalletStatus() {
  return useQuery<WalletStatus>({
    queryKey: ['walletStatus'],
    queryFn: async () => {
      const { data } = await axios.get('/api/wallet/status')
      return data
    },
    refetchInterval: 10000,
  })
}

export function useInvalidateWalletStatus() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['walletStatus'] })
    queryClient.invalidateQueries({ queryKey: ['portfolio'] })
  }
}

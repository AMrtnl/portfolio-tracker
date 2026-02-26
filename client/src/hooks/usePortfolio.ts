import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => axios.get('/api/portfolio').then(r => r.data),
    refetchInterval: 60_000,
  })
}

export function usePortfolioHistory(days = 30) {
  return useQuery({
    queryKey: ['portfolio-history', days],
    queryFn: () => axios.get(`/api/portfolio/history?days=${days}`).then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

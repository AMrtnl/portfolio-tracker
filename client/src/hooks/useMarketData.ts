import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function useCryptoPrices() {
  return useQuery({
    queryKey: ['market-prices'],
    queryFn: () => axios.get('/api/market/prices').then(r => r.data),
    refetchInterval: 60_000,
  })
}

export function useMacroData() {
  return useQuery({
    queryKey: ['macro'],
    queryFn: () => axios.get('/api/market/macro').then(r => r.data),
    staleTime: 60 * 60_000,
  })
}

export function useEconomicCalendar() {
  return useQuery({
    queryKey: ['economic-calendar'],
    queryFn: () => axios.get('/api/market/calendar/economic').then(r => r.data),
    staleTime: 15 * 60_000,
  })
}

export function useEarningsCalendar() {
  return useQuery({
    queryKey: ['earnings-calendar'],
    queryFn: () => axios.get('/api/market/calendar/earnings').then(r => r.data),
    staleTime: 15 * 60_000,
  })
}

export function useMarketNews() {
  return useQuery({
    queryKey: ['market-news'],
    queryFn: () => axios.get('/api/market/news').then(r => r.data),
    staleTime: 15 * 60_000,
  })
}

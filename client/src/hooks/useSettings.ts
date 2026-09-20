import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export type DisplayCurrency = 'CHF' | 'EUR' | 'USD' | 'GBP'
export type HeadlineMetric = 'net' | 'financial' | 'gross'

export interface Settings {
  displayCurrency: DisplayCurrency
  headlineMetric: HeadlineMetric
  currencies: DisplayCurrency[]
  metrics: HeadlineMetric[]
  /** Units of the display currency per unit of the key. */
  rates: Record<string, number>
  warnings: string[]
}

const FALLBACK: Settings = {
  displayCurrency: 'CHF',
  headlineMetric: 'net',
  currencies: ['CHF', 'EUR', 'USD', 'GBP'],
  metrics: ['net', 'financial', 'gross'],
  rates: { CHF: 1 },
  warnings: [],
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await axios.get('/api/settings')
      return data as Settings
    },
    staleTime: 5 * 60_000,
    placeholderData: FALLBACK,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Settings, 'displayCurrency' | 'headlineMetric'>>) => {
      const { data } = await axios.put('/api/settings', patch)
      return data as Pick<Settings, 'displayCurrency' | 'headlineMetric'>
    },
    onSuccess: () => {
      // Every server-side total is denominated in the display currency.
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['market'] })
    },
  })
}

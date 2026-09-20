import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'

export type PlanId = 'free' | 'plus' | 'family'

export interface PlanSpec {
  name: string
  priceChf: number
  liveConnections: number | null
  grow: boolean
  exposure: boolean
  benchmarks: boolean
  seats: number
}

export interface Billing {
  plan: PlanId
  source: 'preview' | 'stripe' | 'manual'
  preview: boolean
  stripeConfigured: boolean
  renewsAt: string | null
  entitlements: { liveConnections: number | null; grow: boolean; exposure: boolean; benchmarks: boolean; seats: number }
  usage: { liveConnections: number }
  plans: Record<PlanId, PlanSpec>
}

export function useBilling(enabled = true) {
  return useQuery({
    queryKey: ['billing'],
    enabled,
    queryFn: async () => {
      const { data } = await axios.get('/api/billing')
      return data as Billing
    },
    staleTime: 60_000,
  })
}

/** Starts a Stripe Checkout session and hands back the page to send the person to. */
export function useCheckout() {
  return useMutation({
    mutationFn: async (input: { plan: Exclude<PlanId, 'free'>; interval: 'month' | 'year' }) => {
      const { data } = await axios.post('/api/billing/checkout', input)
      return data as { url: string }
    },
  })
}

/** Opens the Stripe billing portal for invoices, card changes and cancelling. */
export function usePortal() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post('/api/billing/portal')
      return data as { url: string }
    },
  })
}

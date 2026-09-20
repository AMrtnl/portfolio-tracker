/**
 * The handoff's demo-data.json, typed. One internally consistent household:
 * every screen's sample figures come from here, through the existing hooks.
 */
import raw from '@/wh/fixtures/demo-data.json'

export type FixtureAccountKind = 'property' | 'broker' | 'bank' | 'pension' | 'wallet' | 'mortgage' | 'loan'

export interface FixtureAccount {
  name: string
  kind: FixtureAccountKind
  source?: string
  mono?: string
  logo?: string
  readOnly?: boolean
  value: number
  share?: number
  change12m?: number
  fresh?: string
  note?: string
}

export interface FixtureHolding {
  name: string
  mono?: string
  logo?: string
  account: string
  class?: string
  sector?: string
  country?: string
  currency?: string
  ter?: number
  units?: string
  staked?: boolean
  value: number
  weight?: number
  change?: number
}

export interface FixtureSubscription {
  name: string
  mono?: string
  logo?: string
  plan?: string
  price: number
  since: string
  next?: string
  flag?: string
}

export interface FixtureGrow {
  rank: number
  kind: 'fund' | 'cash' | 'eth' | 'stock'
  title: string
  because: string
  savingPerYear?: number
  effect?: string
  evidence?: { holdingsAnalysed: number; currentFeePct: number; comparableMedianPct: number; tradingCost: number }
  assumptions?: { returnPct: number; years: number; modelledGain: number; breakEvenMonths: number }
  risks?: string[]
}

export interface Fixture {
  currency: string
  asOf: string
  netWorth: number
  assets: number
  liabilities: number
  liquid: number
  change12m: { amount: number; pct: number }
  ytd: { amount: number; pct: number }
  accounts: FixtureAccount[]
  holdings: FixtureHolding[]
  allocation: Array<[string, number]>
  exposure: {
    sector: Array<[string, number]>
    country: Array<[string, number]>
    currency: Array<[string, number]>
    insight: string
  }
  cashflow: {
    months: string[]
    in: number[]
    out: number[]
    cashPosition: number[]
    forecastFromIndex: number
    september: Record<string, number>
  }
  subscriptions: {
    monthly: number
    yearly: number
    history12m: number[]
    items: FixtureSubscription[]
    alerts: Array<{ kind: 'priceRise' | 'overlap'; text: string }>
  }
  grow: FixtureGrow[]
}

export const FIXTURE = raw as unknown as Fixture

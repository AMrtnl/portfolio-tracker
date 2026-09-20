export const GAIN = 'var(--gain)'
export const LOSS = 'var(--loss)'
export const TINT = 'var(--accent)'
export const MUTED = 'var(--wh-faint)'

export const PAD = { top: 16, right: 14, bottom: 20, left: 14 }

export const RANGES = [
  { k: '1M', n: '1m' as const },
  { k: '3M', n: '3m' as const },
  { k: '6M', n: '6m' as const },
  { k: '1Y', n: '1y' as const },
]

export type AssetClassId =
  | 'estate'
  | 'pension'
  | 'stocks'
  | 'crypto'
  | 'cash'
  | 'bonds'
  | 'funds'
  | 'other'

export interface AssetClass {
  id: AssetClassId
  name: string
  color: string
  keys: string[]
}

/** Visual classes used in the wealth UI, mapped from analytics assetClass. */
export const CLASSES: AssetClass[] = [
  { id: 'estate', name: 'Real estate', color: 'var(--wh-c-property)', keys: ['real_estate', 'estate'] },
  { id: 'pension', name: 'Pension', color: 'var(--wh-c-pension)', keys: ['pension'] },
  { id: 'stocks', name: 'Stocks', color: 'var(--wh-c-equities)', keys: ['equity', 'etf'] },
  { id: 'funds', name: 'Funds', color: '#5AC8FA', keys: ['fund'] },
  { id: 'cash', name: 'Cash', color: 'var(--wh-c-cash)', keys: ['cash'] },
  { id: 'bonds', name: 'Bonds', color: '#8E8E93', keys: ['bond'] },
  { id: 'crypto', name: 'Crypto', color: 'var(--wh-c-crypto)', keys: ['crypto'] },
  { id: 'other', name: 'Other', color: 'var(--wh-faint)', keys: ['other', 'unclassified'] },
]

export const CLASS_BY_KEY: Record<string, AssetClass> = {}
for (const c of CLASSES) {
  CLASS_BY_KEY[c.id] = c
  for (const k of c.keys) CLASS_BY_KEY[k] = c
}

export const GEO_COLORS: Record<string, { name: string; color: string }> = {
  CH: { name: 'Switzerland', color: '#0071E3' },
  US: { name: 'United States', color: '#5E5CE6' },
  EU: { name: 'Europe', color: '#30B0C7' },
  UK: { name: 'United Kingdom', color: '#AF52DE' },
  JP: { name: 'Japan', color: '#A2845E' },
  EM: { name: 'Emerging', color: '#34C759' },
  asia: { name: 'Asia', color: '#A2845E' },
  europe: { name: 'Europe', color: '#30B0C7' },
  'north-america': { name: 'North America', color: '#5E5CE6' },
  'north america': { name: 'North America', color: '#5E5CE6' },
  'united states': { name: 'United States', color: '#5E5CE6' },
  switzerland: { name: 'Switzerland', color: '#0071E3' },
  'united kingdom': { name: 'United Kingdom', color: '#AF52DE' },
  japan: { name: 'Japan', color: '#A2845E' },
  emerging: { name: 'Emerging', color: '#34C759' },
  global: { name: 'Global', color: '#AF52DE' },
  other: { name: 'Other', color: '#8E8E93' },
}

export const SECTOR_COLORS: Record<string, { name: string; color: string }> = {
  technology: { name: 'Technology', color: '#AF52DE' },
  healthcare: { name: 'Healthcare', color: '#34C759' },
  financials: { name: 'Financials', color: '#5E5CE6' },
  financial: { name: 'Financials', color: '#5E5CE6' },
  consumer: { name: 'Consumer', color: '#30B0C7' },
  'consumer cyclical': { name: 'Consumer', color: '#30B0C7' },
  'consumer defensive': { name: 'Consumer', color: '#A2845E' },
  industrials: { name: 'Industrials', color: '#A2845E' },
  energy: { name: 'Energy', color: '#8E8E93' },
  crypto: { name: 'Crypto', color: '#0071E3' },
  bonds: { name: 'Bonds', color: '#5AC8FA' },
  cash: { name: 'Cash', color: '#34C759' },
  'real estate': { name: 'Real estate', color: '#A2845E' },
  communication: { name: 'Communication', color: '#0071E3' },
  'communication services': { name: 'Communication', color: '#0071E3' },
  utilities: { name: 'Utilities', color: '#5E5CE6' },
  materials: { name: 'Materials', color: '#A2845E' },
  other: { name: 'Other', color: '#8E8E93' },
}

export function classOf(raw?: string | null): AssetClass {
  if (!raw) return CLASS_BY_KEY.other
  return CLASS_BY_KEY[raw.toLowerCase()] ?? CLASS_BY_KEY.other
}

export function paletteColor(
  key: string,
  table: Record<string, { name: string; color: string }>,
  fallbackIndex = 0,
): { name: string; color: string } {
  const hit = table[key] || table[key.toLowerCase()]
  if (hit) return hit
  const colors = Object.values(table)
  return {
    name: key,
    color: colors[fallbackIndex % colors.length]?.color ?? MUTED,
  }
}

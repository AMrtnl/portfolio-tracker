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
  { id: 'funds', name: 'Funds', color: 'var(--wh-c-cash)', keys: ['fund'] },
  { id: 'cash', name: 'Cash', color: 'var(--wh-c-cash)', keys: ['cash'] },
  { id: 'bonds', name: 'Bonds', color: 'var(--wh-olive)', keys: ['bond'] },
  { id: 'crypto', name: 'Crypto', color: 'var(--wh-c-crypto)', keys: ['crypto'] },
  { id: 'other', name: 'Other', color: 'var(--wh-faint)', keys: ['other', 'unclassified'] },
]

export const CLASS_BY_KEY: Record<string, AssetClass> = {}
for (const c of CLASSES) {
  CLASS_BY_KEY[c.id] = c
  for (const k of c.keys) CLASS_BY_KEY[k] = c
}

export const GEO_COLORS: Record<string, { name: string; color: string }> = {
  CH: { name: 'Switzerland', color: '#1F3FD0' },
  US: { name: 'United States', color: '#4F6B3A' },
  EU: { name: 'Europe', color: '#9DB6F5' },
  UK: { name: 'United Kingdom', color: '#E2B23C' },
  JP: { name: 'Japan', color: '#8A5F0A' },
  EM: { name: 'Emerging', color: '#157A52' },
  asia: { name: 'Asia', color: '#8A5F0A' },
  europe: { name: 'Europe', color: '#9DB6F5' },
  'north-america': { name: 'North America', color: '#4F6B3A' },
  'north america': { name: 'North America', color: '#4F6B3A' },
  'united states': { name: 'United States', color: '#4F6B3A' },
  switzerland: { name: 'Switzerland', color: '#1F3FD0' },
  'united kingdom': { name: 'United Kingdom', color: '#E2B23C' },
  japan: { name: 'Japan', color: '#8A5F0A' },
  emerging: { name: 'Emerging', color: '#157A52' },
  global: { name: 'Global', color: '#E2B23C' },
  other: { name: 'Other', color: '#9A9DB0' },
}

export const SECTOR_COLORS: Record<string, { name: string; color: string }> = {
  technology: { name: 'Technology', color: '#E2B23C' },
  healthcare: { name: 'Healthcare', color: '#157A52' },
  financials: { name: 'Financials', color: '#4F6B3A' },
  financial: { name: 'Financials', color: '#4F6B3A' },
  consumer: { name: 'Consumer', color: '#9DB6F5' },
  'consumer cyclical': { name: 'Consumer', color: '#9DB6F5' },
  'consumer defensive': { name: 'Consumer', color: '#8A5F0A' },
  industrials: { name: 'Industrials', color: '#8A5F0A' },
  energy: { name: 'Energy', color: '#9A9DB0' },
  crypto: { name: 'Crypto', color: '#1F3FD0' },
  bonds: { name: 'Bonds', color: '#9DB6F5' },
  cash: { name: 'Cash', color: '#157A52' },
  'real estate': { name: 'Real estate', color: '#8A5F0A' },
  communication: { name: 'Communication', color: '#1F3FD0' },
  'communication services': { name: 'Communication', color: '#1F3FD0' },
  utilities: { name: 'Utilities', color: '#4F6B3A' },
  materials: { name: 'Materials', color: '#8A5F0A' },
  other: { name: 'Other', color: '#9A9DB0' },
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

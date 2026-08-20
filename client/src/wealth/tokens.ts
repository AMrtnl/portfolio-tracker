export const GAIN = '#30D158'
export const LOSS = '#FF453A'
export const TINT = '#0A84FF'
export const MUTED = '#8E8E93'

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
  { id: 'estate', name: 'Real estate', color: '#FF5C48', keys: ['real_estate', 'estate'] },
  { id: 'pension', name: 'Pension', color: '#FF9F45', keys: ['pension'] },
  { id: 'stocks', name: 'Stocks', color: '#FFD84D', keys: ['equity', 'etf'] },
  { id: 'funds', name: 'Funds', color: '#FF9F45', keys: ['fund'] },
  { id: 'cash', name: 'Cash', color: '#4BD57E', keys: ['cash'] },
  { id: 'bonds', name: 'Bonds', color: '#3ABEFF', keys: ['bond'] },
  { id: 'crypto', name: 'Crypto', color: '#A57BFF', keys: ['crypto'] },
  { id: 'other', name: 'Other', color: '#8E8E93', keys: ['other', 'unclassified'] },
]

export const CLASS_BY_KEY: Record<string, AssetClass> = {}
for (const c of CLASSES) {
  CLASS_BY_KEY[c.id] = c
  for (const k of c.keys) CLASS_BY_KEY[k] = c
}

export const GEO_COLORS: Record<string, { name: string; color: string }> = {
  CH: { name: 'Switzerland', color: '#FF5C48' },
  US: { name: 'United States', color: '#3ABEFF' },
  EU: { name: 'Europe', color: '#FFD84D' },
  UK: { name: 'United Kingdom', color: '#A57BFF' },
  JP: { name: 'Japan', color: '#FF9F45' },
  EM: { name: 'Emerging', color: '#4BD57E' },
  asia: { name: 'Asia', color: '#FF9F45' },
  europe: { name: 'Europe', color: '#FFD84D' },
  'north-america': { name: 'North America', color: '#3ABEFF' },
  'north america': { name: 'North America', color: '#3ABEFF' },
  'united states': { name: 'United States', color: '#3ABEFF' },
  switzerland: { name: 'Switzerland', color: '#FF5C48' },
  'united kingdom': { name: 'United Kingdom', color: '#A57BFF' },
  japan: { name: 'Japan', color: '#FF9F45' },
  emerging: { name: 'Emerging', color: '#4BD57E' },
  global: { name: 'Global', color: '#A57BFF' },
  other: { name: 'Other', color: '#8E8E93' },
}

export const SECTOR_COLORS: Record<string, { name: string; color: string }> = {
  technology: { name: 'Technology', color: '#A57BFF' },
  healthcare: { name: 'Healthcare', color: '#4BD57E' },
  financials: { name: 'Financials', color: '#3ABEFF' },
  financial: { name: 'Financials', color: '#3ABEFF' },
  consumer: { name: 'Consumer', color: '#FFD84D' },
  'consumer cyclical': { name: 'Consumer', color: '#FFD84D' },
  'consumer defensive': { name: 'Consumer', color: '#FF9F45' },
  industrials: { name: 'Industrials', color: '#FF9F45' },
  energy: { name: 'Energy', color: '#7D7D82' },
  crypto: { name: 'Crypto', color: '#FF5C48' },
  bonds: { name: 'Bonds', color: '#5AC8FA' },
  cash: { name: 'Cash', color: '#34C759' },
  'real estate': { name: 'Real estate', color: '#FF6B4A' },
  communication: { name: 'Communication', color: '#FF5C48' },
  'communication services': { name: 'Communication', color: '#FF5C48' },
  utilities: { name: 'Utilities', color: '#3ABEFF' },
  materials: { name: 'Materials', color: '#FF9F45' },
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

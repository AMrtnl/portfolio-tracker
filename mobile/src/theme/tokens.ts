/**
 * Wealth design tokens — shared with the web client (black canvas, iOS tint).
 */

export const color = {
  background: '#000000',
  surface: 'rgba(28,28,30,0.72)',
  surfaceSolid: '#1C1C1E',
  foreground: '#FFFFFF',
  ink: '#FFFFFF',
  primary: '#0A84FF',
  primaryForeground: '#FFFFFF',
  muted: 'rgba(118,118,128,0.24)',
  mutedForeground: 'rgba(235,235,245,0.55)',
  accent: 'rgba(118,118,128,0.18)',
  haze: 'rgba(28,28,30,0.9)',
  border: 'rgba(255,255,255,0.08)',
  gain: '#30D158',
  loss: '#FF453A',
  gainSoft: 'rgba(48,209,88,0.16)',
  lossSoft: 'rgba(255,69,58,0.16)',
  warn: '#FF9F45',
  warnSoft: 'rgba(255,159,69,0.16)',
} as const;

export const chartPalette = [
  '#FF5C48',
  '#FF9F45',
  '#FFD84D',
  '#4BD57E',
  '#3ABEFF',
  '#A57BFF',
] as const;

export function chartColor(index: number): string {
  return chartPalette[index % chartPalette.length];
}

export const CLASSES = [
  { id: 'estate', name: 'Real estate', color: '#FF5C48' },
  { id: 'pension', name: 'Pension', color: '#FF9F45' },
  { id: 'stocks', name: 'Stocks', color: '#FFD84D' },
  { id: 'funds', name: 'Funds', color: '#FF9F45' },
  { id: 'cash', name: 'Cash', color: '#4BD57E' },
  { id: 'bonds', name: 'Bonds', color: '#3ABEFF' },
  { id: 'crypto', name: 'Crypto', color: '#A57BFF' },
  { id: 'other', name: 'Other', color: '#8E8E93' },
] as const;

export type AssetClassId = (typeof CLASSES)[number]['id'];

/** Subtle dark wash — no light paper blooms. */
export const atmosphere = {
  wash: ['#000000', '#0A0A0C', '#000000'] as const,
  teal: ['rgba(10,132,255,0.16)', 'rgba(10,132,255,0.04)', 'rgba(10,132,255,0)'] as const,
  sky: ['rgba(165,123,255,0.12)', 'rgba(165,123,255,0.03)', 'rgba(165,123,255,0)'] as const,
  sage: ['rgba(48,209,88,0)', 'rgba(48,209,88,0.04)', 'rgba(48,209,88,0.08)'] as const,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'SourceSans3_400Regular',
  bodyMedium: 'SourceSans3_500Medium',
  bodySemi: 'SourceSans3_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const overline = {
  fontFamily: font.bodySemi,
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  color: color.mutedForeground,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

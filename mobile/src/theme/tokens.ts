/**
 * Meridian design tokens, converted from the HSL custom properties in
 * `client/src/index.css` so web and iOS stay visually identical.
 */

export const color = {
  background: '#F6F9F7', // 150 18% 97%
  surface: '#FFFFFF',
  foreground: '#11221E', // 168 32% 10%
  ink: '#0C1D19', // 168 40% 8%
  primary: '#0D6D63', // 174 78% 24%
  primaryForeground: '#F7FCFA',
  muted: '#EBF0EE', // 155 14% 93%
  mutedForeground: '#5C706B', // 165 10% 40%
  accent: '#E0EBE8', // 162 22% 90%
  haze: '#EBF4F0', // 155 28% 94%
  border: '#D7E0DD', // 160 12% 86%
  gain: '#178C61', // 158 72% 32%
  loss: '#D32E22', // 4 72% 48%
  gainSoft: 'rgba(23, 140, 97, 0.10)',
  lossSoft: 'rgba(211, 46, 34, 0.10)',
  warn: '#D09D25',
  warnSoft: 'rgba(208, 157, 37, 0.12)',
} as const;

/** Matches --chart-1..5 and drives allocation slices. */
export const chartPalette = [
  '#188B7F',
  '#3083A6',
  '#D09D25',
  '#B1437A',
  '#685AAF',
] as const;

export function chartColor(index: number): string {
  return chartPalette[index % chartPalette.length];
}

/**
 * The web app paints three radial blooms over a linear wash. Native has no
 * radial gradient primitive in expo-linear-gradient, so the atmosphere is
 * rebuilt from stacked linear gradients using the same stop colours.
 *
 * Every bloom fades to a zero-alpha copy of its own colour rather than to
 * `transparent`: iOS interpolates `transparent` as transparent *black*, which
 * greys out the midpoint and leaves visible rectangles.
 */
export const atmosphere = {
  wash: ['#F6F9F8', '#EDF2F1', '#F3F6F5'] as const,
  // 174 50% 68% — teal bloom, top-left
  teal: ['rgba(133, 214, 206, 0.42)', 'rgba(133, 214, 206, 0.12)', 'rgba(133, 214, 206, 0)'] as const,
  // 198 48% 74% — sky bloom, top-right
  sky: ['rgba(157, 201, 221, 0.35)', 'rgba(157, 201, 221, 0.10)', 'rgba(157, 201, 221, 0)'] as const,
  // 155 35% 82% — sage bloom lifting the lower third
  sage: ['rgba(193, 225, 212, 0)', 'rgba(193, 225, 212, 0.18)', 'rgba(193, 225, 212, 0.5)'] as const,
} as const;

/** 4pt scale. */
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
  sm: 6,
  md: 10, // --radius: 0.625rem
  lg: 14,
  xl: 20,
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

/** Uppercase micro-label used for every section heading in the web app. */
export const overline = {
  fontFamily: font.bodySemi,
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: color.mutedForeground,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0C1D19',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;

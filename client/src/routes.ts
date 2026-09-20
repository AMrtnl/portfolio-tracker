/** Every path in one place. The product lives under /app; everything else is public. */
export const APP = '/app'

export const R = {
  // Product
  overview: '/app',
  holdings: '/app/holdings',
  holding: (symbol: string) => `/app/holdings/${encodeURIComponent(symbol)}`,
  exposure: '/app/exposure',
  cashflow: '/app/cashflow',
  subscriptions: '/app/subscriptions',
  grow: '/app/grow',
  growItem: (id: string) => `/app/grow/${id}`,
  performance: '/app/performance',
  activity: '/app/activity',
  planning: '/app/planning',
  connect: '/app/connect',
  settings: '/app/settings',
  welcome: '/app/welcome',
  // Public
  home: '/',
  pricing: '/pricing',
  security: '/security',
  login: '/login',
  signup: '/signup',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
} as const

/** Where to send someone after they sign in: the page they wanted, or the overview. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/app') || next.startsWith('//')) return R.overview
  return next
}

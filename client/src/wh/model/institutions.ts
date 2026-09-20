import type { ClassId } from '@/wh/Token'

/** How a source gets connected. Each method is one form. */
export type Method =
  | 'broker' // through the SnapTrade portal, read-only
  | 'wallet' // a public key or address, read-only
  | 'balance' // a figure you keep by hand
  | 'holdings' // positions you type in
  | 'exchange' // an exchange account through the SnapTrade portal

export type InstitutionKind = 'bank' | 'broker' | 'pension' | 'wallet' | 'exchange' | 'property' | 'loan' | 'other'

export interface Institution {
  id: string
  name: string
  /** For the token and the logo service. */
  domain?: string
  kind: InstitutionKind
  classId: ClassId
  method: Method
  /** Where it is common: shown as a small hint. */
  region: string
  /** SnapTrade's slug when the portal can open straight to it. */
  brokerSlug?: string
  /** A short note about what connecting means for this one. */
  note?: string
  /** Search helpers. */
  aliases?: string[]
}

export const METHOD_LABEL: Record<Method, { title: string; sub: string; ro: boolean }> = {
  broker: { title: 'Broker link', sub: 'Read-only, through SnapTrade. Sign in on their page; we never see your password.', ro: true },
  exchange: { title: 'Exchange link', sub: 'Read-only API access through SnapTrade. No trading permission is granted.', ro: true },
  wallet: { title: 'Public key', sub: 'Paste an address or an xpub. Nothing that can sign ever leaves your device.', ro: true },
  balance: { title: 'Balance by hand', sub: 'Enter the figure. We remind you when it looks old.', ro: false },
  holdings: { title: 'Positions by hand', sub: 'Tickers, quantities and prices you keep yourself.', ro: false },
}

/**
 * The catalogue people search. Coverage is honest: Swiss retail banks are
 * not in any aggregator yet, so they connect by hand, with a reminder.
 */
export const INSTITUTIONS: Institution[] = [
  // Brokers with a portal
  { id: 'ibkr', name: 'Interactive Brokers', domain: 'interactivebrokers.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'Worldwide', brokerSlug: 'INTERACTIVE_BROKERS', aliases: ['ibkr', 'ib'] },
  { id: 'schwab', name: 'Charles Schwab', domain: 'schwab.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'US', brokerSlug: 'SCHWAB' },
  { id: 'fidelity', name: 'Fidelity', domain: 'fidelity.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'US', brokerSlug: 'FIDELITY' },
  { id: 'vanguard', name: 'Vanguard', domain: 'vanguard.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'US, UK', brokerSlug: 'VANGUARD' },
  { id: 'robinhood', name: 'Robinhood', domain: 'robinhood.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'US', brokerSlug: 'ROBINHOOD' },
  { id: 'etrade', name: 'E*TRADE', domain: 'etrade.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'US', brokerSlug: 'ETRADE' },
  { id: 'trading212', name: 'Trading 212', domain: 'trading212.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'UK, EU', brokerSlug: 'TRADING212' },
  { id: 'degiro', name: 'DEGIRO', domain: 'degiro.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'EU, CH', brokerSlug: 'DEGIRO' },
  { id: 'questrade', name: 'Questrade', domain: 'questrade.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'Canada', brokerSlug: 'QUESTRADE' },
  { id: 'wealthsimple', name: 'Wealthsimple', domain: 'wealthsimple.com', kind: 'broker', classId: 'broker', method: 'broker', region: 'Canada', brokerSlug: 'WEALTHSIMPLE' },
  { id: 'swissquote', name: 'Swissquote', domain: 'swissquote.ch', kind: 'broker', classId: 'broker', method: 'holdings', region: 'Switzerland', note: 'No API access for private clients yet. Keep the positions by hand, or paste the CSV export.' },
  { id: 'saxo', name: 'Saxo', domain: 'home.saxo', kind: 'broker', classId: 'broker', method: 'holdings', region: 'EU, CH', note: 'Not in the portal yet. Keep positions by hand.' },

  // Exchanges with a portal
  { id: 'coinbase', name: 'Coinbase', domain: 'coinbase.com', kind: 'exchange', classId: 'exchange', method: 'exchange', region: 'Worldwide', brokerSlug: 'COINBASE' },
  { id: 'kraken', name: 'Kraken', domain: 'kraken.com', kind: 'exchange', classId: 'exchange', method: 'exchange', region: 'Worldwide', brokerSlug: 'KRAKEN' },
  { id: 'binance', name: 'Binance', domain: 'binance.com', kind: 'exchange', classId: 'exchange', method: 'exchange', region: 'Worldwide', brokerSlug: 'BINANCE' },

  // Wallets
  { id: 'ledger', name: 'Ledger', domain: 'ledger.com', kind: 'wallet', classId: 'wallet', method: 'wallet', region: 'Hardware', aliases: ['nano', 'hardware'] },
  { id: 'trezor', name: 'Trezor', domain: 'trezor.io', kind: 'wallet', classId: 'wallet', method: 'wallet', region: 'Hardware' },
  { id: 'bitcoin', name: 'Bitcoin address or xpub', kind: 'wallet', classId: 'bitcoin', method: 'wallet', region: 'On-chain', aliases: ['btc', 'xpub', 'zpub'] },
  { id: 'ethereum', name: 'Ethereum address', kind: 'wallet', classId: 'crypto', method: 'wallet', region: 'On-chain', aliases: ['eth', 'metamask', 'rabby'] },
  { id: 'solana', name: 'Solana address', kind: 'wallet', classId: 'crypto', method: 'wallet', region: 'On-chain', aliases: ['sol', 'phantom'] },

  // Swiss and European banks: by hand for now
  { id: 'ubs', name: 'UBS', domain: 'ubs.com', kind: 'bank', classId: 'bank', method: 'balance', region: 'Switzerland', note: 'Swiss banks are not in any aggregator yet. Enter the balance; we remind you monthly.' },
  { id: 'zkb', name: 'Zürcher Kantonalbank', domain: 'zkb.ch', kind: 'bank', classId: 'bank', method: 'balance', region: 'Switzerland', aliases: ['zkb'] },
  { id: 'postfinance', name: 'PostFinance', domain: 'postfinance.ch', kind: 'bank', classId: 'bank', method: 'balance', region: 'Switzerland' },
  { id: 'raiffeisen', name: 'Raiffeisen', domain: 'raiffeisen.ch', kind: 'bank', classId: 'bank', method: 'balance', region: 'Switzerland' },
  { id: 'migrosbank', name: 'Migros Bank', domain: 'migrosbank.ch', kind: 'bank', classId: 'bank', method: 'balance', region: 'Switzerland' },
  { id: 'neon', name: 'neon', domain: 'neon-free.ch', kind: 'bank', classId: 'bank', method: 'balance', region: 'Switzerland' },
  { id: 'yuh', name: 'Yuh', domain: 'yuh.com', kind: 'bank', classId: 'bank', method: 'balance', region: 'Switzerland' },
  { id: 'revolut', name: 'Revolut', domain: 'revolut.com', kind: 'bank', classId: 'bank', method: 'balance', region: 'EU, UK, CH' },
  { id: 'wise', name: 'Wise', domain: 'wise.com', kind: 'bank', classId: 'bank', method: 'balance', region: 'Worldwide' },
  { id: 'n26', name: 'N26', domain: 'n26.com', kind: 'bank', classId: 'bank', method: 'balance', region: 'EU' },
  { id: 'bank-other', name: 'Another bank', kind: 'bank', classId: 'bank', method: 'balance', region: 'Any', aliases: ['bank', 'savings', 'current account'] },

  // Pensions
  { id: 'viac', name: 'VIAC', domain: 'viac.ch', kind: 'pension', classId: 'pension', method: 'balance', region: 'Switzerland', aliases: ['3a', 'pillar'] },
  { id: 'finpension', name: 'finpension', domain: 'finpension.ch', kind: 'pension', classId: 'pension', method: 'balance', region: 'Switzerland', aliases: ['3a', 'pillar'] },
  { id: 'frankly', name: 'frankly', domain: 'frankly.ch', kind: 'pension', classId: 'pension', method: 'balance', region: 'Switzerland', aliases: ['3a'] },
  { id: 'pillar2', name: 'Pension fund (2nd pillar)', kind: 'pension', classId: 'pension', method: 'balance', region: 'Switzerland', aliases: ['bvg', 'lpp', 'pensionskasse', 'pillar 2'] },
  { id: 'pension-other', name: 'Another pension', kind: 'pension', classId: 'pension', method: 'balance', region: 'Any', aliases: ['401k', 'ira', 'isa', 'sipp', 'retirement'] },

  // Property and debts
  { id: 'property', name: 'Property', kind: 'property', classId: 'property', method: 'balance', region: 'By hand', aliases: ['home', 'apartment', 'house', 'flat', 'real estate'] },
  { id: 'mortgage', name: 'Mortgage', kind: 'loan', classId: 'mortgage', method: 'balance', region: 'By hand', aliases: ['hypothek', 'hypothèque', 'loan'] },
  { id: 'loan', name: 'Loan or credit card', kind: 'loan', classId: 'loan', method: 'balance', region: 'By hand', aliases: ['car', 'credit', 'debt', 'leasing'] },
  { id: 'holdings', name: 'Positions by hand', kind: 'other', classId: 'equities', method: 'holdings', region: 'Any broker', aliases: ['manual', 'stocks', 'etf', 'csv'] },
]

const KIND_ORDER: InstitutionKind[] = ['broker', 'exchange', 'wallet', 'bank', 'pension', 'property', 'loan', 'other']

export const KIND_LABEL: Record<InstitutionKind, string> = {
  broker: 'Brokers',
  exchange: 'Exchanges',
  wallet: 'Wallets',
  bank: 'Banks',
  pension: 'Pensions',
  property: 'Property',
  loan: 'Debts',
  other: 'By hand',
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Search by name, alias or kind; empty query lists the popular ones first. */
export function searchInstitutions(query: string): Institution[] {
  const q = norm(query.trim())
  if (!q) return INSTITUTIONS
  return INSTITUTIONS.filter((i) => {
    const hay = [i.name, i.region, KIND_LABEL[i.kind], ...(i.aliases ?? [])].map(norm)
    return hay.some((h) => h.includes(q))
  }).sort((a, b) => {
    const as = norm(a.name).startsWith(q) ? 0 : 1
    const bs = norm(b.name).startsWith(q) ? 0 : 1
    return as - bs
  })
}

export function groupByKind(list: Institution[]): Array<{ kind: InstitutionKind; items: Institution[] }> {
  return KIND_ORDER.map((kind) => ({ kind, items: list.filter((i) => i.kind === kind) })).filter((g) => g.items.length > 0)
}

/** The ones on the first screen before anyone types. */
export const FEATURED_IDS = ['ibkr', 'ledger', 'ubs', 'revolut', 'coinbase', 'viac', 'property', 'mortgage']

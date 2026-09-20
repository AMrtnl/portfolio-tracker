/**
 * The curated institution list: what people search for before any aggregator
 * is asked. Every entry carries a default connector; build.ts upgrades an
 * entry to a live link when SnapTrade or GoCardless turns out to list it.
 * Coverage notes are honest: a Swiss retail bank is by hand until it is not.
 */

export type CatalogCategory =
  | 'banks'
  | 'brokers'
  | 'exchanges'
  | 'wallets'
  | 'pensions'
  | 'property'
  | 'debts';

export type ConnectMethod = 'link' | 'key' | 'manual';
export type ConnectorId = 'snaptrade' | 'gocardless' | 'watch' | 'manual';
export type ManualKind = 'bank' | 'broker' | 'pension' | 'property' | 'loan' | 'holdings';

export interface CuratedInstitution {
  /** Stable suffix of the public id: `curated:<key>`. */
  key: string;
  name: string;
  domain?: string;
  /** ISO alpha-2; empty means worldwide. */
  countries: string[];
  category: CatalogCategory;
  connector: ConnectorId;
  /** SnapTrade brokerage slug, verified against the live list when configured. */
  ref?: string;
  manualKind?: ManualKind;
  note?: string;
  /** Other names the aggregators use for the same institution. */
  aliases?: string[];
}

export const CATEGORY_META: Record<CatalogCategory, { name: string; description: string }> = {
  banks: {
    name: 'Banks',
    description:
      'Current and savings accounts, linked through open banking where a bank allows it, otherwise a balance kept by hand.',
  },
  brokers: {
    name: 'Brokers',
    description: 'Stock and fund accounts, linked read-only through SnapTrade or kept as positions by hand.',
  },
  exchanges: {
    name: 'Exchanges',
    description: 'Crypto exchange accounts, linked read-only; no trading permission is ever granted.',
  },
  wallets: {
    name: 'Wallets',
    description: 'On-chain balances read from a public key or address; nothing that can sign is stored.',
  },
  pensions: {
    name: 'Pensions',
    description: 'Pillar 3a, pension funds and retirement accounts, kept by hand with a reminder.',
  },
  property: {
    name: 'Property',
    description: 'Homes and land at the value you set.',
  },
  debts: {
    name: 'Debts',
    description: 'Mortgages, loans and cards, entered as what is owed.',
  },
};

export const CATEGORY_ORDER: CatalogCategory[] = [
  'banks',
  'brokers',
  'exchanges',
  'wallets',
  'pensions',
  'property',
  'debts',
];

export const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'CH', name: 'Switzerland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'AT', name: 'Austria' },
];

const SWISS_BANK_NOTE = 'Not in any aggregator yet; kept by hand with a monthly reminder.';
const EU_BANK_NOTE = 'Links through open banking when GoCardless is configured on this server; otherwise kept by hand.';
const BY_HAND_BROKER = 'No API for private clients; keep the positions by hand or paste the CSV export.';
const EU_CORE = ['DE', 'FR', 'IT', 'ES', 'AT', 'NL'];

export const CURATED: CuratedInstitution[] = [
  // ---- banks: Switzerland ----
  { key: 'ubs', name: 'UBS', domain: 'ubs.com', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: SWISS_BANK_NOTE, aliases: ['ubs switzerland', 'ubs switzerland ag'] },
  { key: 'zkb', name: 'Zürcher Kantonalbank', domain: 'zkb.ch', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: SWISS_BANK_NOTE, aliases: ['zkb', 'zuercher kantonalbank', 'zurcher kantonalbank'] },
  { key: 'postfinance', name: 'PostFinance', domain: 'postfinance.ch', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: SWISS_BANK_NOTE },
  { key: 'raiffeisen', name: 'Raiffeisen', domain: 'raiffeisen.ch', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: SWISS_BANK_NOTE, aliases: ['raiffeisen schweiz', 'raiffeisen switzerland'] },
  { key: 'migrosbank', name: 'Migros Bank', domain: 'migrosbank.ch', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: SWISS_BANK_NOTE },
  { key: 'neon', name: 'neon', domain: 'neon-free.ch', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: SWISS_BANK_NOTE },
  { key: 'yuh', name: 'Yuh', domain: 'yuh.com', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: SWISS_BANK_NOTE },
  { key: 'creditsuisse', name: 'Credit Suisse', domain: 'credit-suisse.com', countries: ['CH'], category: 'banks', connector: 'manual', manualKind: 'bank', note: 'Now part of UBS; kept by hand with a monthly reminder.', aliases: ['credit suisse (schweiz) ag', 'credit suisse schweiz'] },

  // ---- banks: Europe and the UK ----
  { key: 'n26', name: 'N26', domain: 'n26.com', countries: EU_CORE, category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['n26 bank'] },
  { key: 'revolut', name: 'Revolut', domain: 'revolut.com', countries: ['CH', 'GB', ...EU_CORE], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['revolut ltd', 'revolut bank'] },
  { key: 'wise', name: 'Wise', domain: 'wise.com', countries: [], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['transferwise'] },
  { key: 'deutschebank', name: 'Deutsche Bank', domain: 'db.com', countries: ['DE'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'commerzbank', name: 'Commerzbank', domain: 'commerzbank.de', countries: ['DE'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'ing', name: 'ING', domain: 'ing.com', countries: ['DE', 'NL', 'ES', 'IT', 'AT', 'FR'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['ing-diba', 'ing diba', 'ing bank'] },
  { key: 'bnpparibas', name: 'BNP Paribas', domain: 'bnpparibas.com', countries: ['FR'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'societegenerale', name: 'Société Générale', domain: 'societegenerale.com', countries: ['FR'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['sg'] },
  { key: 'creditagricole', name: 'Crédit Agricole', domain: 'credit-agricole.fr', countries: ['FR'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'boursorama', name: 'Boursorama', domain: 'boursorama.com', countries: ['FR'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['boursobank', 'boursorama banque'] },
  { key: 'barclays', name: 'Barclays', domain: 'barclays.co.uk', countries: ['GB'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['barclays personal', 'barclays uk'] },
  { key: 'hsbc', name: 'HSBC', domain: 'hsbc.com', countries: ['GB', 'FR'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['hsbc personal', 'hsbc uk'] },
  { key: 'lloyds', name: 'Lloyds', domain: 'lloydsbank.com', countries: ['GB'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['lloyds bank', 'lloyds bank personal', 'lloyds personal'] },
  { key: 'monzo', name: 'Monzo', domain: 'monzo.com', countries: ['GB'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'starling', name: 'Starling', domain: 'starlingbank.com', countries: ['GB'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE, aliases: ['starling bank'] },
  { key: 'abnamro', name: 'ABN AMRO', domain: 'abnamro.nl', countries: ['NL'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'rabobank', name: 'Rabobank', domain: 'rabobank.nl', countries: ['NL'], category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'bunq', name: 'bunq', domain: 'bunq.com', countries: EU_CORE, category: 'banks', connector: 'manual', manualKind: 'bank', note: EU_BANK_NOTE },
  { key: 'bank-other', name: 'Another bank', countries: [], category: 'banks', connector: 'manual', manualKind: 'bank', note: 'Any bank, as a balance you keep by hand with a monthly reminder.' },

  // ---- brokers ----
  { key: 'ibkr', name: 'Interactive Brokers', domain: 'interactivebrokers.com', countries: [], category: 'brokers', connector: 'snaptrade', ref: 'INTERACTIVE_BROKERS', aliases: ['ibkr', 'ib'] },
  { key: 'swissquote', name: 'Swissquote', domain: 'swissquote.ch', countries: ['CH'], category: 'brokers', connector: 'manual', manualKind: 'holdings', note: BY_HAND_BROKER },
  { key: 'saxo', name: 'Saxo', domain: 'home.saxo', countries: ['CH', 'GB', 'NL', 'FR', 'DE', 'IT', 'ES'], category: 'brokers', connector: 'manual', manualKind: 'holdings', note: 'Not in the portal yet; keep the positions by hand.', aliases: ['saxo bank'] },
  { key: 'degiro', name: 'DEGIRO', domain: 'degiro.com', countries: ['CH', 'GB', ...EU_CORE], category: 'brokers', connector: 'snaptrade', ref: 'DEGIRO' },
  { key: 'traderepublic', name: 'Trade Republic', domain: 'traderepublic.com', countries: EU_CORE, category: 'brokers', connector: 'manual', manualKind: 'holdings', note: BY_HAND_BROKER },
  { key: 'scalable', name: 'Scalable Capital', domain: 'scalable.capital', countries: EU_CORE, category: 'brokers', connector: 'manual', manualKind: 'holdings', note: BY_HAND_BROKER },
  { key: 'trading212', name: 'Trading 212', domain: 'trading212.com', countries: ['CH', 'GB', ...EU_CORE], category: 'brokers', connector: 'snaptrade', ref: 'TRADING212', aliases: ['trading212'] },
  { key: 'schwab', name: 'Charles Schwab', domain: 'schwab.com', countries: ['US'], category: 'brokers', connector: 'snaptrade', ref: 'SCHWAB', aliases: ['schwab'] },
  { key: 'fidelity', name: 'Fidelity', domain: 'fidelity.com', countries: ['US'], category: 'brokers', connector: 'snaptrade', ref: 'FIDELITY', aliases: ['fidelity investments'] },
  { key: 'vanguard', name: 'Vanguard', domain: 'vanguard.com', countries: ['US', 'GB'], category: 'brokers', connector: 'snaptrade', ref: 'VANGUARD' },
  { key: 'robinhood', name: 'Robinhood', domain: 'robinhood.com', countries: ['US'], category: 'brokers', connector: 'snaptrade', ref: 'ROBINHOOD' },
  { key: 'etrade', name: 'E*TRADE', domain: 'etrade.com', countries: ['US'], category: 'brokers', connector: 'snaptrade', ref: 'ETRADE', aliases: ['etrade', 'e-trade'] },
  { key: 'questrade', name: 'Questrade', domain: 'questrade.com', countries: ['CA'], category: 'brokers', connector: 'snaptrade', ref: 'QUESTRADE' },
  { key: 'wealthsimple', name: 'Wealthsimple', domain: 'wealthsimple.com', countries: ['CA'], category: 'brokers', connector: 'snaptrade', ref: 'WEALTHSIMPLE' },
  { key: 'hl', name: 'Hargreaves Lansdown', domain: 'hl.co.uk', countries: ['GB'], category: 'brokers', connector: 'manual', manualKind: 'holdings', note: BY_HAND_BROKER, aliases: ['hl'] },
  { key: 'freetrade', name: 'Freetrade', domain: 'freetrade.io', countries: ['GB'], category: 'brokers', connector: 'manual', manualKind: 'holdings', note: BY_HAND_BROKER },
  { key: 'holdings', name: 'Positions by hand', countries: [], category: 'brokers', connector: 'manual', manualKind: 'holdings', note: 'Any broker: tickers, quantities and prices you keep yourself.' },

  // ---- exchanges ----
  { key: 'coinbase', name: 'Coinbase', domain: 'coinbase.com', countries: [], category: 'exchanges', connector: 'snaptrade', ref: 'COINBASE' },
  { key: 'kraken', name: 'Kraken', domain: 'kraken.com', countries: [], category: 'exchanges', connector: 'snaptrade', ref: 'KRAKEN' },
  { key: 'binance', name: 'Binance', domain: 'binance.com', countries: [], category: 'exchanges', connector: 'snaptrade', ref: 'BINANCE' },
  { key: 'bitstamp', name: 'Bitstamp', domain: 'bitstamp.net', countries: [], category: 'exchanges', connector: 'manual', manualKind: 'holdings', note: 'Not in the portal yet; keep the balances by hand.' },
  { key: 'swissborg', name: 'Swissborg', domain: 'swissborg.com', countries: ['CH', 'GB', ...EU_CORE], category: 'exchanges', connector: 'manual', manualKind: 'holdings', note: 'Not in the portal yet; keep the balances by hand.' },

  // ---- wallets ----
  { key: 'ledger', name: 'Ledger', domain: 'ledger.com', countries: [], category: 'wallets', connector: 'watch', note: 'Export the account xpub from Ledger Live; nothing that can sign leaves the device.' },
  { key: 'trezor', name: 'Trezor', domain: 'trezor.io', countries: [], category: 'wallets', connector: 'watch', note: 'Paste the account xpub from Trezor Suite.' },
  { key: 'bitcoin', name: 'Bitcoin address or xpub', countries: [], category: 'wallets', connector: 'watch', aliases: ['btc', 'xpub', 'zpub'] },
  { key: 'ethereum', name: 'Ethereum address', countries: [], category: 'wallets', connector: 'watch', aliases: ['eth', 'metamask'] },
  { key: 'solana', name: 'Solana address', countries: [], category: 'wallets', connector: 'watch', aliases: ['sol', 'phantom'] },

  // ---- pensions ----
  { key: 'viac', name: 'VIAC', domain: 'viac.ch', countries: ['CH'], category: 'pensions', connector: 'manual', manualKind: 'pension', note: 'Pillar 3a; no API, kept by hand with a monthly reminder.' },
  { key: 'finpension', name: 'finpension', domain: 'finpension.ch', countries: ['CH'], category: 'pensions', connector: 'manual', manualKind: 'pension', note: 'Pillar 3a; no API, kept by hand with a monthly reminder.' },
  { key: 'frankly', name: 'frankly', domain: 'frankly.ch', countries: ['CH'], category: 'pensions', connector: 'manual', manualKind: 'pension', note: 'Pillar 3a; no API, kept by hand with a monthly reminder.' },
  { key: 'pillar2', name: 'Pension fund (2nd pillar)', countries: ['CH'], category: 'pensions', connector: 'manual', manualKind: 'pension', note: 'From the yearly pension certificate; kept by hand.', aliases: ['pensionskasse', 'bvg', 'lpp'] },
  { key: 'pension-other', name: 'Another pension', countries: [], category: 'pensions', connector: 'manual', manualKind: 'pension', note: 'Any retirement account, kept by hand with a reminder.' },

  // ---- property and debts ----
  { key: 'property', name: 'Property', countries: [], category: 'property', connector: 'manual', manualKind: 'property', note: 'At the value you set; revisit it once a year.' },
  { key: 'mortgage', name: 'Mortgage', countries: [], category: 'debts', connector: 'manual', manualKind: 'loan', note: 'What is still owed, from the latest statement.' },
  { key: 'loan', name: 'Loan or credit card', countries: [], category: 'debts', connector: 'manual', manualKind: 'loan', note: 'What is still owed, from the latest statement.' },
];

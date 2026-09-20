jest.mock('../providers', () => ({ getProvider: jest.fn() }));
jest.mock('../snaptrade', () => ({
  fetchSnapBrokerages: jest.fn(),
  isSnaptradeConfigured: jest.fn(() => false),
}));

import { buildCatalog, normalizeName } from './build';
import type { CatalogConnector, Institution, LiveData } from './build';

const connectors: CatalogConnector[] = [
  { id: 'snaptrade', name: 'SnapTrade', configured: true, coverage: 'US, CA, UK, EU' },
  { id: 'gocardless', name: 'GoCardless', configured: true, coverage: 'EU and UK banks' },
  { id: 'watch', name: 'Watch-only wallet', configured: true, coverage: 'BTC · ETH · SOL' },
  { id: 'manual', name: 'Manual', configured: true, coverage: 'Global' },
];

const live: LiveData = {
  snaptrade: {
    configured: true,
    brokerages: [
      { slug: 'INTERACTIVE_BROKERS', name: 'Interactive Brokers', logo: 'https://s3/ibkr.png', domain: 'interactivebrokers.com', enabled: true, maintenance: false },
      { slug: 'SCHWAB', name: 'Charles Schwab', enabled: true, maintenance: false },
      { slug: 'KRAKEN', name: 'Kraken', logo: 'https://s3/kraken.png', enabled: true, maintenance: false },
      { slug: 'TRADE_REPUBLIC', name: 'Trade Republic', enabled: true, maintenance: false },
      { slug: 'ALPACA', name: 'Alpaca', domain: 'alpaca.markets', enabled: true, maintenance: false },
      { slug: 'CRYPTO_COM', name: 'Crypto.com', enabled: true, maintenance: false },
      { slug: 'ROBINHOOD', name: 'Robinhood', enabled: true, maintenance: true },
      { slug: 'OLD_BROKER', name: 'Old Broker', enabled: false, maintenance: false },
    ],
  },
  gocardless: {
    configured: true,
    institutions: [
      { id: 'UBS_UBSWCHZH80A', name: 'UBS Switzerland AG', logo: 'https://cdn/ubs.png', countries: ['CH'] },
      { id: 'REVOLUT_REVOLT21', name: 'Revolut', countries: ['CH', 'GB', 'DE'] },
      { id: 'ZUERCHER_KANTONALBANK_ZKBKCHZZ80A', name: 'Zürcher Kantonalbank', countries: ['CH'] },
      { id: 'BANK_CLER_BCLRCHBB', name: 'Bank Cler', countries: ['CH'] },
      { id: 'SANDBOXFINANCE_SFIN0000', name: 'Sandbox Finance', countries: ['CH'] },
    ],
  },
};

const nothing: LiveData = {
  snaptrade: { configured: false, brokerages: null },
  gocardless: { configured: false, institutions: null },
};

function group(catalog: ReturnType<typeof buildCatalog>, id: string): Institution[] {
  return catalog.categories.find((c) => c.id === id)!.institutions;
}

describe('normalizeName', () => {
  it('drops case, accents and punctuation', () => {
    expect(normalizeName('Zürcher Kantonalbank')).toBe('zurcherkantonalbank');
    expect(normalizeName('E*TRADE')).toBe('etrade');
    expect(normalizeName('INTERACTIVE_BROKERS')).toBe('interactivebrokers');
  });
});

describe('buildCatalog', () => {
  it('upgrades curated banks GoCardless lists, adds the rest, and hides the sandbox', () => {
    const banks = group(buildCatalog('ch', live, connectors), 'banks');
    const ubs = banks.find((b) => b.id === 'curated:ubs')!;
    expect(ubs).toMatchObject({
      name: 'UBS',
      domain: 'ubs.com',
      logo: 'https://cdn/ubs.png',
      connector: 'gocardless',
      method: 'link',
      available: true,
      ref: 'UBS_UBSWCHZH80A',
      countries: ['CH'],
    });
    expect(ubs.note).toBeUndefined();
    expect(ubs.manualKind).toBeUndefined();
    expect(banks.find((b) => b.id === 'curated:zkb')).toMatchObject({ connector: 'gocardless', ref: 'ZUERCHER_KANTONALBANK_ZKBKCHZZ80A' });
    expect(banks.find((b) => b.id === 'curated:revolut')).toMatchObject({ connector: 'gocardless', ref: 'REVOLUT_REVOLT21' });
    expect(banks.find((b) => b.id === 'gocardless:BANK_CLER_BCLRCHBB')).toMatchObject({
      name: 'Bank Cler',
      category: 'banks',
      connector: 'gocardless',
      method: 'link',
      available: true,
      countries: ['CH'],
    });
    expect(banks.some((b) => b.id.includes('SANDBOX'))).toBe(false);
    expect(banks.filter((b) => b.name === 'UBS')).toHaveLength(1);
    // A curated bank with no live match stays by hand, with its note.
    expect(banks.find((b) => b.id === 'curated:postfinance')).toMatchObject({
      connector: 'manual',
      method: 'manual',
      available: true,
      manualKind: 'bank',
      note: expect.stringMatching(/kept by hand/),
    });
  });

  it('sorts available links first, then by name', () => {
    const banks = group(buildCatalog('CH', live, connectors), 'banks');
    const linked = banks.filter((b) => b.method === 'link' && b.available).map((b) => b.name);
    expect(banks.slice(0, linked.length).map((b) => b.name)).toEqual(linked);
    expect(linked).toEqual(['Bank Cler', 'Revolut', 'UBS', 'Zürcher Kantonalbank']);
    const rest = banks.slice(linked.length).map((b) => b.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('matches SnapTrade brokerages by slug or name and files unknown ones by kind', () => {
    const us = buildCatalog('US', live, connectors);
    const brokers = group(us, 'brokers');
    expect(brokers.find((b) => b.id === 'curated:ibkr')).toMatchObject({
      connector: 'snaptrade',
      method: 'link',
      available: true,
      ref: 'INTERACTIVE_BROKERS',
      logo: 'https://s3/ibkr.png',
      domain: 'interactivebrokers.com',
    });
    expect(brokers.find((b) => b.id === 'curated:schwab')).toMatchObject({ available: true, ref: 'SCHWAB' });
    expect(brokers.find((b) => b.id === 'curated:robinhood')).toMatchObject({
      available: false,
      ref: 'ROBINHOOD',
      note: expect.stringMatching(/maintenance/i),
    });
    // Known slug, absent from the live list: honest about it.
    expect(brokers.find((b) => b.id === 'curated:fidelity')).toMatchObject({
      connector: 'snaptrade',
      available: false,
      note: expect.stringMatching(/not in the snaptrade/i),
    });
    expect(brokers.find((b) => b.id === 'snaptrade:ALPACA')).toMatchObject({
      name: 'Alpaca',
      category: 'brokers',
      domain: 'alpaca.markets',
      countries: [],
      available: true,
      ref: 'ALPACA',
    });
    expect(brokers.some((b) => b.id === 'snaptrade:OLD_BROKER')).toBe(false);
    // Available links lead, alphabetically; everything else follows by name.
    expect(brokers.map((b) => b.name)).toEqual([
      'Alpaca',
      'Charles Schwab',
      'Interactive Brokers',
      'E*TRADE',
      'Fidelity',
      'Positions by hand',
      'Robinhood',
      'Vanguard',
    ]);

    const exchanges = group(us, 'exchanges');
    expect(exchanges.find((e) => e.id === 'curated:kraken')).toMatchObject({ available: true, logo: 'https://s3/kraken.png' });
    expect(exchanges.find((e) => e.id === 'snaptrade:CRYPTO_COM')).toMatchObject({ category: 'exchanges', available: true });

    // A curated broker that is by hand by default gains a link when SnapTrade names it.
    const de = group(buildCatalog('DE', live, connectors), 'brokers');
    expect(de.find((b) => b.id === 'curated:traderepublic')).toMatchObject({
      connector: 'snaptrade',
      method: 'link',
      available: true,
      ref: 'TRADE_REPUBLIC',
    });
    expect(de.find((b) => b.id === 'curated:traderepublic')?.manualKind).toBeUndefined();
    expect(de.find((b) => b.id === 'curated:scalable')).toMatchObject({ connector: 'manual', manualKind: 'holdings' });
  });

  it('filters by country, keeping worldwide entries everywhere', () => {
    const ch = buildCatalog('CH', live, connectors);
    const de = buildCatalog('DE', live, connectors);
    expect(ch.country).toBe('CH');
    expect(group(ch, 'banks').some((b) => b.id === 'curated:n26')).toBe(false);
    expect(group(de, 'banks').some((b) => b.id === 'curated:n26')).toBe(true);
    expect(group(de, 'banks').some((b) => b.id === 'curated:ubs')).toBe(false);
    expect(group(ch, 'brokers').some((b) => b.id === 'curated:schwab')).toBe(false);
    for (const catalog of [ch, de]) {
      expect(group(catalog, 'brokers').some((b) => b.id === 'curated:ibkr')).toBe(true);
      expect(group(catalog, 'wallets').map((w) => w.id)).toContain('curated:ledger');
      expect(group(catalog, 'property').map((p) => p.id)).toEqual(['curated:property']);
    }
    expect(ch.countries.map((c) => c.code)).toEqual(['CH', 'DE', 'FR', 'GB', 'US', 'CA', 'NL', 'IT', 'ES', 'AT']);
    expect(ch.categories.map((c) => c.id)).toEqual(['banks', 'brokers', 'exchanges', 'wallets', 'pensions', 'property', 'debts']);
    expect(ch.connectors).toBe(connectors);
  });

  it('is honest when no aggregator is configured', () => {
    const catalog = buildCatalog('CH', nothing, connectors);
    expect(group(catalog, 'brokers').find((b) => b.id === 'curated:ibkr')).toMatchObject({
      connector: 'snaptrade',
      method: 'link',
      available: false,
      note: expect.stringMatching(/keys/),
    });
    expect(group(catalog, 'banks').find((b) => b.id === 'curated:ubs')).toMatchObject({
      connector: 'manual',
      method: 'manual',
      available: true,
      note: expect.stringMatching(/Not in any aggregator/),
    });
    expect(group(catalog, 'wallets').every((w) => w.connector === 'watch' && w.method === 'key' && w.available)).toBe(true);
    expect(group(catalog, 'debts').every((d) => d.manualKind === 'loan')).toBe(true);
    expect(group(catalog, 'pensions').every((p) => p.manualKind === 'pension')).toBe(true);
    expect(catalog.categories.flatMap((c) => c.institutions).some((i) => i.id.startsWith('snaptrade:'))).toBe(false);
  });

  it('keeps curated links usable when a configured aggregator cannot be reached', () => {
    const degraded: LiveData = {
      snaptrade: { configured: true, brokerages: null },
      gocardless: { configured: true, institutions: null },
    };
    const brokers = group(buildCatalog('CH', degraded, connectors), 'brokers');
    expect(brokers.find((b) => b.id === 'curated:ibkr')).toMatchObject({ available: true, ref: 'INTERACTIVE_BROKERS' });
    expect(brokers.find((b) => b.id === 'curated:ibkr')?.note).toBeUndefined();
  });
});

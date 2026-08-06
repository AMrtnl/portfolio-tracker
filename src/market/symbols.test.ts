import {
  assetClassFromQuoteType,
  fxSymbol,
  isFiat,
  isStablecoin,
  mapSymbol,
  normalizeTicker,
  regionFromCountry,
  regionFromSymbol,
} from './symbols';

describe('normalizeTicker', () => {
  it('trims and upper-cases', () => {
    expect(normalizeTicker('  aapl ')).toBe('AAPL');
    expect(normalizeTicker('')).toBe('');
  });
});

describe('mapSymbol — equities', () => {
  it('passes US tickers through unchanged', () => {
    expect(mapSymbol('AAPL')).toEqual({
      raw: 'AAPL',
      yahooSymbol: 'AAPL',
      kind: 'equity',
    });
  });

  it('keeps exchange suffixes, which Yahoo uses too', () => {
    expect(mapSymbol('NESN.SW').yahooSymbol).toBe('NESN.SW');
    expect(mapSymbol('vusa.l').yahooSymbol).toBe('VUSA.L');
  });

  it('refuses to guess a ticker for unparseable symbols', () => {
    expect(mapSymbol('AAPL 260116C00150000').yahooSymbol).toBeNull();
    expect(mapSymbol('').yahooSymbol).toBeNull();
  });
});

describe('mapSymbol — crypto', () => {
  it('appends -USD for well-known crypto tickers', () => {
    expect(mapSymbol('BTC')).toEqual({
      raw: 'BTC',
      yahooSymbol: 'BTC-USD',
      kind: 'crypto',
    });
    expect(mapSymbol('HYPE').yahooSymbol).toBe('HYPE-USD');
  });

  it('resolves exchange aliases', () => {
    expect(mapSymbol('XBT').yahooSymbol).toBe('BTC-USD');
    expect(mapSymbol('XDG').yahooSymbol).toBe('DOGE-USD');
  });

  it('strips perp and pair decorations', () => {
    expect(mapSymbol('BTC-PERP').yahooSymbol).toBe('BTC-USD');
    expect(mapSymbol('ETH/USD').yahooSymbol).toBe('ETH-USD');
  });

  it('treats unknown tickers from a crypto venue as crypto', () => {
    expect(
      mapSymbol('WLD', { provider: 'hyperliquid' }),
    ).toEqual({ raw: 'WLD', yahooSymbol: 'WLD-USD', kind: 'crypto' });
    expect(mapSymbol('WLD', { institution: 'Kraken Crypto' }).kind).toBe('crypto');
  });

  it('treats the same ticker from a brokerage as an equity', () => {
    expect(mapSymbol('WLD', { institution: 'Trading212' }).kind).toBe('equity');
  });
});

describe('mapSymbol — cash', () => {
  it('classifies fiat and stablecoins as cash with no quote lookup', () => {
    expect(mapSymbol('USD')).toEqual({ raw: 'USD', yahooSymbol: null, kind: 'cash' });
    expect(mapSymbol('CHF').kind).toBe('cash');
    expect(mapSymbol('USDC').kind).toBe('cash');
    expect(mapSymbol('USDG').kind).toBe('cash');
    expect(mapSymbol('USDT', { provider: 'hyperliquid' }).kind).toBe('cash');
  });

  it('honours a broker cash-equivalent flag', () => {
    expect(mapSymbol('EUR', { cashEquivalent: true }).kind).toBe('cash');
  });

  it('exposes the fiat and stablecoin predicates', () => {
    expect(isFiat('gbp')).toBe(true);
    expect(isFiat('BTC')).toBe(false);
    expect(isStablecoin('dai')).toBe(true);
    expect(isStablecoin('usdg')).toBe(true);
  });
});

describe('mapSymbol — Kraken tokenized equities', () => {
  it('strips the x.T decoration down to the underlying ticker', () => {
    expect(mapSymbol('COINx.T')).toEqual({
      raw: 'COINX.T',
      yahooSymbol: 'COIN',
      kind: 'equity',
    });
    expect(mapSymbol('QQQx.T', { institution: 'Kraken Crypto' }).yahooSymbol).toBe('QQQ');
    expect(mapSymbol('GLDx.T').yahooSymbol).toBe('GLD');
    expect(mapSymbol('HOODx.T').yahooSymbol).toBe('HOOD');
    expect(mapSymbol('CRCLx.T').yahooSymbol).toBe('CRCL');
    expect(mapSymbol('SPCXx.T').yahooSymbol).toBe('SPCX');
  });
});

describe('mapSymbol — ambiguous tickers', () => {
  it('treats LTC from a brokerage as the equity (LTC Properties), not Litecoin', () => {
    expect(mapSymbol('LTC', { institution: 'Trading212' })).toEqual({
      raw: 'LTC',
      yahooSymbol: 'LTC',
      kind: 'equity',
    });
  });

  it('treats LTC from a crypto venue as Litecoin', () => {
    expect(mapSymbol('LTC', { institution: 'Kraken Crypto' })).toEqual({
      raw: 'LTC',
      yahooSymbol: 'LTC-USD',
      kind: 'crypto',
    });
  });
});

describe('fxSymbol', () => {
  it('builds Yahoo currency pairs', () => {
    expect(fxSymbol('CHF', 'USD')).toBe('CHFUSD=X');
    expect(fxSymbol('USD', 'CHF')).toBe('USDCHF=X');
    expect(fxSymbol('EUR', 'GBP')).toBe('EURGBP=X');
  });

  it('returns null when no conversion is needed or possible', () => {
    expect(fxSymbol('USD', 'USD')).toBeNull();
    expect(fxSymbol('BITCOIN', 'USD')).toBeNull();
    expect(fxSymbol('', 'USD')).toBeNull();
  });
});

describe('assetClassFromQuoteType', () => {
  it('maps Yahoo quote types', () => {
    expect(assetClassFromQuoteType('EQUITY')).toBe('equity');
    expect(assetClassFromQuoteType('ETF')).toBe('etf');
    expect(assetClassFromQuoteType('MUTUALFUND')).toBe('fund');
    expect(assetClassFromQuoteType('CRYPTOCURRENCY')).toBe('crypto');
    expect(assetClassFromQuoteType('CURRENCY')).toBe('cash');
    expect(assetClassFromQuoteType(undefined)).toBe('unclassified');
    expect(assetClassFromQuoteType('SOMETHING_NEW')).toBe('unclassified');
  });
});

describe('region mapping', () => {
  it('maps issuer country to a region', () => {
    expect(regionFromCountry('Switzerland')).toBe('Europe');
    expect(regionFromCountry('United States')).toBe('North America');
    expect(regionFromCountry('Atlantis')).toBeNull();
    expect(regionFromCountry(null)).toBeNull();
  });

  it('falls back to the listing venue', () => {
    expect(regionFromSymbol('NESN.SW')).toBe('Europe');
    expect(regionFromSymbol('7203.T')).toBe('Asia-Pacific');
    expect(regionFromSymbol('SHOP.TO')).toBe('North America');
    expect(regionFromSymbol('AAPL')).toBe('North America');
    expect(regionFromSymbol('BTC-USD')).toBe('Crypto');
    expect(regionFromSymbol('FOO.ZZ')).toBeNull();
  });
});

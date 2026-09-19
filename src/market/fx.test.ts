import fs from 'fs';
import os from 'os';
import path from 'path';
import { FxConverter, baseCurrency } from './fx';
import { resetSettingsCache } from '../settings';

describe('baseCurrency', () => {
  const original = { ...process.env };
  let dir: string;

  // A saved display currency would win over BASE_CURRENCY, so read from an
  // empty scratch data dir rather than whatever the developer has saved.
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-fx-'));
    process.env.DATA_DIR = dir;
    resetSettingsCache();
  });

  afterEach(() => {
    process.env = { ...original };
    resetSettingsCache();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to USD', () => {
    delete process.env.BASE_CURRENCY;
    expect(baseCurrency()).toBe('USD');
  });

  it('honours a configured fiat currency', () => {
    process.env.BASE_CURRENCY = 'chf';
    expect(baseCurrency()).toBe('CHF');
  });

  it('ignores a nonsense configuration rather than breaking totals', () => {
    process.env.BASE_CURRENCY = 'DOGE';
    expect(baseCurrency()).toBe('USD');
  });
});

describe('FxConverter', () => {
  const fx = FxConverter.fixed('USD', { CHF: 1.25, EUR: 1.1 });

  it('leaves base-currency amounts untouched', () => {
    expect(fx.convert(100, 'USD')).toBe(100);
    expect(fx.rate('USD')).toBe(1);
  });

  it('converts foreign currency at the quoted rate', () => {
    expect(fx.convert(100, 'CHF')).toBe(125);
    expect(fx.convert(100, 'eur')).toBeCloseTo(110, 10);
  });

  it('returns null instead of silently assuming 1:1 for an unknown currency', () => {
    expect(fx.convert(100, 'JPY')).toBeNull();
    expect(fx.rate('JPY')).toBeNull();
  });

  it('propagates null and non-finite amounts', () => {
    expect(fx.convert(null, 'CHF')).toBeNull();
    expect(fx.convert(undefined, 'CHF')).toBeNull();
    expect(fx.convert(NaN, 'CHF')).toBeNull();
  });

  it('handles negative amounts (short positions, withdrawals)', () => {
    expect(fx.convert(-80, 'CHF')).toBe(-100);
  });

  it('reports the rates it used so a response can disclose them', () => {
    expect(fx.ratesUsed()).toEqual({ USD: 1, CHF: 1.25, EUR: 1.1 });
  });
});

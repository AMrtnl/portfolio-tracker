import fs from 'fs';
import os from 'os';
import path from 'path';
import { SettingsStore, getSettings, updateSettings } from './settings';

describe('settings', () => {
  const originalEnv = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-settings-'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults from BASE_CURRENCY until something is saved', () => {
    process.env.BASE_CURRENCY = 'chf';
    const store = new SettingsStore(dir);
    expect(getSettings(store)).toEqual({ displayCurrency: 'CHF', headlineMetric: 'net' });
    process.env.BASE_CURRENCY = 'eur';
    expect(getSettings(store).displayCurrency).toBe('EUR');
  });

  it('persists updates and reads them back from a fresh instance', () => {
    updateSettings(new SettingsStore(dir), { displayCurrency: 'GBP', headlineMetric: 'financial' });
    expect(getSettings(new SettingsStore(dir))).toEqual({
      displayCurrency: 'GBP',
      headlineMetric: 'financial',
    });
    expect(fs.existsSync(path.join(dir, 'settings.json'))).toBe(true);
  });

  it('rejects values outside the allowed sets without touching the file', () => {
    const store = new SettingsStore(dir);
    expect(() => updateSettings(store, { displayCurrency: 'DOGE' as never })).toThrow(
      /displayCurrency/,
    );
    expect(() => updateSettings(store, { headlineMetric: 'vibes' as never })).toThrow(
      /headlineMetric/,
    );
    expect(getSettings(store).displayCurrency).toBe('CHF');
    expect(fs.existsSync(path.join(dir, 'settings.json'))).toBe(false);
  });

  it('keeps two directories apart', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-settings-other-'));
    try {
      updateSettings(new SettingsStore(dir), { displayCurrency: 'USD' });
      expect(getSettings(new SettingsStore(other)).displayCurrency).toBe('CHF');
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });
});

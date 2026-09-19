import fs from 'fs';
import os from 'os';
import path from 'path';

type SettingsModule = typeof import('./settings');

function loadWithDataDir(dir: string): SettingsModule {
  process.env.DATA_DIR = dir;
  let mod: SettingsModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./settings') as SettingsModule;
  });
  return mod!;
}

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
    const { getSettings } = loadWithDataDir(dir);
    expect(getSettings()).toEqual({ displayCurrency: 'CHF', headlineMetric: 'net' });
    process.env.BASE_CURRENCY = 'eur';
    expect(getSettings().displayCurrency).toBe('EUR');
  });

  it('persists updates and reads them back after a fresh load', () => {
    const first = loadWithDataDir(dir);
    first.updateSettings({ displayCurrency: 'GBP', headlineMetric: 'financial' });
    const second = loadWithDataDir(dir);
    expect(second.getSettings()).toEqual({ displayCurrency: 'GBP', headlineMetric: 'financial' });
    expect(fs.existsSync(path.join(dir, 'settings.json'))).toBe(true);
  });

  it('rejects values outside the allowed sets without touching the file', () => {
    const { updateSettings, getSettings } = loadWithDataDir(dir);
    expect(() => updateSettings({ displayCurrency: 'DOGE' as never })).toThrow(/displayCurrency/);
    expect(() => updateSettings({ headlineMetric: 'vibes' as never })).toThrow(/headlineMetric/);
    expect(getSettings().displayCurrency).toBe('CHF');
    expect(fs.existsSync(path.join(dir, 'settings.json'))).toBe(false);
  });
});

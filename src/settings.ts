import fs from 'fs';
import path from 'path';

/**
 * User preferences that shape every figure the API returns. Kept in a tiny
 * JSON file next to the other stores so a redeploy keeps them.
 */

export const DISPLAY_CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const HEADLINE_METRICS = ['net', 'financial', 'gross'] as const;
export type HeadlineMetric = (typeof HEADLINE_METRICS)[number];

export interface Settings {
  /** Currency every total is converted into (Finary's "display currency"). */
  displayCurrency: DisplayCurrency;
  /** Which figure the dashboard leads with. */
  headlineMetric: HeadlineMetric;
}

/** Resolved per call so tests can point DATA_DIR at a scratch directory. */
function dataDir(): string {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, '..', 'data');
}

function settingsFile(): string {
  return path.join(dataDir(), 'settings.json');
}

function isCurrency(v: unknown): v is DisplayCurrency {
  return typeof v === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(v);
}

function isMetric(v: unknown): v is HeadlineMetric {
  return typeof v === 'string' && (HEADLINE_METRICS as readonly string[]).includes(v);
}

function defaults(): Settings {
  const env = (process.env.BASE_CURRENCY || '').toUpperCase();
  return {
    displayCurrency: isCurrency(env) ? env : 'USD',
    headlineMetric: 'net',
  };
}

/** undefined = not read yet, null = no file on disk. */
let saved: Partial<Settings> | null | undefined;

function readFile(): Partial<Settings> | null {
  try {
    const file = settingsFile();
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Settings>;
  } catch (err) {
    console.warn('⚠️  Could not read settings, using defaults:', err);
    return null;
  }
}

/**
 * Saved settings win; anything unset falls back to the environment at call
 * time, so BASE_CURRENCY keeps working as the deploy-level default.
 */
export function getSettings(): Settings {
  if (saved === undefined) saved = readFile();
  const base = defaults();
  if (saved) {
    if (isCurrency(saved.displayCurrency)) base.displayCurrency = saved.displayCurrency;
    if (isMetric(saved.headlineMetric)) base.headlineMetric = saved.headlineMetric;
  }
  return base;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings() };
  if (patch.displayCurrency !== undefined) {
    if (!isCurrency(patch.displayCurrency)) {
      throw new Error(`displayCurrency must be one of ${DISPLAY_CURRENCIES.join(', ')}`);
    }
    next.displayCurrency = patch.displayCurrency;
  }
  if (patch.headlineMetric !== undefined) {
    if (!isMetric(patch.headlineMetric)) {
      throw new Error(`headlineMetric must be one of ${HEADLINE_METRICS.join(', ')}`);
    }
    next.headlineMetric = patch.headlineMetric;
  }
  const dir = dataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf8');
  saved = next;
  return next;
}

/** Test seam. */
export function resetSettingsCache(): void {
  saved = undefined;
}

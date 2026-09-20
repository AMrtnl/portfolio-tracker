import fs from 'fs';
import path from 'path';

/**
 * User preferences that shape every figure the API returns. Kept in a tiny
 * JSON file inside the user's data directory so a redeploy keeps them.
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

function isCurrency(v: unknown): v is DisplayCurrency {
  return typeof v === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(v);
}

function isMetric(v: unknown): v is HeadlineMetric {
  return typeof v === 'string' && (HEADLINE_METRICS as readonly string[]).includes(v);
}

function defaults(): Settings {
  const env = (process.env.BASE_CURRENCY || '').toUpperCase();
  // One ledger in one currency: CHF unless BASE_CURRENCY says otherwise.
  return {
    displayCurrency: isCurrency(env) ? env : 'CHF',
    headlineMetric: 'net',
  };
}

export class SettingsStore {
  /** undefined = not read yet, null = no file on disk. */
  private saved: Partial<Settings> | null | undefined;

  constructor(readonly dir: string) {}

  private file(): string {
    return path.join(this.dir, 'settings.json');
  }

  private read(): Partial<Settings> | null {
    try {
      const file = this.file();
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
  get(): Settings {
    if (this.saved === undefined) this.saved = this.read();
    const base = defaults();
    if (this.saved) {
      if (isCurrency(this.saved.displayCurrency)) base.displayCurrency = this.saved.displayCurrency;
      if (isMetric(this.saved.headlineMetric)) base.headlineMetric = this.saved.headlineMetric;
    }
    return base;
  }

  update(patch: Partial<Settings>): Settings {
    const next = { ...this.get() };
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
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file(), JSON.stringify(next, null, 2), 'utf8');
    this.saved = next;
    return next;
  }
}

export function getSettings(store: SettingsStore): Settings {
  return store.get();
}

export function updateSettings(store: SettingsStore, patch: Partial<Settings>): Settings {
  return store.update(patch);
}

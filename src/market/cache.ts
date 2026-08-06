/**
 * TTL cache for market data, backed by an optional JSON file under DATA_DIR.
 *
 * Yahoo is an unofficial, rate-limited source: every lookup that can be served
 * from memory or from the last process's disk snapshot is a lookup we don't
 * make. Disk persistence matters most for profiles (sector/industry), which
 * change on a scale of months but would otherwise be re-fetched for all ~66
 * holdings on every container restart.
 */
import fs from 'fs';
import path from 'path';

export interface CacheEntry<T> {
  value: T;
  /** Epoch ms when this entry stops being served. */
  expiresAt: number;
  /** Epoch ms when this entry was written. */
  storedAt: number;
}

export interface CacheStats {
  namespace: string;
  entries: number;
  hits: number;
  misses: number;
}

function dataDir(): string {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, '..', '..', 'data');
}

/**
 * A single named cache. `persist: true` mirrors the map to
 * `DATA_DIR/market-cache-<namespace>.json` on a debounce.
 */
export class TtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private misses = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private dirty = false;
  private loaded = false;

  constructor(
    readonly namespace: string,
    readonly defaultTtlMs: number,
    private readonly persist = false,
    /** Debounce window for disk writes. */
    private readonly flushDelayMs = 5_000,
  ) {}

  private file(): string {
    return path.join(dataDir(), `market-cache-${this.namespace}.json`);
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.persist) return;
    try {
      const file = this.file();
      if (!fs.existsSync(file)) return;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        entries?: Record<string, CacheEntry<T>>;
      };
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed.entries || {})) {
        if (entry && typeof entry.expiresAt === 'number' && entry.expiresAt > now) {
          this.map.set(key, entry);
        }
      }
    } catch (err) {
      console.warn(
        `⚠️  market cache "${this.namespace}" unreadable, starting empty:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  private scheduleFlush(): void {
    if (!this.persist) return;
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.flushDelayMs);
    // A pending cache write must never hold the process open.
    this.flushTimer.unref?.();
  }

  flush(): void {
    if (!this.persist || !this.dirty) return;
    this.dirty = false;
    try {
      const dir = dataDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const now = Date.now();
      const entries: Record<string, CacheEntry<T>> = {};
      for (const [key, entry] of this.map) {
        if (entry.expiresAt > now) entries[key] = entry;
      }
      fs.writeFileSync(
        this.file(),
        JSON.stringify({ namespace: this.namespace, entries }),
        'utf8',
      );
    } catch (err) {
      console.warn(
        `⚠️  Could not persist market cache "${this.namespace}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  get(key: string): T | undefined {
    this.ensureLoaded();
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  /** Returns the entry even when expired — used to serve stale data on failure. */
  getStale(key: string): CacheEntry<T> | undefined {
    this.ensureLoaded();
    return this.map.get(key);
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.ensureLoaded();
    const now = Date.now();
    this.map.set(key, { value, storedAt: now, expiresAt: now + ttlMs });
    this.scheduleFlush();
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.ensureLoaded();
    if (this.map.delete(key)) this.scheduleFlush();
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
    this.scheduleFlush();
  }

  stats(): CacheStats {
    this.ensureLoaded();
    return {
      namespace: this.namespace,
      entries: this.map.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

/**
 * Collapses concurrent identical requests into one upstream call.
 * Ten analytics endpoints asking for AAPL at once should hit Yahoo once.
 */
export class InFlightMap<T> {
  private pending = new Map<string, Promise<T>>();

  run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    const promise = fn().finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, promise);
    return promise;
  }
}

export const TTL = {
  QUOTE: 10 * 60 * 1000,
  PROFILE: 30 * 24 * 60 * 60 * 1000,
  HISTORY: 24 * 60 * 60 * 1000,
  FX: 6 * 60 * 60 * 1000,
  NEWS: 30 * 60 * 1000,
} as const;

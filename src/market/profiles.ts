/**
 * Sector / industry / region lookups.
 *
 * Yahoo has no batch endpoint for `assetProfile`, so this is one request per
 * symbol behind a 30-day cache. Profiles change on a scale of months; the disk
 * cache means a container restart does not re-fetch every holding.
 */
import { InFlightMap, TTL, TtlCache } from './cache';
import { regionFromCountry, regionFromSymbol } from './symbols';
import { getYahooClient, guarded } from './yahoo';

export interface MarketProfile {
  symbol: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  region: string | null;
}

export interface ProfileLookup {
  profiles: Map<string, MarketProfile>;
  warnings: string[];
}

const profileCache = new TtlCache<MarketProfile>('profiles', TTL.PROFILE, true);
const inFlight = new InFlightMap<MarketProfile | null>();

/** Parallel profile requests. Low enough to stay a polite client. */
const CONCURRENCY = 5;
/** Upper bound on fresh lookups per request so a cold cache cannot stall a page. */
const MAX_FETCHES_PER_CALL = 80;
/** Give up on remaining lookups after this and let them fill in next request. */
const DEADLINE_MS = 12_000;

async function fetchProfile(symbol: string): Promise<MarketProfile | null> {
  const client = getYahooClient();
  const result = await guarded(`quoteSummary(profile)`, () =>
    client.quoteSummary(symbol, { modules: ['assetProfile'] }),
  );
  if (!result.data) return null;
  const asset = (result.data as { assetProfile?: Record<string, unknown> }).assetProfile;
  const country = typeof asset?.country === 'string' ? asset.country : null;
  const profile: MarketProfile = {
    symbol,
    sector: typeof asset?.sector === 'string' ? asset.sector : null,
    industry: typeof asset?.industry === 'string' ? asset.industry : null,
    country,
    region: regionFromCountry(country) ?? regionFromSymbol(symbol),
  };
  profileCache.set(symbol, profile);
  return profile;
}

/** Resolves profiles for `symbols`; unknown symbols are simply absent. */
export async function getProfiles(symbols: string[]): Promise<ProfileLookup> {
  const wanted = Array.from(
    new Set(symbols.filter(Boolean).map((s) => s.toUpperCase())),
  );
  const profiles = new Map<string, MarketProfile>();
  const warnings: string[] = [];
  const misses: string[] = [];

  for (const symbol of wanted) {
    const hit = profileCache.get(symbol);
    if (hit) profiles.set(symbol, hit);
    else misses.push(symbol);
  }

  if (misses.length === 0) return { profiles, warnings };

  const queue = misses.slice(0, MAX_FETCHES_PER_CALL);
  const deferred = misses.length - queue.length;
  const startedAt = Date.now();
  let timedOut = 0;
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= queue.length) return;
      const symbol = queue[index];
      if (Date.now() - startedAt > DEADLINE_MS) {
        timedOut++;
        continue;
      }
      const profile = await inFlight.run(`profile:${symbol}`, () =>
        fetchProfile(symbol),
      );
      if (profile) profiles.set(symbol, profile);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
  );

  if (deferred > 0) {
    warnings.push(
      `Sector/region lookup deferred for ${deferred} symbol(s) to limit market-data requests; retry shortly.`,
    );
  }
  if (timedOut > 0) {
    warnings.push(
      `Sector/region lookup timed out for ${timedOut} symbol(s); they stay unclassified for now.`,
    );
  }
  const unresolved = queue.filter((s) => !profiles.has(s)).length - timedOut;
  if (unresolved > 0) {
    warnings.push(
      `No sector/region profile available for ${unresolved} symbol(s).`,
    );
  }

  return { profiles, warnings };
}

/** Test helper. */
export function clearProfileCache(): void {
  profileCache.clear();
}

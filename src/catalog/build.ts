/**
 * Assembles the catalogue: the curated list, upgraded and extended with what
 * the configured aggregators actually offer right now.
 */
import type { GcInstitution } from '../aggregators/gocardless';
import { getGocardlessClient, isGocardlessConfigured } from '../aggregators/gocardless';
import { isCryptoInstitution } from '../market/symbols';
import { getProvider } from '../providers';
import { fetchSnapBrokerages, isSnaptradeConfigured } from '../snaptrade';
import type { SnapBrokerageVM } from '../snaptrade/types';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  COUNTRIES,
  CURATED,
} from './institutions';
import type {
  CatalogCategory,
  ConnectMethod,
  ConnectorId,
  CuratedInstitution,
  ManualKind,
} from './institutions';

export interface Institution {
  id: string;
  name: string;
  logo?: string;
  domain?: string;
  countries: string[];
  category: CatalogCategory;
  method: ConnectMethod;
  connector: ConnectorId;
  available: boolean;
  ref?: string;
  manualKind?: ManualKind;
  note?: string;
}

export interface CatalogConnector {
  id: ConnectorId;
  name: string;
  configured: boolean;
  coverage: string;
}

export interface CatalogCategoryGroup {
  id: CatalogCategory;
  name: string;
  description: string;
  institutions: Institution[];
}

export interface Catalog {
  country: string;
  countries: Array<{ code: string; name: string }>;
  connectors: CatalogConnector[];
  categories: CatalogCategoryGroup[];
}

/** What the aggregators returned; null means the connector is configured but its list could not be read. */
export interface LiveData {
  snaptrade: { configured: boolean; brokerages: SnapBrokerageVM[] | null };
  gocardless: { configured: boolean; institutions: GcInstitution[] | null };
}

const CONNECTOR_IDS: ConnectorId[] = ['snaptrade', 'gocardless', 'watch', 'manual'];
const CACHE_TTL_MS = 10 * 60 * 1000;
const SNAPTRADE_NOT_LISTED = 'Not in the SnapTrade brokerage list at the moment.';
const SNAPTRADE_NEEDS_KEYS = 'Broker links need SnapTrade keys on this server.';
const SNAPTRADE_MAINTENANCE = 'In maintenance at SnapTrade right now; try again later.';

// ----- name matching -----

/** Words a bank's registered name carries that its everyday name does not. */
const NOISE_WORDS = new Set([
  'ag', 'sa', 'se', 'ltd', 'plc', 'gmbh', 'nv', 'inc', 'llc', 'co', 'corp', 'corporation',
  'bank', 'group', 'holding', 'holdings', 'the', 'switzerland', 'schweiz', 'svizzera',
  'deutschland', 'uk', 'europe', 'international', 'personal', 'retail',
]);

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** The full name and the name without legal/geographic noise, both normalised. */
function nameKeys(name: string): string[] {
  const full = normalizeName(name);
  const words = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const reduced = normalizeName(words.filter((w) => !NOISE_WORDS.has(w)).join(' '));
  const keys = [full];
  if (reduced && reduced !== full) keys.push(reduced);
  return keys.filter(Boolean);
}

function curatedKeys(c: CuratedInstitution): string[] {
  const keys = [...nameKeys(c.name), normalizeName(c.key)];
  if (c.ref) keys.push(normalizeName(c.ref));
  for (const alias of c.aliases ?? []) keys.push(...nameKeys(alias));
  return [...new Set(keys.filter(Boolean))];
}

function snaptradeKeys(b: SnapBrokerageVM): string[] {
  return [...new Set([normalizeName(b.slug), ...nameKeys(b.name)].filter(Boolean))];
}

/** `REVOLUT_REVOLT21` → `revolut`: the id is a name plus the BIC. */
function gocardlessKeys(i: GcInstitution): string[] {
  const idParts = i.id.split('_');
  const idName = idParts.length > 1 ? idParts.slice(0, -1).join(' ') : i.id;
  return [...new Set([...nameKeys(i.name), ...nameKeys(idName)].filter(Boolean))];
}

function index<T>(items: T[], keysOf: (item: T) => string[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    for (const key of keysOf(item)) {
      if (!map.has(key)) map.set(key, item);
    }
  }
  return map;
}

function lookup<T>(map: Map<string, T>, keys: string[]): T | undefined {
  for (const key of keys) {
    const hit = map.get(key);
    if (hit) return hit;
  }
  return undefined;
}

function isSandbox(i: GcInstitution): boolean {
  return i.id.toUpperCase().startsWith('SANDBOXFINANCE');
}

// ----- entries -----

function methodFor(connector: ConnectorId): ConnectMethod {
  if (connector === 'snaptrade' || connector === 'gocardless') return 'link';
  if (connector === 'watch') return 'key';
  return 'manual';
}

function fromCurated(c: CuratedInstitution, live: LiveData): Institution {
  const inst: Institution = {
    id: `curated:${c.key}`,
    name: c.name,
    domain: c.domain,
    countries: [...c.countries],
    category: c.category,
    method: methodFor(c.connector),
    connector: c.connector,
    available: true,
    ref: c.ref,
    manualKind: c.manualKind,
    note: c.note,
  };
  if (c.connector === 'snaptrade') {
    inst.available = live.snaptrade.configured;
    if (!inst.available) inst.note = c.note ?? SNAPTRADE_NEEDS_KEYS;
  }
  if (c.connector === 'gocardless') {
    inst.available = live.gocardless.configured;
  }
  return inst;
}

function fromSnaptrade(b: SnapBrokerageVM): Institution {
  const available = b.enabled && !b.maintenance;
  return {
    id: `snaptrade:${b.slug}`,
    name: b.name,
    logo: b.logo,
    domain: b.domain,
    countries: [],
    category: isCryptoInstitution(b.name) ? 'exchanges' : 'brokers',
    method: 'link',
    connector: 'snaptrade',
    available,
    ref: b.slug,
    note: available ? undefined : SNAPTRADE_MAINTENANCE,
  };
}

function fromGocardless(i: GcInstitution, country: string): Institution {
  return {
    id: `gocardless:${i.id}`,
    name: i.name,
    logo: i.logo || undefined,
    countries: Array.isArray(i.countries) && i.countries.length ? i.countries.map((c) => c.toUpperCase()) : [country],
    category: 'banks',
    method: 'link',
    connector: 'gocardless',
    available: true,
    ref: i.id,
  };
}

function upgradeToSnaptrade(inst: Institution, b: SnapBrokerageVM): void {
  const available = b.enabled && !b.maintenance;
  inst.connector = 'snaptrade';
  inst.method = 'link';
  inst.available = available;
  inst.ref = b.slug;
  inst.logo = b.logo ?? inst.logo;
  inst.domain = inst.domain ?? b.domain;
  inst.manualKind = undefined;
  inst.note = available ? undefined : SNAPTRADE_MAINTENANCE;
}

function upgradeToGocardless(inst: Institution, i: GcInstitution): void {
  inst.connector = 'gocardless';
  inst.method = 'link';
  inst.available = true;
  inst.ref = i.id;
  inst.logo = i.logo || inst.logo;
  inst.manualKind = undefined;
  inst.note = undefined;
  for (const c of i.countries ?? []) {
    const code = c.toUpperCase();
    if (inst.countries.length && !inst.countries.includes(code)) inst.countries.push(code);
  }
}

function rank(inst: Institution): number {
  return inst.method === 'link' && inst.available ? 0 : 1;
}

export function connectorSummaries(): CatalogConnector[] {
  return CONNECTOR_IDS.map((id) => {
    const info = getProvider(id).info();
    return { id, name: info.name, configured: info.configured, coverage: info.coverage };
  });
}

/** Pure assembly, so the merge rules can be tested with fixtures. */
export function buildCatalog(
  country: string,
  live: LiveData,
  connectors: CatalogConnector[] = connectorSummaries(),
): Catalog {
  const cc = country.toUpperCase();
  const snapIndex = index(live.snaptrade.brokerages ?? [], snaptradeKeys);
  const gcIndex = index((live.gocardless.institutions ?? []).filter((i) => !isSandbox(i)), gocardlessKeys);
  const claimedSnap = new Set<string>();
  const claimedGc = new Set<string>();
  const entries: Institution[] = [];

  for (const c of CURATED) {
    const inst = fromCurated(c, live);
    const keys = curatedKeys(c);
    if (c.category === 'banks' && live.gocardless.institutions) {
      const hit = lookup(gcIndex, keys);
      if (hit && !claimedGc.has(hit.id)) {
        upgradeToGocardless(inst, hit);
        claimedGc.add(hit.id);
      }
    }
    if ((c.category === 'brokers' || c.category === 'exchanges') && live.snaptrade.brokerages) {
      const hit = lookup(snapIndex, keys);
      if (hit && !claimedSnap.has(hit.slug)) {
        upgradeToSnaptrade(inst, hit);
        claimedSnap.add(hit.slug);
      } else if (c.connector === 'snaptrade') {
        // The slug we know is not in the live list and no name matched.
        inst.available = false;
        inst.note = SNAPTRADE_NOT_LISTED;
      }
    }
    entries.push(inst);
  }

  for (const b of live.snaptrade.brokerages ?? []) {
    if (!b.enabled || claimedSnap.has(b.slug)) continue;
    claimedSnap.add(b.slug);
    entries.push(fromSnaptrade(b));
  }
  for (const i of live.gocardless.institutions ?? []) {
    if (isSandbox(i) || claimedGc.has(i.id)) continue;
    claimedGc.add(i.id);
    entries.push(fromGocardless(i, cc));
  }

  const inCountry = entries.filter((e) => e.countries.length === 0 || e.countries.includes(cc));
  const categories: CatalogCategoryGroup[] = CATEGORY_ORDER.map((id) => ({
    id,
    ...CATEGORY_META[id],
    institutions: inCountry
      .filter((e) => e.category === id)
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en')),
  }));

  return { country: cc, countries: COUNTRIES, connectors, categories };
}

// ----- live data and cache -----

async function loadLive(country: string): Promise<LiveData> {
  const live: LiveData = {
    snaptrade: { configured: isSnaptradeConfigured(), brokerages: null },
    gocardless: { configured: isGocardlessConfigured(), institutions: null },
  };
  if (live.snaptrade.configured) {
    try {
      live.snaptrade.brokerages = await fetchSnapBrokerages();
    } catch (err) {
      console.warn('⚠️  Catalogue: SnapTrade brokerage list unavailable:', err instanceof Error ? err.message : err);
    }
  }
  const gc = getGocardlessClient();
  if (gc) {
    try {
      live.gocardless.institutions = await gc.listInstitutions(country);
    } catch (err) {
      console.warn(`⚠️  Catalogue: GoCardless institutions for ${country} unavailable:`, err instanceof Error ? err.message : err);
    }
  }
  return live;
}

const cache = new Map<string, { at: number; catalog: Catalog }>();

/** The catalogue for one country, assembled at most every ten minutes. */
export async function getCatalog(country: string): Promise<Catalog> {
  const cc = country.toUpperCase();
  const hit = cache.get(cc);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.catalog;
  const catalog = buildCatalog(cc, await loadLive(cc));
  cache.set(cc, { at: Date.now(), catalog });
  return catalog;
}

export function clearCatalogCache(): void {
  cache.clear();
}

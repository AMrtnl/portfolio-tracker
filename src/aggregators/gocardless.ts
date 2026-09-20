/**
 * GoCardless Bank Account Data (formerly Nordigen): open-banking access to
 * EU and UK bank accounts, read-only.
 *
 * Flow: list institutions for a country → create a requisition (the bank's
 * consent page) → once its status is LN, read each linked account's details,
 * balances and transactions. Tokens are short-lived and refreshed here; the
 * secrets never leave the server. Banks cap reads per account per day, so
 * callers cache what they get and fall back to the last good read.
 */
import type { Holding } from '../types/accounts';
import type { TxKind } from '../money/types';

export const GOCARDLESS_API = 'https://bankaccountdata.gocardless.com/api/v2';

const TIMEOUT_MS = 20_000;
/** Refresh a little before expiry so a request in flight never uses a dead token. */
const TOKEN_SLACK_MS = 60_000;
const INSTITUTIONS_TTL_MS = 24 * 60 * 60 * 1000;

// ----- wire shapes (only the fields we read) -----

export interface GcInstitution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  countries?: string[];
  transaction_total_days?: string | number;
}

export type RequisitionStatus = 'CR' | 'GC' | 'UA' | 'RJ' | 'SA' | 'GA' | 'LN' | 'EX' | string;

export interface GcRequisition {
  id: string;
  status: RequisitionStatus;
  accounts: string[];
  institution_id?: string;
  reference?: string;
  link?: string;
}

export interface GcAccountDetails {
  iban?: string;
  bban?: string;
  maskedPan?: string;
  currency?: string;
  name?: string;
  ownerName?: string;
  product?: string;
}

export interface GcBalance {
  balanceAmount: { amount: string; currency: string };
  balanceType?: string;
  referenceDate?: string;
}

export interface GcTransaction {
  transactionId?: string;
  bookingDate?: string;
  bookingDateTime?: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  creditorName?: string;
  debtorName?: string;
  additionalInformation?: string;
}

/** What the rest of the app works with. */
export interface NormalizedTransaction {
  date: string;
  kind: TxKind;
  amount: number;
  note: string;
  currency: string;
}

// ----- errors -----

export class GocardlessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GocardlessError';
  }
}

export const REQUISITION_STATUS_TEXT: Record<string, string> = {
  CR: 'created, the bank page has not been opened yet',
  GC: 'waiting for consent at the bank',
  UA: 'waiting for authentication at the bank',
  RJ: 'rejected at the bank',
  SA: 'waiting for the account selection',
  GA: 'access being granted',
  LN: 'linked',
  EX: 'expired; start the link again',
};

export function describeRequisitionStatus(status: string): string {
  return REQUISITION_STATUS_TEXT[status] || `status ${status}`;
}

function errorFromResponse(status: number, body: unknown): GocardlessError {
  const b = (body || {}) as { summary?: string; detail?: string };
  const detail = [b.summary, b.detail].filter(Boolean).join(': ');
  if (status === 401 || status === 403) {
    return new GocardlessError(
      `GoCardless rejected the server's credentials (${status}). Check GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY.`,
      status,
    );
  }
  if (status === 429) {
    return new GocardlessError(
      `GoCardless rate limit reached (429)${detail ? `: ${detail}` : ''}. Banks allow a few reads per account per day; try again later.`,
      status,
    );
  }
  if (status >= 500) {
    return new GocardlessError(`GoCardless is unavailable (${status}). Try again in a few minutes.`, status);
  }
  return new GocardlessError(detail ? `GoCardless: ${detail}` : `GoCardless HTTP ${status}`, status);
}

// ----- client -----

export interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<FetchResponse>;

interface TokenState {
  access: string;
  accessExpiresAt: number;
  refresh: string;
  refreshExpiresAt: number;
}

export interface GocardlessClientOptions {
  secretId: string;
  secretKey: string;
  fetch?: FetchLike;
  now?: () => number;
  baseUrl?: string;
}

export class GocardlessClient {
  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly baseUrl: string;
  private token: TokenState | null = null;
  private tokenPending: Promise<string> | null = null;
  private institutions = new Map<string, { at: number; list: GcInstitution[] }>();

  constructor(opts: GocardlessClientOptions) {
    this.secretId = opts.secretId;
    this.secretKey = opts.secretKey;
    this.fetchImpl = opts.fetch ?? ((url, init) => fetch(url, init));
    this.now = opts.now ?? (() => Date.now());
    this.baseUrl = (opts.baseUrl ?? GOCARDLESS_API).replace(/\/+$/, '');
  }

  // --- tokens ---

  private async raw<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    token?: string,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) throw errorFromResponse(res.status, parsed);
    return parsed as T;
  }

  /** A valid access token: cached, refreshed before expiry, re-issued when the refresh token is dead too. */
  async accessToken(): Promise<string> {
    const now = this.now();
    if (this.token && this.token.accessExpiresAt - TOKEN_SLACK_MS > now) return this.token.access;
    // Concurrent syncs share one token request instead of racing for new ones.
    if (!this.tokenPending) {
      this.tokenPending = this.obtainToken(now).finally(() => {
        this.tokenPending = null;
      });
    }
    return this.tokenPending;
  }

  private async obtainToken(now: number): Promise<string> {
    if (this.token && this.token.refreshExpiresAt - TOKEN_SLACK_MS > now) {
      try {
        const refreshed = await this.raw<{ access: string; access_expires: number }>(
          'POST',
          '/token/refresh/',
          { refresh: this.token.refresh },
        );
        this.token = {
          ...this.token,
          access: refreshed.access,
          accessExpiresAt: now + Number(refreshed.access_expires) * 1000,
        };
        return this.token.access;
      } catch (err) {
        // A refresh token revoked server-side is not fatal: fall through to a new pair.
        if (!(err instanceof GocardlessError) || err.status >= 500 || err.status === 429) throw err;
      }
    }
    const fresh = await this.raw<{
      access: string;
      access_expires: number;
      refresh: string;
      refresh_expires: number;
    }>('POST', '/token/new/', { secret_id: this.secretId, secret_key: this.secretKey });
    this.token = {
      access: fresh.access,
      accessExpiresAt: now + Number(fresh.access_expires) * 1000,
      refresh: fresh.refresh,
      refreshExpiresAt: now + Number(fresh.refresh_expires) * 1000,
    };
    return this.token.access;
  }

  private async get<T>(path: string): Promise<T> {
    return this.raw<T>('GET', path, undefined, await this.accessToken());
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.raw<T>('POST', path, body, await this.accessToken());
  }

  // --- reference data ---

  async listInstitutions(country: string): Promise<GcInstitution[]> {
    const key = country.toUpperCase();
    const hit = this.institutions.get(key);
    if (hit && this.now() - hit.at < INSTITUTIONS_TTL_MS) return hit.list;
    const list = await this.get<GcInstitution[]>(`/institutions/?country=${encodeURIComponent(key)}`);
    const clean = (Array.isArray(list) ? list : []).filter((i) => i && typeof i.id === 'string');
    this.institutions.set(key, { at: this.now(), list: clean });
    return clean;
  }

  /** One institution by id; the per-country caches are checked first to save a call. */
  async getInstitution(id: string): Promise<GcInstitution | null> {
    for (const { list } of this.institutions.values()) {
      const hit = list.find((i) => i.id === id);
      if (hit) return hit;
    }
    try {
      return await this.get<GcInstitution>(`/institutions/${encodeURIComponent(id)}/`);
    } catch (err) {
      if (err instanceof GocardlessError && err.status === 404) return null;
      throw err;
    }
  }

  // --- requisitions ---

  async createRequisition(input: {
    redirect: string;
    institutionId: string;
    reference: string;
    userLanguage?: string;
  }): Promise<{ id: string; link: string }> {
    const created = await this.post<{ id: string; link: string }>('/requisitions/', {
      redirect: input.redirect,
      institution_id: input.institutionId,
      reference: input.reference,
      user_language: input.userLanguage || 'EN',
    });
    if (!created?.id || !created?.link) {
      throw new GocardlessError('GoCardless did not return a bank link.', 502);
    }
    return { id: created.id, link: created.link };
  }

  async getRequisition(id: string): Promise<GcRequisition> {
    const req = await this.get<GcRequisition>(`/requisitions/${encodeURIComponent(id)}/`);
    return { ...req, accounts: Array.isArray(req?.accounts) ? req.accounts : [] };
  }

  // --- accounts ---

  async getAccountDetails(accountId: string): Promise<GcAccountDetails> {
    const res = await this.get<{ account?: GcAccountDetails }>(
      `/accounts/${encodeURIComponent(accountId)}/details/`,
    );
    return res?.account ?? {};
  }

  async getAccountBalances(accountId: string): Promise<GcBalance[]> {
    const res = await this.get<{ balances?: GcBalance[] }>(
      `/accounts/${encodeURIComponent(accountId)}/balances/`,
    );
    return (Array.isArray(res?.balances) ? res.balances : []).filter(
      (b) => b?.balanceAmount && b.balanceAmount.amount != null,
    );
  }

  async getAccountTransactions(accountId: string, dateFrom: string): Promise<GcTransaction[]> {
    const res = await this.get<{ transactions?: { booked?: GcTransaction[] } }>(
      `/accounts/${encodeURIComponent(accountId)}/transactions/?date_from=${encodeURIComponent(dateFrom)}`,
    );
    const booked = res?.transactions?.booked;
    return (Array.isArray(booked) ? booked : []).filter((t) => t?.transactionAmount);
  }
}

// ----- normalisation (pure, so the mapping is testable without a client) -----

/** Banks report several balance views; `expected` is the one that includes what is pending. */
const BALANCE_PREFERENCE = ['expected', 'interimAvailable', 'closingBooked'];

export function pickBalance(balances: GcBalance[]): GcBalance | null {
  if (balances.length === 0) return null;
  for (const wanted of BALANCE_PREFERENCE) {
    const hit = balances.find((b) => b.balanceType === wanted);
    if (hit) return hit;
  }
  return balances[0];
}

function amountOf(balance: GcBalance): number {
  const n = parseFloat(String(balance.balanceAmount.amount));
  return Number.isFinite(n) ? n : 0;
}

/**
 * One cash holding per currency, the preferred balance type within each.
 * Symbol = currency and priceUsd = 1 mirror how a manual cash balance is kept.
 */
export function holdingsFromBalances(balances: GcBalance[]): Holding[] {
  const byCurrency = new Map<string, GcBalance[]>();
  for (const b of balances) {
    const ccy = String(b.balanceAmount.currency || '').toUpperCase();
    if (!ccy) continue;
    const list = byCurrency.get(ccy) ?? [];
    list.push(b);
    byCurrency.set(ccy, list);
  }
  const out: Holding[] = [];
  for (const [ccy, list] of byCurrency) {
    const best = pickBalance(list);
    if (!best) continue;
    out.push({
      symbol: ccy,
      name: `${ccy} cash`,
      quantity: amountOf(best),
      priceUsd: 1,
      assetClass: 'cash',
    });
  }
  return out;
}

/** `…1234` from the IBAN; card accounts fall back to the masked PAN, then the BBAN. */
export function maskIdentifier(details: GcAccountDetails): string | undefined {
  const iban = (details.iban || '').replace(/\s+/g, '');
  if (iban.length >= 4) return `…${iban.slice(-4)}`;
  if (details.maskedPan) return details.maskedPan;
  const bban = (details.bban || '').replace(/\s+/g, '');
  if (bban.length >= 4) return `…${bban.slice(-4)}`;
  return undefined;
}

/** A display label: the bank's own account name, else the product, else the owner. */
export function accountLabel(details: GcAccountDetails, institution: string): string {
  const name = (details.name || details.product || '').trim();
  if (name) return name;
  const owner = (details.ownerName || '').trim();
  return owner ? `${institution} · ${owner}` : institution;
}

function noteFor(t: GcTransaction, kind: TxKind): string {
  const counterparty = (kind === 'spend' ? t.creditorName : t.debtorName)?.trim() || '';
  const remittance = (
    t.remittanceInformationUnstructured ||
    (t.remittanceInformationUnstructuredArray || []).join(' ') ||
    t.additionalInformation ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  // The remittance text usually names the merchant already ("MIGROS ZUERICH
  // HB"); prefix the counterparty only when it adds a name the text lacks.
  let note: string;
  if (counterparty && remittance && !remittance.toLowerCase().includes(counterparty.toLowerCase())) {
    note = `${counterparty} · ${remittance}`;
  } else {
    note = remittance || counterparty;
  }
  return note.slice(0, 120);
}

/** Booked rows → ledger rows. Zero amounts and undated rows are dropped. */
export function normalizeTransactions(rows: GcTransaction[]): NormalizedTransaction[] {
  const out: NormalizedTransaction[] = [];
  for (const t of rows) {
    const signed = parseFloat(String(t.transactionAmount?.amount ?? ''));
    if (!Number.isFinite(signed) || signed === 0) continue;
    const date = (t.bookingDate || t.valueDate || t.bookingDateTime || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const kind: TxKind = signed < 0 ? 'spend' : 'income';
    out.push({
      date,
      kind,
      amount: Math.round(Math.abs(signed) * 100) / 100,
      note: noteFor(t, kind),
      currency: String(t.transactionAmount.currency || '').toUpperCase(),
    });
  }
  return out;
}

// ----- process-wide client from the environment -----

let cached: GocardlessClient | null | undefined;

export function isGocardlessConfigured(): boolean {
  return Boolean(process.env.GOCARDLESS_SECRET_ID?.trim() && process.env.GOCARDLESS_SECRET_KEY?.trim());
}

export function getGocardlessClient(): GocardlessClient | null {
  if (!isGocardlessConfigured()) return null;
  if (cached === undefined) {
    cached = new GocardlessClient({
      secretId: process.env.GOCARDLESS_SECRET_ID!.trim(),
      secretKey: process.env.GOCARDLESS_SECRET_KEY!.trim(),
    });
  }
  return cached;
}

/** Reset the cached client (tests / env reload). */
export function resetGocardlessClient(): void {
  cached = undefined;
}

export function gocardlessErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'GoCardless request failed';
}

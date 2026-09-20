import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { invalidatePortfolioSnapshot } from '../analytics/portfolio';
import { liveConnectionLimit, publicBaseUrl } from '../billing/routes';
import { suggestCategory } from '../money/detect';
import { splitNewRows } from '../money/import';
import { gocardless as gocardlessProvider } from '../providers';
import type { PublicAccount } from '../types/accounts';
import { tenantFor } from '../users/tenant';
import type { Tenant } from '../users/tenant';
import type { User } from '../users/users';
import {
  GocardlessError,
  accountLabel,
  describeRequisitionStatus,
  getGocardlessClient,
  gocardlessErrorMessage,
  holdingsFromBalances,
  isGocardlessConfigured,
  maskIdentifier,
  normalizeTransactions,
} from './gocardless';
import type { GocardlessClient } from './gocardless';

const DEFAULT_DAYS = 90;
const MAX_DAYS = 730;
const DEFAULT_COUNTRY = 'CH';

/** The client the routes talk to: the real one, or whatever a test hands in. */
export type BankClient = Pick<
  GocardlessClient,
  | 'listInstitutions'
  | 'getInstitution'
  | 'createRequisition'
  | 'getRequisition'
  | 'getAccountDetails'
  | 'getAccountBalances'
  | 'getAccountTransactions'
>;

export interface ErrorBody {
  error: string;
  message?: string;
  status?: string;
  configured?: boolean;
  upgrade?: true;
}

export interface ServiceResult<T> {
  status: number;
  body: T | ErrorBody;
}

function fail(status: number, error: string, extra: Omit<ErrorBody, 'error'> = {}): ServiceResult<never> {
  return { status, body: { error, ...extra } };
}

/** GoCardless failures become 502 (upstream) unless the upstream said 429. */
function upstream(err: unknown): ServiceResult<never> {
  const status = err instanceof GocardlessError && err.status === 429 ? 429 : 502;
  return fail(status, 'GoCardless request failed', { message: gocardlessErrorMessage(err) });
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value);
}

// ----- services -----

export async function startBankLink(
  client: BankClient,
  tenant: Tenant,
  input: { institutionId: string; redirect: string },
): Promise<ServiceResult<{ url: string; reference: string }>> {
  const institutionId = (input.institutionId || '').trim();
  if (!institutionId) return fail(400, 'institutionId is required');
  let institution;
  try {
    institution = await client.getInstitution(institutionId);
  } catch (err) {
    return upstream(err);
  }
  if (!institution) return fail(400, `Unknown institution "${institutionId}"`);

  const reference = crypto.randomUUID();
  try {
    const created = await client.createRequisition({
      redirect: input.redirect,
      institutionId,
      reference,
      userLanguage: 'EN',
    });
    tenant.links.add({
      id: created.id,
      reference,
      institutionId,
      institutionName: institution.name,
      status: 'CR',
    });
    return { status: 200, body: { url: created.link, reference } };
  } catch (err) {
    return upstream(err);
  }
}

/**
 * Turns a finished requisition into accounts. Every account the bank shared
 * lands as its own row; one that could not be read still lands, marked with
 * the error, so the user sees what happened instead of a silent gap.
 */
export async function finishBankLink(
  client: BankClient,
  tenant: Tenant,
  user: User,
  reference: string,
): Promise<ServiceResult<{ imported: PublicAccount[]; institution: string }>> {
  const pending = tenant.links.findByReference((reference || '').trim());
  if (!pending) return fail(404, 'Unknown reference', { message: 'This bank link does not belong to you or was never started.' });

  let requisition;
  try {
    requisition = await client.getRequisition(pending.id);
  } catch (err) {
    return upstream(err);
  }
  tenant.links.setStatus(pending.id, requisition.status);
  if (requisition.status !== 'LN') {
    return fail(409, 'Bank link not completed', {
      message: `The bank has not finished the link yet (${describeRequisitionStatus(requisition.status)}).`,
      status: requisition.status,
    });
  }
  if (requisition.accounts.length === 0) {
    return fail(409, 'No accounts shared', {
      message: 'The bank linked but shared no accounts. Start the link again and select at least one.',
      status: requisition.status,
    });
  }

  // Re-finishing a link (page reload) must not count against the plan.
  const known = new Set(
    tenant.store
      .getAllRaw()
      .filter((a) => a.provider === 'gocardless' && a.externalId)
      .map((a) => a.externalId as string),
  );
  if (!requisition.accounts.some((id) => known.has(id))) {
    const limit = liveConnectionLimit(user, tenant.store);
    if (limit) return { status: 402, body: limit };
  }

  const imported: PublicAccount[] = [];
  for (const accountId of requisition.accounts) {
    const [detailsSettled, balancesSettled] = await Promise.allSettled([
      client.getAccountDetails(accountId),
      client.getAccountBalances(accountId),
    ]);
    const details = detailsSettled.status === 'fulfilled' ? detailsSettled.value : {};
    const errors: string[] = [];
    if (detailsSettled.status === 'rejected') errors.push(`details: ${gocardlessErrorMessage(detailsSettled.reason)}`);
    if (balancesSettled.status === 'rejected') errors.push(`balances: ${gocardlessErrorMessage(balancesSettled.reason)}`);
    const balances = balancesSettled.status === 'fulfilled' ? balancesSettled.value : [];
    const holdings = holdingsFromBalances(balances);
    const currency = (details.currency || holdings[0]?.symbol || 'EUR').toUpperCase();

    const id = tenant.store.upsertGocardlessAccount({
      externalId: accountId,
      label: accountLabel(details, pending.institutionName),
      institution: pending.institutionName,
      maskedIdentifier: maskIdentifier(details),
      currency,
      holdings,
      requisitionId: requisition.id,
    });
    if (errors.length) {
      // Never invent a balance: an unreadable account shows its error instead.
      tenant.store.updateAccount(id, { status: 'error', lastError: errors.join('; ') });
    }
    gocardlessProvider.forget(id);
    const account = tenant.store.getAccount(id);
    if (account) imported.push(account);
  }
  invalidatePortfolioSnapshot(tenant.userId);
  console.log(`✅ Linked ${imported.length} ${pending.institutionName} account(s) via GoCardless`);
  return { status: 200, body: { imported, institution: pending.institutionName } };
}

export function clampDays(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(1, Math.round(n)));
}

/** Pulls booked transactions into the money ledger, categorised and deduped. */
export async function importBankTransactions(
  client: BankClient,
  tenant: Tenant,
  accountId: string,
  days: number,
  now: Date = new Date(),
): Promise<ServiceResult<{ imported: number; skipped: number }>> {
  const account = tenant.store.getRawAccount(accountId);
  if (!account) return fail(404, 'Account not found');
  if (account.provider !== 'gocardless' || !account.externalId) {
    return fail(400, 'Only bank accounts linked through GoCardless can import transactions');
  }
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let rows;
  try {
    rows = normalizeTransactions(await client.getAccountTransactions(account.externalId, from));
  } catch (err) {
    return upstream(err);
  }
  const categorised = rows.map((row) => ({
    ...row,
    category: suggestCategory(row.note, row.kind) ?? (row.kind === 'income' ? 'other-income' : 'other'),
  }));
  const { fresh, skipped } = splitNewRows(categorised, tenant.money.listTransactions());
  try {
    tenant.money.addTransactions(
      fresh.map((row) => ({
        date: row.date,
        kind: row.kind,
        amount: row.amount,
        category: row.category,
        note: row.note || undefined,
      })),
    );
  } catch (err) {
    return fail(400, err instanceof Error ? err.message : 'Could not save the transactions');
  }
  return { status: 200, body: { imported: fresh.length, skipped } };
}

// ----- express -----

function gocardlessUnavailable(res: Response) {
  return res.status(503).json({
    error: 'GoCardless not configured',
    message:
      'Set GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY in .env. Free tier: https://bankaccountdata.gocardless.com',
    configured: false,
  });
}

function currentUser(req: Request): User {
  if (!req.user) throw new Error('No user on request — is requireApiAuth mounted before this route?');
  return req.user;
}

function send<T>(res: Response, result: ServiceResult<T>) {
  res.status(result.status).json(result.body);
}

/** `/api/connect/gocardless/*` — every handler works on the caller's own tenant. */
export function createGocardlessConnectRouter(): Router {
  const router = Router();

  router.get('/institutions', async (req: Request, res: Response) => {
    const client = getGocardlessClient();
    if (!client) return gocardlessUnavailable(res);
    const raw = req.query.country ?? DEFAULT_COUNTRY;
    if (!isCountryCode(raw)) return res.status(400).json({ error: 'country must be an ISO alpha-2 code' });
    const country = raw.toUpperCase();
    try {
      const institutions = await client.listInstitutions(country);
      res.json({
        country,
        institutions: institutions.map((i) => ({
          id: i.id,
          name: i.name,
          bic: i.bic ?? null,
          logo: i.logo ?? null,
          countries: Array.isArray(i.countries) ? i.countries : [],
        })),
      });
    } catch (err) {
      send(res, upstream(err));
    }
  });

  router.post('/start', async (req: Request, res: Response) => {
    const client = getGocardlessClient();
    if (!client) return gocardlessUnavailable(res);
    const body = (req.body ?? {}) as { institutionId?: unknown; redirect?: unknown };
    if (typeof body.institutionId !== 'string' || !body.institutionId.trim()) {
      return res.status(400).json({ error: 'institutionId is required' });
    }
    // GoCardless appends ?ref=<reference> to whatever it sends the user back to.
    const redirect =
      typeof body.redirect === 'string' && /^https?:\/\//.test(body.redirect)
        ? body.redirect
        : `${publicBaseUrl(req)}/app/connect`;
    send(res, await startBankLink(client, tenantFor(req), { institutionId: body.institutionId, redirect }));
  });

  router.post('/finish', async (req: Request, res: Response) => {
    const client = getGocardlessClient();
    if (!client) return gocardlessUnavailable(res);
    const body = (req.body ?? {}) as { reference?: unknown };
    if (typeof body.reference !== 'string' || !body.reference.trim()) {
      return res.status(400).json({ error: 'reference is required' });
    }
    send(res, await finishBankLink(client, tenantFor(req), currentUser(req), body.reference));
  });

  return router;
}

/** `POST /api/accounts/:id/transactions/import` — body `{ days? }`. */
export async function importGocardlessTransactions(req: Request, res: Response) {
  const tenant = tenantFor(req);
  const account = tenant.store.getRawAccount(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.provider !== 'gocardless') {
    return res.status(400).json({ error: 'Only bank accounts linked through GoCardless can import transactions' });
  }
  if (!isGocardlessConfigured()) return gocardlessUnavailable(res);
  const client = getGocardlessClient()!;
  const body = (req.body ?? {}) as { days?: unknown };
  send(res, await importBankTransactions(client, tenant, account.id, clampDays(body.days)));
}

/**
 * Accounts and sessions for the multi-user deployment.
 *
 * The app exposes personal finance data, so every non-public route is closed
 * unless the caller presents a valid session cookie naming a user who still
 * exists with the same sessionVersion. Sessions are stateless HMACs (see
 * users/session.ts), so no session store has to survive a restart, and a
 * password change revokes every earlier cookie by bumping the version.
 */
import crypto from 'crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { invalidatePortfolioSnapshot } from './analytics/portfolio';
import { watch } from './providers';
import { rehydrateHyperliquidAccounts, removeLiveAdapter } from './providers/hyperliquid';
import { adoptLegacyData } from './users/legacy';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  isSessionConfigured,
  issueSessionToken,
  resolveSession,
} from './users/session';
import { getTenant, removeTenantData, userDir } from './users/tenant';
import { toPublicUser } from './users/users';
import type { User, UserStore } from './users/users';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 10;
const MAX_FAILURES_GLOBAL = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;
const MAX_NAME = 80;

// ----- sign-up policy -----

export type SignupMode = 'open' | 'invite' | 'closed';

/** INVITE_CODE wins; APP_PASSWORD keeps working as the code for existing deployments. */
function inviteCode(): string {
  return (process.env.INVITE_CODE || process.env.APP_PASSWORD || '').trim();
}

/**
 * Defaults to invite-only whenever a code is configured, so an existing
 * password-gated deployment does not silently open to the public.
 */
export function signupMode(): SignupMode {
  const raw = (process.env.SIGNUP_MODE || '').trim().toLowerCase();
  if (raw === 'open' || raw === 'closed') return raw;
  if (raw === 'invite') return inviteCode() ? 'invite' : 'closed';
  return inviteCode() ? 'invite' : 'open';
}

/** One line for the startup log. */
export function describeSignupMode(): string {
  const raw = (process.env.SIGNUP_MODE || '').trim().toLowerCase();
  const mode = signupMode();
  if (raw === 'invite' && mode === 'closed') {
    return 'closed (SIGNUP_MODE=invite but no INVITE_CODE or APP_PASSWORD is set)';
  }
  if (mode === 'invite') {
    return `invite-only (code from ${process.env.INVITE_CODE ? 'INVITE_CODE' : 'APP_PASSWORD'})`;
  }
  return mode;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ----- cookies -----

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function setSessionCookie(req: Request, res: Response, token: string, maxAgeSeconds: number) {
  const secure = isProduction() || req.protocol === 'https';
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response) {
  setSessionCookie(req, res, '', 0);
}

// ----- failure rate limiting (in-memory, per process) -----

interface Bucket {
  count: number;
  resetAt: number;
}

const EMPTY_BUCKET: Bucket = { count: 0, resetAt: 0 };

const ipFailures = new Map<string, Bucket>();
let globalFailures: Bucket = { ...EMPTY_BUCKET };

/** An expired (or never-used) bucket opens a fresh window at the first hit. */
function bump(bucket: Bucket): Bucket {
  const now = Date.now();
  if (now >= bucket.resetAt) return { count: 1, resetAt: now + RATE_WINDOW_MS };
  return { count: bucket.count + 1, resetAt: bucket.resetAt };
}

function blockedFor(bucket: Bucket | undefined, max: number): number {
  if (!bucket) return 0;
  const now = Date.now();
  if (now >= bucket.resetAt || bucket.count < max) return 0;
  return Math.ceil((bucket.resetAt - now) / 1000);
}

function pruneBuckets() {
  const now = Date.now();
  for (const [key, bucket] of ipFailures) {
    if (now >= bucket.resetAt) ipFailures.delete(key);
  }
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function recordFailure(req: Request) {
  pruneBuckets();
  const ip = clientIp(req);
  ipFailures.set(ip, bump(ipFailures.get(ip) ?? EMPTY_BUCKET));
  globalFailures = bump(globalFailures);
}

/** Answers 429 and returns true when the caller is locked out. */
function rateLimited(req: Request, res: Response): boolean {
  const retryAfter = Math.max(
    blockedFor(ipFailures.get(clientIp(req)), MAX_FAILURES_PER_IP),
    blockedFor(globalFailures, MAX_FAILURES_GLOBAL),
  );
  if (retryAfter <= 0) return false;
  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json({
    error: 'Too many attempts',
    message: `Locked out. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
  });
  return true;
}

// ----- validation -----

function cleanEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return null;
  return email;
}

function passwordError(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters`;
  }
  if (value.length > MAX_PASSWORD) return `Password must be ${MAX_PASSWORD} characters or fewer`;
  return null;
}

/** Returns the trimmed name, undefined when absent, or an error string. */
function cleanName(value: unknown): { name?: string; error?: string } {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'string') return { error: 'name must be text' };
  const name = value.trim();
  if (!name) return {};
  if (name.length > MAX_NAME) return { error: `name must be ${MAX_NAME} characters or fewer` };
  return { name };
}

function notConfigured(res: Response) {
  return res.status(503).json({
    error: 'Server not configured',
    message:
      'SESSION_SECRET (or STORE_SECRET) is required in production. Set it in the hosting dashboard.',
  });
}

/** The user requireApiAuth attached; only valid behind that middleware. */
export function currentUser(req: Request): User {
  if (!req.user) throw new Error('No user on request — is requireApiAuth mounted before this route?');
  return req.user;
}

// ----- factory -----

/**
 * Everything auth-related, bound to one UserStore. Returned as an object so
 * server.ts can mount the public and the gated routers on either side of
 * the /api gate without a module-level store.
 */
export function createAuth(users: UserStore) {
  function authenticate(req: Request): User | null {
    if (!isSessionConfigured()) return null;
    return resolveSession(users, readCookie(req, SESSION_COOKIE));
  }

  /** Closes every `/api/*` route that is not explicitly public. */
  function requireApiAuth(req: Request, res: Response, next: NextFunction) {
    if (!isSessionConfigured()) return notConfigured(res);
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized', loginUrl: '/login' });
    req.user = user;
    req.tenant = getTenant(user.id);
    next();
  }

  /** Bounces unauthenticated browsers from the app shell to the SPA's login page. */
  function requireAppPage(req: Request, res: Response, next: NextFunction) {
    if (authenticate(req)) return next();
    res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
  }

  function signIn(req: Request, res: Response, user: User) {
    setSessionCookie(req, res, issueSessionToken(user), SESSION_TTL_SECONDS);
  }

  // ---- public ----

  const publicRoutes = Router();

  publicRoutes.get('/session', (req: Request, res: Response) => {
    const user = authenticate(req);
    res.json({
      authenticated: user !== null,
      user: user ? toPublicUser(user) : null,
      signup: signupMode(),
      configured: isSessionConfigured(),
    });
  });

  publicRoutes.post('/signup', (req: Request, res: Response) => {
    if (!isSessionConfigured()) return notConfigured(res);
    const mode = signupMode();
    if (mode === 'closed') return res.status(403).json({ error: 'Sign-ups are closed' });
    if (rateLimited(req, res)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = cleanEmail(body.email);
    if (!email) return res.status(400).json({ error: 'Enter a valid email address' });
    const badPassword = passwordError(body.password);
    if (badPassword) return res.status(400).json({ error: badPassword });
    const { name, error: nameError } = cleanName(body.name);
    if (nameError) return res.status(400).json({ error: nameError });

    if (mode === 'invite') {
      const supplied = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
      if (!supplied) return res.status(403).json({ error: 'Invite code required' });
      if (!safeEqual(supplied, inviteCode())) {
        recordFailure(req);
        return res.status(403).json({ error: 'That invite code is not right' });
      }
    }

    if (users.findByEmail(email)) {
      recordFailure(req);
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // The first account inherits the single-user deployment's files, which
    // must happen before its tenant is built so the stores load them.
    const first = users.count() === 0;
    const user = users.create({ email, password: body.password as string, name });
    if (first) {
      const moved = adoptLegacyData(users.dir, userDir(user.id));
      if (moved.includes('accounts.json')) {
        const { booted } = rehydrateHyperliquidAccounts(getTenant(user.id).store);
        console.log(`📂 ${booted} adopted crypto wallet(s) live for ${user.email}`);
      }
    }

    signIn(req, res, user);
    console.log(`👤 New account: ${user.email}`);
    res.status(201).json({ user: toPublicUser(user) });
  });

  publicRoutes.post('/login', (req: Request, res: Response) => {
    if (!isSessionConfigured()) return notConfigured(res);
    if (rateLimited(req, res)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = email && password ? users.findByEmail(email) : null;
    // Hash something even for an unknown email so the response time does not
    // say whether the address exists.
    const ok = user
      ? users.verifyPassword(user, password)
      : (crypto.scryptSync(password || 'x', 'wealth-hub-no-such-user', 64), false);
    if (!user || !ok) {
      recordFailure(req);
      return res.status(401).json({ error: 'Email or password is not right' });
    }

    signIn(req, res, user);
    res.json({ user: toPublicUser(user) });
  });

  publicRoutes.post('/logout', (req: Request, res: Response) => {
    clearSessionCookie(req, res);
    res.json({ authenticated: false });
  });

  // ---- behind the gate ----

  const accountRoutes = Router();

  accountRoutes.get('/me', (req: Request, res: Response) => {
    res.json({ user: toPublicUser(currentUser(req)) });
  });

  accountRoutes.patch('/me', (req: Request, res: Response) => {
    const user = currentUser(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.name !== undefined) {
      const { name, error } = cleanName(body.name);
      if (error) return res.status(400).json({ error });
      if (!name) return res.status(400).json({ error: 'name cannot be empty' });
      users.setName(user.id, name);
    }
    if (body.onboarded === true) users.markOnboarded(user.id);
    res.json({ user: toPublicUser(users.findById(user.id) ?? user) });
  });

  accountRoutes.post('/password', (req: Request, res: Response) => {
    const user = currentUser(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!current || !users.verifyPassword(user, current)) {
      return res.status(401).json({ error: 'Current password is not right' });
    }
    const badPassword = passwordError(body.newPassword);
    if (badPassword) return res.status(400).json({ error: badPassword });

    const updated = users.setPassword(user.id, body.newPassword as string);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    // The bump just revoked this request's own cookie; hand back a fresh one.
    signIn(req, res, updated);
    res.json({ ok: true });
  });

  accountRoutes.delete('/me', (req: Request, res: Response) => {
    const user = currentUser(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || !users.verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Password is not right' });
    }

    const tenant = getTenant(user.id);
    for (const account of tenant.store.getAllRaw()) {
      removeLiveAdapter(account.id);
      watch.forget(account.id);
    }
    users.remove(user.id);
    removeTenantData(user.id);
    invalidatePortfolioSnapshot(user.id);
    clearSessionCookie(req, res);
    console.log(`🗑️  Account ${user.email} deleted along with its data.`);
    res.json({ ok: true });
  });

  return { authenticate, requireApiAuth, requireAppPage, publicRoutes, accountRoutes };
}

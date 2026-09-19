/**
 * Single-user gate for the Meridian deployment.
 *
 * The app exposes personal finance data, so every non-public route is closed
 * unless the caller presents a valid session cookie. Sessions are stateless
 * HMACs derived from the configured password, so rotating the password in the
 * hosting dashboard immediately invalidates every issued cookie and no session
 * store has to survive a restart.
 */
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { renderLoginPage } from './loginPage';

const COOKIE_NAME = 'meridian_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 10;
const MAX_FAILURES_GLOBAL = 60;

export type AuthMode = 'enforced' | 'disabled' | 'misconfigured';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function configuredPassword(): string {
  return (process.env.APP_PASSWORD || process.env.AUTH_TOKEN || '').trim();
}

/**
 * `misconfigured` fails closed: in production a missing password must never
 * degrade into an open portfolio endpoint.
 */
export function authMode(): AuthMode {
  if (configuredPassword()) return 'enforced';
  return isProduction() ? 'misconfigured' : 'disabled';
}

function sessionKey(): Buffer {
  const material = `${process.env.SESSION_SECRET || process.env.STORE_SECRET || ''}::${configuredPassword()}`;
  return crypto.createHmac('sha256', 'meridian-session-v1').update(material).digest();
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function issueToken(): string {
  const payload = base64url(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
  );
  const sig = base64url(crypto.createHmac('sha256', sessionKey()).update(payload).digest());
  return `${payload}.${sig}`;
}

function tokenIsValid(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = base64url(
    crypto.createHmac('sha256', sessionKey()).update(payload).digest(),
  );
  if (!safeEqual(sig, expected)) return false;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: number };
    return typeof decoded.exp === 'number' && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

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
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function isAuthenticated(req: Request): boolean {
  const mode = authMode();
  if (mode === 'disabled') return true;
  if (mode === 'misconfigured') return false;
  return tokenIsValid(readCookie(req, COOKIE_NAME));
}

// ----- login rate limiting (in-memory, per process) -----

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

// ----- handlers -----

export function authStatusHandler(req: Request, res: Response) {
  const mode = authMode();
  res.json({
    authenticated: isAuthenticated(req),
    required: mode !== 'disabled',
    configured: mode !== 'misconfigured',
  });
}

export function loginHandler(req: Request, res: Response) {
  const mode = authMode();
  if (mode === 'misconfigured') {
    return res.status(503).json({
      error: 'Login unavailable',
      message: 'APP_PASSWORD is not set on the server. Set it in the hosting dashboard.',
    });
  }
  if (mode === 'disabled') {
    return res.json({ authenticated: true, required: false });
  }

  const retryAfter = Math.max(
    blockedFor(ipFailures.get(clientIp(req)), MAX_FAILURES_PER_IP),
    blockedFor(globalFailures, MAX_FAILURES_GLOBAL),
  );
  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many attempts',
      message: `Locked out. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
    });
  }

  const supplied = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!supplied || !safeEqual(supplied, configuredPassword())) {
    recordFailure(req);
    return res.status(401).json({ error: 'Invalid password' });
  }

  setSessionCookie(req, res, issueToken(), SESSION_TTL_SECONDS);
  res.json({ authenticated: true, required: true });
}

export function logoutHandler(req: Request, res: Response) {
  setSessionCookie(req, res, '', 0);
  res.json({ authenticated: false });
}

/** Closes every `/api/*` route that is not explicitly public. */
export function requireApiAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthenticated(req)) return next();
  if (authMode() === 'misconfigured') {
    return res.status(503).json({
      error: 'Server not configured',
      message: 'APP_PASSWORD is required in production. Set it in the hosting dashboard.',
    });
  }
  res.status(401).json({ error: 'Unauthorized', loginUrl: '/login' });
}

/** Redirects unauthenticated browsers away from the app shell. */
export function requirePageAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthenticated(req)) return next();
  res.redirect(302, '/login');
}

export function loginPageHtml(options: { error?: boolean } = {}): string {
  return renderLoginPage({ error: options.error, misconfigured: authMode() === 'misconfigured' });
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;

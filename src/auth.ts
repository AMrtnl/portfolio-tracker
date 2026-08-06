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
  const mode = authMode();
  const notice =
    mode === 'misconfigured'
      ? '<p class="notice">This deployment has no <code>APP_PASSWORD</code> set. Add it in the hosting dashboard, then reload.</p>'
      : '';
  const initialError = options.error
    ? '<p class="error" role="alert">Incorrect password.</p>'
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Meridian — Sign in</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #0b0d10; color: #e8eaed; padding: 24px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .card {
        width: 100%; max-width: 360px; padding: 28px;
        background: #14171c; border: 1px solid #23272e; border-radius: 14px;
      }
      .mark {
        width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center;
        background: #e8eaed; color: #0b0d10; font-weight: 800; margin-bottom: 18px;
      }
      h1 { margin: 0 0 4px; font-size: 19px; letter-spacing: -0.01em; }
      p.sub { margin: 0 0 22px; font-size: 13px; color: #9aa3ad; }
      label { display: block; font-size: 12px; color: #9aa3ad; margin-bottom: 7px; }
      input {
        width: 100%; padding: 11px 12px; font-size: 14px; color: #e8eaed;
        background: #0b0d10; border: 1px solid #2b3038; border-radius: 9px;
      }
      input:focus { outline: 2px solid #4c7dff; outline-offset: 1px; border-color: #4c7dff; }
      button {
        width: 100%; margin-top: 16px; padding: 11px 12px; font-size: 14px; font-weight: 600;
        color: #0b0d10; background: #e8eaed; border: 0; border-radius: 9px; cursor: pointer;
      }
      button:disabled { opacity: 0.6; cursor: progress; }
      .error, .notice { margin: 14px 0 0; font-size: 13px; }
      .error { color: #ff8080; }
      .notice { color: #ffcc66; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="mark" aria-hidden="true">M</div>
      <h1>Meridian</h1>
      <p class="sub">Private portfolio. Sign in to continue.</p>
      <form id="login-form" method="post" action="/api/auth/login">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password"
               required autofocus />
        <button type="submit" id="submit">Sign in</button>
      </form>
      ${initialError}
      ${notice}
      <p class="error" id="message" role="alert" hidden></p>
    </main>
    <script>
      const form = document.getElementById('login-form');
      const button = document.getElementById('submit');
      const message = document.getElementById('message');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.hidden = true;
        button.disabled = true;
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ password: document.getElementById('password').value }),
          });
          if (res.ok) { window.location.replace('/'); return; }
          const body = await res.json().catch(() => ({}));
          message.textContent = body.message || body.error || 'Sign in failed.';
          message.hidden = false;
        } catch {
          message.textContent = 'Network error. Try again.';
          message.hidden = false;
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;

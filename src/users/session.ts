/**
 * Stateless session cookies.
 *
 * The cookie carries `{ uid, sv, exp }` signed with HMAC-SHA256. Nothing is
 * stored server-side, so sessions survive restarts; revocation works through
 * `sv`, which must still equal the user's sessionVersion when the cookie is
 * presented. The signing key derives from SESSION_SECRET (or STORE_SECRET).
 * Production must set one of them: without it nothing can be signed and every
 * gated route fails closed rather than falling back to a guessable key.
 */
import crypto from 'crypto';
import type { User, UserStore } from './users';

export const SESSION_COOKIE = 'wh_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const DEV_SECRET = 'wealth-hub-dev-session-secret';

export interface SessionClaims {
  uid: string;
  sv: number;
  /** Unix seconds. */
  exp: number;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

let warnedDevSecret = false;

/** null means "cannot sign anything": production with no secret configured. */
export function sessionSecret(): string | null {
  const configured = (process.env.SESSION_SECRET || process.env.STORE_SECRET || '').trim();
  if (configured) return configured;
  if (isProduction()) return null;
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn(
      '⚠️  SESSION_SECRET is not set; signing sessions with a fixed dev secret (non-production only).',
    );
  }
  return DEV_SECRET;
}

export function isSessionConfigured(): boolean {
  return sessionSecret() !== null;
}

function signingKey(secret: string): Buffer {
  return crypto.createHmac('sha256', 'wealth-hub-session-v2').update(secret).digest();
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload: string, secret: string): string {
  return base64url(crypto.createHmac('sha256', signingKey(secret)).update(payload).digest());
}

/** Hashing both sides first keeps the compare constant-time for unequal lengths. */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function issueSessionToken(
  user: Pick<User, 'id' | 'sessionVersion'>,
  now: number = Date.now(),
): string {
  const secret = sessionSecret();
  if (secret === null) throw new Error('Session secret is not configured');
  const claims: SessionClaims = {
    uid: user.id,
    sv: user.sessionVersion,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = base64url(JSON.stringify(claims));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  now: number = Date.now(),
): SessionClaims | null {
  if (!token) return null;
  const secret = sessionSecret();
  if (secret === null) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  if (!safeEqual(token.slice(dot + 1), sign(payload, secret))) return null;
  try {
    const decoded = JSON.parse(fromBase64url(payload).toString('utf8')) as Partial<SessionClaims>;
    if (
      typeof decoded.uid !== 'string' ||
      typeof decoded.sv !== 'number' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }
    if (decoded.exp <= Math.floor(now / 1000)) return null;
    return { uid: decoded.uid, sv: decoded.sv, exp: decoded.exp };
  } catch {
    return null;
  }
}

/** The user a cookie stands for, or null when it is missing, forged, expired, or revoked. */
export function resolveSession(
  users: UserStore,
  token: string | undefined,
  now: number = Date.now(),
): User | null {
  const claims = verifySessionToken(token, now);
  if (!claims) return null;
  const user = users.findById(claims.uid);
  if (!user || user.sessionVersion !== claims.sv) return null;
  return user;
}

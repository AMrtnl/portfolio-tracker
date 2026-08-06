import * as SecureStore from 'expo-secure-store';
import { apiRequest, apiRequestRaw, ApiError } from '../api/client';

/**
 * Session persistence.
 *
 * The Meridian server (src/auth.ts) authenticates with a stateless HMAC session
 * delivered as an HttpOnly `meridian_session` cookie — it returns no token in the
 * response body. Browsers replay that cookie automatically; a native app has to
 * decide where to keep it.
 *
 * The cookie value is lifted out of the login response's `Set-Cookie` header and
 * stored in the iOS Keychain via expo-secure-store, then replayed as an explicit
 * `Cookie` header. The server only ever reads the `Cookie` header, so it cannot
 * tell the difference. Nothing sensitive touches AsyncStorage.
 */

const CREDENTIAL_KEY = 'meridian.session.credential';
const BIOMETRIC_KEY = 'meridian.session.biometricEnabled';
const COOKIE_NAME = 'meridian_session';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type SessionCredential =
  /** Cookie value captured from Set-Cookie and held in the Keychain. */
  | { kind: 'cookie'; value: string }
  /** Bearer token, if a future server version returns one in the body. */
  | { kind: 'bearer'; value: string }
  /**
   * The server reported `required: false` — APP_PASSWORD is unset, which it
   * permits outside production. No credential exists to store.
   */
  | { kind: 'open' }
  /**
   * Set-Cookie was not readable, so the session lives in iOS's own cookie store
   * (NSHTTPCookieStorage), which persists across launches and is replayed
   * automatically. Only the fact that a session exists is recorded here — there
   * is no token for us to protect, and signing out calls the server's logout
   * route, whose `Max-Age=0` response clears that store.
   */
  | { kind: 'native' };

export function authHeadersFor(
  credential: SessionCredential | null,
): Record<string, string> {
  if (!credential) return {};
  switch (credential.kind) {
    case 'cookie':
      return { Cookie: `${COOKIE_NAME}=${credential.value}` };
    case 'bearer':
      return { Authorization: `Bearer ${credential.value}` };
    default:
      return {};
  }
}

export async function readStoredCredential(): Promise<SessionCredential | null> {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY, SECURE_OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCredential;
    return parsed?.kind ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeStoredCredential(
  credential: SessionCredential,
): Promise<void> {
  await SecureStore.setItemAsync(
    CREDENTIAL_KEY,
    JSON.stringify(credential),
    SECURE_OPTIONS,
  );
}

export async function clearStoredCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIAL_KEY, SECURE_OPTIONS);
}

export async function readBiometricPreference(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_KEY, SECURE_OPTIONS)) === '1';
  } catch {
    return false;
  }
}

export async function writeBiometricPreference(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    BIOMETRIC_KEY,
    enabled ? '1' : '0',
    SECURE_OPTIONS,
  );
}

interface LoginResponse {
  authenticated?: boolean;
  required?: boolean;
  token?: string;
  accessToken?: string;
}

export interface SessionStatus {
  authenticated: boolean;
  required: boolean;
  configured: boolean;
}

/** Public route — safe to call with no credential. */
export function fetchSessionStatus(
  authHeaders?: Record<string, string>,
): Promise<SessionStatus> {
  return apiRequest<SessionStatus>('/api/auth/session', {
    authHeaders: authHeaders ?? {},
    skipAuthHandling: true,
    timeoutMs: 15_000,
  });
}

/** Extracts our session cookie from a raw Set-Cookie header value. */
function parseSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  // iOS may fold multiple Set-Cookie headers into one comma-joined string.
  const match = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;,\\s]+)`));
  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

/**
 * Exchanges the password for a session. Prefers a body token, then the
 * Set-Cookie value, then the platform cookie store.
 */
export async function login(password: string): Promise<SessionCredential> {
  const { data, headers } = await apiRequestRaw<LoginResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: { password },
      authHeaders: {},
      skipAuthHandling: true,
    },
  );

  const bearer = data.token ?? data.accessToken;
  if (bearer) return { kind: 'bearer', value: bearer };

  const cookie = parseSessionCookie(headers.get('set-cookie'));
  if (cookie) return { kind: 'cookie', value: cookie };

  // The server answers `required: false` when APP_PASSWORD is unset, which it
  // allows outside production. There is nothing to store.
  if (data.required === false) return { kind: 'open' };

  if (data.authenticated) return { kind: 'native' };

  throw new ApiError(
    502,
    'The server accepted the password but issued no session.',
    'Expected a meridian_session cookie or a token in the response.',
  );
}

/** Confirms a credential is still accepted before trusting it. */
export async function verifyCredential(
  credential: SessionCredential,
): Promise<boolean> {
  const status = await fetchSessionStatus(authHeadersFor(credential));
  return status.authenticated || !status.required;
}

/** Best-effort server-side invalidation; the local wipe happens regardless. */
export async function revokeSession(
  credential: SessionCredential | null,
): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      authHeaders: authHeadersFor(credential),
      skipAuthHandling: true,
      timeoutMs: 8_000,
    });
  } catch {
    // Offline or already expired — nothing to salvage.
  }
}

import Constants from 'expo-constants';

/**
 * HTTP layer for the private Meridian API.
 *
 * This app holds NO brokerage credentials. SnapTrade's Personal API key
 * (SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY) identifies the account owner
 * and must never ship inside a distributed binary — see
 * https://docs.snaptrade.com/docs/build-with-ai.md. Every brokerage call is made
 * server-side by the user's own Railway deployment; the app only ever sees
 * normalized, read-only view models.
 */

const rawBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  '';

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export class ApiConfigError extends Error {
  constructor() {
    super(
      'EXPO_PUBLIC_API_URL is not set. Point it at your Railway deployment (see mobile/README.md).',
    );
    this.name = 'ApiConfigError';
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly body?: unknown;

  constructor(status: number, message: string, detail?: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.body = body;
  }

  /** 401/403 mean the stored session is no longer usable. */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** The API returns 503 when a provider is not configured at all. */
  get isNotConfigured(): boolean {
    return this.status === 503;
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(
      'Could not reach the Meridian API. Check your connection and that the server is running.',
    );
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

type HeaderReader = () => Record<string, string>;
type UnauthorizedHandler = () => void;

let readAuthHeaders: HeaderReader = () => ({});
let onUnauthorized: UnauthorizedHandler = () => {};

/**
 * Wired up once by AuthProvider so queries never handle credentials themselves.
 * Headers rather than a bare token, because the server issues an HttpOnly
 * session cookie — see src/auth/session.ts.
 */
export function configureApiAuth(options: {
  getAuthHeaders: HeaderReader;
  onUnauthorized: UnauthorizedHandler;
}) {
  readAuthHeaders = options.getAuthHeaders;
  onUnauthorized = options.onUnauthorized;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Skip the global 401 handler — used by the login call itself. */
  skipAuthHandling?: boolean;
  /**
   * Send these auth headers instead of the stored session. Login uses it to
   * validate a candidate credential before committing it to the Keychain.
   */
  authHeaders?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Response plus the headers, which login needs in order to read Set-Cookie. */
export interface RawResponse<T> {
  data: T;
  headers: Headers;
}

async function readErrorBody(
  response: Response,
): Promise<{ message?: string; detail?: string; body?: unknown }> {
  try {
    const text = await response.text();
    if (!text) return {};
    try {
      const json = JSON.parse(text) as {
        error?: string;
        message?: string;
        [key: string]: unknown;
      };
      return {
        message: json.error ?? json.message,
        detail: json.error && json.message ? json.message : undefined,
        body: json,
      };
    } catch {
      return { message: text.slice(0, 300) };
    }
  } catch {
    return {};
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return (await apiRequestRaw<T>(path, options)).data;
}

export async function apiRequestRaw<T>(
  path: string,
  options: RequestOptions = {},
): Promise<RawResponse<T>> {
  if (!API_BASE_URL) throw new ApiConfigError();

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 20_000,
  );
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), {
      once: true,
    });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.authHeaders ?? readAuthHeaders()),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const { message, detail, body } = await readErrorBody(response);
    const error = new ApiError(
      response.status,
      message ?? `Request failed (${response.status})`,
      detail,
      body,
    );
    if (error.isAuthFailure && !options.skipAuthHandling) onUnauthorized();
    throw error;
  }

  if (response.status === 204) {
    return { data: undefined as T, headers: response.headers };
  }
  return { data: (await response.json()) as T, headers: response.headers };
}

/** Human-readable message for any thrown value, for error UI. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ? `${error.message} — ${error.detail}` : error.message;
  }
  if (error instanceof ApiConfigError || error instanceof NetworkError) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  // Section-level failures arrive as plain strings in the SnapTrade view models.
  if (typeof error === 'string' && error.trim()) return error;
  return 'Something went wrong.';
}

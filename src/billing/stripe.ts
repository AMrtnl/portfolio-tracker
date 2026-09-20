/**
 * The slice of Stripe this server needs: Checkout, the customer portal, one
 * subscription read, and webhook signatures. Plain `fetch` with form-encoded
 * bodies keeps the dependency list unchanged.
 */
import crypto from 'crypto';
import type { PlanId } from './plans';

const STRIPE_API = 'https://api.stripe.com/v1';
const TIMEOUT_MS = 15_000;

export type BillingInterval = 'month' | 'year';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  prices: Record<Exclude<PlanId, 'free'>, Record<BillingInterval, string>>;
}

export function isStripeConfigured(): boolean {
  return Boolean((process.env.STRIPE_SECRET_KEY || '').trim());
}

/** null until STRIPE_SECRET_KEY is set; missing price ids just make that plan unbuyable. */
export function stripeConfig(): StripeConfig | null {
  const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) return null;
  const env = (name: string) => (process.env[name] || '').trim();
  return {
    secretKey,
    webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
    prices: {
      plus: { month: env('STRIPE_PRICE_PLUS_MONTHLY'), year: env('STRIPE_PRICE_PLUS_YEARLY') },
      family: {
        month: env('STRIPE_PRICE_FAMILY_MONTHLY'),
        year: env('STRIPE_PRICE_FAMILY_YEARLY'),
      },
    },
  };
}

/** Which plan and interval a Stripe price id stands for, or null when it is not ours. */
export function planForPrice(
  priceId: string | undefined | null,
  config: Pick<StripeConfig, 'prices'>,
): { plan: Exclude<PlanId, 'free'>; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of ['plus', 'family'] as const) {
    for (const interval of ['month', 'year'] as const) {
      if (config.prices[plan][interval] && config.prices[plan][interval] === priceId) {
        return { plan, interval };
      }
    }
  }
  return null;
}

// ----- HTTP -----

export interface StripeResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type StripeFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<StripeResponse>;

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

/** Nested objects become Stripe's bracket syntax: `line_items[0][price]=…`. */
export function encodeForm(params: Record<string, unknown>, prefix = ''): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (value: unknown, key: string) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${key}[${i}]`));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, key ? `${key}[${k}]` : k);
      }
    } else {
      out.append(key, String(value));
    }
  };
  walk(params, prefix);
  return out;
}

export interface CheckoutSessionInput {
  customer?: string;
  customerEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId: string;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  /** Older API versions put the period on the subscription… */
  current_period_end?: number;
  /** …newer ones on each item. */
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number }> };
}

export class StripeClient {
  constructor(
    private readonly secretKey: string,
    private readonly fetchImpl: StripeFetch = (url, init) => fetch(url, init),
  ) {}

  private async request<T>(method: 'GET' | 'POST', path: string, form?: URLSearchParams): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      Accept: 'application/json',
    };
    if (form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const res = await this.fetchImpl(`${STRIPE_API}${path}`, {
      method,
      headers,
      body: form?.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const detail = (body as { error?: { message?: string } } | null)?.error?.message;
      throw new StripeError(detail || `Stripe HTTP ${res.status}`, res.status);
    }
    return body as T;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }> {
    const form = encodeForm({
      mode: 'subscription',
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.clientReferenceId,
      // An existing customer keeps one Stripe record; otherwise Stripe creates it from the email.
      customer: input.customer,
      customer_email: input.customer ? undefined : input.customerEmail,
      allow_promotion_codes: true,
    });
    return this.request('POST', '/checkout/sessions', form);
  }

  async createPortalSession(input: { customer: string; returnUrl: string }): Promise<{ url: string }> {
    const form = encodeForm({ customer: input.customer, return_url: input.returnUrl });
    return this.request('POST', '/billing_portal/sessions', form);
  }

  async getSubscription(id: string): Promise<StripeSubscription> {
    return this.request('GET', `/subscriptions/${encodeURIComponent(id)}`);
  }
}

// ----- webhooks -----

export function signWebhookPayload(payload: string | Buffer, secret: string, timestamp: number): string {
  const body = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

/**
 * Stripe's `t=…,v1=…` scheme: HMAC-SHA256 over `${t}.${rawBody}`. Any of the
 * `v1` entries may match (secrets roll over), and `t` must be within the
 * tolerance so a captured request cannot be replayed later.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  header: string | undefined,
  secret: string,
  toleranceSec = 300,
  now: number = Date.now(),
): boolean {
  if (!header || !secret) return false;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = Number(value);
    else if (key === 'v1') signatures.push(value);
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSec) return false;

  const expected = Buffer.from(signWebhookPayload(rawBody, secret, timestamp), 'hex');
  return signatures.some((sig) => {
    let given: Buffer;
    try {
      given = Buffer.from(sig, 'hex');
    } catch {
      return false;
    }
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

/** Unix seconds → ISO string, or null when Stripe sent nothing. */
export function isoFromUnix(seconds: number | undefined | null): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

export function subscriptionPriceId(sub: StripeSubscription): string | undefined {
  return sub.items?.data?.[0]?.price?.id;
}

export function subscriptionPeriodEnd(sub: StripeSubscription): number | undefined {
  return sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
}

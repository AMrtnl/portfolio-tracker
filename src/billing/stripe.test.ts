import {
  StripeClient,
  encodeForm,
  planForPrice,
  signWebhookPayload,
  stripeConfig,
  verifyWebhookSignature,
} from './stripe';

const SECRET = 'whsec_test_secret';
const BODY = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
const NOW = Date.parse('2026-09-20T12:00:00Z');

function header(body: string, secret: string, atMs: number): string {
  const t = Math.floor(atMs / 1000);
  return `t=${t},v1=${signWebhookPayload(body, secret, t)}`;
}

describe('verifyWebhookSignature', () => {
  it('accepts a signature computed over the raw body within the tolerance', () => {
    expect(verifyWebhookSignature(BODY, header(BODY, SECRET, NOW), SECRET, 300, NOW)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from(BODY), header(BODY, SECRET, NOW - 200_000), SECRET, 300, NOW)).toBe(true);
  });

  it('rejects a tampered body or the wrong secret', () => {
    const sig = header(BODY, SECRET, NOW);
    expect(verifyWebhookSignature(BODY.replace('evt_1', 'evt_2'), sig, SECRET, 300, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, sig, 'whsec_other', 300, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, sig, '', 300, NOW)).toBe(false);
  });

  it('rejects an expired or malformed header', () => {
    expect(verifyWebhookSignature(BODY, header(BODY, SECRET, NOW - 301_000), SECRET, 300, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, header(BODY, SECRET, NOW + 301_000), SECRET, 300, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, undefined, SECRET, 300, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, 'garbage', SECRET, 300, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${Math.floor(NOW / 1000)}`, SECRET, 300, NOW)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${Math.floor(NOW / 1000)},v1=zz`, SECRET, 300, NOW)).toBe(false);
  });

  it('accepts any one of several v1 signatures, as during a secret rollover', () => {
    const t = Math.floor(NOW / 1000);
    const stale = signWebhookPayload(BODY, 'whsec_old', t);
    const good = signWebhookPayload(BODY, SECRET, t);
    expect(verifyWebhookSignature(BODY, `t=${t},v1=${stale},v1=${good}`, SECRET, 300, NOW)).toBe(true);
    expect(verifyWebhookSignature(BODY, `t=${t},v0=x,v1=${stale}`, SECRET, 300, NOW)).toBe(false);
  });
});

describe('encodeForm and prices', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses Stripe bracket syntax for nested fields and drops empty ones', () => {
    const form = encodeForm({
      mode: 'subscription',
      line_items: [{ price: 'price_1', quantity: 1 }],
      customer: undefined,
      customer_email: 'a@b.c',
      allow_promotion_codes: true,
    });
    expect(form.toString()).toBe(
      'mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&customer_email=a%40b.c&allow_promotion_codes=true',
    );
  });

  it('reads the price ids from the environment and maps them back to plans', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(stripeConfig()).toBeNull();
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_PRICE_PLUS_MONTHLY = 'price_pm';
    process.env.STRIPE_PRICE_FAMILY_YEARLY = 'price_fy';
    const config = stripeConfig()!;
    expect(config.prices.plus.month).toBe('price_pm');
    expect(planForPrice('price_pm', config)).toEqual({ plan: 'plus', interval: 'month' });
    expect(planForPrice('price_fy', config)).toEqual({ plan: 'family', interval: 'year' });
    expect(planForPrice('price_unknown', config)).toBeNull();
    // An unset price id must never match an empty string from Stripe.
    expect(planForPrice('', config)).toBeNull();
  });
});

describe('StripeClient', () => {
  it('posts form-encoded bodies with the bearer key and surfaces Stripe errors', async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = [];
    const fetchImpl = jest.fn(async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
      calls.push({ url, init });
      if (url.endsWith('/checkout/sessions')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }) };
      }
      return { ok: false, status: 402, text: async () => JSON.stringify({ error: { message: 'Card declined' } }) };
    });
    const client = new StripeClient('sk_test_x', fetchImpl as never);

    const session = await client.createCheckoutSession({
      customerEmail: 'jane@example.com',
      priceId: 'price_pm',
      successUrl: 'https://x/ok',
      cancelUrl: 'https://x/no',
      clientReferenceId: 'u1',
    });
    expect(session.url).toBe('https://checkout.stripe.com/x');
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(calls[0].init.headers.Authorization).toBe('Bearer sk_test_x');
    expect(calls[0].init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(calls[0].init.body).toContain('client_reference_id=u1');
    expect(calls[0].init.body).toContain('customer_email=jane%40example.com');
    expect(calls[0].init.body).not.toContain('customer=');

    await expect(client.createPortalSession({ customer: 'cus_1', returnUrl: 'https://x' })).rejects.toThrow('Card declined');
  });
});

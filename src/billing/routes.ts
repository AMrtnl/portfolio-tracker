import { Router } from 'express';
import type { Request, RequestHandler, Response } from 'express';
import type { Store } from '../store';
import { tenantFor } from '../users/tenant';
import type { User, UserStore } from '../users/users';
import {
  PLANS,
  effectivePlan,
  entitlementsFor,
  isPlanId,
  isPreviewMode,
  serializePlans,
} from './plans';
import type { PlanId } from './plans';
import {
  StripeClient,
  isStripeConfigured,
  isoFromUnix,
  planForPrice,
  stripeConfig,
  subscriptionPeriodEnd,
  subscriptionPriceId,
  verifyWebhookSignature,
} from './stripe';
import type { StripeConfig, StripeSubscription } from './stripe';

/** Where Stripe and the bank redirect flows send people back to. */
export function publicBaseUrl(req: Request): string {
  const configured = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The user requireApiAuth attached; same contract as auth.ts's currentUser. */
function currentUser(req: Request): User {
  if (!req.user) throw new Error('No user on request — is requireApiAuth mounted before this route?');
  return req.user;
}

// ----- enforcement -----

/** Accounts that read from somewhere: everything but a figure kept by hand. */
export function countLiveConnections(store: Store): number {
  return store.getAllRaw().filter((a) => a.provider !== 'manual').length;
}

export interface PlanLimit {
  error: string;
  message: string;
  upgrade: true;
}

/**
 * The 402 body when this user cannot add one more live connection, or null
 * when they can. Never blocks in preview mode.
 */
export function liveConnectionLimit(user: User, store: Store): PlanLimit | null {
  const { plan } = effectivePlan(user);
  const limit = PLANS[plan].liveConnections;
  if (!Number.isFinite(limit)) return null;
  if (countLiveConnections(store) < limit) return null;
  return {
    error: 'Plan limit reached',
    message: `${PLANS[plan].name} includes ${limit} live connections. Upgrade to Plus for unlimited.`,
    upgrade: true,
  };
}

/** Answers 402 and returns true when the caller's plan has no slot left. */
export function requireLiveConnectionSlot(req: Request, res: Response): boolean {
  const limit = liveConnectionLimit(currentUser(req), tenantFor(req).store);
  if (!limit) return false;
  res.status(402).json(limit);
  return true;
}

// ----- webhook events -----

export interface StripeEvent {
  id?: string;
  type: string;
  data: { object: Record<string, unknown> };
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  // Expanded objects carry their id inline.
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return undefined;
}

const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

function applySubscription(
  users: UserStore,
  user: User,
  sub: StripeSubscription,
  config: Pick<StripeConfig, 'prices'>,
): void {
  const priced = planForPrice(subscriptionPriceId(sub), config);
  const entitled = ENTITLED_STATUSES.has(sub.status) && priced !== null;
  const plan: PlanId = entitled ? priced!.plan : 'free';
  if (!entitled && priced === null && ENTITLED_STATUSES.has(sub.status)) {
    console.warn(`⚠️  Stripe subscription ${sub.id} has a price this server does not know; treating as Free.`);
  }
  users.setPlan(user.id, {
    plan,
    source: 'stripe',
    stripeCustomerId: str(sub.customer) ?? user.stripeCustomerId,
    stripeSubscriptionId: sub.id,
    renewsAt: entitled ? isoFromUnix(subscriptionPeriodEnd(sub)) : null,
  });
  console.log(`💳 ${user.email} → ${PLANS[plan].name} (Stripe ${sub.status})`);
}

/**
 * Turns a verified Stripe event into a plan change. Unknown event types are
 * accepted and ignored so the endpoint can be subscribed to more than it uses.
 */
export async function handleStripeEvent(
  event: StripeEvent,
  users: UserStore,
  stripe: Pick<StripeClient, 'getSubscription'>,
  config: Pick<StripeConfig, 'prices'>,
): Promise<void> {
  const object = event.data?.object ?? {};
  switch (event.type) {
    case 'checkout.session.completed': {
      if (object.mode && object.mode !== 'subscription') return;
      const userId = str(object.client_reference_id);
      const customer = str(object.customer);
      const subscriptionId = str(object.subscription);
      const user = userId ? users.findById(userId) : null;
      if (!user) {
        console.warn(`⚠️  Stripe checkout completed for unknown user ${userId ?? '(none)'}`);
        return;
      }
      if (customer) users.setPlan(user.id, { plan: user.plan, source: user.planSource, stripeCustomerId: customer });
      if (!subscriptionId) return;
      const sub = await stripe.getSubscription(subscriptionId);
      applySubscription(users, user, sub, config);
      return;
    }
    case 'customer.subscription.updated': {
      const sub = object as unknown as StripeSubscription;
      const user = users.findByStripeCustomer(str(sub.customer) ?? '');
      if (!user) return;
      applySubscription(users, user, sub, config);
      return;
    }
    case 'customer.subscription.deleted': {
      const sub = object as unknown as StripeSubscription;
      const user = users.findByStripeCustomer(str(sub.customer) ?? '');
      if (!user) return;
      users.setPlan(user.id, { plan: 'free', source: 'stripe', stripeSubscriptionId: null, renewsAt: null });
      console.log(`💳 ${user.email} → Free (subscription ended)`);
      return;
    }
    default:
      return;
  }
}

// ----- routes -----

export interface BillingDeps {
  /** Overridable for tests; defaults to a client on STRIPE_SECRET_KEY. */
  stripe?: (config: StripeConfig) => StripeClient;
}

function defaultClient(config: StripeConfig): StripeClient {
  return new StripeClient(config.secretKey);
}

function stripeUnavailable(res: Response) {
  return res.status(503).json({
    error: 'Billing not configured',
    message: 'Set STRIPE_SECRET_KEY and the STRIPE_PRICE_* ids to enable checkout.',
    configured: false,
  });
}

/** Gated routes: what the user has, checkout, and the portal. */
export function createBillingRouter(users: UserStore, deps: BillingDeps = {}): Router {
  const router = Router();
  const client = deps.stripe ?? defaultClient;

  router.get('/', (req: Request, res: Response) => {
    const user = users.findById(currentUser(req).id) ?? currentUser(req);
    const plan = effectivePlan(user);
    res.json({
      plan: plan.plan,
      source: plan.source,
      preview: isPreviewMode(),
      stripeConfigured: isStripeConfigured(),
      renewsAt: user.planRenewsAt ?? null,
      entitlements: entitlementsFor(user),
      usage: { liveConnections: countLiveConnections(tenantFor(req).store) },
      plans: serializePlans(),
    });
  });

  router.post('/checkout', async (req: Request, res: Response) => {
    const config = stripeConfig();
    if (!config) return stripeUnavailable(res);
    const body = (req.body ?? {}) as { plan?: unknown; interval?: unknown; successUrl?: unknown; cancelUrl?: unknown };
    if (!isPlanId(body.plan) || body.plan === 'free') {
      return res.status(400).json({ error: 'plan must be plus or family' });
    }
    const interval = body.interval === 'year' ? 'year' : body.interval === 'month' || body.interval === undefined ? 'month' : null;
    if (!interval) return res.status(400).json({ error: 'interval must be month or year' });
    const priceId = config.prices[body.plan][interval];
    if (!priceId) {
      return res.status(503).json({
        error: 'Price not configured',
        message: `No Stripe price id for ${body.plan} / ${interval} on this server.`,
        configured: false,
      });
    }
    const user = users.findById(currentUser(req).id) ?? currentUser(req);
    const base = publicBaseUrl(req);
    try {
      const session = await client(config).createCheckoutSession({
        customer: user.stripeCustomerId,
        customerEmail: user.email,
        priceId,
        successUrl: typeof body.successUrl === 'string' ? body.successUrl : `${base}/app/settings?billing=success`,
        cancelUrl: typeof body.cancelUrl === 'string' ? body.cancelUrl : `${base}/app/settings?billing=cancelled`,
        clientReferenceId: user.id,
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(502).json({ error: 'Could not start checkout', message: message(err) });
    }
  });

  router.post('/portal', async (req: Request, res: Response) => {
    const config = stripeConfig();
    if (!config) return stripeUnavailable(res);
    const user = users.findById(currentUser(req).id) ?? currentUser(req);
    if (!user.stripeCustomerId) {
      return res.status(409).json({
        error: 'No billing account yet',
        message: 'Subscribe first; the portal manages an existing subscription.',
      });
    }
    const body = (req.body ?? {}) as { returnUrl?: unknown };
    try {
      const session = await client(config).createPortalSession({
        customer: user.stripeCustomerId,
        returnUrl: typeof body.returnUrl === 'string' ? body.returnUrl : `${publicBaseUrl(req)}/app/settings`,
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(502).json({ error: 'Could not open the billing portal', message: message(err) });
    }
  });

  return router;
}

/**
 * Public webhook. Must be mounted with `express.raw` before the JSON parser:
 * the signature covers the exact bytes Stripe sent.
 */
export function createBillingWebhook(users: UserStore, deps: BillingDeps = {}): RequestHandler {
  const client = deps.stripe ?? defaultClient;
  return async (req: Request, res: Response) => {
    const config = stripeConfig();
    if (!config) return stripeUnavailable(res);
    if (!config.webhookSecret) {
      return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET is not set' });
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : '');
    const header = req.get('stripe-signature');
    if (!verifyWebhookSignature(raw, header, config.webhookSecret)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    let event: StripeEvent;
    try {
      event = JSON.parse(raw.toString('utf8')) as StripeEvent;
      if (!event || typeof event.type !== 'string') throw new Error('no type');
    } catch {
      return res.status(400).json({ error: 'Invalid event' });
    }
    try {
      await handleStripeEvent(event, users, client(config), config);
      res.json({ received: true });
    } catch (err) {
      // A 5xx makes Stripe retry, which is what we want for a transient failure.
      console.error(`❌ Stripe event ${event.type} failed:`, message(err));
      res.status(500).json({ error: 'Event handling failed', message: message(err) });
    }
  };
}

/** One line for the startup log. */
export function describeBilling(): string {
  if (isPreviewMode()) {
    return `preview mode (every account is Plus)${isStripeConfigured() ? ' · Stripe keys present but PREVIEW_MODE=true' : ''}`;
  }
  return isStripeConfigured()
    ? 'Stripe (plans enforced · webhook at /api/billing/webhook)'
    : 'plans enforced without Stripe (PREVIEW_MODE=false; upgrades need STRIPE_SECRET_KEY)';
}

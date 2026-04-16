import { Router, Request, Response } from 'express';
import { requireAuth, getUserId } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import {
  lemonSqueezySetup,
  createCheckout,
  getCustomer,
  listSubscriptions,
} from '@lemonsqueezy/lemonsqueezy.js';
import crypto from 'crypto';

const router = Router();

function setupLS() {
  lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY ?? '' });
}

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Get started with FinVault',
    features: [
      '3 connected accounts',
      'Portfolio overview',
      'Basic market data',
      '7-day history',
    ],
    limits: { accounts: 3, history: 7, ai: false, alerts: 3 },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    variantId: process.env.LS_PRO_VARIANT_ID,
    description: 'For serious traders',
    features: [
      'Unlimited accounts',
      'AI portfolio advisor',
      'Unlimited alerts',
      '1-year history',
      '0x Token swaps',
      'Hyperliquid trading',
    ],
    limits: { accounts: Infinity, history: 365, ai: true, alerts: Infinity },
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 49,
    variantId: process.env.LS_BUSINESS_VARIANT_ID,
    description: 'For power users & teams',
    features: [
      'Everything in Pro',
      'AAVE positions',
      'CSV / JSON export',
      'Priority support',
      'API access',
      'Multiple wallets',
    ],
    limits: { accounts: Infinity, history: Infinity, ai: true, alerts: Infinity },
  },
];

// GET /api/billing/plans
router.get('/plans', (_req: Request, res: Response) => {
  res.json(PLANS);
});

// GET /api/billing/subscription
router.get('/subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const plan = await prisma.userPlan.findUnique({ where: { userId } });
    res.json(plan ?? { plan: 'free', userId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/billing/checkout
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    setupLS();
    const userId = getUserId(req);
    const { planId } = req.body;

    const plan = PLANS.find(p => p.id === planId);
    if (!plan?.variantId) return res.status(400).json({ error: 'Invalid plan' });

    const checkout = await createCheckout(
      process.env.LEMONSQUEEZY_STORE_ID ?? '',
      plan.variantId,
      {
        checkoutData: {
          custom: { userId },
        },
        productOptions: {
          redirectUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/billing/success`,
        },
      }
    );

    res.json({ url: (checkout.data as any)?.data?.attributes?.url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/billing/webhook  (LemonSqueezy → FinVault)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '';
    const signature = req.headers['x-signature'] as string;
    const payload = JSON.stringify(req.body);

    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (hmac !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    const eventName: string = event.meta?.event_name ?? '';
    const attrs = event.data?.attributes ?? {};
    const userId: string = event.meta?.custom_data?.userId ?? '';

    if (!userId) return res.status(200).json({ ok: true });

    const subscriptionData = {
      lsSubscriptionId: String(event.data?.id ?? ''),
      lsCustomerId: String(attrs.customer_id ?? ''),
      lsVariantId: String(attrs.variant_id ?? ''),
      lsStatus: attrs.status ?? 'active',
      lsCurrentPeriodEnd: attrs.renews_at ? new Date(attrs.renews_at) : null,
    };

    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const variantId = String(attrs.variant_id ?? '');
      const plan =
        variantId === process.env.LS_BUSINESS_VARIANT_ID
          ? 'business'
          : variantId === process.env.LS_PRO_VARIANT_ID
          ? 'pro'
          : 'free';

      await prisma.userPlan.upsert({
        where: { userId },
        update: { ...subscriptionData, plan },
        create: { userId, ...subscriptionData, plan },
      });
    }

    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      await prisma.userPlan.upsert({
        where: { userId },
        update: { plan: 'free', lsStatus: 'cancelled' },
        create: { userId, plan: 'free', lsStatus: 'cancelled' },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

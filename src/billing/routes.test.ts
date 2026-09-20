import fs from 'fs';
import os from 'os';
import path from 'path';
import { Store } from '../store';
import { UserStore } from '../users/users';
import type { User } from '../users/users';
import { handleStripeEvent, liveConnectionLimit, requireLiveConnectionSlot } from './routes';
import type { StripeEvent } from './routes';
import type { StripeSubscription } from './stripe';

const prices = { prices: { plus: { month: 'price_pm', year: 'price_py' }, family: { month: 'price_fm', year: 'price_fy' } } };

function event(type: string, object: Record<string, unknown>): StripeEvent {
  return { id: 'evt', type, data: { object } };
}

describe('Stripe events', () => {
  let dir: string;
  let users: UserStore;
  let user: User;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PREVIEW_MODE = 'false';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-billing-'));
    users = new UserStore(dir);
    user = users.create({ email: 'jane@example.com', password: 'a long password' });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const subscription = (over: Partial<StripeSubscription> = {}): StripeSubscription => ({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    current_period_end: 1_790_000_000,
    items: { data: [{ price: { id: 'price_pm' } }] },
    ...over,
  });

  it('activates the plan a completed checkout paid for', async () => {
    const stripe = { getSubscription: jest.fn(async () => subscription()) };
    await handleStripeEvent(
      event('checkout.session.completed', { mode: 'subscription', client_reference_id: user.id, customer: 'cus_1', subscription: 'sub_1' }),
      users,
      stripe,
      prices,
    );
    expect(stripe.getSubscription).toHaveBeenCalledWith('sub_1');
    const updated = users.findById(user.id)!;
    expect(updated).toMatchObject({
      plan: 'plus',
      planSource: 'stripe',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      planRenewsAt: new Date(1_790_000_000 * 1000).toISOString(),
    });
    expect(users.findByStripeCustomer('cus_1')?.id).toBe(user.id);
    expect(new UserStore(dir).findById(user.id)?.plan).toBe('plus');
  });

  it('follows subscription updates: plan changes, cancellation, and the period end on items', async () => {
    users.setPlan(user.id, { plan: 'plus', source: 'stripe', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
    const stripe = { getSubscription: jest.fn() };

    await handleStripeEvent(
      event('customer.subscription.updated', {
        ...subscription({ current_period_end: undefined, items: { data: [{ price: { id: 'price_fy' }, current_period_end: 1_800_000_000 }] } }),
      }),
      users,
      stripe,
      prices,
    );
    expect(users.findById(user.id)).toMatchObject({ plan: 'family', planRenewsAt: new Date(1_800_000_000 * 1000).toISOString() });

    await handleStripeEvent(event('customer.subscription.updated', { ...subscription({ status: 'canceled' }) }), users, stripe, prices);
    expect(users.findById(user.id)).toMatchObject({ plan: 'free', planSource: 'stripe', planRenewsAt: null });

    await handleStripeEvent(event('customer.subscription.updated', { ...subscription({ status: 'active' }) }), users, stripe, prices);
    expect(users.findById(user.id)?.plan).toBe('plus');

    await handleStripeEvent(event('customer.subscription.deleted', { ...subscription() }), users, stripe, prices);
    expect(users.findById(user.id)).toMatchObject({ plan: 'free', stripeCustomerId: 'cus_1', planRenewsAt: null });
    expect(users.findById(user.id)?.stripeSubscriptionId).toBeUndefined();
    expect(stripe.getSubscription).not.toHaveBeenCalled();
  });

  it('ignores events for unknown users, unknown prices, and unknown types', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const stripe = { getSubscription: jest.fn(async () => subscription({ items: { data: [{ price: { id: 'price_other' } }] } })) };
      await handleStripeEvent(event('customer.subscription.updated', { ...subscription() }), users, stripe, prices);
      await handleStripeEvent(event('checkout.session.completed', { client_reference_id: 'nobody', subscription: 'sub_1' }), users, stripe, prices);
      await handleStripeEvent(event('invoice.paid', {}), users, stripe, prices);
      expect(users.findById(user.id)?.plan).toBe('free');

      await handleStripeEvent(event('checkout.session.completed', { client_reference_id: user.id, customer: 'cus_1', subscription: 'sub_1' }), users, stripe, prices);
      expect(users.findById(user.id)).toMatchObject({ plan: 'free', stripeCustomerId: 'cus_1' });
    } finally {
      warn.mockRestore();
    }
  });
});

describe('live connection limit', () => {
  let dir: string;
  let store: Store;
  const originalEnv = { ...process.env };
  const free: User = {
    id: 'u1',
    email: 'a@b.c',
    name: 'A',
    passwordHash: '',
    salt: '',
    sessionVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    plan: 'free',
    planSource: 'manual',
  };
  const zpub = 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';

  beforeEach(() => {
    process.env.PREVIEW_MODE = 'false';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-limit-'));
    store = new Store(dir);
    store.addManualAccount('Cash', { balance: 1 });
    store.addWatchWallet('w1', { key: zpub, chain: 'btc', kind: 'xpub' });
    store.upsertSnaptradeAccount({ externalId: 's1', label: 'IBKR' });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('counts only accounts that read from somewhere and blocks at the Free cap', () => {
    expect(liveConnectionLimit(free, store)).toBeNull();
    store.upsertGocardlessAccount({ externalId: 'g1', label: 'UBS', institution: 'UBS', currency: 'CHF', holdings: [] });
    expect(liveConnectionLimit(free, store)).toEqual({
      error: 'Plan limit reached',
      message: 'Free includes 3 live connections. Upgrade to Plus for unlimited.',
      upgrade: true,
    });
    expect(liveConnectionLimit({ ...free, plan: 'plus' }, store)).toBeNull();
    process.env.PREVIEW_MODE = 'true';
    expect(liveConnectionLimit(free, store)).toBeNull();
  });

  it('answers 402 through the request helper', () => {
    store.upsertGocardlessAccount({ externalId: 'g1', label: 'UBS', institution: 'UBS', currency: 'CHF', holdings: [] });
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const req = { user: free, tenant: { store } } as never;
    expect(requireLiveConnectionSlot(req, { status } as never)).toBe(true);
    expect(status).toHaveBeenCalledWith(402);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ upgrade: true }));

    store.removeAccount(store.getAllRaw().find((a) => a.provider === 'gocardless')!.id);
    expect(requireLiveConnectionSlot(req, { status } as never)).toBe(false);
    expect(status).toHaveBeenCalledTimes(1);
  });
});

import { PLANS, effectivePlan, entitlementsFor, isPlanId, isPreviewMode, serializePlans } from './plans';

describe('plans', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const free = { plan: 'free' as const, planSource: 'manual' as const };

  it('describes the three tiers and serialises an uncapped limit as null', () => {
    expect(PLANS.free).toEqual({ name: 'Free', priceChf: 0, liveConnections: 3, grow: false, exposure: false, benchmarks: false, seats: 1 });
    expect(PLANS.plus).toMatchObject({ name: 'Plus', priceChf: 8, liveConnections: Infinity, grow: true, seats: 1 });
    expect(PLANS.family).toMatchObject({ name: 'Family', priceChf: 14, liveConnections: Infinity, seats: 2 });
    const plans = serializePlans();
    expect(plans.free.liveConnections).toBe(3);
    expect(plans.plus.liveConnections).toBeNull();
    expect(plans.family.liveConnections).toBeNull();
    expect(JSON.parse(JSON.stringify(plans)).family.seats).toBe(2);
    expect(isPlanId('plus')).toBe(true);
    expect(isPlanId('gold')).toBe(false);
  });

  it('is in preview mode until a Stripe key exists, unless PREVIEW_MODE says otherwise', () => {
    delete process.env.PREVIEW_MODE;
    delete process.env.STRIPE_SECRET_KEY;
    expect(isPreviewMode()).toBe(true);
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(isPreviewMode()).toBe(false);
    process.env.PREVIEW_MODE = 'true';
    expect(isPreviewMode()).toBe(true);
    delete process.env.STRIPE_SECRET_KEY;
    process.env.PREVIEW_MODE = 'false';
    expect(isPreviewMode()).toBe(false);
  });

  it('entitles everyone as Plus in preview mode', () => {
    process.env.PREVIEW_MODE = 'true';
    expect(effectivePlan(free)).toEqual({ plan: 'plus', source: 'preview' });
    expect(entitlementsFor(free)).toEqual({ liveConnections: null, grow: true, exposure: true, benchmarks: true, seats: 1 });
  });

  it('resolves entitlements from the stored plan otherwise', () => {
    process.env.PREVIEW_MODE = 'false';
    expect(effectivePlan(free)).toEqual({ plan: 'free', source: 'manual' });
    expect(entitlementsFor(free)).toEqual({ liveConnections: 3, grow: false, exposure: false, benchmarks: false, seats: 1 });
    expect(effectivePlan({ plan: 'family', planSource: 'stripe' })).toEqual({ plan: 'family', source: 'stripe' });
    expect(entitlementsFor({ plan: 'family', planSource: 'stripe' }).seats).toBe(2);
    // A plan id from a future version of the file falls back to Free rather than crashing.
    expect(effectivePlan({ plan: 'gold' as never, planSource: 'manual' }).plan).toBe('free');
  });
});

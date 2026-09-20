/**
 * Plans and what they entitle a user to.
 *
 * Entitlements are resolved from the user's stored plan, except in preview
 * mode, where every account is treated as Plus so the product can be tried
 * end to end before billing is switched on. Preview is the default until a
 * Stripe key is configured; PREVIEW_MODE overrides either way.
 */
import type { User } from '../users/users';

export type PlanId = 'free' | 'plus' | 'family';
export type PlanSource = 'preview' | 'stripe' | 'manual';

export interface Plan {
  name: string;
  priceChf: number;
  /** Accounts whose provider is not `manual`; Infinity means no cap. */
  liveConnections: number;
  grow: boolean;
  exposure: boolean;
  benchmarks: boolean;
  seats: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    name: 'Free',
    priceChf: 0,
    liveConnections: 3,
    grow: false,
    exposure: false,
    benchmarks: false,
    seats: 1,
  },
  plus: {
    name: 'Plus',
    priceChf: 8,
    liveConnections: Infinity,
    grow: true,
    exposure: true,
    benchmarks: true,
    seats: 1,
  },
  family: {
    name: 'Family',
    priceChf: 14,
    liveConnections: Infinity,
    grow: true,
    exposure: true,
    benchmarks: true,
    seats: 2,
  },
};

export const PLAN_IDS: PlanId[] = ['free', 'plus', 'family'];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as string[]).includes(value);
}

/** JSON has no Infinity, so an uncapped limit travels as null. */
export interface PublicPlan extends Omit<Plan, 'liveConnections'> {
  liveConnections: number | null;
}

export function serializePlans(): Record<PlanId, PublicPlan> {
  const out = {} as Record<PlanId, PublicPlan>;
  for (const id of PLAN_IDS) {
    const plan = PLANS[id];
    out[id] = {
      ...plan,
      liveConnections: Number.isFinite(plan.liveConnections) ? plan.liveConnections : null,
    };
  }
  return out;
}

function envFlag(value: string | undefined): boolean | null {
  const raw = (value || '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return null;
}

/** Default: on until STRIPE_SECRET_KEY exists, so a fresh deploy is fully usable. */
export function isPreviewMode(): boolean {
  const explicit = envFlag(process.env.PREVIEW_MODE);
  if (explicit !== null) return explicit;
  return !(process.env.STRIPE_SECRET_KEY || '').trim();
}

export interface EffectivePlan {
  plan: PlanId;
  source: PlanSource;
}

/** The plan in force for a user right now. */
export function effectivePlan(user: Pick<User, 'plan' | 'planSource'>): EffectivePlan {
  if (isPreviewMode()) return { plan: 'plus', source: 'preview' };
  const plan = isPlanId(user.plan) ? user.plan : 'free';
  return { plan, source: user.planSource || 'manual' };
}

export interface Entitlements {
  liveConnections: number | null;
  grow: boolean;
  exposure: boolean;
  benchmarks: boolean;
  seats: number;
}

export function entitlementsFor(user: Pick<User, 'plan' | 'planSource'>): Entitlements {
  const plan = PLANS[effectivePlan(user).plan];
  return {
    liveConnections: Number.isFinite(plan.liveConnections) ? plan.liveConnections : null,
    grow: plan.grow,
    exposure: plan.exposure,
    benchmarks: plan.benchmarks,
    seats: plan.seats,
  };
}

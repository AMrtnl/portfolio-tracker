/**
 * Accounts for the multi-user deployment.
 *
 * One JSON file holds every user's credentials; each user's portfolio lives in
 * its own directory (see tenant.ts), so nothing here ever touches account data.
 * Passwords are scrypt-hashed with a per-user salt. `sessionVersion` is baked
 * into every session cookie and bumped on a password change, which is how a
 * stateless cookie can still be revoked.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { effectivePlan } from '../billing/plans';
import type { PlanId, PlanSource } from '../billing/plans';

export interface User {
  id: string;
  /** Lower-cased and trimmed; the unique key for login. */
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  sessionVersion: number;
  createdAt: string;
  onboardedAt?: string;
  /** What the user pays for; entitlements may still be wider in preview mode. */
  plan: PlanId;
  planSource: PlanSource;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** ISO date of the next renewal, null when nothing renews. */
  planRenewsAt?: string | null;
}

/** What the API returns about a user — never the hash or the salt. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  onboardedAt: string | null;
  /** The plan in force, i.e. `plus` from `preview` while preview mode is on. */
  plan: PlanId;
  planSource: PlanSource;
}

export interface PlanUpdate {
  plan: PlanId;
  source: PlanSource;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
  renewsAt?: string | null;
}

interface UsersFile {
  version: 1;
  users: User[];
}

const KEY_LENGTH = 64;
const MAX_NAME = 80;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "jane.doe+tag@x.com" → "Jane Doe": the part before @ is the best default we have. */
export function defaultNameFor(email: string): string {
  const local = (email.split('@')[0] || '').split('+')[0];
  const words = local.split(/[._-]+/).filter(Boolean);
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return (name || 'New user').slice(0, MAX_NAME);
}

export function toPublicUser(user: User): PublicUser {
  const plan = effectivePlan(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    onboardedAt: user.onboardedAt ?? null,
    plan: plan.plan,
    planSource: plan.source,
  };
}

/** Files written before billing existed have no plan fields; everyone starts on Free. */
function withPlanDefaults(user: Partial<User> & Pick<User, 'id' | 'email'>): User {
  return {
    ...(user as User),
    plan: user.plan === 'plus' || user.plan === 'family' ? user.plan : 'free',
    planSource: user.planSource === 'stripe' || user.planSource === 'preview' ? user.planSource : 'manual',
  };
}

function newSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
}

export class UserStore {
  private data: UsersFile;
  private readonly file: string;

  constructor(readonly dir: string) {
    this.file = path.join(dir, 'users.json');
    this.data = this.load();
  }

  private load(): UsersFile {
    if (!fs.existsSync(this.file)) return { version: 1, users: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<UsersFile>;
      if (parsed?.version === 1 && Array.isArray(parsed.users)) {
        return { version: 1, users: parsed.users.map(withPlanDefaults) };
      }
      throw new Error('unexpected file shape');
    } catch (err) {
      // Silently starting fresh would orphan every user's data directory, so
      // keep the broken file where an operator can find it instead of
      // overwriting it on the next sign-up.
      const aside = `${this.file}.corrupt-${Date.now()}`;
      fs.renameSync(this.file, aside);
      console.error(
        `❌ Could not read users.json (${err instanceof Error ? err.message : err}). Moved it to ${aside}; starting with no users.`,
      );
      return { version: 1, users: [] };
    }
  }

  /** Write-then-rename so a crash mid-write cannot leave a half-written credentials file. */
  private save(): void {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  list(): User[] {
    return [...this.data.users];
  }

  count(): number {
    return this.data.users.length;
  }

  findByEmail(email: string): User | null {
    const key = normalizeEmail(email);
    return this.data.users.find((u) => u.email === key) ?? null;
  }

  findById(id: string): User | null {
    return this.data.users.find((u) => u.id === id) ?? null;
  }

  findByStripeCustomer(customerId: string): User | null {
    if (!customerId) return null;
    return this.data.users.find((u) => u.stripeCustomerId === customerId) ?? null;
  }

  create(input: { email: string; password: string; name?: string }): User {
    const email = normalizeEmail(input.email);
    if (this.findByEmail(email)) {
      throw new Error('An account with this email already exists');
    }
    const salt = newSalt();
    const user: User = {
      id: crypto.randomUUID(),
      email,
      name: (input.name || '').trim().slice(0, MAX_NAME) || defaultNameFor(email),
      passwordHash: hashPassword(input.password, salt),
      salt,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
      plan: 'free',
      planSource: 'manual',
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  /**
   * Records what the user is entitled to and where that came from. The Stripe
   * ids are kept across a downgrade so the portal and a later webhook can
   * still find the customer.
   */
  setPlan(id: string, update: PlanUpdate): User | null {
    const user = this.findById(id);
    if (!user) return null;
    user.plan = update.plan;
    user.planSource = update.source;
    if (update.stripeCustomerId !== undefined) user.stripeCustomerId = update.stripeCustomerId;
    if (update.stripeSubscriptionId !== undefined) {
      user.stripeSubscriptionId = update.stripeSubscriptionId ?? undefined;
    }
    if (update.renewsAt !== undefined) user.planRenewsAt = update.renewsAt;
    this.save();
    return user;
  }

  verifyPassword(user: User, password: string): boolean {
    const expected = Buffer.from(user.passwordHash, 'hex');
    if (expected.length !== KEY_LENGTH) return false;
    const actual = crypto.scryptSync(password, user.salt, KEY_LENGTH);
    return crypto.timingSafeEqual(expected, actual);
  }

  /** Bumps sessionVersion so every cookie issued before the change stops working. */
  setPassword(id: string, password: string): User | null {
    const user = this.findById(id);
    if (!user) return null;
    user.salt = newSalt();
    user.passwordHash = hashPassword(password, user.salt);
    user.sessionVersion += 1;
    this.save();
    return user;
  }

  setName(id: string, name: string): User | null {
    const user = this.findById(id);
    if (!user) return null;
    user.name = name.trim().slice(0, MAX_NAME) || user.name;
    this.save();
    return user;
  }

  /** Idempotent: the first onboarding date is the one that stays. */
  markOnboarded(id: string): User | null {
    const user = this.findById(id);
    if (!user) return null;
    if (!user.onboardedAt) {
      user.onboardedAt = new Date().toISOString();
      this.save();
    }
    return user;
  }

  remove(id: string): boolean {
    const before = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length === before) return false;
    this.save();
    return true;
  }
}

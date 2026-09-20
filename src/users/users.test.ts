import fs from 'fs';
import os from 'os';
import path from 'path';
import { UserStore, defaultNameFor, toPublicUser } from './users';

describe('UserStore', () => {
  const originalEnv = { ...process.env };
  let dir: string;

  beforeEach(() => {
    // Preview mode would report every user as Plus; these tests read the stored plan.
    process.env.PREVIEW_MODE = 'false';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-users-'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a user with a hashed password and persists it', () => {
    const users = new UserStore(dir);
    expect(users.count()).toBe(0);

    const user = users.create({ email: '  Jane.Doe@Example.COM ', password: 'correct horse battery' });
    expect(user.email).toBe('jane.doe@example.com');
    expect(user.name).toBe('Jane Doe');
    expect(user.sessionVersion).toBe(1);
    expect(user.passwordHash).not.toContain('correct horse');
    expect(user.passwordHash).toHaveLength(128);
    expect(user.salt).toHaveLength(32);

    const raw = fs.readFileSync(path.join(dir, 'users.json'), 'utf8');
    expect(raw).not.toContain('correct horse');

    const reloaded = new UserStore(dir);
    expect(reloaded.count()).toBe(1);
    expect(reloaded.findById(user.id)?.email).toBe('jane.doe@example.com');
    expect(reloaded.findByEmail('JANE.DOE@example.com')?.id).toBe(user.id);
    expect(reloaded.findByEmail('nobody@example.com')).toBeNull();
  });

  it('keeps an explicit name and refuses a duplicate email', () => {
    const users = new UserStore(dir);
    users.create({ email: 'a@example.com', password: 'a long password', name: '  Alex ' });
    expect(users.findByEmail('a@example.com')?.name).toBe('Alex');
    expect(() => users.create({ email: 'A@example.com', password: 'another one!' })).toThrow(
      /already exists/,
    );
    expect(users.count()).toBe(1);
  });

  it('verifies the right password and rejects the wrong one', () => {
    const users = new UserStore(dir);
    const user = users.create({ email: 'a@example.com', password: 'a long password' });
    expect(users.verifyPassword(user, 'a long password')).toBe(true);
    expect(users.verifyPassword(user, 'a long passwor')).toBe(false);
    expect(users.verifyPassword(user, '')).toBe(false);
  });

  it('bumps sessionVersion on a password change so old cookies die', () => {
    const users = new UserStore(dir);
    const user = users.create({ email: 'a@example.com', password: 'old password 1' });
    const updated = users.setPassword(user.id, 'new password 2');
    expect(updated?.sessionVersion).toBe(2);
    expect(users.verifyPassword(updated!, 'old password 1')).toBe(false);
    expect(users.verifyPassword(updated!, 'new password 2')).toBe(true);
    expect(new UserStore(dir).findById(user.id)?.sessionVersion).toBe(2);
    expect(users.setPassword('missing', 'whatever pw')).toBeNull();
  });

  it('renames, marks onboarding once, and removes', () => {
    const users = new UserStore(dir);
    const user = users.create({ email: 'a@example.com', password: 'a long password' });
    expect(toPublicUser(user).onboardedAt).toBeNull();

    expect(users.setName(user.id, '  Alexandre ')?.name).toBe('Alexandre');
    const first = users.markOnboarded(user.id)?.onboardedAt;
    expect(first).toEqual(expect.any(String));
    expect(users.markOnboarded(user.id)?.onboardedAt).toBe(first);

    const pub = toPublicUser(users.findById(user.id)!);
    expect(pub).toEqual({
      id: user.id,
      email: 'a@example.com',
      name: 'Alexandre',
      createdAt: user.createdAt,
      onboardedAt: first,
      plan: 'free',
      planSource: 'manual',
    });
    expect(pub).not.toHaveProperty('passwordHash');

    expect(users.remove(user.id)).toBe(true);
    expect(users.remove(user.id)).toBe(false);
    expect(new UserStore(dir).count()).toBe(0);
  });

  it('starts everyone on Free, records plan changes, and finds users by Stripe customer', () => {
    const users = new UserStore(dir);
    const user = users.create({ email: 'a@example.com', password: 'a long password' });
    expect(user).toMatchObject({ plan: 'free', planSource: 'manual' });
    expect(users.findByStripeCustomer('cus_1')).toBeNull();

    const updated = users.setPlan(user.id, {
      plan: 'plus',
      source: 'stripe',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      renewsAt: '2026-10-20T00:00:00.000Z',
    });
    expect(updated).toMatchObject({ plan: 'plus', planSource: 'stripe', stripeCustomerId: 'cus_1' });
    expect(users.findByStripeCustomer('cus_1')?.id).toBe(user.id);
    expect(toPublicUser(updated!)).toMatchObject({ plan: 'plus', planSource: 'stripe' });

    // A downgrade keeps the customer so the portal still works.
    users.setPlan(user.id, { plan: 'free', source: 'stripe', stripeSubscriptionId: null, renewsAt: null });
    const reloaded = new UserStore(dir).findById(user.id)!;
    expect(reloaded).toMatchObject({ plan: 'free', stripeCustomerId: 'cus_1', planRenewsAt: null });
    expect(reloaded.stripeSubscriptionId).toBeUndefined();
    expect(users.setPlan('missing', { plan: 'plus', source: 'manual' })).toBeNull();

    process.env.PREVIEW_MODE = 'true';
    expect(toPublicUser(reloaded)).toMatchObject({ plan: 'plus', planSource: 'preview' });
  });

  it('loads a users file written before plans existed', () => {
    const legacy = {
      version: 1,
      users: [
        {
          id: 'old-1',
          email: 'old@example.com',
          name: 'Old',
          passwordHash: 'ab',
          salt: 'cd',
          sessionVersion: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };
    fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify(legacy), 'utf8');
    const user = new UserStore(dir).findById('old-1')!;
    expect(user).toMatchObject({ email: 'old@example.com', plan: 'free', planSource: 'manual' });
    expect(toPublicUser(user)).toMatchObject({ plan: 'free', planSource: 'manual' });
  });

  it('sets aside a corrupt users file instead of overwriting it', () => {
    fs.writeFileSync(path.join(dir, 'users.json'), '{ not json', 'utf8');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const users = new UserStore(dir);
      expect(users.count()).toBe(0);
      const kept = fs.readdirSync(dir).filter((f) => f.startsWith('users.json.corrupt-'));
      expect(kept).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('defaultNameFor', () => {
  it('capitalises the part before @', () => {
    expect(defaultNameFor('jane@example.com')).toBe('Jane');
    expect(defaultNameFor('jane.doe@example.com')).toBe('Jane Doe');
    expect(defaultNameFor('jane_doe+wh@example.com')).toBe('Jane Doe');
  });
});

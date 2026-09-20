import fs from 'fs';
import os from 'os';
import path from 'path';
import { UserStore, defaultNameFor, toPublicUser } from './users';

describe('UserStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-users-'));
  });

  afterEach(() => {
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
    });
    expect(pub).not.toHaveProperty('passwordHash');

    expect(users.remove(user.id)).toBe(true);
    expect(users.remove(user.id)).toBe(false);
    expect(new UserStore(dir).count()).toBe(0);
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

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SESSION_TTL_SECONDS,
  isSessionConfigured,
  issueSessionToken,
  resolveSession,
  verifySessionToken,
} from './session';
import { UserStore } from './users';

describe('session tokens', () => {
  const originalEnv = { ...process.env };
  const user = { id: 'user-1', sessionVersion: 3 };

  beforeEach(() => {
    process.env.SESSION_SECRET = 'unit-test-secret';
    delete process.env.STORE_SECRET;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('round-trips the user id and session version', () => {
    const now = Date.parse('2026-09-20T12:00:00Z');
    const token = issueSessionToken(user, now);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifySessionToken(token, now)).toEqual({
      uid: 'user-1',
      sv: 3,
      exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    });
  });

  it('expires after 30 days', () => {
    const now = Date.parse('2026-09-20T12:00:00Z');
    const token = issueSessionToken(user, now);
    expect(verifySessionToken(token, now + (SESSION_TTL_SECONDS - 1) * 1000)).not.toBeNull();
    expect(verifySessionToken(token, now + SESSION_TTL_SECONDS * 1000)).toBeNull();
  });

  it('rejects a tampered payload or signature', () => {
    const token = issueSessionToken(user);
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 'user-2', sv: 3, exp: 9e9 }))
      .toString('base64')
      .replace(/=+$/, '');
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${payload}.${sig.slice(0, -2)}AA`)).toBeNull();
    expect(verifySessionToken(payload)).toBeNull();
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it('rejects tokens signed under a different secret', () => {
    const token = issueSessionToken(user);
    process.env.SESSION_SECRET = 'rotated';
    expect(verifySessionToken(token)).toBeNull();
  });

  it('falls back to STORE_SECRET when SESSION_SECRET is unset', () => {
    delete process.env.SESSION_SECRET;
    process.env.STORE_SECRET = 'store-secret';
    const token = issueSessionToken(user);
    expect(verifySessionToken(token)?.uid).toBe('user-1');
  });

  it('fails closed in production without any secret', () => {
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = 'production';
    expect(isSessionConfigured()).toBe(false);
    expect(() => issueSessionToken(user)).toThrow(/not configured/);
    expect(verifySessionToken('a.b')).toBeNull();
  });

  it('uses a fixed dev secret outside production', () => {
    delete process.env.SESSION_SECRET;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(isSessionConfigured()).toBe(true);
      expect(verifySessionToken(issueSessionToken(user))?.sv).toBe(3);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('resolveSession', () => {
  const originalEnv = { ...process.env };
  let dir: string;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'unit-test-secret';
    delete process.env.NODE_ENV;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-session-'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the user for a live token and nothing after a password change', () => {
    const users = new UserStore(dir);
    const user = users.create({ email: 'a@example.com', password: 'a long password' });
    const token = issueSessionToken(user);
    expect(resolveSession(users, token)?.id).toBe(user.id);

    users.setPassword(user.id, 'a different one');
    expect(resolveSession(users, token)).toBeNull();
    expect(resolveSession(users, issueSessionToken(users.findById(user.id)!))?.id).toBe(user.id);
  });

  it('returns nothing for a deleted user', () => {
    const users = new UserStore(dir);
    const user = users.create({ email: 'a@example.com', password: 'a long password' });
    const token = issueSessionToken(user);
    users.remove(user.id);
    expect(resolveSession(users, token)).toBeNull();
  });
});

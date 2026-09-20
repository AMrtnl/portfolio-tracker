/**
 * Everything one user owns, resolved once per process and cached.
 *
 * Each store instance is bound to the user's directory, so a request can only
 * ever read or write the files of the user its cookie names. The only thing
 * users share is the code.
 */
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import { HistoryStore } from '../analytics/valueHistory';
import { rootDataDir } from '../dataDir';
import { GoalsStore } from '../goals/store';
import { MoneyStore } from '../money/store';
import { SettingsStore } from '../settings';
import { Store } from '../store';
import type { User } from './users';

export interface Tenant {
  userId: string;
  dir: string;
  store: Store;
  money: MoneyStore;
  settings: SettingsStore;
  goals: GoalsStore;
  history: HistoryStore;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireApiAuth on every authenticated /api request. */
      user?: User;
      tenant?: Tenant;
    }
  }
}

const tenants = new Map<string, Tenant>();

export function userDir(userId: string): string {
  return path.join(rootDataDir(), 'users', userId);
}

export function getTenant(userId: string): Tenant {
  const hit = tenants.get(userId);
  if (hit) return hit;
  const dir = userDir(userId);
  const tenant: Tenant = {
    userId,
    dir,
    store: new Store(dir),
    money: new MoneyStore(dir),
    settings: new SettingsStore(dir),
    goals: new GoalsStore(dir),
    history: new HistoryStore(dir),
  };
  tenants.set(userId, tenant);
  return tenant;
}

export function forgetTenant(userId: string): void {
  tenants.delete(userId);
}

/** Drops the cached stores first so nothing writes the directory back afterwards. */
export function removeTenantData(userId: string): void {
  forgetTenant(userId);
  fs.rmSync(userDir(userId), { recursive: true, force: true });
}

export function tenantFor(req: Request): Tenant {
  if (!req.tenant) {
    throw new Error('No tenant on request — is requireApiAuth mounted before this route?');
  }
  return req.tenant;
}

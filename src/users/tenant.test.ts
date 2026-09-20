import fs from 'fs';
import os from 'os';
import path from 'path';
import { forgetTenant, getTenant, removeTenantData, tenantFor, userDir } from './tenant';

describe('tenants', () => {
  const originalEnv = { ...process.env };
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-tenant-'));
    process.env.DATA_DIR = root;
  });

  afterEach(() => {
    forgetTenant('u1');
    forgetTenant('u2');
    process.env = { ...originalEnv };
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('binds every store to the user directory and caches the instance', () => {
    const tenant = getTenant('u1');
    expect(tenant.dir).toBe(path.join(root, 'users', 'u1'));
    expect(userDir('u1')).toBe(tenant.dir);
    expect(getTenant('u1')).toBe(tenant);

    tenant.settings.update({ displayCurrency: 'EUR' });
    tenant.goals.add({ name: 'Boat', targetAmount: 10 });
    expect(fs.existsSync(path.join(tenant.dir, 'settings.json'))).toBe(true);
    expect(fs.existsSync(path.join(tenant.dir, 'goals.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'settings.json'))).toBe(false);

    forgetTenant('u1');
    const fresh = getTenant('u1');
    expect(fresh).not.toBe(tenant);
    expect(fresh.settings.get().displayCurrency).toBe('EUR');
    expect(fresh.goals.list()).toHaveLength(1);
  });

  it('keeps users apart', () => {
    getTenant('u1').money.setBudgets({ groceries: 500 });
    expect(getTenant('u2').money.getBudgets()).toEqual({});
    expect(getTenant('u2').goals.list()).toEqual([]);
  });

  it('removes a user directory on request', () => {
    const tenant = getTenant('u1');
    tenant.money.setBudgets({ groceries: 500 });
    removeTenantData('u1');
    expect(fs.existsSync(tenant.dir)).toBe(false);
    expect(getTenant('u1')).not.toBe(tenant);
    expect(getTenant('u1').money.getBudgets()).toEqual({});
  });

  it('refuses a request that never went through the auth gate', () => {
    expect(() => tenantFor({} as never)).toThrow(/requireApiAuth/);
    const tenant = getTenant('u1');
    expect(tenantFor({ tenant } as never)).toBe(tenant);
  });
});

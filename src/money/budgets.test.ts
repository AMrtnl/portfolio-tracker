import fs from 'fs';
import os from 'os';
import path from 'path';

type StoreModule = typeof import('./store');

function loadWithDataDir(dir: string): StoreModule {
  process.env.DATA_DIR = dir;
  let mod: StoreModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./store') as StoreModule;
  });
  return mod!;
}

describe('budget targets', () => {
  const originalEnv = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-budgets-'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('sets, clears, and persists monthly targets per category', () => {
    const store = new (loadWithDataDir(dir).MoneyStore)();
    expect(store.getBudgets()).toEqual({});
    expect(store.setBudgets({ groceries: 600, leisure: '250' as never })).toEqual({
      groceries: 600,
      leisure: 250,
    });
    expect(store.setBudgets({ leisure: null, ' transport ': 120 })).toEqual({
      groceries: 600,
      transport: 120,
    });

    const reloaded = new (loadWithDataDir(dir).MoneyStore)();
    expect(reloaded.getBudgets()).toEqual({ groceries: 600, transport: 120 });
  });

  it('rejects negative or non-numeric targets without saving', () => {
    const store = new (loadWithDataDir(dir).MoneyStore)();
    expect(() => store.setBudgets({ groceries: -1 })).toThrow(/groceries/);
    expect(() => store.setBudgets({ groceries: 'lots' as never })).toThrow(/groceries/);
    expect(store.getBudgets()).toEqual({});
  });
});

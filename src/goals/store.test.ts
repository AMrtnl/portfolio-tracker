import fs from 'fs';
import os from 'os';
import path from 'path';

type GoalsModule = typeof import('./store');

function loadWithDataDir(dir: string): GoalsModule {
  process.env.DATA_DIR = dir;
  let mod: GoalsModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./store') as GoalsModule;
  });
  return mod!;
}

describe('goals store', () => {
  const originalEnv = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-goals-'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds, updates, and removes goals, persisting across a fresh load', () => {
    const first = loadWithDataDir(dir);
    const goal = first.addGoal({
      name: '  Emergency fund ',
      targetAmount: '30000',
      targetDate: '2027-06-01',
      accountIds: ['a1', 'a1', ' a2 '],
      monthlyContribution: 500,
      expectedReturn: 0.01,
    });
    expect(goal).toMatchObject({
      name: 'Emergency fund',
      targetAmount: 30000,
      targetDate: '2027-06-01',
      accountIds: ['a1', 'a2'],
      monthlyContribution: 500,
      expectedReturn: 0.01,
    });

    const updated = first.updateGoal(goal.id, { monthlyContribution: 750, targetDate: null });
    expect(updated).toMatchObject({ name: 'Emergency fund', monthlyContribution: 750 });
    expect(updated?.targetDate).toBeUndefined();

    const second = loadWithDataDir(dir);
    expect(second.listGoals()).toHaveLength(1);
    expect(second.listGoals()[0].monthlyContribution).toBe(750);
    expect(second.removeGoal(goal.id)).toBe(true);
    expect(second.removeGoal(goal.id)).toBe(false);
    expect(loadWithDataDir(dir).listGoals()).toEqual([]);
  });

  it('defaults contribution and return to zero', () => {
    const { addGoal } = loadWithDataDir(dir);
    expect(addGoal({ name: 'Car', targetAmount: 12000 })).toMatchObject({
      accountIds: [],
      monthlyContribution: 0,
      expectedReturn: 0,
    });
  });

  it('rejects bad input without writing anything', () => {
    const { addGoal, updateGoal, listGoals } = loadWithDataDir(dir);
    expect(() => addGoal({ targetAmount: 100 })).toThrow(/name/);
    expect(() => addGoal({ name: 'x', targetAmount: -5 })).toThrow(/targetAmount/);
    expect(() => addGoal({ name: 'x', targetAmount: 5, targetDate: 'June' })).toThrow(/targetDate/);
    expect(() => addGoal({ name: 'x', targetAmount: 5, accountIds: 'a1' })).toThrow(/accountIds/);
    expect(() => addGoal({ name: 'x', targetAmount: 5, expectedReturn: 2 })).toThrow(/expectedReturn/);
    expect(() => addGoal({ name: 'x', targetAmount: 5, monthlyContribution: -1 })).toThrow(
      /monthlyContribution/,
    );
    expect(updateGoal('missing', { name: 'y' })).toBeNull();
    expect(listGoals()).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'goals.json'))).toBe(false);
  });
});

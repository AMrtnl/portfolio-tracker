import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Savings goals: a target, an optional date, and the accounts that fund it.
 * Progress is worked out against live account values by whoever reads it,
 * so the file only holds intent.
 */

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  /** YYYY-MM-DD; absent means "whenever". */
  targetDate?: string;
  /** Accounts whose balances count towards the goal. */
  accountIds: string[];
  /** What the user puts in each month. */
  monthlyContribution: number;
  /** Yearly rate used for the projection, e.g. 0.04. */
  expectedReturn: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  name?: unknown;
  targetAmount?: unknown;
  targetDate?: unknown;
  accountIds?: unknown;
  monthlyContribution?: unknown;
  expectedReturn?: unknown;
}

interface GoalsFile {
  version: 1;
  goals: Goal[];
}

const MAX_NAME = 80;

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}

type GoalFields = Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>;

/** Validates a create body, or a partial update layered over `base`. */
function cleanGoal(input: GoalInput, base?: Goal): GoalFields {
  const name = typeof input.name === 'string' ? input.name.trim() : base?.name;
  if (!name) throw new Error('name is required');
  if (name.length > MAX_NAME) throw new Error(`name must be ${MAX_NAME} characters or fewer`);

  const targetAmount =
    input.targetAmount !== undefined ? Number(input.targetAmount) : base?.targetAmount;
  if (targetAmount === undefined || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new Error('targetAmount must be a positive number');
  }

  let targetDate = base?.targetDate;
  if (input.targetDate !== undefined) {
    if (input.targetDate === null || input.targetDate === '') {
      targetDate = undefined;
    } else if (typeof input.targetDate === 'string' && isIsoDate(input.targetDate)) {
      targetDate = input.targetDate;
    } else {
      throw new Error('targetDate must be YYYY-MM-DD');
    }
  }

  let accountIds = base?.accountIds ?? [];
  if (input.accountIds !== undefined) {
    if (
      !Array.isArray(input.accountIds) ||
      !input.accountIds.every((id) => typeof id === 'string')
    ) {
      throw new Error('accountIds must be a list of account ids');
    }
    accountIds = [...new Set(input.accountIds.map((id) => id.trim()).filter(Boolean))];
  }

  const monthlyContribution =
    input.monthlyContribution !== undefined
      ? Number(input.monthlyContribution)
      : (base?.monthlyContribution ?? 0);
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    throw new Error('monthlyContribution must be zero or more');
  }

  const expectedReturn =
    input.expectedReturn !== undefined ? Number(input.expectedReturn) : (base?.expectedReturn ?? 0);
  if (!Number.isFinite(expectedReturn) || expectedReturn < -0.5 || expectedReturn > 0.5) {
    throw new Error('expectedReturn must be a yearly rate between -0.5 and 0.5');
  }

  return { name, targetAmount, targetDate, accountIds, monthlyContribution, expectedReturn };
}

export class GoalsStore {
  private cache: GoalsFile | undefined;

  /** `dir` is the owning user's data directory. */
  constructor(readonly dir: string) {}

  private file(): string {
    return path.join(this.dir, 'goals.json');
  }

  private load(): GoalsFile {
    if (this.cache) return this.cache;
    try {
      const file = this.file();
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<GoalsFile>;
        if (parsed?.version === 1 && Array.isArray(parsed.goals)) {
          this.cache = { version: 1, goals: parsed.goals };
          return this.cache;
        }
      }
    } catch (err) {
      console.warn('⚠️  Could not read goals, starting fresh:', err);
    }
    this.cache = { version: 1, goals: [] };
    return this.cache;
  }

  private save(data: GoalsFile): void {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file(), JSON.stringify(data, null, 2), 'utf8');
    this.cache = data;
  }

  list(): Goal[] {
    return [...this.load().goals];
  }

  add(input: GoalInput): Goal {
    const now = new Date().toISOString();
    const goal: Goal = { id: crypto.randomUUID(), ...cleanGoal(input), createdAt: now, updatedAt: now };
    const data = this.load();
    this.save({ ...data, goals: [...data.goals, goal] });
    return goal;
  }

  update(id: string, input: GoalInput): Goal | null {
    const data = this.load();
    const index = data.goals.findIndex((g) => g.id === id);
    if (index < 0) return null;
    const next: Goal = {
      ...data.goals[index],
      ...cleanGoal(input, data.goals[index]),
      updatedAt: new Date().toISOString(),
    };
    const goals = [...data.goals];
    goals[index] = next;
    this.save({ ...data, goals });
    return next;
  }

  remove(id: string): boolean {
    const data = this.load();
    const goals = data.goals.filter((g) => g.id !== id);
    if (goals.length === data.goals.length) return false;
    this.save({ ...data, goals });
    return true;
  }
}

export function listGoals(store: GoalsStore): Goal[] {
  return store.list();
}

export function addGoal(store: GoalsStore, input: GoalInput): Goal {
  return store.add(input);
}

export function updateGoal(store: GoalsStore, id: string, input: GoalInput): Goal | null {
  return store.update(id, input);
}

export function removeGoal(store: GoalsStore, id: string): boolean {
  return store.remove(id);
}

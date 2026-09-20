import type { Goal } from '@/hooks/useGoals'

/** Palette for goal rings and bars, cycled by position. */
export const GOAL_COLORS = ['#3B6EA8', '#2B7A4B', '#B8742B', '#7A5BA8', '#3A8E9E', '#8A7A2B']

/** Whole months from now until `dateIso`, never negative; null without a date. */
export function monthsUntil(dateIso: string | undefined, now = new Date()): number | null {
  if (!dateIso) return null
  const d = new Date(dateIso)
  if (!Number.isFinite(d.getTime())) return null
  const months =
    (d.getFullYear() - now.getFullYear()) * 12 +
    (d.getMonth() - now.getMonth()) -
    (d.getDate() < now.getDate() ? 1 : 0)
  return Math.max(0, months)
}

/**
 * Monthly payment that lands on `target` in `months`, with `current` and the
 * payments compounding at `annualReturn`. Zero months means the gap is due now.
 */
export function neededMonthly(
  current: number,
  target: number,
  months: number,
  annualReturn: number,
): number {
  const gap = target - current
  if (gap <= 0) return 0
  if (months <= 0) return gap
  const r = annualReturn / 12
  if (Math.abs(r) < 1e-9) return gap / months
  const growth = Math.pow(1 + r, months)
  return Math.max(0, ((target - current * growth) * r) / (growth - 1))
}

/** Months until the balance crosses `target` at the current pace; null if it never does. */
export function monthsToReach(
  current: number,
  target: number,
  monthly: number,
  annualReturn: number,
): number | null {
  if (current >= target) return 0
  const r = annualReturn / 12
  let value = current
  for (let m = 1; m <= 600; m++) {
    value = value * (1 + r) + monthly
    if (value >= target) return m
  }
  return null
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export type GoalState = 'funded' | 'ontrack' | 'behind' | 'open'

export interface GoalStatus {
  current: number
  pct: number
  months: number | null
  needed: number | null
  eta: number | null
  etaDate: Date | null
  state: GoalState
}

export function goalStatus(goal: Goal, current: number, now = new Date()): GoalStatus {
  const pct = goal.targetAmount > 0 ? Math.min(100, (current / goal.targetAmount) * 100) : 0
  const months = monthsUntil(goal.targetDate, now)
  const needed =
    months != null ? neededMonthly(current, goal.targetAmount, months, goal.expectedReturn) : null
  const eta = monthsToReach(current, goal.targetAmount, goal.monthlyContribution, goal.expectedReturn)
  let state: GoalState = 'open'
  if (current >= goal.targetAmount) state = 'funded'
  else if (needed != null) state = goal.monthlyContribution >= needed * 0.99 ? 'ontrack' : 'behind'
  return { current, pct, months, needed, eta, etaDate: eta != null ? addMonths(now, eta) : null, state }
}

export const STATE_COPY: Record<GoalState, { label: string; tone: 'gain' | 'loss' | 'flat' | 'info' }> = {
  funded: { label: 'Funded', tone: 'gain' },
  ontrack: { label: 'On track', tone: 'gain' },
  behind: { label: 'Behind', tone: 'loss' },
  open: { label: 'No date', tone: 'flat' },
}

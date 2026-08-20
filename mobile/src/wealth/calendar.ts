export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const mondayIndex = (y: number, m: number, d = 1) =>
  (new Date(y, m, d).getDay() + 6) % 7;

export function monthGrid(year: number, month: number) {
  const lead = mondayIndex(year, month);
  const total = daysInMonth(year, month);
  const prev = daysInMonth(year, month === 0 ? 11 : month - 1);
  return Array.from({ length: 42 }, (_, i) => {
    const n = i - lead + 1;
    if (n < 1) return { day: prev + n, outside: true };
    if (n > total) return { day: n - total, outside: true };
    return { day: n, outside: false };
  });
}

export type SubCycle = 'monthly' | 'quarterly' | 'yearly';

export function chargeDay(
  sub: { cycle: SubCycle; day: number; month?: number },
  year: number,
  month: number,
): number | null {
  if (sub.cycle === 'yearly' && sub.month !== month) return null;
  if (sub.cycle === 'quarterly' && sub.month != null) {
    if ((((month - sub.month) % 3) + 3) % 3 !== 0) return null;
  }
  return Math.min(sub.day, daysInMonth(year, month));
}

export function monthlyEquivalent(s: { cycle: SubCycle; amount: number }): number {
  if (s.cycle === 'yearly') return s.amount / 12;
  if (s.cycle === 'quarterly') return s.amount / 3;
  return s.amount;
}

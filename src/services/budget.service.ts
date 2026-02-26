import prisma from '../db/client.js';
import { SubscriptionItem } from '../types/common.js';

const CADENCE_TO_MONTHS: Record<string, number> = {
  WEEKLY: 1 / 4.33,
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

function toMonthly(amount: number, cadence: string): number {
  const months = CADENCE_TO_MONTHS[cadence] ?? 1;
  return amount / months;
}

export async function getSubscriptions(): Promise<SubscriptionItem[]> {
  const subs = await prisma.subscription.findMany({
    where: { isActive: true },
    orderBy: { nextBilling: 'asc' },
  });
  return subs.map(s => ({
    id: s.id,
    name: s.name,
    amount: s.amount,
    currency: s.currency,
    cadence: s.cadence as SubscriptionItem['cadence'],
    category: s.category,
    nextBilling: s.nextBilling.toISOString(),
    logoUrl: s.logoUrl ?? undefined,
    isActive: s.isActive,
    monthlyEquivalent: toMonthly(s.amount, s.cadence),
  }));
}

export async function addSubscription(data: {
  name: string;
  amount: number;
  currency: string;
  cadence: string;
  category: string;
  nextBilling: string;
  logoUrl?: string;
}): Promise<SubscriptionItem> {
  const sub = await prisma.subscription.create({
    data: {
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      cadence: data.cadence,
      category: data.category,
      nextBilling: new Date(data.nextBilling),
      logoUrl: data.logoUrl,
    },
  });
  return {
    id: sub.id,
    name: sub.name,
    amount: sub.amount,
    currency: sub.currency,
    cadence: sub.cadence as SubscriptionItem['cadence'],
    category: sub.category,
    nextBilling: sub.nextBilling.toISOString(),
    logoUrl: sub.logoUrl ?? undefined,
    isActive: sub.isActive,
    monthlyEquivalent: toMonthly(sub.amount, sub.cadence),
  };
}

export async function updateSubscription(
  id: string,
  data: Partial<{ name: string; amount: number; currency: string; cadence: string; category: string; nextBilling: string; isActive: boolean }>
): Promise<void> {
  await prisma.subscription.update({
    where: { id },
    data: {
      ...data,
      nextBilling: data.nextBilling ? new Date(data.nextBilling) : undefined,
    },
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  await prisma.subscription.delete({ where: { id } });
}

export async function getBudgetSummary() {
  const subs = await getSubscriptions();

  const totalMonthly = subs.reduce((sum, s) => sum + s.monthlyEquivalent, 0);
  const totalAnnual = subs.reduce((sum, s) => sum + (s.cadence === 'YEARLY' ? s.amount : s.monthlyEquivalent * 12), 0);

  const byCategory: Record<string, number> = {};
  for (const s of subs) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + s.monthlyEquivalent;
  }

  const upcomingRenewals = subs
    .filter(s => new Date(s.nextBilling).getTime() < Date.now() + 30 * 24 * 3600 * 1000)
    .sort((a, b) => new Date(a.nextBilling).getTime() - new Date(b.nextBilling).getTime());

  // Build monthly cash flow (last 6 months simulated from subscriptions)
  const months: { month: string; expenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      month: d.toISOString().slice(0, 7),
      expenses: totalMonthly * (0.9 + Math.random() * 0.2), // slight variation
    });
  }

  return {
    totalMonthly,
    totalAnnual,
    byCategory,
    subscriptionCount: subs.length,
    upcomingRenewals,
    cashFlowHistory: months,
  };
}

export async function getBudgetCategories() {
  return prisma.budgetCategory.findMany({ orderBy: { name: 'asc' } });
}

export async function upsertBudgetCategory(name: string, limit: number, color?: string) {
  return prisma.budgetCategory.upsert({
    where: { name },
    update: { limit, color: color ?? '#3B82F6' },
    create: { name, limit, color: color ?? '#3B82F6' },
  });
}

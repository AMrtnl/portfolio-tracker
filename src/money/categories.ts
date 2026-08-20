export interface MoneyCategory {
  id: string;
  name: string;
  color: string;
}

export const SPEND_CATEGORIES: MoneyCategory[] = [
  { id: 'housing', name: 'Housing', color: '#FF9F45' },
  { id: 'insurance', name: 'Insurance', color: '#4BD57E' },
  { id: 'groceries', name: 'Groceries', color: '#FFD84D' },
  { id: 'subscriptions', name: 'Subscriptions', color: '#A57BFF' },
  { id: 'transport', name: 'Transport', color: '#3ABEFF' },
  { id: 'leisure', name: 'Leisure', color: '#FF5C48' },
  { id: 'other', name: 'Other', color: '#8E8E93' },
];

export const INCOME_CATEGORIES: MoneyCategory[] = [
  { id: 'salary', name: 'Salary', color: '#30D158' },
  { id: 'bonus', name: 'Bonus', color: '#4BD57E' },
  { id: 'other-income', name: 'Other', color: '#8E8E93' },
];

export const SUB_CATEGORIES: MoneyCategory[] = [
  { id: 'essentials', name: 'Essentials', color: '#4BD57E' },
  { id: 'telecom', name: 'Telecom', color: '#3ABEFF' },
  { id: 'transport', name: 'Transport', color: '#FFD84D' },
  { id: 'software', name: 'Software', color: '#A57BFF' },
  { id: 'media', name: 'Media', color: '#FF5C48' },
  { id: 'home', name: 'Home', color: '#FF9F45' },
];

export function spendCat(id?: string): MoneyCategory {
  return SPEND_CATEGORIES.find((c) => c.id === id) || SPEND_CATEGORIES[SPEND_CATEGORIES.length - 1];
}

export function incomeCat(id?: string): MoneyCategory {
  return INCOME_CATEGORIES.find((c) => c.id === id) || INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1];
}

export function subCat(id?: string): MoneyCategory {
  return SUB_CATEGORIES.find((c) => c.id === id) || SUB_CATEGORIES[0];
}

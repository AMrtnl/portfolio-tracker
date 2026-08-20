import type { PublicAccount } from '../api/types';
import { CLASSES, type AssetClassId } from '../theme/tokens';

export function isLiability(account: PublicAccount): boolean {
  return account.kind === 'liability' || account.type === 'loan';
}

export function accountValue(account: PublicAccount): number {
  return Math.abs(account.totalValueUsd ?? 0);
}

export function accountClass(account: PublicAccount): AssetClassId {
  if (account.bookClass && CLASSES.some((c) => c.id === account.bookClass)) {
    return account.bookClass as AssetClassId;
  }
  switch (account.type) {
    case 'crypto_wallet':
      return 'crypto';
    case 'bank':
      return 'cash';
    case 'pension':
      return 'pension';
    case 'estate':
      return 'estate';
    case 'broker':
      return 'stocks';
    default:
      return 'other';
  }
}

export function classMeta(id: AssetClassId) {
  return CLASSES.find((c) => c.id === id) ?? CLASSES[CLASSES.length - 1];
}

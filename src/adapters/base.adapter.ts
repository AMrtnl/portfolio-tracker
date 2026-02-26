import { Balance, Position, TxRecord, AccountType } from '../types/common.js';

export interface IAdapter {
  platform: string;
  accountType: AccountType;
  getBalances(): Promise<Balance[]>;
  getPositions(): Promise<Position[]>;
  getTransactions(from?: Date): Promise<TxRecord[]>;
  isConfigured(): boolean;
}

export function hmacSHA256(secret: string, message: string): string {
  const crypto = await import('crypto');
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export async function signHmac256(secret: string, message: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export async function signHmac512(secret: string, message: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHmac('sha512', secret).update(message).digest('base64');
}

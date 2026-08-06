/**
 * Server-only SnapTrade Personal client.
 * Never import this module from client/browser code.
 * Personal API key identifies the user — no userId / userSecret.
 */
import {
  PersonalApiKeyAuth,
  Snaptrade,
  SnaptradeAuth,
} from 'snaptrade-typescript-sdk';

export type PersonalSnaptrade = Snaptrade<PersonalApiKeyAuth>;

let cached: PersonalSnaptrade | null | undefined;

export function isSnaptradeConfigured(): boolean {
  return Boolean(
    process.env.SNAPTRADE_CLIENT_ID?.trim() &&
      process.env.SNAPTRADE_CONSUMER_KEY?.trim(),
  );
}

export function getSnaptradeClient(): PersonalSnaptrade | null {
  if (!isSnaptradeConfigured()) return null;
  if (cached !== undefined) return cached;

  try {
    const auth = SnaptradeAuth.personalApiKey({
      clientId: process.env.SNAPTRADE_CLIENT_ID!.trim(),
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!.trim(),
    });
    cached = new Snaptrade({ auth });
  } catch (err) {
    console.error(
      '❌ Failed to init SnapTrade client:',
      err instanceof Error ? err.message : 'unknown error',
    );
    cached = null;
  }
  return cached;
}

/** Reset cached client (tests / env reload). */
export function resetSnaptradeClient(): void {
  cached = undefined;
}

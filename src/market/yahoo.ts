/**
 * Thin, failure-contained wrapper around `yahoo-finance2`.
 *
 * Yahoo Finance has no official public API. Treat everything here as
 * best-effort: every call is wrapped so a market-data outage degrades an
 * analytics response into a `warnings[]` entry instead of a 5xx.
 */
import YahooFinance from 'yahoo-finance2';

export interface YahooCallResult<T> {
  data: T | null;
  error?: string;
}

let client: InstanceType<typeof YahooFinance> | null = null;

export function getYahooClient(): InstanceType<typeof YahooFinance> {
  if (!client) {
    client = new YahooFinance({
      // The survey notice and schema drift notices are console noise in a
      // server process; validation stays on but only logs.
      suppressNotices: ['yahooSurvey', 'ripHistorical'],
      validation: { logErrors: false, logOptionsErrors: false },
    });
  }
  return client;
}

/** Test seam: swap in a stub client. */
export function setYahooClient(next: InstanceType<typeof YahooFinance> | null): void {
  client = next;
}

export function marketErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'market data request failed';
}

/**
 * Runs a Yahoo call with a hard timeout so a hung upstream cannot stall an
 * analytics request behind it.
 */
export async function guarded<T>(
  label: string,
  fn: () => Promise<T>,
  timeoutMs = 8_000,
): Promise<YahooCallResult<T>> {
  let timer: NodeJS.Timeout | null = null;
  try {
    const data = await Promise.race([
      fn(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
        timer.unref?.();
      }),
    ]);
    return { data };
  } catch (err) {
    const message = marketErrorMessage(err);
    // Symbols, prices and holdings never go to the log — only the failure.
    console.warn(`⚠️  market data: ${label} failed — ${message}`);
    return { data: null, error: `${label}: ${message}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

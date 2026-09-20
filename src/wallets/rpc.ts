/** Minimal batched JSON-RPC client shared by the EVM and Solana readers. */

export interface RpcRequest {
  method: string;
  params: unknown[];
}

export interface RpcOutcome {
  result?: unknown;
  error?: string;
}

export type RpcBatch = (url: string, calls: RpcRequest[]) => Promise<RpcOutcome[]>;

interface RpcRow {
  id?: number;
  result?: unknown;
  error?: { message?: string } | string;
}

export const jsonRpcBatch: RpcBatch = async (url, calls) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(
      calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params })),
    ),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  const body = (await res.json()) as RpcRow | RpcRow[];
  const rows = Array.isArray(body) ? body : [body];
  return calls.map((_, i) => {
    const row = rows.find((r) => r.id === i + 1);
    if (!row) return { error: 'No response for this call' };
    if (row.error) {
      return {
        error: typeof row.error === 'string' ? row.error : row.error.message || 'RPC error',
      };
    }
    return { result: row.result };
  });
};

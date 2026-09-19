import type { WatchChain } from '@/hooks/useAccounts'

/**
 * Client-side mirror of the server's key detection: enough to label what was
 * pasted before the request goes out. The server does the real validation.
 */
export interface DetectedKey {
  chain: WatchChain
  kind: 'xpub' | 'address'
  label: string
}

const CHAIN_NAMES: Record<WatchChain, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  sol: 'Solana',
}

const XPUB_LABELS: Record<string, string> = {
  xpub: 'legacy account (xpub)',
  ypub: 'wrapped segwit account (ypub)',
  zpub: 'native segwit account (zpub)',
}

export function detectKey(input: string): DetectedKey | null {
  const key = input.trim()
  if (!key) return null
  const prefix = key.slice(0, 4)
  if (XPUB_LABELS[prefix] && /^[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(key.slice(4))) {
    return { chain: 'btc', kind: 'xpub', label: `${CHAIN_NAMES.btc} · ${XPUB_LABELS[prefix]}` }
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(key)) {
    return { chain: 'eth', kind: 'address', label: `${CHAIN_NAMES.eth} · single address` }
  }
  if (/^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/i.test(key)) {
    return { chain: 'btc', kind: 'address', label: `${CHAIN_NAMES.btc} · single address` }
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)) {
    return { chain: 'sol', kind: 'address', label: `${CHAIN_NAMES.sol} · single address` }
  }
  return null
}

export type LedgerChain = 'btc' | 'eth'

/** True when this browser can talk to a Ledger over USB (Chrome, Edge, Brave). */
export function ledgerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator
}

/** SLIP-132 version bytes so Ledger answers with a zpub / ypub / xpub directly. */
const XPUB_VERSIONS = {
  native: { path: "84'/0'/0'", version: 0x04b24746 },
  wrapped: { path: "49'/0'/0'", version: 0x049d7cb2 },
  legacy: { path: "44'/0'/0'", version: 0x0488b21e },
}

export type BtcAccountType = keyof typeof XPUB_VERSIONS

/**
 * Reads an account-level public key (Bitcoin) or the first address
 * (Ethereum) from a connected Ledger. The device only ever exports public
 * material; the libraries are loaded on demand so the app bundle stays lean.
 */
export async function readFromLedger(
  chain: LedgerChain,
  btcAccount: BtcAccountType = 'native',
): Promise<{ key: string; institution: string }> {
  const { default: TransportWebHID } = await import('@ledgerhq/hw-transport-webhid')
  const transport = await TransportWebHID.create()
  try {
    if (chain === 'btc') {
      const { default: Btc } = await import('@ledgerhq/hw-app-btc')
      const app = new Btc({ transport })
      const { path, version } = XPUB_VERSIONS[btcAccount]
      const key = await app.getWalletXpub({ path, xpubVersion: version })
      return { key, institution: 'Ledger' }
    }
    const { default: Eth } = await import('@ledgerhq/hw-app-eth')
    const app = new Eth(transport)
    const { address } = await app.getAddress("44'/60'/0'/0/0")
    return { key: address, institution: 'Ledger' }
  } finally {
    await transport.close().catch(() => undefined)
  }
}

export function ledgerErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/0x6511|0x6e00|0x6d02|CLA_NOT_SUPPORTED|app.*not.*open/i.test(raw)) {
    return 'Open the Bitcoin or Ethereum app on the Ledger first, then try again.'
  }
  if (/0x5515|locked/i.test(raw)) return 'Unlock the Ledger with its PIN, then try again.'
  if (/No device selected|NotFoundError|cancel/i.test(raw)) {
    return 'No device was chosen. Plug the Ledger in and pick it in the browser prompt.'
  }
  if (/0x6985|denied|rejected/i.test(raw)) return 'The export was declined on the device.'
  return raw || 'Could not talk to the Ledger.'
}

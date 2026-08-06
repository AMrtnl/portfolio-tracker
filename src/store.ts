import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AccountStatus,
  AccountType,
  Holding,
  ProviderId,
  PublicAccount,
} from './types/accounts';

// ----- Internal persisted shapes -----

interface StoredAccountV1 {
  id: string;
  label: string;
  encryptedMnemonic: string;
  iv: string;
  tag: string;
  address: string;
  createdAt: string;
}

interface StoredAccountV2 {
  id: string;
  label: string;
  type: AccountType;
  provider: ProviderId;
  status: AccountStatus;
  externalId?: string;
  maskedIdentifier?: string;
  institution?: string;
  currency: string;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
  // Crypto wallet secrets (AES-GCM)
  encryptedMnemonic?: string;
  iv?: string;
  tag?: string;
  // Manual holdings
  holdings?: Holding[];
}

interface StoreDataV1 {
  version: 1;
  accounts: StoredAccountV1[];
}

interface StoreDataV2 {
  version: 2;
  accounts: StoredAccountV2[];
}

type StoreData = StoreDataV1 | StoreDataV2;

export type { StoredAccountV2 as StoredAccount };

// ----- Encryption helpers -----

function getEncryptionKey(): Buffer {
  const secret = process.env.STORE_SECRET || 'portfolio-tracker-default-key';
  return crypto.scryptSync(secret, 'portfolio-tracker-salt', 32);
}

function encrypt(plain: string): { ciphertext: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(plain, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return { ciphertext: enc, iv: iv.toString('hex'), tag: tag.toString('hex') };
}

function decrypt(ciphertext: string, ivHex: string, tagHex: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(ciphertext, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function maskAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function holdingsTotal(holdings: Holding[] | undefined): number {
  if (!holdings?.length) return 0;
  return holdings.reduce((s, h) => s + h.quantity * h.priceUsd, 0);
}

function migrateV1ToV2(old: StoreDataV1): StoreDataV2 {
  return {
    version: 2,
    accounts: old.accounts.map((a) => ({
      id: a.id,
      label: a.label,
      type: 'crypto_wallet' as const,
      provider: 'hyperliquid' as const,
      status: 'connected' as const,
      externalId: a.address,
      maskedIdentifier: maskAddress(a.address),
      institution: 'Hyperliquid',
      currency: 'USD',
      createdAt: a.createdAt,
      encryptedMnemonic: a.encryptedMnemonic,
      iv: a.iv,
      tag: a.tag,
    })),
  };
}

function toPublic(acct: StoredAccountV2, live?: boolean): PublicAccount {
  const pub: PublicAccount = {
    id: acct.id,
    label: acct.label,
    type: acct.type,
    provider: acct.provider,
    status: acct.status,
    externalId: acct.externalId,
    maskedIdentifier: acct.maskedIdentifier,
    institution: acct.institution,
    currency: acct.currency || 'USD',
    lastSyncedAt: acct.lastSyncedAt,
    lastError: acct.lastError,
    createdAt: acct.createdAt,
    live: live ?? false,
  };
  if (acct.provider === 'manual') {
    pub.holdings = acct.holdings || [];
    pub.totalValueUsd = holdingsTotal(acct.holdings);
  }
  return pub;
}

// ----- Store class -----

// DATA_DIR lets a host mount a persistent volume; containers otherwise lose
// accounts.json on every redeploy.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'accounts.json');

export class Store {
  private data: StoreDataV2;

  constructor() {
    this.data = this.load();
  }

  private load(): StoreDataV2 {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw) as StoreData;
        if (parsed.version === 2 && Array.isArray(parsed.accounts)) {
          return parsed;
        }
        if (parsed.version === 1 && Array.isArray(parsed.accounts)) {
          console.log('📂 Migrating accounts store v1 → v2…');
          const migrated = migrateV1ToV2(parsed);
          this.write(migrated);
          return migrated;
        }
      }
    } catch (err) {
      console.warn('⚠️  Could not read accounts store, starting fresh:', err);
    }
    return { version: 2, accounts: [] };
  }

  private write(data: StoreDataV2): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  private save(): void {
    this.write(this.data);
  }

  private find(id: string): StoredAccountV2 | undefined {
    return this.data.accounts.find((a) => a.id === id);
  }

  // ---- public API ----

  getAccounts(liveIds?: Set<string>): PublicAccount[] {
    return this.data.accounts.map((a) =>
      toPublic(a, liveIds?.has(a.id) ?? false),
    );
  }

  getAccount(id: string, live?: boolean): PublicAccount | null {
    const acct = this.find(id);
    if (!acct) return null;
    return toPublic(acct, live);
  }

  getRawAccount(id: string): StoredAccountV2 | null {
    return this.find(id) ?? null;
  }

  getAllRaw(): StoredAccountV2[] {
    return [...this.data.accounts];
  }

  /** Add a Hyperliquid crypto wallet (mnemonic encrypted at rest). */
  addCryptoWallet(label: string, mnemonic: string, address: string): string {
    const id = crypto.randomUUID();
    const { ciphertext, iv, tag } = encrypt(mnemonic);
    this.data.accounts.push({
      id,
      label,
      type: 'crypto_wallet',
      provider: 'hyperliquid',
      status: 'connected',
      externalId: address,
      maskedIdentifier: maskAddress(address),
      institution: 'Hyperliquid',
      currency: 'USD',
      createdAt: new Date().toISOString(),
      encryptedMnemonic: ciphertext,
      iv,
      tag,
    });
    this.save();
    return id;
  }

  /** Add a manual account with optional holdings. */
  addManualAccount(
    label: string,
    opts: {
      institution?: string;
      currency?: string;
      holdings?: Holding[];
      type?: 'manual' | 'broker' | 'bank';
    } = {},
  ): string {
    const id = crypto.randomUUID();
    const holdings = (opts.holdings || []).map(normalizeHolding);
    this.data.accounts.push({
      id,
      label,
      type: opts.type || 'manual',
      provider: 'manual',
      status: 'connected',
      maskedIdentifier: opts.institution || 'Manual',
      institution: opts.institution || 'Manual',
      currency: opts.currency || 'USD',
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      holdings,
    });
    this.save();
    return id;
  }

  /**
   * Link / upsert a SnapTrade brokerage account locally.
   * Secrets stay in env (Personal API key); we only store the external id.
   */
  upsertSnaptradeAccount(input: {
    externalId: string;
    label: string;
    institution?: string;
    maskedIdentifier?: string;
    currency?: string;
    type?: 'broker' | 'bank';
  }): string {
    const existing = this.data.accounts.find(
      (a) => a.provider === 'snaptrade' && a.externalId === input.externalId,
    );
    if (existing) {
      existing.label = input.label || existing.label;
      existing.institution = input.institution ?? existing.institution;
      existing.maskedIdentifier =
        input.maskedIdentifier ?? existing.maskedIdentifier;
      existing.currency = input.currency || existing.currency || 'USD';
      existing.status = 'connected';
      existing.lastError = undefined;
      this.save();
      return existing.id;
    }
    const id = crypto.randomUUID();
    this.data.accounts.push({
      id,
      label: input.label,
      type: input.type || 'broker',
      provider: 'snaptrade',
      status: 'connected',
      externalId: input.externalId,
      maskedIdentifier: input.maskedIdentifier,
      institution: input.institution || 'Brokerage',
      currency: input.currency || 'USD',
      createdAt: new Date().toISOString(),
    });
    this.save();
    return id;
  }

  updateAccount(
    id: string,
    patch: {
      label?: string;
      holdings?: Holding[];
      institution?: string;
      status?: AccountStatus;
      lastSyncedAt?: string;
      lastError?: string | null;
    },
  ): boolean {
    const acct = this.find(id);
    if (!acct) return false;
    if (patch.label !== undefined) acct.label = patch.label.trim();
    if (patch.institution !== undefined) {
      acct.institution = patch.institution;
      if (acct.provider === 'manual') {
        acct.maskedIdentifier = patch.institution;
      }
    }
    if (patch.holdings !== undefined) {
      acct.holdings = patch.holdings.map(normalizeHolding);
    }
    if (patch.status !== undefined) acct.status = patch.status;
    if (patch.lastSyncedAt !== undefined) acct.lastSyncedAt = patch.lastSyncedAt;
    if (patch.lastError !== undefined) {
      acct.lastError = patch.lastError ?? undefined;
    }
    this.save();
    return true;
  }

  removeAccount(id: string): boolean {
    const before = this.data.accounts.length;
    this.data.accounts = this.data.accounts.filter((a) => a.id !== id);
    if (this.data.accounts.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  getMnemonic(id: string): string | null {
    const acct = this.find(id);
    if (!acct?.encryptedMnemonic || !acct.iv || !acct.tag) return null;
    try {
      return decrypt(acct.encryptedMnemonic, acct.iv, acct.tag);
    } catch {
      console.error(`❌ Failed to decrypt mnemonic for account ${id}`);
      return null;
    }
  }

  /** @deprecated Use addCryptoWallet */
  addAccount(label: string, mnemonic: string, address: string): string {
    return this.addCryptoWallet(label, mnemonic, address);
  }
}

function normalizeHolding(h: Holding): Holding {
  return {
    symbol: String(h.symbol || '').trim().toUpperCase(),
    name: h.name?.trim() || undefined,
    quantity: Number(h.quantity) || 0,
    priceUsd: Number(h.priceUsd) || 0,
    assetClass: h.assetClass || 'other',
  };
}

import fs from 'fs';
import path from 'path';

/**
 * Bank links in progress. A GoCardless requisition is created before the
 * user leaves for the bank and only becomes accounts when they come back, so
 * the reference has to survive in between — and belong to one user only.
 */

export interface PendingRequisition {
  /** GoCardless requisition id. */
  id: string;
  /** Our reference, the value the bank redirect carries back. */
  reference: string;
  institutionId: string;
  institutionName: string;
  createdAt: string;
  status: string;
}

interface LinksFile {
  version: 1;
  requisitions: PendingRequisition[];
}

/** Anything older than this is dead at GoCardless too (consent links expire). */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export class LinksStore {
  private data: LinksFile;
  private readonly file: string;

  /** `dir` is the owning user's data directory. */
  constructor(readonly dir: string) {
    this.file = path.join(dir, 'links.json');
    this.data = this.load();
  }

  private load(): LinksFile {
    try {
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<LinksFile>;
        if (parsed?.version === 1 && Array.isArray(parsed.requisitions)) {
          return { version: 1, requisitions: parsed.requisitions };
        }
      }
    } catch (err) {
      console.warn('⚠️  Could not read links store, starting fresh:', err);
    }
    return { version: 1, requisitions: [] };
  }

  private save(): void {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  list(): PendingRequisition[] {
    return [...this.data.requisitions];
  }

  add(input: Omit<PendingRequisition, 'createdAt'> & { createdAt?: string }): PendingRequisition {
    const row: PendingRequisition = { ...input, createdAt: input.createdAt ?? new Date().toISOString() };
    // Stale rows never turn into accounts; drop them while we are writing anyway.
    const cutoff = Date.now() - MAX_AGE_MS;
    this.data.requisitions = this.data.requisitions.filter((r) => Date.parse(r.createdAt) >= cutoff);
    this.data.requisitions.push(row);
    this.save();
    return row;
  }

  findByReference(reference: string): PendingRequisition | null {
    if (!reference) return null;
    return this.data.requisitions.find((r) => r.reference === reference) ?? null;
  }

  setStatus(id: string, status: string): PendingRequisition | null {
    const row = this.data.requisitions.find((r) => r.id === id);
    if (!row) return null;
    row.status = status;
    this.save();
    return row;
  }

  remove(id: string): boolean {
    const before = this.data.requisitions.length;
    this.data.requisitions = this.data.requisitions.filter((r) => r.id !== id);
    if (this.data.requisitions.length === before) return false;
    this.save();
    return true;
  }
}

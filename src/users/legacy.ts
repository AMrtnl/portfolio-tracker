/**
 * The single-household deployment kept every store at the root of DATA_DIR.
 * The first account to sign up inherits those files, so the owner's existing
 * data survives the move to per-user directories without any manual step.
 */
import fs from 'fs';
import path from 'path';

export const LEGACY_FILES = [
  'accounts.json',
  'settings.json',
  'money.json',
  'goals.json',
  'history.json',
] as const;

export function hasLegacyData(rootDir: string): boolean {
  return LEGACY_FILES.some((name) => fs.existsSync(path.join(rootDir, name)));
}

function moveFile(from: string, to: string): void {
  try {
    fs.renameSync(from, to);
  } catch (err) {
    // A volume mounted below DATA_DIR can put the target on another device,
    // where rename is impossible; copy-then-delete is the same end state.
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

/** Moves every legacy file into `userDir` and returns the names it moved. */
export function adoptLegacyData(rootDir: string, userDir: string): string[] {
  const moved: string[] = [];
  for (const name of LEGACY_FILES) {
    const from = path.join(rootDir, name);
    if (!fs.existsSync(from)) continue;
    const to = path.join(userDir, name);
    if (fs.existsSync(to)) {
      console.warn(`⚠️  Not adopting legacy ${name}: ${to} already exists.`);
      continue;
    }
    fs.mkdirSync(userDir, { recursive: true });
    moveFile(from, to);
    moved.push(name);
  }
  if (moved.length > 0) {
    console.log(`📦 Adopted legacy data into ${userDir}: ${moved.join(', ')}`);
  }
  return moved;
}

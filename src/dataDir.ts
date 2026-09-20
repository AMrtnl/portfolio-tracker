import path from 'path';

/**
 * DATA_DIR lets a host mount a persistent volume; containers otherwise lose
 * every store on redeploy. Resolved per call so tests can point it at a
 * scratch directory without reloading modules.
 */
export function rootDataDir(): string {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, '..', 'data');
}

import fs from 'fs';
import os from 'os';
import path from 'path';
import { LEGACY_FILES, adoptLegacyData, hasLegacyData } from './legacy';

describe('legacy data adoption', () => {
  let root: string;
  let log: jest.SpyInstance;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-hub-legacy-'));
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('moves the single-user files into the user directory and nothing else', () => {
    fs.writeFileSync(path.join(root, 'accounts.json'), '{"version":2,"accounts":[]}');
    fs.writeFileSync(path.join(root, 'money.json'), '{"version":1,"transactions":[]}');
    fs.writeFileSync(path.join(root, 'market-cache-fx.json'), '{}');
    expect(hasLegacyData(root)).toBe(true);

    const userDir = path.join(root, 'users', 'u1');
    expect(adoptLegacyData(root, userDir)).toEqual(['accounts.json', 'money.json']);

    expect(fs.readFileSync(path.join(userDir, 'accounts.json'), 'utf8')).toContain('"version":2');
    expect(fs.existsSync(path.join(userDir, 'money.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'accounts.json'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'money.json'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'market-cache-fx.json'))).toBe(true);
    expect(hasLegacyData(root)).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Adopted legacy data'));

    // A second run finds nothing left to move.
    expect(adoptLegacyData(root, userDir)).toEqual([]);
  });

  it('is a no-op when there is nothing to adopt', () => {
    expect(hasLegacyData(root)).toBe(false);
    expect(adoptLegacyData(root, path.join(root, 'users', 'u1'))).toEqual([]);
    expect(fs.existsSync(path.join(root, 'users'))).toBe(false);
  });

  it('never overwrites a file the user already has', () => {
    const userDir = path.join(root, 'users', 'u1');
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(path.join(root, 'goals.json'), 'legacy');
    fs.writeFileSync(path.join(userDir, 'goals.json'), 'mine');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(adoptLegacyData(root, userDir)).toEqual([]);
    } finally {
      warn.mockRestore();
    }
    expect(fs.readFileSync(path.join(userDir, 'goals.json'), 'utf8')).toBe('mine');
    expect(fs.existsSync(path.join(root, 'goals.json'))).toBe(true);
  });

  it('covers every per-user store', () => {
    expect([...LEGACY_FILES].sort()).toEqual(
      ['accounts.json', 'goals.json', 'history.json', 'money.json', 'settings.json'].sort(),
    );
  });
});

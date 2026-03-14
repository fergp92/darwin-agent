// darwin/tests/core/db.test.js
import { describe, it, expect, afterEach } from 'vitest';
import { initDb, getDb, closeDb } from '../../core/db.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let testDbPath;

function makeTempDb() {
  testDbPath = path.join(os.tmpdir(), `darwin-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  return testDbPath;
}

function cleanup() {
  closeDb();
  if (testDbPath) {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(testDbPath + suffix); } catch {}
    }
  }
}

describe('Database', () => {
  afterEach(cleanup, 15000);

  it('initializes database with WAL mode', () => {
    const db = initDb(makeTempDb());
    const result = db.pragma('journal_mode');
    expect(result[0].journal_mode).toBe('wal');
  });

  it('runs migrations on init', () => {
    const db = initDb(makeTempDb());
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
    ).get();
    expect(tables).toBeDefined();
    expect(tables.name).toBe('migrations');
  });

  it('creates all required tables from 001 migration', () => {
    const db = initDb(makeTempDb());
    const expected = [
      'portfolio', 'trades', 'brain_decisions', 'strategy_metrics',
      'circuit_breakers', 'predictions', 'airdrop_interactions',
      'daily_snapshots', 'migrations'
    ];
    for (const table of expected) {
      const row = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(table);
      expect(row, `Table ${table} should exist`).toBeDefined();
    }
  });

  it('does not re-run already applied migrations', () => {
    const dbFile = makeTempDb();
    initDb(dbFile);
    closeDb();
    // Re-init — should not throw or re-apply
    const db = initDb(dbFile);
    const count = db.prepare('SELECT COUNT(*) as c FROM migrations').get();
    expect(count.c).toBe(1); // Only 001
  });

  it('getDb returns active connection', () => {
    initDb(makeTempDb());
    const db = getDb();
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe('function');
  });
});

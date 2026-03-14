// darwin/tests/core/portfolio.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb } from '../../core/db.js';
import { Portfolio } from '../../core/portfolio.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let testDbPath;

function makeTempDb() {
  testDbPath = path.join(os.tmpdir(), `darwin-portfolio-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
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

describe('Portfolio', () => {
  let portfolio;

  beforeEach(() => {
    const db = initDb(makeTempDb());
    portfolio = new Portfolio(db);
  });

  afterEach(cleanup, 15000);

  it('starts with zero balance', () => {
    const state = portfolio.getState();
    expect(state.totalBalanceEur).toBe(0);
    expect(state.tier).toBe(0);
    expect(state.mode).toBe('normal');
  });

  it('updates balance and persists snapshot', () => {
    portfolio.updateBalance({ solana: 20, base: 15, polygon: 10 });
    const state = portfolio.getState();
    expect(state.totalBalanceEur).toBe(45);
    expect(state.solanaBalanceEur).toBe(20);
  });

  it('evaluates tier 0 correctly', () => {
    portfolio.updateBalance({ solana: 30, base: 10, polygon: 10 });
    expect(portfolio.getState().tier).toBe(0); // 50 < 150
  });

  it('upgrades to tier 1 at 150 EUR', () => {
    portfolio.updateBalance({ solana: 60, base: 50, polygon: 40 });
    expect(portfolio.getState().tier).toBe(1); // 150 >= 150
  });

  it('enters emergency mode below 30 EUR', () => {
    portfolio.updateBalance({ solana: 10, base: 8, polygon: 7 });
    expect(portfolio.getState().mode).toBe('emergency');
  });

  it('enters hibernation below 10 EUR', () => {
    portfolio.updateBalance({ solana: 3, base: 3, polygon: 3 });
    expect(portfolio.getState().mode).toBe('hibernation');
  });

  it('enters dead mode below 5 EUR', () => {
    portfolio.updateBalance({ solana: 1, base: 1, polygon: 1 });
    expect(portfolio.getState().mode).toBe('dead');
  });

  it('returns to normal above 30 EUR', () => {
    portfolio.updateBalance({ solana: 5, base: 5, polygon: 5 });
    expect(portfolio.getState().mode).toBe('emergency');

    portfolio.updateBalance({ solana: 15, base: 10, polygon: 10 });
    expect(portfolio.getState().mode).toBe('normal');
  });

  it('provides allocation percentages for current tier', () => {
    portfolio.updateBalance({ solana: 60, base: 50, polygon: 40 });
    const alloc = portfolio.getAllocation();
    expect(alloc.prediction).toBe(30); // Tier 1
    expect(alloc.liquidation).toBe(20);
    expect(alloc.arbitrage).toBe(20);
  });
});

// darwin/tests/core/risk-manager.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDb, closeDb } from '../../core/db.js';
import { RiskManager } from '../../core/risk-manager.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let testDbPath;

function makeTempDb() {
  testDbPath = path.join(os.tmpdir(), `darwin-risk-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
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

function mockPortfolio(overrides = {}) {
  const defaults = { totalBalanceEur: 100, tier: 0, mode: 'normal' };
  const alloc = { prediction: 40, airdrop: 30, yield: 30, liquidation: 0, arbitrage: 0 };
  return {
    getState: () => ({ ...defaults, ...overrides }),
    getAllocation: () => ({ ...alloc, ...(overrides.allocation || {}) }),
  };
}

describe('RiskManager', () => {
  let db;
  let rm;

  beforeEach(() => {
    db = initDb(makeTempDb());
    rm = new RiskManager(db, mockPortfolio());
  });

  afterEach(cleanup, 15000);

  it('approves a valid trade', () => {
    const result = rm.validateTrade({
      strategy: 'prediction',
      amount: 10,
      gasCostEur: 0.5,
    });
    expect(result.approved).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects trade exceeding position size (>20%)', () => {
    const result = rm.validateTrade({
      strategy: 'prediction',
      amount: 25, // 25% of 100
      gasCostEur: 0.5,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('position size');
  });

  it('rejects trade that would breach capital floor', () => {
    // Use a portfolio with 35 EUR — floor is 30 for normal mode
    // maxPosition = 20% of 35 = 7, so amount 7 passes position check
    // But post-trade balance = 35 - 7 = 28 < 30 floor
    const floorRm = new RiskManager(db, mockPortfolio({ totalBalanceEur: 35 }));
    const result = floorRm.validateTrade({
      strategy: 'prediction',
      amount: 7,
      gasCostEur: 0.1,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('capital floor');
  });

  it('rejects trade with excessive gas cost', () => {
    const result = rm.validateTrade({
      strategy: 'prediction',
      amount: 5,
      gasCostEur: 1, // 1/5 = 20% > 10% limit
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('gas');
  });

  it('rejects duplicate trade within 5 minutes', () => {
    rm.recordTrade({ strategy: 'prediction', amount: 5, tradeKey: 'polymarket-abc' });
    const result = rm.validateTrade({
      strategy: 'prediction',
      amount: 5,
      gasCostEur: 0.1,
      tradeKey: 'polymarket-abc',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('duplicate');
  });

  it('rejects trade when strategy exceeds allocation', () => {
    // Allocation for prediction at tier 0 is 40% of 100 = 40 EUR max
    rm.recordTrade({ strategy: 'prediction', amount: 35 });
    const result = rm.validateTrade({
      strategy: 'prediction',
      amount: 10, // 35 + 10 = 45 > 40
      gasCostEur: 0.1,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('allocation');
  });

  it('triggers circuit breaker on daily loss exceeding 15%', () => {
    rm.recordDailyLoss(16);
    const breakers = rm.getActiveBreakers();
    expect(breakers.length).toBeGreaterThanOrEqual(1);
    expect(breakers[0].type).toBe('daily_loss');
  });

  it('blocks all trades when daily loss breaker is active', () => {
    rm.recordDailyLoss(16);
    const result = rm.validateTrade({
      strategy: 'prediction',
      amount: 5,
      gasCostEur: 0.1,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('circuit breaker');
  });

  it('uses emergency position size (5%) in emergency mode', () => {
    const emergencyRm = new RiskManager(db, mockPortfolio({ mode: 'emergency', totalBalanceEur: 25 }));
    // 5% of 25 = 1.25 EUR max position
    const result = emergencyRm.validateTrade({
      strategy: 'prediction',
      amount: 2, // > 1.25
      gasCostEur: 0.05,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('position size');
  });
});

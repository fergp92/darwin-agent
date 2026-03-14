// darwin/core/risk-manager.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './logger.js';
import { eventBus, EVENTS } from './events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'config');
const config = JSON.parse(fs.readFileSync(path.join(configDir, 'default.json'), 'utf-8')).risk;

const log = createLogger('risk-manager');

export class RiskManager {
  #db;
  #portfolio;
  #recentTrades; // Map<tradeKey, timestamp>
  #strategyExposure; // Map<strategy, amountEur>
  #dailyLossPct;

  constructor(db, portfolio) {
    this.#db = db;
    this.#portfolio = portfolio;
    this.#recentTrades = new Map();
    this.#strategyExposure = new Map();
    this.#dailyLossPct = 0;
  }

  /**
   * Validate a proposed trade against all risk checks.
   * @param {{ strategy: string, amount: number, gasCostEur: number, tradeKey?: string, chain?: string }} trade
   * @returns {{ approved: boolean, reason?: string }}
   */
  validateTrade({ strategy, amount, gasCostEur, tradeKey, chain }) {
    const state = this.#portfolio.getState();
    const allocation = this.#portfolio.getAllocation();

    // Check 0: Active circuit breakers
    const breakers = this.getActiveBreakers();
    if (breakers.length > 0) {
      const relevant = breakers.find(
        b => b.type === 'daily_loss' ||
             (b.type === 'strategy_loss' && b.target === strategy) ||
             (b.type === 'chain_failure' && b.target === chain)
      );
      if (relevant) {
        return { approved: false, reason: `Blocked by active circuit breaker: ${relevant.type} — ${relevant.reason}` };
      }
    }

    // Check 1: Position size
    const maxPct = state.mode === 'emergency'
      ? config.emergencyMaxPositionPct
      : config.maxPositionPct;
    const maxAmount = (maxPct / 100) * state.totalBalanceEur;
    if (amount > maxAmount) {
      return { approved: false, reason: `Exceeds max position size: ${amount.toFixed(2)} > ${maxAmount.toFixed(2)} (${maxPct}%)` };
    }

    // Check 2: Capital floor
    const floor = this.#getFloor(state.mode);
    const postTradeBalance = state.totalBalanceEur - amount;
    if (postTradeBalance < floor) {
      return { approved: false, reason: `Would breach capital floor: ${postTradeBalance.toFixed(2)} < ${floor} (${state.mode})` };
    }

    // Check 3: Daily loss limit
    if (this.#dailyLossPct >= config.dailyLossLimitPct) {
      return { approved: false, reason: `Daily loss limit reached: ${this.#dailyLossPct.toFixed(1)}% >= ${config.dailyLossLimitPct}%` };
    }

    // Check 4: Strategy allocation
    const allocPct = allocation[strategy] || 0;
    const maxStrategyAmount = (allocPct / 100) * state.totalBalanceEur;
    const currentExposure = this.#strategyExposure.get(strategy) || 0;
    if (currentExposure + amount > maxStrategyAmount) {
      return {
        approved: false,
        reason: `Exceeds strategy allocation: ${(currentExposure + amount).toFixed(2)} > ${maxStrategyAmount.toFixed(2)} (${allocPct}% for ${strategy})`,
      };
    }

    // Check 5: Gas sanity
    const gasMaxAmount = (config.gasMaxPct / 100) * amount;
    if (gasCostEur > gasMaxAmount) {
      return { approved: false, reason: `Excessive gas cost: ${gasCostEur.toFixed(2)} > ${gasMaxAmount.toFixed(2)} (${config.gasMaxPct}% of trade)` };
    }

    // Check 6: Duplicate trade
    if (tradeKey) {
      const lastTime = this.#recentTrades.get(tradeKey);
      if (lastTime && Date.now() - lastTime < config.duplicateWindowMs) {
        return { approved: false, reason: `Rejected duplicate trade: ${tradeKey} within ${config.duplicateWindowMs / 1000}s window` };
      }
    }

    log.info({ strategy, amount, gasCostEur, tradeKey }, 'Trade approved');
    return { approved: true };
  }

  /**
   * Record a completed trade — updates exposure and duplicate tracking.
   * @param {{ strategy: string, amount: number, tradeKey?: string }} trade
   */
  recordTrade(trade) {
    const { strategy, amount, tradeKey } = trade;

    // Update strategy exposure
    const current = this.#strategyExposure.get(strategy) || 0;
    this.#strategyExposure.set(strategy, current + amount);

    // Update duplicate tracking
    if (tradeKey) {
      this.#recentTrades.set(tradeKey, Date.now());
    }

    log.info({ strategy, amount, tradeKey }, 'Trade recorded');
  }

  /**
   * Record a daily loss percentage — triggers circuit breaker if threshold exceeded.
   * @param {number} lossPct
   */
  recordDailyLoss(lossPct) {
    this.#dailyLossPct = lossPct;
    if (lossPct >= config.dailyLossLimitPct) {
      log.warn({ lossPct }, 'Daily loss limit breached — triggering circuit breaker');
      this.#triggerBreaker(
        'daily_loss',
        null,
        `Daily loss ${lossPct.toFixed(1)}% >= ${config.dailyLossLimitPct}% limit`,
        24 * 60 * 60 * 1000, // 24 hours
      );
    }
  }

  /**
   * Get all active (non-expired, non-resolved) circuit breakers.
   * @returns {Array<{ id: number, type: string, target: string|null, reason: string, expires_at: string|null }>}
   */
  getActiveBreakers() {
    return this.#db.prepare(`
      SELECT id, type, target, reason, expires_at
      FROM circuit_breakers
      WHERE active = 1
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).all();
  }

  /**
   * Reset daily counters — called at start of each trading day.
   */
  resetDaily() {
    this.#dailyLossPct = 0;
    this.#strategyExposure.clear();
    this.#recentTrades.clear();
    log.info('Daily risk counters reset');
  }

  /**
   * Get the capital floor for a given mode.
   * @param {string} mode
   * @returns {number}
   */
  #getFloor(mode) {
    return config.capitalFloors[mode] ?? config.capitalFloors.normal;
  }

  /**
   * Insert a circuit breaker record and emit event.
   * @param {string} type
   * @param {string|null} target
   * @param {string} reason
   * @param {number} durationMs
   */
  #triggerBreaker(type, target, reason, durationMs) {
    const expiresAt = new Date(Date.now() + durationMs).toISOString();

    this.#db.prepare(`
      INSERT INTO circuit_breakers (type, target, reason, expires_at, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(type, target, reason, expiresAt);

    eventBus.emit(EVENTS.CIRCUIT_BREAKER_TRIGGERED, { type, target, reason, expiresAt });
    log.warn({ type, target, reason, expiresAt }, 'Circuit breaker triggered');
  }
}

// darwin/strategies/base-strategy.js
import { createLogger } from '../core/logger.js';
import { eventBus, EVENTS } from '../core/events.js';

/**
 * Abstract base class for all trading strategies.
 * Provides the scan -> evaluate -> execute lifecycle.
 */
export class BaseStrategy {
  constructor(name, opts = {}) {
    if (new.target === BaseStrategy) {
      throw new Error('Cannot instantiate abstract BaseStrategy directly');
    }

    this.name = name;
    this.isPaper = opts.paper ?? false;
    this.minCapital = opts.minCapital ?? 0;
    this.log = createLogger(`strategy:${name}`);
    this.riskManager = null;
    this.enabled = true;
  }

  /**
   * Orchestrates the full strategy cycle: scan -> evaluate -> execute.
   * @returns {Promise<{opportunities: number, executed: boolean, paper: boolean, errors: Array}>}
   */
  async runCycle() {
    const result = { opportunities: 0, executed: false, paper: false, errors: [] };

    const opportunities = await this.scan();
    result.opportunities = opportunities.length;

    for (const opp of opportunities) {
      try {
        const evaluation = await this.evaluate(opp);

        if (!evaluation.shouldExecute) {
          continue;
        }

        if (this.isPaper) {
          this.log.info({ opportunity: opp, evaluation }, 'Paper mode — theoretical trade');
          eventBus.emit(EVENTS.STRATEGY_OPPORTUNITY, {
            strategy: this.name,
            opportunity: opp,
            evaluation,
          });
          result.paper = true;
          continue;
        }

        if (this.riskManager) {
          const validation = this.riskManager.validateTrade(evaluation);
          if (!validation.approved) {
            eventBus.emit(EVENTS.TRADE_REJECTED, {
              strategy: this.name,
              evaluation,
              reason: validation.reason,
            });
            continue;
          }
        }

        const tradeResult = await this.execute(evaluation);
        result.executed = true;

        if (this.riskManager) {
          this.riskManager.recordTrade(tradeResult);
        }

        eventBus.emit(EVENTS.TRADE_EXECUTED, {
          strategy: this.name,
          trade: tradeResult,
        });
      } catch (err) {
        result.errors.push(err);
        eventBus.emit(EVENTS.TRADE_FAILED, {
          strategy: this.name,
          error: err.message,
        });
      }
    }

    return result;
  }

  /**
   * Check whether available capital meets the strategy minimum.
   * @param {number} availableEur
   * @returns {boolean}
   */
  hasMinCapital(availableEur) {
    return availableEur >= this.minCapital;
  }

  // --- Abstract methods (must be overridden) ---

  async scan() {
    throw new Error('Not implemented');
  }

  async evaluate(opportunity) {
    throw new Error('Not implemented');
  }

  async execute(evaluation) {
    throw new Error('Not implemented');
  }

  report() {
    throw new Error('Not implemented');
  }
}

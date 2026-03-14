// darwin/strategies/liquidation/liquidation-strategy.js
import { BaseStrategy } from '../base-strategy.js';
import { aggregateHealthFactors } from './health-monitor.js';

const LIQUIDATION_BONUS = 0.05; // 5% typical liquidation bonus
const ESTIMATED_GAS_USD = 2; // Conservative gas estimate

/**
 * Liquidation strategy — monitors lending protocol health factors
 * and executes liquidations on under-collateralized positions.
 *
 * Purely mathematical evaluation (no Brain/LLM needed).
 */
export class LiquidationStrategy extends BaseStrategy {
  constructor({ adapters, paper }) {
    super('liquidation', { paper, minCapital: 30 });
    this.adapters = adapters;
    this._liquidationsExecuted = 0;
    this._totalProfit = 0;
  }

  /**
   * Scan all adapters for positions with health factor < 1.0.
   * @returns {Promise<Array<{user: string, health: number, collateral: number, protocol: string, chain: string}>>}
   */
  async scan() {
    this.log.info('Scanning health factors across all chains');
    const unhealthy = await aggregateHealthFactors(this.adapters);
    this.log.info({ count: unhealthy.length }, 'Found liquidatable positions');
    return unhealthy;
  }

  /**
   * Evaluate whether a position is profitable to liquidate.
   * Purely mathematical — no Brain/LLM call.
   * @param {{user: string, health: number, collateral: number, protocol: string, chain: string}} position
   * @returns {Promise<{shouldExecute: boolean, estimatedProfit: number, position: object}>}
   */
  async evaluate(position) {
    const { health, collateral } = position;

    if (health >= 1.0) {
      return { shouldExecute: false, estimatedProfit: 0, position };
    }

    const estimatedProfit = collateral * LIQUIDATION_BONUS;
    const shouldExecute = estimatedProfit > ESTIMATED_GAS_USD;

    this.log.debug(
      { user: position.user, health, estimatedProfit, shouldExecute },
      'Evaluated liquidation opportunity',
    );

    return { shouldExecute, estimatedProfit, position };
  }

  /**
   * Execute a liquidation via the appropriate chain adapter.
   * @param {{shouldExecute: boolean, estimatedProfit: number, position: object}} evaluation
   * @returns {Promise<{txHash: string, profit: number, chain: string, protocol: string}>}
   */
  async execute(evaluation) {
    const { position } = evaluation;
    const adapter = this.adapters[position.chain];

    if (!adapter) {
      throw new Error(`No adapter for chain: ${position.chain}`);
    }

    this.log.info(
      { user: position.user, chain: position.chain, protocol: position.protocol },
      'Executing liquidation',
    );

    const result = await adapter.liquidate(position);

    this._liquidationsExecuted += 1;
    this._totalProfit += result.profit ?? 0;

    return {
      ...result,
      chain: position.chain,
      protocol: position.protocol,
    };
  }

  /**
   * Report strategy performance metrics.
   * @returns {{liquidationsExecuted: number, totalProfit: number}}
   */
  report() {
    return {
      liquidationsExecuted: this._liquidationsExecuted,
      totalProfit: this._totalProfit,
    };
  }
}

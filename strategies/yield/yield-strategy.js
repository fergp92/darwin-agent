// darwin/strategies/yield/yield-strategy.js

import { BaseStrategy } from '../base-strategy.js';
import { scanAll } from './apy-scanner.js';

/**
 * Yield Strategy — finds the best lending APY across chains and
 * reallocates deposits when the improvement justifies gas costs.
 */
export class YieldStrategy extends BaseStrategy {
  /**
   * @param {object} opts
   * @param {object} opts.adapters - Chain adapters keyed by chain name
   * @param {boolean} [opts.paper=false] - Paper trading mode
   */
  constructor({ adapters, paper } = {}) {
    super('yield', { paper, minCapital: 5 });
    this.adapters = adapters ?? {};
    this._currentDeposits = [];
    this._totalYieldEarned = 0;
  }

  /**
   * Fetch APY data from lending protocols.
   * Exposed as a method so tests can mock it easily.
   * @returns {Promise<Array<{protocol: string, chain: string, apy: number, tvl: number}>>}
   */
  async _fetchApys() {
    return scanAll(Object.keys(this.adapters).filter((c) => c !== 'solana'));
  }

  /**
   * Scan available lending opportunities across all chains.
   * @returns {Promise<Array<{protocol: string, chain: string, apy: number, tvl: number}>>}
   */
  async scan() {
    this.log.info('Scanning lending opportunities');
    const opportunities = await this._fetchApys();
    this.log.info({ count: opportunities.length }, 'Opportunities found');
    return opportunities;
  }

  /**
   * Evaluate whether switching to a new opportunity is worthwhile.
   * Switching is justified when:
   *   annualised APY improvement on `amount` > annualised gas cost (weekly rebalance)
   *
   * Formula: (apy_delta / 100) * amount > gasCostEur * 52
   *
   * @param {object} opp
   * @param {string} opp.protocol
   * @param {string} opp.chain
   * @param {number} opp.apy         - Target APY (%)
   * @param {number} [opp.currentApy=0] - Current deposit APY (%)
   * @param {number} opp.gasCostEur  - Estimated gas cost in EUR
   * @param {number} opp.amount      - Deposit amount in EUR
   * @returns {Promise<{shouldExecute: boolean, reason: string, opp: object}>}
   */
  async evaluate(opp) {
    const currentApy = opp.currentApy ?? 0;
    const apyDelta = opp.apy - currentApy;
    const annualBenefit = (apyDelta / 100) * opp.amount;
    const annualGasCost = opp.gasCostEur * 52;

    const shouldExecute = annualBenefit > annualGasCost;

    const reason = shouldExecute
      ? `APY +${apyDelta.toFixed(2)}% yields ${annualBenefit.toFixed(2)} EUR/yr vs ${annualGasCost.toFixed(2)} EUR gas/yr`
      : `APY delta too small: ${annualBenefit.toFixed(2)} EUR/yr <= ${annualGasCost.toFixed(2)} EUR gas/yr`;

    this.log.info({ shouldExecute, apyDelta, annualBenefit, annualGasCost }, reason);

    return { shouldExecute, reason, opp };
  }

  /**
   * Execute a reallocation: withdraw from current deposit, deposit into the best opportunity.
   * @param {object} evaluation - Result from evaluate()
   * @returns {Promise<object>} Trade result
   */
  async execute(evaluation) {
    const { opp } = evaluation;
    const adapter = this.adapters[opp.chain];

    if (!adapter) {
      throw new Error(`No adapter for chain: ${opp.chain}`);
    }

    // Withdraw from current position if we have one on this chain
    const existingIdx = this._currentDeposits.findIndex((d) => d.chain === opp.chain);
    if (existingIdx !== -1) {
      const existing = this._currentDeposits[existingIdx];
      this.log.info({ protocol: existing.protocol, chain: opp.chain }, 'Withdrawing current deposit');
      await adapter.withdraw({ protocol: existing.protocol, amount: existing.amount });
      this._currentDeposits.splice(existingIdx, 1);
    }

    // Deposit into new opportunity
    this.log.info({ protocol: opp.protocol, chain: opp.chain, apy: opp.apy }, 'Depositing');
    const result = await adapter.deposit({
      protocol: opp.protocol,
      amount: opp.amount,
    });

    this._currentDeposits.push({
      protocol: opp.protocol,
      chain: opp.chain,
      apy: result.apy ?? opp.apy,
      amount: opp.amount,
      depositedAt: new Date().toISOString(),
    });

    return {
      type: 'yield_reallocation',
      protocol: opp.protocol,
      chain: opp.chain,
      apy: result.apy ?? opp.apy,
      txHash: result.txHash,
      amount: opp.amount,
    };
  }

  /**
   * Report current yield positions and total earnings.
   * @returns {{currentDeposits: Array, totalYieldEarned: number}}
   */
  report() {
    return {
      currentDeposits: this._currentDeposits,
      totalYieldEarned: this._totalYieldEarned,
    };
  }
}

// darwin/strategies/arbitrage/arbitrage-strategy.js
import { BaseStrategy } from '../base-strategy.js';

/**
 * Cross-DEX arbitrage strategy — purely mathematical, no Brain invocation.
 * Finds price spreads across Solana DEXs (Jupiter, Raydium, Orca) and
 * executes atomic buy-low / sell-high swaps when spread > fees + slippage.
 */
export class ArbitrageStrategy extends BaseStrategy {
  constructor({ dexScanner, adapters, paper } = {}) {
    super('arbitrage', { paper, minCapital: 50 });
    this.dexScanner = dexScanner;
    this.adapters = adapters;
    this._tradesExecuted = 0;
    this._totalProfit = 0;
  }

  /**
   * Scan DEXs for price spreads on the same token pairs.
   * @returns {Promise<Array>}
   */
  async scan() {
    const spreads = await this.dexScanner.findSpreads();
    this.log.info({ count: spreads.length }, 'Scanned cross-DEX spreads');
    return spreads;
  }

  /**
   * Purely mathematical evaluation — no Brain call.
   * Checks if spread exceeds estimated fees + slippage.
   * @param {object} spread - Spread data from scan()
   * @returns {Promise<{shouldExecute: boolean, expectedProfitPct?: number, tokenPair?: string, buyDex?: string, sellDex?: string, buyPrice?: number, sellPrice?: number, chain?: string}>}
   */
  async evaluate(spread) {
    const totalCost = (spread.estimatedFees ?? 0) + (spread.estimatedSlippage ?? 0);
    const expectedProfitPct = spread.spread - totalCost;

    if (spread.spread <= totalCost) {
      this.log.info(
        { tokenPair: spread.tokenPair, spread: spread.spread, totalCost },
        'Spread does not exceed costs — skipping',
      );
      return { shouldExecute: false, expectedProfitPct };
    }

    return {
      shouldExecute: true,
      expectedProfitPct,
      tokenPair: spread.tokenPair,
      buyDex: spread.buyDex,
      sellDex: spread.sellDex,
      buyPrice: spread.buyPrice,
      sellPrice: spread.sellPrice,
      chain: spread.chain ?? 'solana',
    };
  }

  /**
   * Execute the atomic arbitrage swap — buy on cheaper DEX, sell on expensive DEX.
   * @param {object} evaluation - Approved evaluation from evaluate()
   * @returns {Promise<object>}
   */
  async execute(evaluation) {
    const chain = evaluation.chain ?? 'solana';
    const adapter = this.adapters[chain];

    if (!adapter) {
      throw new Error(`No adapter configured for chain: ${chain}`);
    }

    const result = await adapter.executeSafeSwap({
      tokenPair: evaluation.tokenPair,
      buyDex: evaluation.buyDex,
      sellDex: evaluation.sellDex,
      buyPrice: evaluation.buyPrice,
      sellPrice: evaluation.sellPrice,
    });

    this._tradesExecuted += 1;
    this._totalProfit += evaluation.expectedProfitPct;

    this.log.info(
      {
        tokenPair: evaluation.tokenPair,
        buyDex: evaluation.buyDex,
        sellDex: evaluation.sellDex,
        profitPct: evaluation.expectedProfitPct,
        txHash: result.txHash,
      },
      'Arbitrage trade executed',
    );

    return {
      ...evaluation,
      txHash: result.txHash,
      confirmed: result.confirmed,
      timestamp: Date.now(),
    };
  }

  /**
   * Report current arbitrage strategy state.
   * @returns {{tradesExecuted: number, totalProfit: number}}
   */
  report() {
    return {
      tradesExecuted: this._tradesExecuted,
      totalProfit: this._totalProfit,
    };
  }
}

// darwin/strategies/arbitrage/dex-scanner.js
import { createLogger } from '../../core/logger.js';

const log = createLogger('dex-scanner');

/**
 * Scans multiple DEXs on Solana for price discrepancies on the same token pairs.
 */
export class DexScanner {
  constructor({ dexClients = {} } = {}) {
    this.dexClients = dexClients;
    this.pairs = ['SOL/USDC', 'SOL/USDT', 'RAY/USDC', 'ORCA/USDC'];
  }

  /**
   * Query all configured DEXs and find spreads where the same pair
   * has different prices on different venues.
   * @returns {Promise<Array<{tokenPair: string, buyDex: string, sellDex: string, spread: number, buyPrice: number, sellPrice: number, chain: string, estimatedFees: number, estimatedSlippage: number}>>}
   */
  async findSpreads() {
    const prices = await this._fetchAllPrices();
    const spreads = [];

    for (const pair of this.pairs) {
      const pairPrices = prices.filter((p) => p.pair === pair);
      if (pairPrices.length < 2) continue;

      // Compare every combination of DEXs
      for (let i = 0; i < pairPrices.length; i++) {
        for (let j = 0; j < pairPrices.length; j++) {
          if (i === j) continue;

          const buy = pairPrices[i];
          const sell = pairPrices[j];

          if (sell.price > buy.price) {
            const spreadPct = ((sell.price - buy.price) / buy.price) * 100;

            spreads.push({
              tokenPair: pair,
              buyDex: buy.dex,
              sellDex: sell.dex,
              spread: Math.round(spreadPct * 1000) / 1000,
              buyPrice: buy.price,
              sellPrice: sell.price,
              chain: 'solana',
              estimatedFees: 0.2,
              estimatedSlippage: 0.1,
            });
          }
        }
      }
    }

    log.info({ count: spreads.length }, 'Price spreads found');
    return spreads;
  }

  /**
   * Fetch prices from all configured DEX clients.
   * @returns {Promise<Array<{pair: string, dex: string, price: number}>>}
   * @private
   */
  async _fetchAllPrices() {
    const results = [];

    for (const [dexName, client] of Object.entries(this.dexClients)) {
      try {
        const prices = await client.getPrices(this.pairs);
        for (const p of prices) {
          results.push({ pair: p.pair, dex: dexName, price: p.price });
        }
      } catch (err) {
        log.warn({ dex: dexName, error: err.message }, 'Failed to fetch DEX prices');
      }
    }

    return results;
  }
}

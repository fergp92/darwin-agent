// darwin/strategies/liquidation/health-monitor.js

/**
 * Aggregates health factor data across all chain adapters.
 * Returns a unified list of positions approaching or below liquidation threshold.
 */

const DEFAULT_THRESHOLD = 1.0;

/**
 * Query all adapters for health factors and return a unified list.
 * @param {Record<string, {getHealthFactors: () => Promise<Array>}>} adapters
 * @param {number} [threshold=1.0] - Health factor threshold to filter by
 * @returns {Promise<Array<{user: string, health: number, collateral: number, protocol: string, chain: string}>>}
 */
export async function aggregateHealthFactors(adapters, threshold = DEFAULT_THRESHOLD) {
  const results = [];

  const entries = Object.entries(adapters);
  const chainResults = await Promise.allSettled(
    entries.map(async ([chain, adapter]) => {
      const factors = await adapter.getHealthFactors();
      return factors.map((f) => ({ ...f, chain }));
    }),
  );

  for (const result of chainResults) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }

  return results.filter((pos) => pos.health < threshold);
}

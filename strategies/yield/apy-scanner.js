// darwin/strategies/yield/apy-scanner.js

/**
 * APY Scanner — queries lending protocol APIs for yield opportunities.
 * Returns normalized [{ protocol, chain, apy, tvl }] arrays.
 */

const MARGINFI_API = 'https://api.marginfi.com/v1/markets';
const KAMINO_API = 'https://api.kamino.finance/v2/strategies';
const AAVE_V3_API = 'https://aave-api-v2.aave.com/data/markets-data';

/**
 * Fetch with timeout and JSON parsing. Returns null on failure.
 */
async function safeFetch(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scan Solana lending protocols (MarginFi, Kamino).
 * @returns {Promise<Array<{protocol: string, chain: string, apy: number, tvl: number}>>}
 */
export async function scanSolana() {
  const results = [];

  // MarginFi
  const marginfi = await safeFetch(MARGINFI_API);
  if (marginfi?.data) {
    for (const market of marginfi.data) {
      if (market.lendingApy > 0) {
        results.push({
          protocol: 'marginfi',
          chain: 'solana',
          apy: Number(market.lendingApy) || 0,
          tvl: Number(market.totalDeposits) || 0,
        });
      }
    }
  }

  // Kamino
  const kamino = await safeFetch(KAMINO_API);
  if (Array.isArray(kamino)) {
    for (const strat of kamino) {
      if (strat.apy > 0) {
        results.push({
          protocol: 'kamino',
          chain: 'solana',
          apy: Number(strat.apy) || 0,
          tvl: Number(strat.tvl) || 0,
        });
      }
    }
  }

  return results;
}

/**
 * Scan EVM lending protocols (Aave V3) for a given chain.
 * @param {string} chain - e.g. 'base', 'ethereum', 'arbitrum'
 * @returns {Promise<Array<{protocol: string, chain: string, apy: number, tvl: number}>>}
 */
export async function scanEvm(chain = 'base') {
  const results = [];

  const aave = await safeFetch(`${AAVE_V3_API}?chainId=${chain}`);
  if (Array.isArray(aave?.reserves)) {
    for (const reserve of aave.reserves) {
      const apy = Number(reserve.liquidityRate) || 0;
      if (apy > 0) {
        results.push({
          protocol: 'aave',
          chain,
          apy,
          tvl: Number(reserve.totalLiquidity) || 0,
        });
      }
    }
  }

  return results;
}

/**
 * Scan all supported chains and return combined opportunities.
 * @param {string[]} chains - EVM chains to scan alongside Solana
 * @returns {Promise<Array<{protocol: string, chain: string, apy: number, tvl: number}>>}
 */
export async function scanAll(chains = ['base']) {
  const [solana, ...evmResults] = await Promise.all([
    scanSolana(),
    ...chains.map((c) => scanEvm(c)),
  ]);

  return [...solana, ...evmResults.flat()];
}

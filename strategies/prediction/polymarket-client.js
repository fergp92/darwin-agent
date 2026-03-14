// darwin/strategies/prediction/polymarket-client.js
import { createLogger } from '../../core/logger.js';

const log = createLogger('polymarket-client');

const CLOB_BASE = 'https://clob.polymarket.com';
const GAMMA_BASE = 'https://gamma-api.polymarket.com';

/**
 * Polymarket CLOB API wrapper.
 * Fetches prediction markets and places bets via the CLOB protocol.
 */
export class PolymarketClient {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey ?? process.env.POLYMARKET_API_KEY ?? null;
    this.minVolume = opts.minVolume ?? 10_000;
    this.minLiquidity = opts.minLiquidity ?? 5_000;
  }

  /**
   * Fetch active markets filtered by volume and liquidity.
   * @returns {Promise<Array<{id: string, title: string, probability: number, volume: number, liquidity: number, resolutionDate: string}>>}
   */
  async getActiveMarkets() {
    try {
      const url = `${GAMMA_BASE}/markets?closed=false&limit=50&order=volume&ascending=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!res.ok) {
        log.warn({ status: res.status }, 'Polymarket API returned non-OK status');
        return [];
      }

      const markets = await res.json();

      return markets
        .filter((m) => {
          const vol = Number(m.volume ?? m.volumeNum ?? 0);
          const liq = Number(m.liquidity ?? m.liquidityNum ?? 0);
          return vol >= this.minVolume && liq >= this.minLiquidity;
        })
        .map((m) => ({
          id: m.id ?? m.conditionId,
          title: m.question ?? m.title,
          probability: Number(m.outcomePrices?.[0] ?? m.bestBid ?? 0.5),
          volume: Number(m.volume ?? m.volumeNum ?? 0),
          liquidity: Number(m.liquidity ?? m.liquidityNum ?? 0),
          resolutionDate: m.endDate ?? m.resolutionDate ?? null,
        }));
    } catch (err) {
      log.error({ err: err.message }, 'Failed to fetch Polymarket markets');
      return [];
    }
  }

  /**
   * Place a bet on a market.
   * @param {string} marketId
   * @param {'yes'|'no'} position
   * @param {number} amount - Size in EUR/USDC
   * @returns {Promise<{orderId: string, txHash: string}>}
   */
  async placeBet(marketId, position, amount) {
    try {
      const url = `${CLOB_BASE}/order`;
      const body = {
        market: marketId,
        side: position === 'yes' ? 'BUY' : 'SELL',
        size: amount,
        type: 'LIMIT',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Polymarket order failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      return { orderId: data.orderId ?? data.id, txHash: data.txHash ?? null };
    } catch (err) {
      log.error({ err: err.message, marketId, position, amount }, 'Failed to place bet');
      throw err;
    }
  }

  /**
   * Get current open positions.
   * @returns {Promise<Array>}
   */
  async getPositions() {
    try {
      const url = `${CLOB_BASE}/positions`;
      const res = await fetch(url, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) return [];
      return res.json();
    } catch (err) {
      log.warn({ err: err.message }, 'Failed to fetch positions');
      return [];
    }
  }
}

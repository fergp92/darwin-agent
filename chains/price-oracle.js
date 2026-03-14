// darwin/chains/price-oracle.js
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createLogger } from '../core/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'config');
const config = JSON.parse(fs.readFileSync(path.join(configDir, 'default.json'), 'utf-8'));

const log = createLogger('price-oracle');

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,eur';

const FALLBACK_EUR_USD = 1.10;

export class PriceOracle {
  /** @type {number} */
  _eurUsdRate = 0;

  /** @type {number} */
  _eurUsdLastFetch = 0;

  /** @type {number} */
  #cacheDurationMs;

  constructor() {
    this.#cacheDurationMs = config.eurUsdRefreshMs ?? 300_000;
  }

  /**
   * Fetch EUR/USD rate from CoinGecko, deriving it from ETH prices.
   * Caches the result for `eurUsdRefreshMs` milliseconds.
   * @returns {Promise<number>} EUR/USD exchange rate
   */
  async getEurUsdRate() {
    const now = Date.now();
    if (this._eurUsdRate > 0 && now - this._eurUsdLastFetch < this.#cacheDurationMs) {
      return this._eurUsdRate;
    }

    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const data = await res.json();
      const usd = data.ethereum?.usd;
      const eur = data.ethereum?.eur;
      if (!usd || !eur) throw new Error('Missing ETH price data');

      this._eurUsdRate = usd / eur;
      this._eurUsdLastFetch = now;
      log.info({ rate: this._eurUsdRate }, 'EUR/USD rate updated');
    } catch (err) {
      log.warn({ err: err.message }, 'Failed to fetch EUR/USD rate, using fallback');
      if (this._eurUsdRate === 0) {
        this._eurUsdRate = FALLBACK_EUR_USD;
        this._eurUsdLastFetch = now;
      }
    }

    return this._eurUsdRate;
  }

  /**
   * Convert a USD amount to EUR.
   * @param {number} usdAmount
   * @returns {Promise<number>}
   */
  async usdToEur(usdAmount) {
    const rate = await this.getEurUsdRate();
    return usdAmount / rate;
  }

  /**
   * Convert a token amount to EUR using an adapter for the USD price.
   * @param {object} adapter - Chain adapter with getTokenPrice(token)
   * @param {string} token - Token symbol
   * @param {number} amount - Token quantity
   * @returns {Promise<number>}
   */
  async tokenToEur(adapter, token, amount) {
    const priceUsd = await adapter.getTokenPrice(token);
    const totalUsd = priceUsd * amount;
    return this.usdToEur(totalUsd);
  }
}

// darwin/strategies/airdrop/protocol-registry.js

/**
 * Registry of DeFi protocols to interact with for potential airdrop eligibility.
 * Tracks last interaction date per protocol to ensure daily activity.
 */

const PROTOCOLS = [
  // Solana
  { protocol: 'jupiter', chain: 'solana', interaction: 'swap', dailyGasBudget: 0.50 },
  { protocol: 'raydium', chain: 'solana', interaction: 'swap', dailyGasBudget: 0.50 },
  { protocol: 'marginfi', chain: 'solana', interaction: 'deposit', dailyGasBudget: 0.50 },
  // Base
  { protocol: 'uniswap', chain: 'base', interaction: 'swap', dailyGasBudget: 0.50 },
  { protocol: 'aave', chain: 'base', interaction: 'deposit', dailyGasBudget: 0.50 },
];

export class ProtocolRegistry {
  constructor() {
    /** @type {Map<string, string>} protocol key -> ISO date string of last interaction */
    this._lastInteraction = new Map();
  }

  /** @returns {string} unique key for a protocol entry */
  _key(entry) {
    return `${entry.chain}:${entry.protocol}`;
  }

  /**
   * Returns protocols that have not been interacted with today.
   * @returns {Array<{protocol: string, chain: string, interaction: string, dailyGasBudget: number, lastInteraction: string|null}>}
   */
  getProtocolsDue() {
    const today = new Date().toISOString().slice(0, 10);
    return PROTOCOLS
      .map((p) => ({
        ...p,
        lastInteraction: this._lastInteraction.get(this._key(p)) ?? null,
      }))
      .filter((p) => p.lastInteraction !== today);
  }

  /**
   * Record that a protocol was interacted with today.
   * @param {{protocol: string, chain: string}} entry
   */
  recordInteraction(entry) {
    const today = new Date().toISOString().slice(0, 10);
    this._lastInteraction.set(this._key(entry), today);
  }

  /** @returns {Array} full protocol list with status */
  getAll() {
    return PROTOCOLS.map((p) => ({
      ...p,
      lastInteraction: this._lastInteraction.get(this._key(p)) ?? null,
    }));
  }
}

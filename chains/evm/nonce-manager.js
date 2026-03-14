// darwin/chains/evm/nonce-manager.js
import { createLogger } from '../../core/logger.js';

const log = createLogger('nonce-manager');

export class NonceManager {
  #nonces;
  #pending;

  constructor() {
    this.#nonces = new Map();
    this.#pending = new Map();
  }

  /**
   * Set the nonce for a chain (e.g. after fetching from RPC).
   * @param {string} chain
   * @param {number} nonce
   */
  setNonce(chain, nonce) {
    this.#nonces.set(chain, nonce);
    log.debug({ chain, nonce }, 'Nonce set');
  }

  /**
   * Get current nonce for a chain (defaults to 0).
   * @param {string} chain
   * @returns {number}
   */
  getNonce(chain) {
    return this.#nonces.get(chain) ?? 0;
  }

  /**
   * Consume the current nonce and increment.
   * @param {string} chain
   * @returns {number} The nonce to use for this transaction
   */
  useNonce(chain) {
    const current = this.getNonce(chain);
    this.#nonces.set(chain, current + 1);
    log.debug({ chain, used: current, next: current + 1 }, 'Nonce consumed');
    return current;
  }

  /**
   * Mark a nonce as pending (transaction submitted but unconfirmed).
   * @param {string} chain
   * @param {number} nonce
   * @param {string} txHash
   */
  markPending(chain, nonce, txHash) {
    if (!this.#pending.has(chain)) {
      this.#pending.set(chain, new Map());
    }
    this.#pending.get(chain).set(nonce, { txHash, timestamp: Date.now() });
    log.debug({ chain, nonce, txHash }, 'Transaction marked pending');
  }

  /**
   * Confirm a transaction — removes it from pending.
   * @param {string} chain
   * @param {number} nonce
   */
  confirmTx(chain, nonce) {
    const chainPending = this.#pending.get(chain);
    if (chainPending) {
      chainPending.delete(nonce);
      if (chainPending.size === 0) {
        this.#pending.delete(chain);
      }
    }
    log.debug({ chain, nonce }, 'Transaction confirmed');
  }

  /**
   * Check if a chain has any pending transactions.
   * @param {string} chain
   * @returns {boolean}
   */
  hasPending(chain) {
    const chainPending = this.#pending.get(chain);
    return chainPending != null && chainPending.size > 0;
  }

  /**
   * Get stuck transactions (pending longer than timeoutMs).
   * @param {string} chain
   * @param {number} timeoutMs
   * @returns {Array<{nonce: number, txHash: string, timestamp: number, age: number}>}
   */
  getStuck(chain, timeoutMs = 120_000) {
    const chainPending = this.#pending.get(chain);
    if (!chainPending) return [];

    const now = Date.now();
    const stuck = [];

    for (const [nonce, entry] of chainPending) {
      const age = now - entry.timestamp;
      if (age >= timeoutMs) {
        stuck.push({ nonce, txHash: entry.txHash, timestamp: entry.timestamp, age });
      }
    }

    return stuck;
  }
}

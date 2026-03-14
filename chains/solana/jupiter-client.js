// darwin/chains/solana/jupiter-client.js
import { createLogger } from '../../core/logger.js';

const log = createLogger('jupiter-client');

const JUPITER_API = 'https://quote-api.jup.ag/v6';

export class JupiterClient {
  constructor(apiBase = JUPITER_API) {
    this.apiBase = apiBase;
  }

  /**
   * Get a swap quote from Jupiter.
   * @param {string} inputMint  - SPL token mint address (or native SOL mint)
   * @param {string} outputMint - SPL token mint address
   * @param {number} amount     - Amount in smallest unit (lamports / token base units)
   * @param {number} [slippageBps=100] - Slippage tolerance in basis points
   * @returns {Promise<object>} Quote response
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = 100) {
    const url = `${this.apiBase}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    log.info({ inputMint, outputMint, amount, slippageBps }, 'Fetching Jupiter quote');

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
    }
    return res.json();
  }

  /**
   * Build a swap transaction from a quote.
   * @param {object} quote          - Quote object from getQuote()
   * @param {string} userPublicKey  - Wallet public key (base58)
   * @returns {Promise<object>} Swap transaction response ({ swapTransaction })
   */
  async getSwapTransaction(quote, userPublicKey) {
    log.info({ userPublicKey }, 'Building Jupiter swap transaction');

    const res = await fetch(`${this.apiBase}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jupiter swap failed (${res.status}): ${body}`);
    }
    return res.json();
  }
}

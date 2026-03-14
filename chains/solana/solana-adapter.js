// darwin/chains/solana/solana-adapter.js
import { ChainAdapter } from '../chain-adapter.js';
import { JupiterClient } from './jupiter-client.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('solana-adapter');

const LAMPORTS_PER_SOL = 1_000_000_000;

export class SolanaAdapter extends ChainAdapter {
  /**
   * @param {string} chainName - e.g. 'solana'
   * @param {object} config
   * @param {string} config.rpcUrl      - Primary RPC endpoint
   * @param {string} [config.fallbackUrl] - Fallback RPC endpoint
   * @param {string} [config.jitoRpc]   - Jito block-engine endpoint for MEV bundles
   */
  constructor(chainName, config = {}) {
    super(chainName);
    this.config = config;
    this.rpcUrl = config.rpcUrl;
    this.fallbackUrl = config.fallbackUrl;
    this.jitoRpc = config.jitoRpc;

    this.jupiter = new JupiterClient();
    this._connection = null; // Set externally or lazily via @solana/web3.js Connection
  }

  /**
   * Get SOL balance (native) and SPL token balances.
   * @param {string} publicKey - Wallet public key (base58)
   * @returns {Promise<{ native: number, tokens: Array }>}
   */
  async getBalance(publicKey) {
    const conn = this._connection;
    if (!conn) throw new Error('Solana connection not initialized');

    const lamports = await conn.getBalance(publicKey);
    const tokenAccounts = await conn.getTokenAccountsByOwner(publicKey, {
      programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    });

    const tokens = tokenAccounts.value.map((ta) => ({
      pubkey: ta.pubkey,
      account: ta.account,
    }));

    return {
      native: lamports / LAMPORTS_PER_SOL,
      tokens,
    };
  }

  /** @override */
  async getTokenPrice(token) {
    // Delegate to Jupiter price API or external oracle
    log.warn({ token }, 'getTokenPrice not yet wired to price oracle');
    throw new Error('Not implemented — use PriceOracle');
  }

  /**
   * Execute a swap via Jupiter, optionally using Jito MEV bundles.
   * @param {string} from   - Input token mint
   * @param {string} to     - Output token mint
   * @param {number} amount - Amount in base units
   * @param {object} opts   - { slippageBps, useMevProtection, wallet }
   * @returns {Promise<{ txHash: string, amountIn: number, amountOut: number }>}
   */
  async swap(from, to, amount, opts = {}) {
    const quote = await this.jupiter.getQuote(from, to, amount, opts.slippageBps);
    const { swapTransaction } = await this.jupiter.getSwapTransaction(
      quote,
      opts.wallet || this.config.walletPublicKey,
    );

    log.info({ from, to, amount, mev: !!opts.useMevProtection }, 'Executing Solana swap');

    // In production: deserialize, sign, and send via Jito or standard RPC
    const endpoint = opts.useMevProtection && this.jitoRpc
      ? this.jitoRpc
      : this.rpcUrl;

    // Placeholder — real implementation would use Connection.sendRawTransaction
    return {
      txHash: swapTransaction,
      amountIn: amount,
      amountOut: Number(quote.outAmount || 0),
      endpoint,
    };
  }

  /**
   * Get a quote from Jupiter.
   */
  async getQuote(from, to, amount) {
    const quote = await this.jupiter.getQuote(from, to, amount);
    return {
      amountIn: amount,
      amountOut: Number(quote.outAmount || 0),
      priceImpactPct: Number(quote.priceImpactPct || 0),
      route: quote,
    };
  }

  /**
   * Simulate a swap transaction on-chain.
   */
  async simulateSwap(from, to, amount) {
    const conn = this._connection;
    if (!conn) throw new Error('Solana connection not initialized');

    try {
      const quote = await this.jupiter.getQuote(from, to, amount);
      const { swapTransaction } = await this.jupiter.getSwapTransaction(
        quote,
        this.config.walletPublicKey,
      );

      const result = await conn.simulateTransaction(swapTransaction);

      return {
        wouldSucceed: !result.value?.err,
        expectedOut: Number(quote.outAmount || 0),
        error: result.value?.err ? JSON.stringify(result.value.err) : null,
        logs: result.value?.logs || [],
      };
    } catch (err) {
      return { wouldSucceed: false, expectedOut: 0, error: err.message };
    }
  }

  /**
   * Wait for transaction confirmation.
   * @param {string} txHash - Transaction signature
   * @returns {Promise<{ status: string, finality: string, blockTime: number|null }>}
   */
  async waitForConfirmation(txHash) {
    const conn = this._connection;
    if (!conn) throw new Error('Solana connection not initialized');

    const result = await conn.confirmTransaction(txHash, 'confirmed');

    return {
      status: result.value?.err ? 'failed' : 'confirmed',
      finality: 'confirmed',
      blockTime: Date.now(),
    };
  }

  /**
   * Estimate priority fee (compute units price).
   */
  async estimateGas(tx) {
    const conn = this._connection;
    if (!conn) throw new Error('Solana connection not initialized');

    try {
      const fees = await conn.getRecentPrioritizationFees?.();
      const avg = fees && fees.length
        ? fees.reduce((s, f) => s + f.prioritizationFee, 0) / fees.length
        : 5000; // default micro-lamports
      return { priorityFee: avg, computeUnits: 200_000 };
    } catch {
      return { priorityFee: 5000, computeUnits: 200_000 };
    }
  }

  /** @override */
  async deposit(protocol, amount) {
    log.info({ protocol, amount }, 'Deposit not yet implemented for Solana');
    throw new Error('Not implemented');
  }

  /** @override */
  async withdraw(protocol, amount) {
    log.info({ protocol, amount }, 'Withdraw not yet implemented for Solana');
    throw new Error('Not implemented');
  }

  /** @override */
  async getHealthFactors() {
    log.info('getHealthFactors not yet implemented for Solana');
    throw new Error('Not implemented');
  }

  /** @override */
  async liquidate(user, protocol) {
    log.info({ user, protocol }, 'Liquidate not yet implemented for Solana');
    throw new Error('Not implemented');
  }

  /**
   * Solana-specific: interact with an airdrop contract/program.
   * Used by airdrop farming strategy.
   * @param {object} params - { programId, instruction, wallet }
   * @returns {Promise<{ txHash: string }>}
   */
  async sendAirdropInteraction(params = {}) {
    log.info({ programId: params.programId }, 'Sending airdrop interaction');
    // Placeholder — real implementation builds and sends a program instruction
    return { txHash: null, status: 'not-implemented' };
  }
}

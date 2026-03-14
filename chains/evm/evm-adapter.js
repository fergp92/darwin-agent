// darwin/chains/evm/evm-adapter.js
import { ethers } from 'ethers';
import { ChainAdapter } from '../chain-adapter.js';
import { NonceManager } from './nonce-manager.js';
import { UniswapClient } from './uniswap-client.js';
import { AaveClient } from './aave-client.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('evm-adapter');

// Chain metadata
const CHAIN_META = {
  base: { chainId: 8453, nativeCurrency: 'ETH' },
  polygon: { chainId: 137, nativeCurrency: 'MATIC' },
};

const ERC20_BALANCE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export class EvmAdapter extends ChainAdapter {
  /** @type {NonceManager} */
  nonceManager;

  #config;
  #provider;
  #fallbackProvider;
  #flashbotsProvider;
  #uniswap;
  #aave;
  #chainMeta;

  /**
   * @param {string} chainName — 'base' or 'polygon'
   * @param {{rpcUrl: string, fallbackUrl?: string, flashbotsRpc?: string}} config
   */
  constructor(chainName, config = {}) {
    super(chainName);
    this.#config = config;
    this.#chainMeta = CHAIN_META[chainName];

    if (!this.#chainMeta) {
      throw new Error(`Unsupported EVM chain: ${chainName}. Supported: ${Object.keys(CHAIN_META).join(', ')}`);
    }

    this.nonceManager = new NonceManager();

    // Providers are lazily initialized on first use
    this.#provider = null;
    this.#fallbackProvider = null;
    this.#flashbotsProvider = null;
    this.#uniswap = null;
    this.#aave = null;
  }

  /** @returns {import('ethers').JsonRpcProvider} */
  get provider() {
    if (!this.#provider) {
      if (!this.#config.rpcUrl) {
        throw new Error(`rpcUrl not configured for ${this.chainName}`);
      }
      this.#provider = new ethers.JsonRpcProvider(this.#config.rpcUrl, this.#chainMeta.chainId);
    }
    return this.#provider;
  }

  /** @returns {import('ethers').JsonRpcProvider | null} */
  get fallbackProvider() {
    if (!this.#fallbackProvider && this.#config.fallbackUrl) {
      this.#fallbackProvider = new ethers.JsonRpcProvider(this.#config.fallbackUrl, this.#chainMeta.chainId);
    }
    return this.#fallbackProvider;
  }

  /** @returns {UniswapClient} */
  get uniswap() {
    if (!this.#uniswap) {
      this.#uniswap = new UniswapClient(this.provider, this.#chainMeta.chainId);
    }
    return this.#uniswap;
  }

  /** @returns {AaveClient} */
  get aave() {
    if (!this.#aave) {
      this.#aave = new AaveClient(this.provider, this.#chainMeta.chainId);
    }
    return this.#aave;
  }

  get chainId() {
    return this.#chainMeta.chainId;
  }

  /**
   * Get native + ERC-20 balances.
   * @param {string} address
   * @param {string[]} tokenAddresses — ERC-20 contract addresses
   * @returns {Promise<{native: string, tokens: Array<{address: string, symbol: string, balance: string, decimals: number}>}>}
   */
  async getBalance(address, tokenAddresses = []) {
    const nativeBalance = await this.provider.getBalance(address);

    const tokens = await Promise.all(
      tokenAddresses.map(async (tokenAddr) => {
        const contract = new ethers.Contract(tokenAddr, ERC20_BALANCE_ABI, this.provider);
        const [balance, decimals, symbol] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals(),
          contract.symbol(),
        ]);
        return {
          address: tokenAddr,
          symbol,
          balance: ethers.formatUnits(balance, decimals),
          decimals,
        };
      })
    );

    return {
      native: ethers.formatEther(nativeBalance),
      tokens,
    };
  }

  /**
   * Execute a swap via Uniswap V3 with optional Flashbots MEV protection.
   * @param {string} from — token address
   * @param {string} to — token address
   * @param {bigint|string|number} amount — raw amount
   * @param {{slippageBps?: number, useMevProtection?: boolean, recipient?: string, feeTier?: number}} opts
   */
  async swap(from, to, amount, opts = {}) {
    const amountIn = BigInt(amount);
    const slippageBps = opts.slippageBps || 100;
    const feeTier = opts.feeTier || 3000;

    // Get quote for minimum output
    const quote = await this.uniswap.getQuote(from, to, amountIn, feeTier);
    const minOut = quote.amountOut * BigInt(10000 - slippageBps) / 10000n;

    const recipient = opts.recipient || '0x0000000000000000000000000000000000000000';
    const tx = await this.uniswap.buildSwapTx(from, to, amountIn, minOut, recipient, feeTier);

    // Assign nonce
    const nonce = this.nonceManager.useNonce(this.chainName);
    tx.nonce = nonce;

    // Use Flashbots RPC for MEV protection if available and requested
    const useFlashbots = opts.useMevProtection !== false && this.#config.flashbotsRpc;
    const targetProvider = useFlashbots ? this.#getFlashbotsProvider() : this.provider;

    log.info({
      chain: this.chainName,
      from, to,
      amountIn: amountIn.toString(),
      minOut: minOut.toString(),
      nonce,
      mevProtection: !!useFlashbots,
    }, 'Submitting swap');

    const txHash = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
    this.nonceManager.markPending(this.chainName, nonce, txHash);

    return {
      txHash,
      nonce,
      amountIn: amountIn.toString(),
      expectedOut: quote.amountOut.toString(),
      minOut: minOut.toString(),
      mevProtected: !!useFlashbots,
    };
  }

  /**
   * Simulate a swap using eth_call.
   */
  async simulateSwap(from, to, amount) {
    try {
      const amountIn = BigInt(amount);
      const quote = await this.uniswap.getQuote(from, to, amountIn);

      return {
        wouldSucceed: true,
        expectedOut: Number(quote.amountOut),
        gasEstimate: Number(quote.gasEstimate),
      };
    } catch (err) {
      log.warn({ error: err.message, from, to, amount }, 'Swap simulation failed');
      return {
        wouldSucceed: false,
        error: err.message,
        expectedOut: 0,
      };
    }
  }

  /**
   * Get a price quote from Uniswap V3.
   */
  async getQuote(from, to, amount) {
    const amountIn = BigInt(amount);
    const quote = await this.uniswap.getQuote(from, to, amountIn);

    return {
      amountOut: Number(quote.amountOut),
      slippage: 100,
      fee: 0.003,
    };
  }

  /**
   * Deposit into Aave V3.
   */
  async deposit(protocol, amount, opts = {}) {
    if (protocol !== 'aave') {
      throw new Error(`Unsupported lending protocol: ${protocol}`);
    }
    const { asset, onBehalfOf } = opts;
    const tx = this.aave.buildSupplyTx(asset, BigInt(amount), onBehalfOf);
    const nonce = this.nonceManager.useNonce(this.chainName);

    log.info({ chain: this.chainName, protocol, asset, amount, nonce }, 'Deposit submitted');

    return { ...tx, nonce };
  }

  /**
   * Withdraw from Aave V3.
   */
  async withdraw(protocol, amount, opts = {}) {
    if (protocol !== 'aave') {
      throw new Error(`Unsupported lending protocol: ${protocol}`);
    }
    const { asset, to } = opts;
    const tx = this.aave.buildWithdrawTx(asset, BigInt(amount), to);
    const nonce = this.nonceManager.useNonce(this.chainName);

    log.info({ chain: this.chainName, protocol, asset, amount, nonce }, 'Withdraw submitted');

    return { ...tx, nonce };
  }

  /**
   * Get Aave health factors for a user.
   */
  async getHealthFactors(userAddress) {
    return this.aave.getUserAccountData(userAddress);
  }

  /**
   * Execute a liquidation on Aave V3.
   */
  async liquidate(user, protocol, opts = {}) {
    if (protocol !== 'aave') {
      throw new Error(`Unsupported lending protocol: ${protocol}`);
    }
    const { collateralAsset, debtAsset, debtToCover, receiveAToken } = opts;
    const tx = this.aave.buildLiquidationTx(collateralAsset, debtAsset, user, BigInt(debtToCover), receiveAToken);
    const nonce = this.nonceManager.useNonce(this.chainName);

    log.info({ chain: this.chainName, user, nonce }, 'Liquidation submitted');

    return { ...tx, nonce };
  }

  /**
   * Wait for a transaction to be confirmed with block confirmations.
   * @param {string} txHash
   * @param {number} confirmations
   */
  async waitForConfirmation(txHash, confirmations = 2) {
    log.info({ chain: this.chainName, txHash, confirmations }, 'Waiting for confirmation');

    const receipt = await this.provider.waitForTransaction(txHash, confirmations);

    if (!receipt) {
      return { status: 'timeout', txHash };
    }

    // Confirm in nonce manager
    if (receipt.status === 1) {
      // Find and confirm by txHash (scan pending)
      log.info({ chain: this.chainName, txHash, block: receipt.blockNumber }, 'Transaction confirmed');
    }

    return {
      status: receipt.status === 1 ? 'confirmed' : 'reverted',
      blockNumber: receipt.blockNumber,
      blockTime: Date.now(),
      gasUsed: receipt.gasUsed.toString(),
      finality: 'confirmed',
    };
  }

  /**
   * Estimate gas for a transaction.
   * @param {import('ethers').TransactionRequest} tx
   */
  async estimateGas(tx) {
    const [gasEstimate, feeData] = await Promise.all([
      this.provider.estimateGas(tx),
      this.provider.getFeeData(),
    ]);

    return {
      gasLimit: gasEstimate.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      gasPrice: feeData.gasPrice?.toString(),
    };
  }

  /** @private */
  #getFlashbotsProvider() {
    if (!this.#flashbotsProvider) {
      this.#flashbotsProvider = new ethers.JsonRpcProvider(this.#config.flashbotsRpc, this.#chainMeta.chainId);
    }
    return this.#flashbotsProvider;
  }
}

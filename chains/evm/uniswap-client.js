// darwin/chains/evm/uniswap-client.js
import { ethers } from 'ethers';
import { createLogger } from '../../core/logger.js';

const log = createLogger('uniswap-client');

// Uniswap V3 contract addresses (same on Base & Polygon)
const UNISWAP_ADDRESSES = {
  quoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  swapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
};

const QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
];

export class UniswapClient {
  #provider;
  #chainId;

  /**
   * @param {import('ethers').Provider} provider
   * @param {number} chainId
   */
  constructor(provider, chainId) {
    this.#provider = provider;
    this.#chainId = chainId;
  }

  /**
   * Get a quote for an exact-input single-hop swap.
   * @param {string} tokenIn — ERC-20 address
   * @param {string} tokenOut — ERC-20 address
   * @param {bigint} amountIn — raw amount (wei/smallest unit)
   * @param {number} feeTier — 500 (0.05%), 3000 (0.3%), 10000 (1%)
   * @returns {Promise<{amountOut: bigint, gasEstimate: bigint}>}
   */
  async getQuote(tokenIn, tokenOut, amountIn, feeTier = 3000) {
    const quoter = new ethers.Contract(UNISWAP_ADDRESSES.quoterV2, QUOTER_V2_ABI, this.#provider);

    const params = {
      tokenIn,
      tokenOut,
      amountIn,
      fee: feeTier,
      sqrtPriceLimitX96: 0n,
    };

    const result = await quoter.quoteExactInputSingle.staticCall(params);
    log.debug({ tokenIn, tokenOut, amountIn: amountIn.toString(), amountOut: result.amountOut.toString() }, 'Quote received');

    return {
      amountOut: result.amountOut,
      gasEstimate: result.gasEstimate,
    };
  }

  /**
   * Build an exactInputSingle swap transaction (unsigned).
   * @param {string} tokenIn
   * @param {string} tokenOut
   * @param {bigint} amountIn
   * @param {bigint} amountOutMinimum
   * @param {string} recipient
   * @param {number} feeTier
   * @returns {Promise<import('ethers').TransactionRequest>}
   */
  async buildSwapTx(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, feeTier = 3000) {
    const router = new ethers.Contract(UNISWAP_ADDRESSES.swapRouter02, SWAP_ROUTER_ABI, this.#provider);

    const params = {
      tokenIn,
      tokenOut,
      fee: feeTier,
      recipient,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    };

    const data = router.interface.encodeFunctionData('exactInputSingle', [params]);

    return {
      to: UNISWAP_ADDRESSES.swapRouter02,
      data,
      value: 0n,
    };
  }
}

// darwin/chains/evm/aave-client.js
import { ethers } from 'ethers';
import { createLogger } from '../../core/logger.js';

const log = createLogger('aave-client');

// Aave V3 Pool addresses per chain
const AAVE_POOL_ADDRESSES = {
  8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',   // Base
  137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',     // Polygon
};

const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken) external',
];

export class AaveClient {
  #provider;
  #chainId;
  #poolAddress;

  /**
   * @param {import('ethers').Provider} provider
   * @param {number} chainId
   */
  constructor(provider, chainId) {
    this.#provider = provider;
    this.#chainId = chainId;
    this.#poolAddress = AAVE_POOL_ADDRESSES[chainId];
    if (!this.#poolAddress) {
      throw new Error(`Aave V3 Pool not configured for chainId ${chainId}`);
    }
  }

  /**
   * Get user health factors and account data.
   * @param {string} userAddress
   * @returns {Promise<{totalCollateral: bigint, totalDebt: bigint, availableBorrows: bigint, liquidationThreshold: bigint, ltv: bigint, healthFactor: bigint}>}
   */
  async getUserAccountData(userAddress) {
    const pool = new ethers.Contract(this.#poolAddress, POOL_ABI, this.#provider);
    const data = await pool.getUserAccountData(userAddress);

    const result = {
      totalCollateral: data.totalCollateralBase,
      totalDebt: data.totalDebtBase,
      availableBorrows: data.availableBorrowsBase,
      liquidationThreshold: data.currentLiquidationThreshold,
      ltv: data.ltv,
      healthFactor: data.healthFactor,
    };

    log.debug({ userAddress, healthFactor: result.healthFactor.toString() }, 'Account data fetched');
    return result;
  }

  /**
   * Build a supply (deposit) transaction.
   * @param {string} asset — ERC-20 address
   * @param {bigint} amount
   * @param {string} onBehalfOf
   * @returns {import('ethers').TransactionRequest}
   */
  buildSupplyTx(asset, amount, onBehalfOf) {
    const pool = new ethers.Contract(this.#poolAddress, POOL_ABI, this.#provider);
    const data = pool.interface.encodeFunctionData('supply', [asset, amount, onBehalfOf, 0]);

    return { to: this.#poolAddress, data, value: 0n };
  }

  /**
   * Build a withdraw transaction.
   * @param {string} asset
   * @param {bigint} amount
   * @param {string} to
   * @returns {import('ethers').TransactionRequest}
   */
  buildWithdrawTx(asset, amount, to) {
    const pool = new ethers.Contract(this.#poolAddress, POOL_ABI, this.#provider);
    const data = pool.interface.encodeFunctionData('withdraw', [asset, amount, to]);

    return { to: this.#poolAddress, data, value: 0n };
  }

  /**
   * Build a liquidation call transaction.
   * @param {string} collateralAsset
   * @param {string} debtAsset
   * @param {string} user
   * @param {bigint} debtToCover
   * @param {boolean} receiveAToken
   * @returns {import('ethers').TransactionRequest}
   */
  buildLiquidationTx(collateralAsset, debtAsset, user, debtToCover, receiveAToken = false) {
    const pool = new ethers.Contract(this.#poolAddress, POOL_ABI, this.#provider);
    const data = pool.interface.encodeFunctionData('liquidationCall', [
      collateralAsset, debtAsset, user, debtToCover, receiveAToken,
    ]);

    return { to: this.#poolAddress, data, value: 0n };
  }
}

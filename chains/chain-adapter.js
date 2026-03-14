// darwin/chains/chain-adapter.js
import { createLogger } from '../core/logger.js';

const log = createLogger('chain-adapter');

export class ChainAdapter {
  constructor(chainName) {
    if (new.target === ChainAdapter) {
      throw new Error('Cannot instantiate abstract ChainAdapter directly');
    }
    this.chainName = chainName;
  }

  async getBalance() { throw new Error('Not implemented'); }
  async getTokenPrice(token) { throw new Error('Not implemented'); }
  async swap(from, to, amount, opts) { throw new Error('Not implemented'); }
  async getQuote(from, to, amount) { throw new Error('Not implemented'); }
  async simulateSwap(from, to, amount) { throw new Error('Not implemented'); }
  async deposit(protocol, amount) { throw new Error('Not implemented'); }
  async withdraw(protocol, amount) { throw new Error('Not implemented'); }
  async getHealthFactors() { throw new Error('Not implemented'); }
  async liquidate(user, protocol) { throw new Error('Not implemented'); }
  async waitForConfirmation(txHash) { throw new Error('Not implemented'); }
  async estimateGas(tx) { throw new Error('Not implemented'); }

  async executeSafeSwap(from, to, amount, opts = {}) {
    const chain = this.chainName;

    log.info({ chain, from, to, amount }, 'Simulating swap');
    const simulation = await this.simulateSwap(from, to, amount);

    if (!simulation.wouldSucceed) {
      throw new Error(`Simulation failed on ${chain}: ${simulation.error || 'unknown'}`);
    }

    const quote = await this.getQuote(from, to, amount);
    const slippageBps = opts.slippageBps || 100;
    const minAcceptable = quote.amountOut * (1 - slippageBps / 10000);

    if (simulation.expectedOut < minAcceptable) {
      throw new Error(
        `Simulation output ${simulation.expectedOut} below acceptable ${minAcceptable} (${slippageBps}bps slippage)`
      );
    }

    log.info({ chain, from, to, amount, slippageBps }, 'Executing swap');
    const result = await this.swap(from, to, amount, {
      slippageBps,
      useMevProtection: opts.useMevProtection !== false,
    });

    const confirmation = await this.waitForConfirmation(result.txHash);

    return {
      ...result,
      confirmed: confirmation.status === 'confirmed',
      finality: confirmation.finality,
      blockTime: confirmation.blockTime,
    };
  }
}

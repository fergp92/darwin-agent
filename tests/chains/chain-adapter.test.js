// darwin/tests/chains/chain-adapter.test.js
import { describe, it, expect } from 'vitest';
import { ChainAdapter } from '../../chains/chain-adapter.js';

describe('ChainAdapter (abstract)', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new ChainAdapter('test')).toThrow('Cannot instantiate abstract');
  });

  it('defines required interface methods', () => {
    class TestAdapter extends ChainAdapter {
      constructor() { super('test'); }
      async getBalance() { return { native: 0, tokens: [] }; }
      async getTokenPrice() { return 0; }
      async swap() { return {}; }
      async getQuote() { return {}; }
      async simulateSwap() { return {}; }
      async deposit() { return {}; }
      async withdraw() { return {}; }
      async getHealthFactors() { return []; }
      async liquidate() { return {}; }
      async waitForConfirmation() { return {}; }
      async estimateGas() { return 0; }
    }

    const adapter = new TestAdapter();
    expect(adapter.chainName).toBe('test');
    expect(typeof adapter.getBalance).toBe('function');
    expect(typeof adapter.swap).toBe('function');
    expect(typeof adapter.simulateSwap).toBe('function');
    expect(typeof adapter.getQuote).toBe('function');
    expect(typeof adapter.estimateGas).toBe('function');
  });

  it('executeSafeSwap runs simulate-then-execute pipeline', async () => {
    class MockAdapter extends ChainAdapter {
      constructor() { super('mock'); }
      async getBalance() { return { native: 100, tokens: [] }; }
      async getTokenPrice() { return 1; }
      async getQuote(from, to, amount) {
        return { amountOut: amount * 0.99, slippage: 100, fee: 0.01 };
      }
      async simulateSwap(from, to, amount) {
        return { expectedOut: amount * 0.99, wouldSucceed: true };
      }
      async swap(from, to, amount, opts) {
        return { txHash: '0xabc', amountOut: amount * 0.99, fee: 0.01 };
      }
      async deposit() { return {}; }
      async withdraw() { return {}; }
      async getHealthFactors() { return []; }
      async liquidate() { return {}; }
      async waitForConfirmation(txHash) {
        return { status: 'confirmed', blockTime: Date.now(), finality: 'confirmed' };
      }
      async estimateGas() { return 0.01; }
    }

    const adapter = new MockAdapter();
    const result = await adapter.executeSafeSwap('SOL', 'USDC', 10, { slippageBps: 100 });
    expect(result.txHash).toBe('0xabc');
    expect(result.confirmed).toBe(true);
  });

  it('executeSafeSwap aborts if simulation fails', async () => {
    class FailAdapter extends ChainAdapter {
      constructor() { super('fail'); }
      async getBalance() { return { native: 0, tokens: [] }; }
      async getTokenPrice() { return 0; }
      async getQuote() { return { amountOut: 10, slippage: 100, fee: 0.01 }; }
      async simulateSwap() { return { wouldSucceed: false, error: 'insufficient liquidity' }; }
      async swap() { throw new Error('should not be called'); }
      async deposit() { return {}; }
      async withdraw() { return {}; }
      async getHealthFactors() { return []; }
      async liquidate() { return {}; }
      async waitForConfirmation() { return {}; }
      async estimateGas() { return 0; }
    }

    const adapter = new FailAdapter();
    await expect(
      adapter.executeSafeSwap('SOL', 'USDC', 10, { slippageBps: 100 })
    ).rejects.toThrow('Simulation failed');
  });
});

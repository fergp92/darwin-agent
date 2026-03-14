// darwin/tests/chains/evm-adapter.test.js
import { describe, it, expect } from 'vitest';
import { NonceManager } from '../../chains/evm/nonce-manager.js';
import { EvmAdapter } from '../../chains/evm/evm-adapter.js';
import { ChainAdapter } from '../../chains/chain-adapter.js';

describe('NonceManager', () => {
  it('tracks nonce per chain', () => {
    const nm = new NonceManager();
    expect(nm.getNonce('base')).toBe(0);
    expect(nm.getNonce('polygon')).toBe(0);

    nm.setNonce('base', 42);
    nm.setNonce('polygon', 7);

    expect(nm.getNonce('base')).toBe(42);
    expect(nm.getNonce('polygon')).toBe(7);
  });

  it('increments nonce after use', () => {
    const nm = new NonceManager();
    nm.setNonce('base', 10);

    const first = nm.useNonce('base');
    expect(first).toBe(10);
    expect(nm.getNonce('base')).toBe(11);

    const second = nm.useNonce('base');
    expect(second).toBe(11);
    expect(nm.getNonce('base')).toBe(12);
  });

  it('queues transactions per chain (markPending/hasPending)', () => {
    const nm = new NonceManager();

    expect(nm.hasPending('base')).toBe(false);

    nm.markPending('base', 0, '0xabc');
    nm.markPending('base', 1, '0xdef');

    expect(nm.hasPending('base')).toBe(true);
    expect(nm.hasPending('polygon')).toBe(false);
  });

  it('clears pending on confirmation', () => {
    const nm = new NonceManager();

    nm.markPending('base', 0, '0xabc');
    nm.markPending('base', 1, '0xdef');
    expect(nm.hasPending('base')).toBe(true);

    nm.confirmTx('base', 0);
    expect(nm.hasPending('base')).toBe(true); // still has nonce 1

    nm.confirmTx('base', 1);
    expect(nm.hasPending('base')).toBe(false);
  });
});

describe('EvmAdapter', () => {
  it('extends ChainAdapter (chainName === "base")', () => {
    const adapter = new EvmAdapter('base', { rpcUrl: 'https://example.com' });
    expect(adapter).toBeInstanceOf(ChainAdapter);
    expect(adapter.chainName).toBe('base');
  });

  it('has all interface methods', () => {
    const adapter = new EvmAdapter('polygon', { rpcUrl: 'https://example.com' });
    const methods = [
      'getBalance', 'swap', 'simulateSwap', 'getQuote',
      'deposit', 'withdraw', 'getHealthFactors', 'liquidate',
      'waitForConfirmation', 'estimateGas',
    ];
    for (const method of methods) {
      expect(typeof adapter[method]).toBe('function');
    }
  });

  it('has nonce manager (instanceof NonceManager)', () => {
    const adapter = new EvmAdapter('base', { rpcUrl: 'https://example.com' });
    expect(adapter.nonceManager).toBeInstanceOf(NonceManager);
  });
});

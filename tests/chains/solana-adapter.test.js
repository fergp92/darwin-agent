import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolanaAdapter } from '../../chains/solana/solana-adapter.js';

describe('SolanaAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new SolanaAdapter('solana', {
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      fallbackUrl: 'https://api.mainnet-beta.solana.com',
      jitoRpc: 'https://mainnet.block-engine.jito.wtf',
    });
  });

  it('extends ChainAdapter', () => {
    expect(adapter.chainName).toBe('solana');
  });

  it('has all interface methods', () => {
    expect(typeof adapter.getBalance).toBe('function');
    expect(typeof adapter.swap).toBe('function');
    expect(typeof adapter.simulateSwap).toBe('function');
    expect(typeof adapter.getQuote).toBe('function');
    expect(typeof adapter.waitForConfirmation).toBe('function');
    expect(typeof adapter.estimateGas).toBe('function');
  });

  it('has Solana-specific methods', () => {
    expect(typeof adapter.sendAirdropInteraction).toBe('function');
  });

  it('implements getBalance returning native + tokens', async () => {
    adapter._connection = {
      getBalance: vi.fn().mockResolvedValue(1_000_000_000),
      getTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
    };
    const balance = await adapter.getBalance('FakePublicKey');
    expect(balance).toHaveProperty('native');
    expect(balance).toHaveProperty('tokens');
    expect(balance.native).toBe(1); // 1 SOL
    expect(balance.tokens).toEqual([]);
  });
});

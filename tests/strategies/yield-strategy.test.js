import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YieldStrategy } from '../../strategies/yield/yield-strategy.js';

describe('YieldStrategy', () => {
  let strategy;
  let mockAdapters;

  beforeEach(() => {
    mockAdapters = {
      solana: {
        deposit: vi.fn().mockResolvedValue({ txHash: '0xsol', apy: 5.2 }),
        withdraw: vi.fn().mockResolvedValue({ txHash: '0xsol2' }),
        getBalance: vi.fn().mockResolvedValue({ native: 100, tokens: [] }),
      },
      base: {
        deposit: vi.fn().mockResolvedValue({ txHash: '0xbase', apy: 4.8 }),
        withdraw: vi.fn().mockResolvedValue({ txHash: '0xbase2' }),
        getBalance: vi.fn().mockResolvedValue({ native: 50, tokens: [] }),
      },
    };
    strategy = new YieldStrategy({ adapters: mockAdapters, paper: false });
  });

  it('extends BaseStrategy with name "yield"', () => {
    expect(strategy.name).toBe('yield');
    expect(strategy.minCapital).toBe(5);
  });

  it('scan returns available lending opportunities', async () => {
    strategy._fetchApys = vi.fn().mockResolvedValue([
      { protocol: 'kamino', chain: 'solana', apy: 5.2, tvl: 1000000 },
      { protocol: 'aave', chain: 'base', apy: 4.8, tvl: 5000000 },
    ]);
    const opps = await strategy.scan();
    expect(opps.length).toBe(2);
    expect(opps[0]).toHaveProperty('apy');
    expect(opps[0]).toHaveProperty('protocol');
  });

  it('evaluate returns shouldExecute=true if APY justifies gas cost', async () => {
    const result = await strategy.evaluate({
      protocol: 'kamino', chain: 'solana', apy: 8.0, currentApy: 2.0, gasCostEur: 0.01, amount: 100,
    });
    expect(result.shouldExecute).toBe(true);
  });

  it('evaluate returns shouldExecute=false if gas > benefit', async () => {
    const result = await strategy.evaluate({
      protocol: 'kamino', chain: 'solana', apy: 2.2, currentApy: 2.1, gasCostEur: 5, amount: 10,
    });
    expect(result.shouldExecute).toBe(false);
  });

  it('report returns metrics', () => {
    const metrics = strategy.report();
    expect(metrics).toHaveProperty('currentDeposits');
    expect(metrics).toHaveProperty('totalYieldEarned');
  });
});

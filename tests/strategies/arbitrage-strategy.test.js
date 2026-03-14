import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArbitrageStrategy } from '../../strategies/arbitrage/arbitrage-strategy.js';

describe('ArbitrageStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new ArbitrageStrategy({
      dexScanner: {
        findSpreads: vi.fn().mockResolvedValue([
          { tokenPair: 'SOL/USDC', buyDex: 'raydium', sellDex: 'jupiter', spread: 0.8, buyPrice: 149.5, sellPrice: 150.7, chain: 'solana' },
        ]),
      },
      adapters: {
        solana: { executeSafeSwap: vi.fn().mockResolvedValue({ txHash: '0xarb', confirmed: true }) },
      },
      paper: false,
    });
  });

  it('extends BaseStrategy with name "arbitrage"', () => {
    expect(strategy.name).toBe('arbitrage');
    expect(strategy.minCapital).toBe(50);
  });

  it('scan returns price spreads across DEXs', async () => {
    const opps = await strategy.scan();
    expect(opps.length).toBe(1);
    expect(opps[0].spread).toBe(0.8);
  });

  it('evaluate checks if spread > fees + slippage (mathematical)', async () => {
    const result = await strategy.evaluate({
      tokenPair: 'SOL/USDC', spread: 0.8, estimatedFees: 0.2, estimatedSlippage: 0.1,
    });
    expect(result.shouldExecute).toBe(true);
    expect(result.expectedProfitPct).toBeCloseTo(0.5, 1);
  });

  it('evaluate rejects when spread <= costs', async () => {
    const result = await strategy.evaluate({
      tokenPair: 'SOL/USDC', spread: 0.2, estimatedFees: 0.2, estimatedSlippage: 0.1,
    });
    expect(result.shouldExecute).toBe(false);
  });

  it('no Brain invocation (purely mathematical)', () => {
    expect(strategy.brain).toBeUndefined();
  });
});

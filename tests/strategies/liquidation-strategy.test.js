import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiquidationStrategy } from '../../strategies/liquidation/liquidation-strategy.js';

describe('LiquidationStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new LiquidationStrategy({
      adapters: {
        solana: {
          getHealthFactors: vi.fn().mockResolvedValue([
            { user: 'user1', health: 0.95, collateral: 500, protocol: 'marginfi' },
            { user: 'user2', health: 1.5, collateral: 1000, protocol: 'kamino' },
          ]),
          liquidate: vi.fn().mockResolvedValue({ txHash: '0xliq', profit: 5.2 }),
        },
        base: {
          getHealthFactors: vi.fn().mockResolvedValue([]),
          liquidate: vi.fn(),
        },
      },
      paper: false,
    });
  });

  it('extends BaseStrategy with name "liquidation"', () => {
    expect(strategy.name).toBe('liquidation');
    expect(strategy.minCapital).toBe(30);
  });

  it('scan returns positions with health factor < 1.0', async () => {
    const opps = await strategy.scan();
    expect(opps.length).toBe(1);
    expect(opps[0].user).toBe('user1');
    expect(opps[0].health).toBe(0.95);
  });

  it('evaluate is purely mathematical — no Brain needed', async () => {
    const result = await strategy.evaluate({
      user: 'user1', health: 0.95, collateral: 500, protocol: 'marginfi', chain: 'solana',
    });
    expect(result.shouldExecute).toBe(true);
    expect(result.estimatedProfit).toBeGreaterThan(0);
  });

  it('evaluate rejects healthy positions', async () => {
    const result = await strategy.evaluate({
      user: 'user2', health: 1.5, collateral: 1000, protocol: 'kamino', chain: 'solana',
    });
    expect(result.shouldExecute).toBe(false);
  });
});

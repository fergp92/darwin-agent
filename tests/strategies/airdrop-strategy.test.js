import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AirdropStrategy } from '../../strategies/airdrop/airdrop-strategy.js';

describe('AirdropStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new AirdropStrategy({
      adapters: {
        solana: { sendAirdropInteraction: vi.fn().mockResolvedValue({ txHash: '0xair' }) },
        base: { sendAirdropInteraction: vi.fn().mockResolvedValue({ txHash: '0xair2' }) },
      },
      paper: false,
    });
  });

  it('extends BaseStrategy with name "airdrop"', () => {
    expect(strategy.name).toBe('airdrop');
    expect(strategy.minCapital).toBe(10);
  });

  it('scan returns protocols needing interaction today', async () => {
    strategy._getProtocolsDue = vi.fn().mockReturnValue([
      { protocol: 'jupiter', chain: 'solana', interaction: 'swap', lastInteraction: null },
    ]);
    const opps = await strategy.scan();
    expect(opps.length).toBe(1);
  });

  it('evaluate checks if we have gas budget', async () => {
    const result = await strategy.evaluate({
      protocol: 'jupiter', chain: 'solana', interaction: 'swap',
      estimatedGas: 0.05, dailyGasBudget: 0.50, gasSpentToday: 0.10,
    });
    expect(result.shouldExecute).toBe(true);
  });

  it('evaluate rejects if gas budget exhausted', async () => {
    const result = await strategy.evaluate({
      protocol: 'jupiter', chain: 'solana', interaction: 'swap',
      estimatedGas: 0.05, dailyGasBudget: 0.50, gasSpentToday: 0.48,
    });
    expect(result.shouldExecute).toBe(false);
  });
});

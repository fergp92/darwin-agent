import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PredictionStrategy } from '../../strategies/prediction/prediction-strategy.js';

describe('PredictionStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new PredictionStrategy({
      brain: {
        invoke: vi.fn().mockResolvedValue({
          action: 'buy_yes', confidence: 0.75, estimated_probability: 0.65,
          reasoning: 'Market underpriced', suggested_size_eur: 3,
        }),
      },
      polymarketClient: {
        getActiveMarkets: vi.fn().mockResolvedValue([
          { id: 'mkt1', title: 'Will X happen?', probability: 0.45, volume: 100000, liquidity: 50000, resolutionDate: '2026-06-01' },
        ]),
        placeBet: vi.fn().mockResolvedValue({ orderId: 'order1', txHash: '0xpoly' }),
      },
      paper: false,
    });
  });

  it('extends BaseStrategy with name "prediction"', () => {
    expect(strategy.name).toBe('prediction');
    expect(strategy.minCapital).toBe(5);
  });

  it('scan returns active Polymarket markets', async () => {
    const markets = await strategy.scan();
    expect(markets.length).toBe(1);
    expect(markets[0].id).toBe('mkt1');
  });

  it('evaluate invokes Brain for market analysis', async () => {
    const result = await strategy.evaluate({
      id: 'mkt1', title: 'Will X happen?', probability: 0.45,
      volume: 100000, liquidity: 50000, resolutionDate: '2026-06-01',
    });
    expect(result.shouldExecute).toBe(true);
    expect(result.action).toBe('buy_yes');
    expect(result.confidence).toBe(0.75);
  });

  it('evaluate rejects when Brain says skip', async () => {
    strategy.brain.invoke = vi.fn().mockResolvedValue({
      action: 'skip', confidence: 0.3, reasoning: 'Too uncertain',
    });
    const result = await strategy.evaluate({ id: 'mkt2', title: 'Test' });
    expect(result.shouldExecute).toBe(false);
  });

  it('evaluate rejects when confidence < 0.6', async () => {
    strategy.brain.invoke = vi.fn().mockResolvedValue({
      action: 'buy_yes', confidence: 0.45, estimated_probability: 0.55,
      reasoning: 'Marginal edge', suggested_size_eur: 2,
    });
    const result = await strategy.evaluate({ id: 'mkt3', title: 'Test' });
    expect(result.shouldExecute).toBe(false);
  });
});

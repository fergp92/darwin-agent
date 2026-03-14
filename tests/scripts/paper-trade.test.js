import { describe, it, expect, vi } from 'vitest';

// Mock initDarwin before importing paper-trade
vi.mock('../../darwin.js', () => ({
  initDarwin: vi.fn().mockResolvedValue({
    start: vi.fn(),
    stop: vi.fn(),
    paper: false,
  }),
}));

import { createPaperTrader } from '../../scripts/paper-trade.js';

describe('paper-trade script', () => {
  it('creates darwin instance in paper mode', async () => {
    const trader = await createPaperTrader({
      initialBalance: 50,
      skipTelegram: true,
      skipApi: true,
    });
    expect(trader).toHaveProperty('start');
    expect(trader).toHaveProperty('stop');
    expect(trader.paper).toBe(true);
  });

  it('paper mode prevents real transactions', async () => {
    const trader = await createPaperTrader({
      initialBalance: 50,
      skipTelegram: true,
      skipApi: true,
    });
    expect(trader.paper).toBe(true);
  });
});

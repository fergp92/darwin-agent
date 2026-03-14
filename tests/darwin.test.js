// darwin/tests/darwin.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all heavy dependencies before importing darwin.js
vi.mock('../core/db.js', () => ({
  initDb: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    close: vi.fn(),
  }),
}));

vi.mock('../core/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../core/events.js', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  EVENTS: {
    TIER_CHANGED: 'tier:changed',
    MODE_CHANGED: 'mode:changed',
    BALANCE_UPDATED: 'balance:updated',
    CIRCUIT_BREAKER_TRIGGERED: 'circuit_breaker:triggered',
    BRAIN_DECISION: 'brain:decision',
  },
}));

// Brain reads prompt files in constructor path resolution — mock fs for that
vi.mock('../core/brain.js', () => {
  function Brain() {
    this.invoke = vi.fn().mockResolvedValue({ action: 'hold' });
    this.getStats = vi.fn().mockReturnValue({ totalInvocations: 0, totalErrors: 0, queueSize: 0, isProcessing: false });
  }
  return { Brain };
});

vi.mock('../core/scheduler.js', () => {
  function Scheduler() {
    this.start = vi.fn();
    this.stop = vi.fn();
    this.isRunning = vi.fn().mockReturnValue(false);
  }
  return { Scheduler };
});

// Portfolio and RiskManager read config files at module level — must mock
vi.mock('../core/portfolio.js', () => {
  function Portfolio() {
    this.getState = vi.fn().mockReturnValue({
      totalBalanceEur: 0,
      solanaBalanceEur: 0,
      baseBalanceEur: 0,
      polygonBalanceEur: 0,
      tier: 0,
      mode: 'normal',
    });
    this.updateBalance = vi.fn();
    this.getAllocation = vi.fn().mockReturnValue({});
  }
  return { Portfolio };
});

vi.mock('../core/risk-manager.js', () => {
  function RiskManager() {
    this.validateTrade = vi.fn().mockReturnValue({ approved: true });
    this.recordTrade = vi.fn();
    this.resetDaily = vi.fn();
    this.getActiveBreakers = vi.fn().mockReturnValue([]);
  }
  return { RiskManager };
});

const { initDarwin } = await import('../darwin.js');

describe('darwin.js entry point', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports an initDarwin function', () => {
    expect(typeof initDarwin).toBe('function');
  });

  it('initDarwin returns an object with start and stop', async () => {
    const darwin = await initDarwin({ skipTelegram: true, skipApi: true, skipWallets: true });
    expect(darwin).toHaveProperty('start');
    expect(darwin).toHaveProperty('stop');
    expect(typeof darwin.start).toBe('function');
    expect(typeof darwin.stop).toBe('function');
    expect(darwin).toHaveProperty('db');
    expect(darwin).toHaveProperty('portfolio');
    expect(darwin).toHaveProperty('riskManager');
    expect(darwin).toHaveProperty('brain');
    expect(darwin).toHaveProperty('scheduler');
  });
});

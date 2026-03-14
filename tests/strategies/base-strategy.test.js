import { describe, it, expect, vi } from 'vitest';
import { BaseStrategy } from '../../strategies/base-strategy.js';

describe('BaseStrategy', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new BaseStrategy('test', {})).toThrow('Cannot instantiate abstract BaseStrategy directly');
  });

  it('concrete subclass implements lifecycle', () => {
    class TestStrategy extends BaseStrategy {
      async scan() { return []; }
      async evaluate(opp) { return { shouldExecute: false }; }
      async execute(eval_) { return {}; }
      report() { return 'ok'; }
    }

    const s = new TestStrategy('test-impl');
    expect(s.name).toBe('test-impl');
    expect(s.isPaper).toBe(false);
    expect(typeof s.scan).toBe('function');
    expect(typeof s.evaluate).toBe('function');
    expect(typeof s.execute).toBe('function');
    expect(typeof s.report).toBe('function');
  });

  it('paper mode skips execute and logs theoretical result', async () => {
    class PaperStrategy extends BaseStrategy {
      async scan() { return [{ ticker: 'AAPL' }]; }
      async evaluate() { return { shouldExecute: true, ticker: 'AAPL' }; }
      async execute() { return { filled: true }; }
      report() { return 'paper report'; }
    }

    const s = new PaperStrategy('paper-test', { paper: true });
    const executeSpy = vi.spyOn(s, 'execute');

    const result = await s.runCycle();

    expect(result.executed).toBe(false);
    expect(result.paper).toBe(true);
    expect(result.opportunities).toBe(1);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('runCycle orchestrates scan -> evaluate -> execute', async () => {
    class RealStrategy extends BaseStrategy {
      async scan() { return [{ ticker: 'MSFT' }]; }
      async evaluate() { return { shouldExecute: true, ticker: 'MSFT' }; }
      async execute() { return { filled: true, ticker: 'MSFT' }; }
      report() { return 'real report'; }
    }

    const mockRisk = {
      validateTrade: vi.fn(() => ({ approved: true })),
      recordTrade: vi.fn(),
    };

    const s = new RealStrategy('real-test');
    s.riskManager = mockRisk;
    const executeSpy = vi.spyOn(s, 'execute');

    const result = await s.runCycle();

    expect(executeSpy).toHaveBeenCalled();
    expect(result.executed).toBe(true);
    expect(mockRisk.validateTrade).toHaveBeenCalled();
    expect(mockRisk.recordTrade).toHaveBeenCalled();
  });

  it('respects minCapital check', () => {
    class CapStrategy extends BaseStrategy {
      async scan() { return []; }
      async evaluate() { return { shouldExecute: false }; }
      async execute() { return {}; }
      report() { return ''; }
    }

    const s = new CapStrategy('cap-test', { minCapital: 50 });
    expect(s.hasMinCapital(30)).toBe(false);
    expect(s.hasMinCapital(50)).toBe(true);
    expect(s.hasMinCapital(100)).toBe(true);
  });
});

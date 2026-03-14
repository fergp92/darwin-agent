// darwin/tests/core/events.test.js
import { describe, it, expect, vi } from 'vitest';
import { eventBus, EVENTS } from '../../core/events.js';

describe('Events', () => {
  it('exports eventBus as EventEmitter', () => {
    expect(typeof eventBus.on).toBe('function');
    expect(typeof eventBus.emit).toBe('function');
  });

  it('exports EVENTS constants', () => {
    expect(EVENTS.TRADE_EXECUTED).toBe('trade:executed');
    expect(EVENTS.TRADE_FAILED).toBe('trade:failed');
    expect(EVENTS.BALANCE_UPDATED).toBe('balance:updated');
    expect(EVENTS.TIER_CHANGED).toBe('tier:changed');
    expect(EVENTS.MODE_CHANGED).toBe('mode:changed');
    expect(EVENTS.CIRCUIT_BREAKER_TRIGGERED).toBe('breaker:triggered');
    expect(EVENTS.CIRCUIT_BREAKER_RESOLVED).toBe('breaker:resolved');
    expect(EVENTS.BRAIN_DECISION).toBe('brain:decision');
    expect(EVENTS.STRATEGY_OPPORTUNITY).toBe('strategy:opportunity');
    expect(EVENTS.DAILY_REPORT).toBe('report:daily');
    expect(EVENTS.SHUTDOWN).toBe('system:shutdown');
  });

  it('emits and receives events', () => {
    const handler = vi.fn();
    eventBus.on(EVENTS.TRADE_EXECUTED, handler);
    eventBus.emit(EVENTS.TRADE_EXECUTED, { txHash: '0xabc' });
    expect(handler).toHaveBeenCalledWith({ txHash: '0xabc' });
    eventBus.removeListener(EVENTS.TRADE_EXECUTED, handler);
  });
});

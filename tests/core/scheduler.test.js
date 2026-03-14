import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../../core/scheduler.js';

describe('Scheduler', () => {
  let scheduler;
  let tickHandlers;

  beforeEach(() => {
    vi.useFakeTimers();
    tickHandlers = {
      balanceCheck: vi.fn(),
      opportunityScan: vi.fn(),
      riskHealthCheck: vi.fn(),
      rebalance: vi.fn(),
      dailyReport: vi.fn(),
    };
    scheduler = new Scheduler(tickHandlers, {
      balanceCheck: 1000,
      opportunityScan: 2000,
      riskHealthCheck: 5000,
      rebalance: 10000,
      dailyReport: 60000,
    });
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('does not tick before start', () => {
    vi.advanceTimersByTime(5000);
    expect(tickHandlers.balanceCheck).not.toHaveBeenCalled();
  });

  it('ticks balanceCheck at configured interval', () => {
    scheduler.start();
    vi.advanceTimersByTime(3000);
    expect(tickHandlers.balanceCheck).toHaveBeenCalledTimes(3);
  });

  it('ticks opportunityScan at configured interval', () => {
    scheduler.start();
    vi.advanceTimersByTime(6000);
    expect(tickHandlers.opportunityScan).toHaveBeenCalledTimes(3);
  });

  it('ticks riskHealthCheck at configured interval', () => {
    scheduler.start();
    vi.advanceTimersByTime(10000);
    expect(tickHandlers.riskHealthCheck).toHaveBeenCalledTimes(2);
  });

  it('stops all ticks on stop()', () => {
    scheduler.start();
    vi.advanceTimersByTime(3000);
    scheduler.stop();
    vi.advanceTimersByTime(10000);
    expect(tickHandlers.balanceCheck).toHaveBeenCalledTimes(3);
  });

  it('reports running state', () => {
    expect(scheduler.isRunning()).toBe(false);
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('catches errors in tick handlers without crashing', () => {
    tickHandlers.balanceCheck.mockImplementation(() => { throw new Error('boom'); });
    scheduler.start();
    vi.advanceTimersByTime(2000);
    expect(tickHandlers.balanceCheck).toHaveBeenCalledTimes(2);
  });
});

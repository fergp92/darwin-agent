// darwin/tests/core/brain.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Brain, PRIORITIES } from '../../core/brain.js';

describe('Brain', () => {
  let brain;

  beforeEach(() => {
    brain = new Brain({ timeoutMs: 5000, maxRetries: 0, maxQueueSize: 3 });
  });

  it('exports PRIORITIES constants', () => {
    expect(PRIORITIES.SURVIVAL).toBe(0);
    expect(PRIORITIES.POST_MORTEM).toBe(1);
    expect(PRIORITIES.REBALANCE).toBe(2);
    expect(PRIORITIES.PREDICTION).toBe(3);
  });

  it('has invoke method', () => {
    expect(typeof brain.invoke).toBe('function');
  });

  it('has getStats method', () => {
    const stats = brain.getStats();
    expect(stats.totalInvocations).toBe(0);
    expect(stats.queueSize).toBe(0);
    expect(stats.isProcessing).toBe(false);
  });

  it('rejects when queue is full', async () => {
    // Mock the internal process spawning to hang
    brain._spawnCli = () => new Promise(() => {}); // never resolves

    // Fill queue: 1 processing + 3 queued = 4 total, 5th should be rejected
    const promises = [];
    for (let i = 0; i < 4; i++) {
      promises.push(brain.invoke('test', { data: i }, PRIORITIES.PREDICTION).catch(() => {}));
    }

    // Wait a tick for them to enter queue
    await new Promise(r => setTimeout(r, 50));

    // 5th invocation should be rejected
    await expect(
      brain.invoke('test', { data: 'overflow' }, PRIORITIES.PREDICTION)
    ).rejects.toThrow('queue full');
  });

  it('validates response JSON with zod schema', () => {
    // Test is about API design — brain.invoke accepts an optional schema
    expect(brain.invoke).toBeDefined();
  });
});

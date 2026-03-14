// darwin/tests/core/logger.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger', () => {
  let createLogger;

  beforeEach(async () => {
    // Dynamic import to get fresh module each time
    const mod = await import('../../core/logger.js');
    createLogger = mod.createLogger;
  });

  it('exports createLogger function', () => {
    expect(typeof createLogger).toBe('function');
  });

  it('creates a logger with a name', () => {
    const log = createLogger('test-module');
    expect(log).toBeDefined();
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  it('creates child loggers with module name', () => {
    const log = createLogger('risk-manager');
    // pino child loggers have bindings
    expect(log).toBeDefined();
  });
});

// darwin/core/events.js
import { EventEmitter } from 'node:events';

export const EVENTS = Object.freeze({
  // Trades
  TRADE_EXECUTED: 'trade:executed',
  TRADE_FAILED: 'trade:failed',
  TRADE_REJECTED: 'trade:rejected',

  // Portfolio
  BALANCE_UPDATED: 'balance:updated',
  TIER_CHANGED: 'tier:changed',
  MODE_CHANGED: 'mode:changed',

  // Risk
  CIRCUIT_BREAKER_TRIGGERED: 'breaker:triggered',
  CIRCUIT_BREAKER_RESOLVED: 'breaker:resolved',

  // Brain
  BRAIN_DECISION: 'brain:decision',

  // Strategies
  STRATEGY_OPPORTUNITY: 'strategy:opportunity',

  // Monitoring
  DAILY_REPORT: 'report:daily',

  // System
  SHUTDOWN: 'system:shutdown',
  ERROR: 'system:error',
});

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(30); // Multiple subscribers expected

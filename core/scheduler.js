import { createLogger } from './logger.js';

const log = createLogger('scheduler');

export class Scheduler {
  #handlers;
  #intervals;
  #timers;
  #running;
  #lastTick;

  constructor(handlers, intervals) {
    this.#handlers = handlers;
    this.#intervals = intervals;
    this.#timers = new Map();
    this.#running = false;
    this.#lastTick = null;
  }

  start() {
    if (this.#running) return;
    this.#running = true;

    for (const [name, intervalMs] of Object.entries(this.#intervals)) {
      const handler = this.#handlers[name];
      if (!handler) {
        log.warn({ name }, 'No handler for scheduled tick, skipping');
        continue;
      }

      const timer = setInterval(() => {
        this.#lastTick = Date.now();
        try {
          const result = handler();
          if (result && typeof result.catch === 'function') {
            result.catch(err => log.error({ tick: name, err: err.message }, 'Async tick error'));
          }
        } catch (err) {
          log.error({ tick: name, err: err.message }, 'Tick error');
        }
      }, intervalMs);

      this.#timers.set(name, timer);
      log.info({ name, intervalMs }, 'Scheduled tick registered');
    }

    log.info('Scheduler started');
  }

  stop() {
    for (const [name, timer] of this.#timers) {
      clearInterval(timer);
    }
    this.#timers.clear();
    this.#running = false;
    log.info('Scheduler stopped');
  }

  isRunning() {
    return this.#running;
  }

  getLastTick() {
    return this.#lastTick;
  }
}

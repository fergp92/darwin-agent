// darwin/core/logger.js
import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

const rootLogger = pino({
  level,
  transport: process.env.NODE_ENV !== 'test'
    ? {
        target: 'pino-roll',
        options: {
          file: 'logs/darwin',
          frequency: 'daily',
          dateFormat: 'yyyy-MM-dd',
          mkdir: true,
        },
      }
    : undefined, // In test: log to stdout (default)
});

/**
 * Create a child logger with a module name binding.
 * @param {string} moduleName
 * @returns {import('pino').Logger}
 */
export function createLogger(moduleName) {
  return rootLogger.child({ module: moduleName });
}

export default rootLogger;

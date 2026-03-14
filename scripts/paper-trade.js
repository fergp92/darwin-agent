import { createLogger } from '../core/logger.js';

const log = createLogger('paper-trade');

export async function createPaperTrader(opts = {}) {
  log.info('Starting Darwin in PAPER TRADE mode');
  log.info('No real transactions will be executed');
  log.info(`Simulated balance: ${opts.initialBalance ?? 50} EUR`);

  // Dynamic import to avoid circular deps and allow testing with mocks
  const { initDarwin } = await import('../darwin.js');

  const darwin = await initDarwin({
    skipWallets: true,
    skipTelegram: opts.skipTelegram ?? false,
    skipApi: opts.skipApi ?? false,
    paper: true,
    ...opts,
  });

  darwin.paper = true;
  return darwin;
}

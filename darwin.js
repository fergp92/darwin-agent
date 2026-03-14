// darwin/darwin.js — Main entry point for Darwin autonomous trading agent
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createLogger } from './core/logger.js';
import { initDb } from './core/db.js';
import { Portfolio } from './core/portfolio.js';
import { RiskManager } from './core/risk-manager.js';
import { Brain } from './core/brain.js';
import { Scheduler } from './core/scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('darwin');

function loadJson(relativePath) {
  return JSON.parse(readFileSync(join(__dirname, relativePath), 'utf-8'));
}

/**
 * Initialize Darwin trading agent.
 * @param {object} opts
 * @param {boolean} [opts.skipWallets] — skip wallet manager creation
 * @param {boolean} [opts.skipApi] — skip API server creation
 * @param {boolean} [opts.skipTelegram] — skip Telegram bot creation
 * @returns {Promise<{ start: Function, stop: Function, db: object, portfolio: Portfolio, riskManager: RiskManager, brain: Brain, scheduler: Scheduler, telegram: object|null }>}
 */
export async function initDarwin(opts = {}) {
  const config = loadJson('config/default.json');
  const tiers = loadJson('config/tiers.json');
  const strategies = loadJson('config/strategies.json');

  log.info({ tiers: tiers.tiers.length, strategies: Object.keys(strategies.allocation).length }, 'Config loaded');

  // Initialize database
  const dbPath = config.database?.path || 'data/darwin.db';
  const db = initDb(join(__dirname, dbPath));

  // Core components
  const portfolio = new Portfolio(db);
  const riskManager = new RiskManager(db, portfolio);
  const brain = new Brain(config.brain);

  // Optional: Wallet manager
  let walletManager = null;
  if (!opts.skipWallets) {
    try {
      const { WalletManager } = await import('./chains/wallet-manager.js');
      walletManager = new WalletManager(config.rpc);
      log.info('Wallet manager initialized');
    } catch (err) {
      log.warn({ err: err.message }, 'Wallet manager not available — running without wallets');
    }
  }

  // Optional: API server
  let api = null;
  if (!opts.skipApi) {
    try {
      const { createApi } = await import('./monitoring/api.js');
      api = createApi({ portfolio, riskManager, brain, db, config });
      log.info('API server created');
    } catch (err) {
      log.warn({ err: err.message }, 'API module not available — running without API');
    }
  }

  // Optional: Telegram bot
  let telegram = null;
  if (!opts.skipTelegram && process.env.TELEGRAM_TOKEN) {
    try {
      const { createTelegram } = await import('./monitoring/telegram.js');
      telegram = createTelegram({ portfolio, riskManager, brain, config });
      log.info('Telegram bot created');
    } catch (err) {
      log.warn({ err: err.message }, 'Telegram module not available — running without Telegram');
    }
  }

  // Build scheduler handlers (stubs for now — strategies wire in later)
  const handlers = {};
  const scheduler = new Scheduler(handlers, config.intervals);

  async function start() {
    const state = portfolio.getState();
    log.info({
      tier: state.tier,
      mode: state.mode,
      balance: state.totalBalanceEur,
    }, 'Darwin starting');

    if (api) {
      await api.listen({ port: config.monitoring.apiPort, host: '0.0.0.0' });
      log.info({ port: config.monitoring.apiPort }, 'API server listening');
    }

    scheduler.start();
    log.info('Darwin started');
  }

  async function stop() {
    log.info('Darwin shutting down...');

    // Stop scheduler first — no new ticks
    scheduler.stop();

    // Mark any interrupted trades
    try {
      db.prepare(`
        UPDATE trades SET status = 'interrupted', updated_at = datetime('now')
        WHERE status = 'pending'
      `).run();
    } catch {
      // trades table may not exist yet
    }

    // Close API
    if (api && typeof api.close === 'function') {
      await api.close();
    }

    // Close database last
    db.close();

    log.info('Darwin stopped');
  }

  return {
    start,
    stop,
    db,
    portfolio,
    riskManager,
    brain,
    scheduler,
    telegram,
  };
}

// CLI entry point — run directly with `node darwin.js`
const isMain = process.argv[1] &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') ===
  process.argv[1].replace(/\\/g, '/');

if (isMain) {
  const darwin = await initDarwin();
  await darwin.start();

  const shutdown = async () => {
    await darwin.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

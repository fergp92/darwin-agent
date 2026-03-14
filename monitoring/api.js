// darwin/monitoring/api.js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createLogger } from '../core/logger.js';

const log = createLogger('api');

/**
 * Creates a read-only REST API for the Darwin dashboard.
 * Does NOT call app.listen() — caller is responsible for that.
 *
 * @param {{ db: import('better-sqlite3').Database, portfolio: object, port?: number }} opts
 * @returns {import('fastify').FastifyInstance}
 */
export function createApi({ db, portfolio, port = 7770 }) {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: 'http://localhost:7760',
  });

  // GET /api/health
  app.get('/api/health', async () => {
    let dbOk = false;
    try {
      db.prepare('SELECT 1').get();
      dbOk = true;
    } catch { /* db unavailable */ }

    return {
      uptime_seconds: Math.floor(process.uptime()),
      db_ok: dbOk,
      timestamp: new Date().toISOString(),
    };
  });

  // GET /api/status
  app.get('/api/status', async () => {
    return portfolio.getStatus();
  });

  // GET /api/trades?limit=N
  app.get('/api/trades', async (req) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    return db.prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?').all(limit);
  });

  // GET /api/portfolio
  app.get('/api/portfolio', async () => {
    return db.prepare('SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT 90').all();
  });

  // GET /api/strategies
  app.get('/api/strategies', async () => {
    return db.prepare('SELECT * FROM strategy_metrics ORDER BY timestamp DESC').all();
  });

  // GET /api/brain?limit=N
  app.get('/api/brain', async (req) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    return db.prepare('SELECT * FROM brain_decisions ORDER BY timestamp DESC LIMIT ?').all(limit);
  });

  // GET /api/breakers
  app.get('/api/breakers', async () => {
    return db.prepare('SELECT * FROM circuit_breakers WHERE active = 1').all();
  });

  // GET /api/daily
  app.get('/api/daily', async () => {
    return db.prepare('SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT 30').all();
  });

  log.info({ port }, 'API instance created');
  return app;
}

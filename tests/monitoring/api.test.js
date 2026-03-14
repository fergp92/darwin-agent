import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApi } from '../../monitoring/api.js';

describe('REST API', () => {
  let app;
  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue({ total_eur: 50, tier: 0, mode: 'normal' }),
    }),
  };
  const mockPortfolio = {
    getStatus: vi.fn().mockReturnValue({
      totalEur: 50, tier: 0, mode: 'normal',
      balances: { solana: 20, base: 15, polygon: 15 },
    }),
  };

  beforeEach(async () => {
    app = createApi({ db: mockDb, portfolio: mockPortfolio, port: 0 });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with uptime', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('uptime_seconds');
    expect(body).toHaveProperty('db_ok');
  });

  it('GET /api/status returns portfolio status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.totalEur).toBe(50);
    expect(body.tier).toBe(0);
  });

  it('GET /api/trades returns array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trades?limit=10' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(res.payload))).toBe(true);
  });

  it('GET /api/portfolio returns balance history', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/portfolio' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/strategies returns strategy metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/strategies' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/brain returns brain decision log', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/brain?limit=20' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/breakers returns circuit breaker status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/breakers' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/daily returns daily snapshots', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/daily' });
    expect(res.statusCode).toBe(200);
  });

  it('rejects POST with 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/status' });
    expect(res.statusCode).toBe(404);
  });
});

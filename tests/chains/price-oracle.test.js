// darwin/tests/chains/price-oracle.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PriceOracle } from '../../chains/price-oracle.js';

describe('PriceOracle', () => {
  let originalFetch;

  afterEach(() => {
    if (originalFetch !== undefined) {
      global.fetch = originalFetch;
      originalFetch = undefined;
    }
    vi.restoreAllMocks();
  });

  it('fetches EUR/USD rate with caching', async () => {
    const oracle = new PriceOracle();
    originalFetch = global.fetch;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ethereum: { usd: 3000, eur: 2727.27 },
      }),
    });
    global.fetch = mockFetch;

    const rate1 = await oracle.getEurUsdRate();
    const rate2 = await oracle.getEurUsdRate();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(rate1).toBeCloseTo(3000 / 2727.27, 2);
    expect(rate2).toBe(rate1);
  });

  it('converts USD to EUR', async () => {
    const oracle = new PriceOracle();
    oracle._eurUsdRate = 1.10;
    oracle._eurUsdLastFetch = Date.now();

    const eur = await oracle.usdToEur(110);
    expect(eur).toBeCloseTo(100, 5);
  });

  it('converts token amount to EUR using adapter quotes', async () => {
    const oracle = new PriceOracle();
    oracle._eurUsdRate = 1.10;
    oracle._eurUsdLastFetch = Date.now();

    const adapter = {
      getTokenPrice: vi.fn().mockResolvedValue(150),
    };

    const eur = await oracle.tokenToEur(adapter, 'SOL', 2);
    expect(adapter.getTokenPrice).toHaveBeenCalledWith('SOL');
    // 150 * 2 = 300 USD, 300 / 1.10 ≈ 272.73
    expect(eur).toBeCloseTo(272.73, 2);
  });

  it('caches EUR/USD rate for configured duration', async () => {
    const oracle = new PriceOracle();
    originalFetch = global.fetch;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ethereum: { usd: 3000, eur: 2727.27 },
      }),
    });
    global.fetch = mockFetch;

    await oracle.getEurUsdRate();
    // Second call within cache window
    await oracle.getEurUsdRate();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramNotifier } from '../../monitoring/telegram.js';

describe('TelegramNotifier', () => {
  let notifier;
  let mockBot;

  beforeEach(() => {
    mockBot = {
      sendMessage: vi.fn().mockResolvedValue(true),
      onText: vi.fn(),
      on: vi.fn(),
    };
    notifier = new TelegramNotifier({
      bot: mockBot,
      chatId: '12345',
      portfolio: {
        getStatus: vi.fn().mockReturnValue({
          totalEur: 50,
          tier: 0,
          mode: 'normal',
          balances: { solana: 20, base: 15, polygon: 15 },
        }),
      },
      db: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue(null),
        }),
      },
    });
  });

  it('sends critical notifications immediately', async () => {
    await notifier.sendCritical('Emergency mode activated');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('CRITICAL'),
      expect.any(Object),
    );
  });

  it('sends important notifications', async () => {
    await notifier.sendImportant('Tier upgraded to 1');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Tier upgraded'),
      expect.any(Object),
    );
  });

  it('batches info notifications', () => {
    notifier.queueInfo('Trade executed: +0.5 EUR');
    notifier.queueInfo('Airdrop interaction on Jupiter');
    expect(notifier._infoBatch.length).toBe(2);
  });

  it('flushes info batch into a single message', async () => {
    notifier.queueInfo('Trade 1');
    notifier.queueInfo('Trade 2');
    await notifier.flushInfoBatch();
    expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Trade 1'),
      expect.any(Object),
    );
    expect(notifier._infoBatch.length).toBe(0);
  });

  it('generates daily report string', () => {
    const report = notifier.buildDailyReport({
      balance: 52,
      pnl: 2,
      tier: 0,
      mode: 'normal',
      trades: 5,
      winRate: 0.6,
      brainInvocations: 3,
    });
    expect(report).toContain('52');
    expect(report).toContain('P&L');
  });

  it('registers command handlers on init', () => {
    notifier.registerCommands();
    expect(mockBot.onText.mock.calls.length).toBeGreaterThanOrEqual(10);
  });
});

/**
 * TelegramNotifier — Push/pull notification layer for Darwin.
 *
 * Push: sendCritical / sendImportant / queueInfo + flushInfoBatch
 * Pull: 10 command handlers registered via registerCommands()
 */
export class TelegramNotifier {
  constructor({ bot, chatId, portfolio, db }) {
    this.bot = bot;
    this.chatId = chatId;
    this.portfolio = portfolio;
    this.db = db;
    this._infoBatch = [];
    this._paused = false;
  }

  /* ── Push notifications ───────────────────────────────── */

  async sendCritical(message) {
    await this._send(`\u{1F6A8} *CRITICAL*: ${message}`);
  }

  async sendImportant(message) {
    await this._send(`\u{26A0}\u{FE0F} *Important*: ${message}`);
  }

  queueInfo(message) {
    this._infoBatch.push({ text: message, ts: Date.now() });
  }

  async flushInfoBatch() {
    if (this._infoBatch.length === 0) return;
    const lines = this._infoBatch.map((m) => `\u{2022} ${m.text}`).join('\n');
    const header = `\u{1F4AC} *Info batch* (${this._infoBatch.length})\n`;
    await this._send(header + lines);
    this._infoBatch = [];
  }

  /* ── Reports ──────────────────────────────────────────── */

  buildDailyReport({ balance, pnl, tier, mode, trades, winRate, brainInvocations }) {
    const pnlSign = pnl >= 0 ? '+' : '';
    return [
      `\u{1F4CA} *Darwin Daily Report*`,
      ``,
      `Balance: \`${balance} EUR\``,
      `P&L: \`${pnlSign}${pnl} EUR\``,
      `Tier: \`${tier}\` | Mode: \`${mode}\``,
      `Trades: \`${trades}\` | Win rate: \`${(winRate * 100).toFixed(1)}%\``,
      `Brain invocations: \`${brainInvocations}\``,
    ].join('\n');
  }

  /* ── Pull commands ────────────────────────────────────── */

  registerCommands() {
    this.bot.onText(/\/status/, async () => {
      const s = this.portfolio.getStatus();
      await this._send(
        `*Status*\nBalance: \`${s.totalEur} EUR\`\nTier: \`${s.tier}\` | Mode: \`${s.mode}\`\nChains: SOL \`${s.balances.solana}\` / BASE \`${s.balances.base}\` / POLY \`${s.balances.polygon}\``,
      );
    });

    this.bot.onText(/\/pnl/, async () => {
      const row = this.db.prepare('SELECT * FROM daily_pnl ORDER BY date DESC LIMIT 1').get();
      if (!row) return this._send('No P&L data yet.');
      await this._send(`*P&L*\nDate: \`${row.date}\`\nP&L: \`${row.pnl} EUR\``);
    });

    this.bot.onText(/\/trades/, async () => {
      const rows = this.db.prepare('SELECT * FROM trades ORDER BY ts DESC LIMIT 5').all();
      if (rows.length === 0) return this._send('No trades recorded.');
      const lines = rows.map((r) => `\`${r.pair}\` ${r.side} ${r.amount} @ ${r.price}`);
      await this._send(`*Recent trades*\n${lines.join('\n')}`);
    });

    this.bot.onText(/\/strategies/, async () => {
      const rows = this.db.prepare('SELECT * FROM strategies WHERE active = 1').all();
      if (rows.length === 0) return this._send('No active strategies.');
      const lines = rows.map((r) => `\`${r.name}\` — ${r.type}`);
      await this._send(`*Active strategies*\n${lines.join('\n')}`);
    });

    this.bot.onText(/\/predictions/, async () => {
      const rows = this.db.prepare('SELECT * FROM predictions ORDER BY ts DESC LIMIT 5').all();
      if (rows.length === 0) return this._send('No predictions yet.');
      const lines = rows.map((r) => `\`${r.token}\` ${r.direction} (${r.confidence}%)`);
      await this._send(`*Recent predictions*\n${lines.join('\n')}`);
    });

    this.bot.onText(/\/breakers/, async () => {
      const rows = this.db.prepare('SELECT * FROM circuit_breakers').all();
      if (rows.length === 0) return this._send('No circuit breakers active.');
      const lines = rows.map((r) => `\`${r.name}\` — ${r.state}`);
      await this._send(`*Circuit breakers*\n${lines.join('\n')}`);
    });

    this.bot.onText(/\/brain/, async () => {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM brain_invocations').get();
      await this._send(`*Brain*\nInvocations: \`${row?.cnt ?? 0}\``);
    });

    this.bot.onText(/\/history/, async () => {
      const rows = this.db.prepare('SELECT * FROM notifications ORDER BY ts DESC LIMIT 10').all();
      if (rows.length === 0) return this._send('No notification history.');
      const lines = rows.map((r) => `[${r.level}] ${r.message}`);
      await this._send(`*History*\n${lines.join('\n')}`);
    });

    this.bot.onText(/\/pause/, async () => {
      this._paused = true;
      await this._send('Darwin notifications *paused*.');
    });

    this.bot.onText(/\/resume/, async () => {
      this._paused = false;
      await this._send('Darwin notifications *resumed*.');
    });
  }

  /* ── Accessors ────────────────────────────────────────── */

  get isPaused() {
    return this._paused;
  }

  /* ── Internal ─────────────────────────────────────────── */

  async _send(text) {
    try {
      await this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[TelegramNotifier] send failed:', err.message);
    }
  }
}

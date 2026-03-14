// darwin/core/portfolio.js
import { createLogger } from './logger.js';
import { eventBus, EVENTS } from './events.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'config');
const log = createLogger('portfolio');

// Load tier and allocation configs
const tiers = JSON.parse(fs.readFileSync(path.join(configDir, 'tiers.json'), 'utf-8')).tiers;
const allocations = JSON.parse(fs.readFileSync(path.join(configDir, 'strategies.json'), 'utf-8')).allocation;
const riskConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'default.json'), 'utf-8')).risk;

export class Portfolio {
  #db;
  #state;

  constructor(db) {
    this.#db = db;
    this.#state = {
      totalBalanceEur: 0,
      solanaBalanceEur: 0,
      baseBalanceEur: 0,
      polygonBalanceEur: 0,
      tier: 0,
      mode: 'normal',
    };
  }

  getState() {
    return { ...this.#state };
  }

  updateBalance(balances) {
    const total = balances.solana + balances.base + balances.polygon;
    const prevTier = this.#state.tier;
    const prevMode = this.#state.mode;

    this.#state.solanaBalanceEur = balances.solana;
    this.#state.baseBalanceEur = balances.base;
    this.#state.polygonBalanceEur = balances.polygon;
    this.#state.totalBalanceEur = total;

    this.#state.tier = this.#evaluateTier(total);
    this.#state.mode = this.#evaluateMode(total);

    this.#persistSnapshot();

    if (this.#state.tier !== prevTier) {
      eventBus.emit(EVENTS.TIER_CHANGED, { from: prevTier, to: this.#state.tier, balance: total });
      log.info({ from: prevTier, to: this.#state.tier }, 'Tier changed');
    }

    if (this.#state.mode !== prevMode) {
      eventBus.emit(EVENTS.MODE_CHANGED, { from: prevMode, to: this.#state.mode, balance: total });
      log.info({ from: prevMode, to: this.#state.mode }, 'Mode changed');
    }

    eventBus.emit(EVENTS.BALANCE_UPDATED, this.getState());
  }

  getAllocation() {
    return { ...allocations[String(this.#state.tier)] };
  }

  #evaluateTier(total) {
    let tier = 0;
    for (const t of tiers) {
      if (t.upgradeAt !== null && total >= t.upgradeAt) {
        tier = t.tier + 1;
      } else if (total >= (t.minBalance || 0)) {
        tier = Math.max(tier, t.tier);
      }
    }
    return Math.min(tier, tiers.length - 1);
  }

  #evaluateMode(total) {
    const floors = riskConfig.capitalFloors;
    if (total < floors.hibernation) return 'dead';
    if (total < floors.emergency) return 'hibernation';
    if (total < floors.normal) return 'emergency';
    return 'normal';
  }

  #persistSnapshot() {
    try {
      this.#db.prepare(`
        INSERT INTO portfolio (total_balance_eur, solana_balance_eur, base_balance_eur, polygon_balance_eur, tier, mode)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        this.#state.totalBalanceEur,
        this.#state.solanaBalanceEur,
        this.#state.baseBalanceEur,
        this.#state.polygonBalanceEur,
        this.#state.tier,
        this.#state.mode
      );
    } catch (err) {
      log.error({ err }, 'Failed to persist portfolio snapshot');
    }
  }
}

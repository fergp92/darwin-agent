-- darwin/data/migrations/001-initial-schema.sql
-- Darwin initial schema — 8 business tables + 1 migrations table

CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  total_balance_eur REAL NOT NULL,
  solana_balance_eur REAL NOT NULL DEFAULT 0,
  base_balance_eur REAL NOT NULL DEFAULT 0,
  polygon_balance_eur REAL NOT NULL DEFAULT 0,
  tier INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'emergency', 'hibernation', 'dead'))
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  strategy TEXT NOT NULL,
  chain TEXT NOT NULL,
  action TEXT NOT NULL,
  token_in TEXT,
  token_out TEXT,
  amount_in REAL,
  amount_out REAL,
  profit_eur REAL,
  gas_cost_eur REAL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'interrupted')),
  error_message TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS brain_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL CHECK (type IN ('prediction', 'rebalance', 'post_mortem', 'survival')),
  context_json TEXT NOT NULL,
  response_json TEXT,
  duration_ms INTEGER,
  outcome_eur REAL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS strategy_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy TEXT NOT NULL,
  period TEXT NOT NULL,
  period_start TEXT NOT NULL,
  trade_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  loss_count INTEGER NOT NULL DEFAULT 0,
  total_profit_eur REAL NOT NULL DEFAULT 0,
  total_loss_eur REAL NOT NULL DEFAULT 0,
  avg_profit_eur REAL,
  sharpe_ratio REAL,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS circuit_breakers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL CHECK (type IN ('daily_loss', 'strategy_loss', 'chain_failure', 'emergency', 'rpc_backoff')),
  target TEXT,
  reason TEXT NOT NULL,
  expires_at TEXT,
  resolved_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  market_id TEXT NOT NULL,
  market_title TEXT,
  position TEXT NOT NULL CHECK (position IN ('yes', 'no')),
  entry_price REAL NOT NULL,
  amount_eur REAL NOT NULL,
  confidence REAL,
  brain_reasoning TEXT,
  outcome TEXT CHECK (outcome IN ('win', 'loss', 'pending', 'cancelled')),
  exit_price REAL,
  profit_eur REAL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS airdrop_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  chain TEXT NOT NULL,
  protocol TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  tx_hash TEXT,
  gas_spent_eur REAL NOT NULL DEFAULT 0,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS daily_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  balance_eur REAL NOT NULL,
  tier INTEGER NOT NULL,
  mode TEXT NOT NULL,
  profit_eur REAL NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  brain_invocations INTEGER NOT NULL DEFAULT 0,
  best_strategy TEXT,
  worst_strategy TEXT,
  metadata_json TEXT
);

-- Indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
CREATE INDEX IF NOT EXISTS idx_trades_chain ON trades(chain);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_brain_type ON brain_decisions(type);
CREATE INDEX IF NOT EXISTS idx_brain_timestamp ON brain_decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_breakers_active ON circuit_breakers(active);
CREATE INDEX IF NOT EXISTS idx_predictions_outcome ON predictions(outcome);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_snapshots(date);

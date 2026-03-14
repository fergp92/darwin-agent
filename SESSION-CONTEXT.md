# Darwin — Autonomous Trading Agent

## Quick Start

### Prerequisites
- Node.js 22+
- npm

### First Run
```bash
cd darwin
npm install
WALLET_PASSPHRASE=your-secure-passphrase node scripts/setup-wallets.js
```

### Paper Trading (no real money)
```bash
WALLET_PASSPHRASE=xxx node scripts/paper-trade.js
```

### Production
```bash
WALLET_PASSPHRASE=xxx TELEGRAM_TOKEN=xxx TELEGRAM_CHAT_ID=xxx node darwin.js
```

### Dashboard
```bash
cd dashboard && npm install && npm run dev
# Open http://localhost:7760
```

## Architecture

Microkernel: single Node.js process with pluggable strategies.

- **Core**: Scheduler → Portfolio → Risk Manager → Brain (Claude CLI)
- **Chains**: Solana, Base L2, Polygon via abstract ChainAdapter
- **Strategies**: Prediction, Yield, Airdrop, Liquidation, Arbitrage
- **Monitoring**: REST API (7761) + Telegram bot + React dashboard (7760)
- **Data**: SQLite (better-sqlite3, WAL mode)

## Key Files

| File | Purpose |
|------|---------|
| `darwin.js` | Entry point — init all subsystems, graceful shutdown |
| `core/brain.js` | Claude CLI wrapper with priority queue |
| `core/risk-manager.js` | 6 pre-trade checks + circuit breakers |
| `core/portfolio.js` | Balance tracking, tier/mode evaluation |
| `core/scheduler.js` | Main loop with configurable intervals |
| `core/events.js` | Event bus with typed constants |
| `core/logger.js` | Pino logger with daily rotation |
| `core/db.js` | SQLite with WAL mode + migration runner |
| `chains/wallet-manager.js` | AES-256-GCM wallet encryption |
| `chains/chain-adapter.js` | Abstract adapter with simulate-then-execute |
| `chains/solana/solana-adapter.js` | Solana + Jupiter + Jito MEV |
| `chains/evm/evm-adapter.js` | Base/Polygon + Uniswap + Flashbots |
| `chains/price-oracle.js` | EUR/USD caching via CoinGecko |
| `strategies/base-strategy.js` | Strategy lifecycle: scan→evaluate→execute |
| `strategies/yield/` | APY comparison across lending protocols |
| `strategies/prediction/` | Polymarket + Brain analysis |
| `strategies/airdrop/` | Protocol interaction farming |
| `strategies/liquidation/` | Health factor monitoring |
| `strategies/arbitrage/` | Cross-DEX spread detection |
| `monitoring/api.js` | Fastify REST API (8 read-only endpoints) |
| `monitoring/telegram.js` | Push/pull Telegram notifications |

## Tier System

| Tier | Balance | Strategies |
|------|---------|------------|
| 0 | 50-149 EUR | Prediction, Yield, Airdrop |
| 1 | 150-499 EUR | + Liquidation |
| 2 | 500-1999 EUR | + Arbitrage |
| 3 | 2000+ EUR | All strategies, full allocation |

## Mode System

| Mode | Balance | Behavior |
|------|---------|----------|
| normal | ≥30 EUR | Full trading |
| emergency | 10-29.99 EUR | 5% max position, reduced strategies |
| hibernation | 5-9.99 EUR | Minimal activity |
| dead | <5 EUR | All trading stopped |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WALLET_PASSPHRASE` | Yes | Decrypts wallet files |
| `TELEGRAM_TOKEN` | Production | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Production | Your Telegram chat ID |
| `POLYMARKET_API_KEY` | Optional | Polymarket CLOB access |
| `LOG_LEVEL` | No | pino log level (default: info) |

## Port Registry

| Port | Service |
|------|---------|
| 7760 | Dashboard (Vite dev / built React) |
| 7761 | REST API (Fastify) |

## Test Commands

```bash
cd darwin
npx vitest run                          # All tests (~116)
npx vitest run tests/core/              # Core module tests
npx vitest run tests/strategies/        # Strategy tests
npx vitest run tests/monitoring/        # API + Telegram tests
npx vitest run tests/chains/            # Chain adapter tests
npx vitest run tests/scripts/           # Script tests
```

## Current Status

- **Branch**: `feat/darwin-agent`
- **Tests**: 116 passing across 23 test files
- **Commits**: 25 (scaffold → entry point)
- **Phase**: Implementation complete, pending security audit

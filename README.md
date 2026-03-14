# Darwin

**An autonomous trading agent that starts with 50 EUR and must survive by generating profit.**

Darwin operates across three blockchains (Solana, Base L2, Polygon) using five trading strategies, managed by an AI brain (Claude) that makes high-level decisions while mathematical modules handle execution. Capital is its life — if it reaches zero, Darwin ceases to exist.

> **Status:** Implementation complete. 116+ tests passing. Not yet battle-tested with real capital.

---

## The Idea

Most trading bots are configured, funded, and supervised by humans. Darwin is different — it's designed to be **autonomous from near-zero capital**:

- **Starts with just 50 EUR** split across three chains
- **Evolves through tiers** as capital grows, unlocking more strategies
- **Enters survival modes** when capital drops, reducing risk automatically
- **Uses AI judgment** for complex decisions (market analysis, portfolio rebalancing, post-mortems on losing trades)
- **Uses pure math** for latency-sensitive decisions (arbitrage spreads, liquidation thresholds, gas costs)

The goal: drop 50 EUR into wallets, start the process, and watch it either grow or learn from its mistakes.

---

## Architecture

Single Node.js process, microkernel design. No microservices, no containers — one process that does everything.

```
                         +------------------+
                         |    Scheduler     |
                         | (tick intervals) |
                         +--------+---------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
     +--------v--------+ +-------v-------+ +---------v--------+
     |    Portfolio     | | Risk Manager  | |      Brain       |
     | balance / tiers  | | 6 pre-trade   | |  Claude CLI      |
     | mode evaluation  | | checks +      | |  priority queue  |
     |                  | | circuit break  | |  FIFO max 3      |
     +--------+---------+ +-------+-------+ +---------+--------+
              |                   |                   |
     +--------v-------------------v-------------------v--------+
     |                    Strategies                            |
     |  Prediction | Yield | Airdrop | Liquidation | Arbitrage |
     +-----+---------------+---------------+------------------+
           |               |               |
     +-----v-----+  +-----v-----+  +------v------+
     |  Solana    |  |   Base    |  |   Polygon   |
     |  Jupiter   |  |  Uniswap  |  |   Uniswap   |
     |  Jito MEV  |  | Flashbots |  |  Flashbots  |
     +-----------+  +-----------+  +-------------+
```

### Core Loop

Every tick (configurable intervals):
1. **Scheduler** fires the appropriate tick type (balance, scan, risk, rebalance, daily)
2. **Portfolio** checks balances across all chains, evaluates tier/mode
3. **Strategies** scan for opportunities, evaluate them, request risk approval
4. **Risk Manager** validates each trade (6 checks), blocks if circuit breaker is active
5. **Brain** (Claude CLI) is invoked only for complex decisions that need reasoning
6. **Chain adapters** simulate transactions before execution (simulate-then-execute pipeline)

---

## Strategies

| Strategy | What it does | Brain? | Min Capital |
|----------|-------------|--------|-------------|
| **Prediction** | Trades on Polymarket binary markets using AI analysis of market conditions | Yes | 5 EUR |
| **Yield** | Compares APYs across lending protocols (Aave, MarginFi, Kamino) and moves capital to highest yield | No | 5 EUR |
| **Airdrop** | Makes daily interactions with protocols to qualify for future airdrops | No | 10 EUR |
| **Liquidation** | Monitors Aave health factors and executes liquidations when positions are underwater | No | 30 EUR |
| **Arbitrage** | Detects price spreads across DEXs on the same chain and executes atomic swaps | No | 50 EUR |

### Strategy Allocation by Tier

| Tier | Prediction | Airdrop | Yield | Liquidation | Arbitrage |
|------|-----------|---------|-------|-------------|-----------|
| 0 (Survive) | 40% | 30% | 30% | - | - |
| 1 (Stabilize) | 30% | 20% | 10% | 20% | 20% |
| 2 (Scale) | 25% | 15% | 10% | 25% | 25% |
| 3 (Professional) | 20% | 10% | 5% | 30% | 35% |

---

## Tier System

Darwin evolves as capital grows:

| Tier | Name | Balance Range | What Changes |
|------|------|--------------|--------------|
| 0 | **Survive** | 50 - 149 EUR | Only low-cost strategies (prediction, yield, airdrop) |
| 1 | **Stabilize** | 150 - 499 EUR | Unlocks liquidation and arbitrage |
| 2 | **Scale** | 500 - 1,999 EUR | Dedicated infrastructure, higher allocations |
| 3 | **Professional** | 2,000+ EUR | Full allocation, premium infrastructure |

## Survival Modes

When capital drops, Darwin gets more conservative:

| Mode | Balance | Behavior |
|------|---------|----------|
| **Normal** | >= 30 EUR | Full trading, 20% max position size |
| **Emergency** | 10 - 29.99 EUR | 5% max position, reduced strategies |
| **Hibernation** | 5 - 9.99 EUR | Minimal activity, preservation only |
| **Dead** | < 5 EUR | All trading stopped |

---

## Risk Management

Every trade passes through 6 checks before execution:

1. **Circuit breakers** — Are any breakers active? (daily loss, strategy loss, chain failure)
2. **Position size** — Is this trade <= 20% of total balance? (5% in emergency mode)
3. **Capital floor** — Will the remaining balance stay above the mode-specific floor?
4. **Daily loss limit** — Has cumulative daily loss exceeded 15%?
5. **Strategy allocation** — Does this strategy's total exposure stay within its allocation?
6. **Gas sanity** — Is gas cost < 10% of the trade amount?
7. **Duplicate detection** — Was the same trade attempted in the last 5 minutes?

If ANY check fails, the trade is rejected. No overrides, no exceptions.

### Circuit Breakers

Automatic trading halts that trigger on:
- **Daily loss >= 15%**: All trading paused for 24 hours
- **Strategy loss threshold**: Individual strategy paused
- **Chain failure**: Specific chain paused (RPC errors, tx failures)

---

## The Brain

Darwin uses Claude (via CLI) for decisions that require reasoning. The Brain is **not** in the hot path — it's invoked sparingly and asynchronously.

**Priority queue** (lower = higher priority):
| Priority | Type | When |
|----------|------|------|
| 0 | SURVIVAL | Balance critically low, need emergency action |
| 1 | POST_MORTEM | Trade failed or lost money, need to learn |
| 2 | REBALANCE | Periodic portfolio rebalancing analysis |
| 3 | PREDICTION | Market analysis for prediction strategy |

**Constraints:**
- Max 1 concurrent invocation
- FIFO queue, max 3 pending
- 60s timeout per invocation
- Stateless — full context passed each time

The Brain never has access to private keys or the ability to execute transactions directly.

---

## Transaction Safety

All trades follow a **simulate-then-execute** pipeline:

1. **Simulate** the transaction against the current blockchain state
2. **Validate** slippage tolerance against simulated output
3. **Execute** with MEV protection:
   - **Solana**: Jito bundles for frontrunning protection
   - **Base/Polygon**: Flashbots Protect RPC
4. **Wait** for on-chain confirmation
5. **Record** result in database

For EVM chains, a **nonce manager** tracks pending transactions per chain and handles stuck tx recovery (speed-up after 2 min, cancel after 5 min).

---

## Wallet Security

- Private keys encrypted at rest with **AES-256-GCM**
- Key derivation via **PBKDF2** (100,000 iterations) from a passphrase
- Wallet files (`.enc`) are gitignored and never committed
- The Brain never sees private keys — only the chain adapters access them
- One Solana keypair, one EVM keypair shared across Base + Polygon

---

## Quick Start

### Prerequisites

- **Node.js 22+**
- **Claude CLI** installed and authenticated (for Brain functionality)
- RPC endpoints (free tiers work for Tier 0)

### 1. Install

```bash
git clone https://github.com/fergp92/darwin-agent.git
cd darwin-agent
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure RPC Endpoints

Edit `config/default.json` and replace `YOUR_KEY` placeholders with your RPC API keys:

```json
{
  "rpc": {
    "solana": { "url": "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY" },
    "base": { "url": "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY" },
    "polygon": { "url": "https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY" }
  }
}
```

Free RPC providers: [Helius](https://helius.dev) (Solana), [Alchemy](https://alchemy.com) (Base/Polygon), or use the public fallback RPCs already configured.

### 3. Generate Wallets

```bash
DARWIN_WALLET_PASSPHRASE=your-secure-passphrase-min-12-chars node scripts/setup-wallets.js
```

This creates encrypted wallet files in `wallets/`. **Save the displayed addresses** — you'll need them to fund the wallets.

### 4. Fund Wallets

Send your initial capital (50 EUR equivalent) split across:
- **SOL** to the Solana address
- **ETH on Base** to the EVM address
- **MATIC on Polygon** to the same EVM address

### 5. Paper Trading (recommended first)

Test without real money:

```bash
DARWIN_WALLET_PASSPHRASE=xxx node scripts/paper-trade.js
```

### 6. Production

```bash
DARWIN_WALLET_PASSPHRASE=xxx \
TELEGRAM_TOKEN=your-bot-token \
TELEGRAM_CHAT_ID=your-chat-id \
node darwin.js
```

### 7. Dashboard

```bash
cd dashboard && npm run dev
# Open http://localhost:7760
```

---

## Docker

### Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env with your passphrase, Telegram token, etc.

docker compose up -d
```

This starts:
- **darwin-agent** on port `7761` (REST API)
- **darwin-dashboard** on port `7760` (nginx serving React + proxying `/api/` to darwin)

### Wallet Setup (Docker)

Generate wallets before first run:

```bash
docker compose run --rm darwin node scripts/setup-wallets.js
```

### Brain (Claude CLI) in Docker

The Brain requires Claude CLI. To use it inside the container, mount your host's Claude config:

```yaml
# In docker-compose.yml, uncomment:
volumes:
  - ${HOME}/.claude:/home/darwin/.claude:ro
```

Without Claude CLI, Darwin still runs — the 4 strategies that don't need AI (yield, airdrop, liquidation, arbitrage) work with pure math. Only the prediction strategy requires the Brain.

### Persistent Data

Three named volumes keep data across container restarts:

| Volume | Container Path | Content |
|--------|---------------|---------|
| `darwin-data` | `/app/data` | SQLite database + backups |
| `darwin-wallets` | `/app/wallets` | Encrypted wallet files |
| `darwin-logs` | `/app/logs` | Log files |

### Useful Commands

```bash
docker compose logs -f darwin          # Follow agent logs
docker compose logs -f dashboard       # Follow dashboard logs
docker compose exec darwin node -e "
  const {initDb,getDb}=await import('./core/db.js');
  initDb('/app/data/darwin.db');
  console.log(getDb().prepare('SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT 5').all())
"                                      # Query database
docker compose down                    # Stop everything
docker compose down -v                 # Stop + delete volumes (DESTRUCTIVE)
```

---

## Monitoring

### REST API (port 7761)

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Uptime, version, status |
| `GET /api/status` | Balance, tier, mode, active strategies |
| `GET /api/trades` | Recent trades with P&L |
| `GET /api/portfolio` | Historical balance snapshots |
| `GET /api/strategies` | Per-strategy metrics |
| `GET /api/brain` | Recent Brain decisions |
| `GET /api/breakers` | Active circuit breakers |
| `GET /api/daily` | Daily snapshots |

### Telegram Bot

**Push notifications** (automatic):
- Critical alerts (mode changes, circuit breakers)
- Trade executions
- Daily performance report at 9:00 AM

**Pull commands** (on demand):
`/status` `/pnl` `/trades` `/strategies` `/predictions` `/breakers` `/brain` `/history` `/pause` `/resume`

### React Dashboard

Real-time dashboard showing balance chart, recent trades, strategy performance, and Brain activity. Polls the REST API with configurable refresh intervals.

---

## Project Structure

```
darwin-agent/
  config/
    default.json          # Intervals, RPC, risk params, monitoring
    tiers.json            # Tier definitions and thresholds
    strategies.json       # Allocation per tier, scan intervals, slippage
  core/
    brain.js              # Claude CLI wrapper with priority queue
    db.js                 # SQLite + WAL mode + migration runner
    events.js             # Event bus with typed constants
    logger.js             # Pino with daily log rotation
    portfolio.js          # Balance tracking, tier/mode evaluation
    risk-manager.js       # 6 pre-trade checks + circuit breakers
    scheduler.js          # Main loop with configurable tick intervals
  chains/
    chain-adapter.js      # Abstract base: simulate-then-execute
    price-oracle.js       # EUR/USD rate caching (CoinGecko)
    wallet-manager.js     # AES-256-GCM wallet encryption
    solana/
      solana-adapter.js   # Solana + Jupiter routing + Jito MEV
      jupiter-client.js   # Jupiter V6 API wrapper
    evm/
      evm-adapter.js      # Base/Polygon + Uniswap + Flashbots
      nonce-manager.js    # Per-chain nonce tracking + stuck tx recovery
      uniswap-client.js   # Uniswap V3 Quoter + Router
      aave-client.js      # Aave V3 lending/liquidation
  strategies/
    base-strategy.js      # Abstract lifecycle: scan -> evaluate -> execute
    prediction/           # Polymarket CLOB + Brain analysis
    yield/                # APY comparison across lending protocols
    airdrop/              # Protocol interaction farming
    liquidation/          # Health factor monitoring + liquidation
    arbitrage/            # Cross-DEX spread detection
  monitoring/
    api.js                # Fastify REST API (8 endpoints)
    telegram.js           # Push/pull Telegram notifications
  dashboard/              # React 19 + Vite + Tailwind + Recharts
  prompts/                # Brain prompt templates
  scripts/
    setup-wallets.js      # Generate encrypted wallets
    paper-trade.js        # Paper trading mode
  data/
    migrations/           # SQLite schema migrations
  darwin.js               # Entry point
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DARWIN_WALLET_PASSPHRASE` | Yes | Passphrase to encrypt/decrypt wallet files (>= 12 chars) |
| `TELEGRAM_TOKEN` | For notifications | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | For notifications | Your Telegram chat ID |
| `POLYMARKET_API_KEY` | Optional | Polymarket CLOB API access for prediction strategy |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |

---

## Running Tests

```bash
npm test                                    # All tests (~116)
npx vitest run tests/core/                  # Core modules
npx vitest run tests/strategies/            # Strategy tests
npx vitest run tests/monitoring/            # API + Telegram
npx vitest run tests/chains/               # Chain adapters
npx vitest run tests/scripts/              # Setup scripts
npx vitest run --reporter verbose           # Verbose output
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22 (ES modules) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Solana | @solana/web3.js + Jupiter V6 + Jito |
| EVM | ethers v6 + Uniswap V3 + Aave V3 + Flashbots |
| API | Fastify 5 |
| Notifications | node-telegram-bot-api |
| Validation | zod |
| Logging | pino + pino-roll |
| Dashboard | React 19 + Vite 6 + Tailwind CSS + Recharts |
| Testing | Vitest |

---

## Disclaimer

This is an experimental project. Trading cryptocurrency involves significant risk of financial loss. Darwin is designed as a learning exercise in autonomous agent design — it is not financial advice and comes with no guarantees. Use at your own risk, and never risk money you can't afford to lose.

---

## License

MIT

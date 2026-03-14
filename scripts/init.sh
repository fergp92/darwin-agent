#!/bin/bash
# Darwin Agent — First-time setup script
# Usage: ./scripts/init.sh
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  Darwin Agent — First-Time Setup"
echo "============================================"
echo ""

# 1. Check .env exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}No .env file found. Creating from template...${NC}"
  cp .env.example .env
  echo -e "${GREEN}.env created.${NC} Edit it with your values before running."
  echo ""
fi

# 2. Check DARWIN_WALLET_PASSPHRASE
source .env 2>/dev/null || true
if [ -z "$DARWIN_WALLET_PASSPHRASE" ] || [ "$DARWIN_WALLET_PASSPHRASE" = "your-secure-passphrase-min-12-chars" ]; then
  echo -e "${RED}ERROR: Set DARWIN_WALLET_PASSPHRASE in .env (>= 12 chars)${NC}"
  echo "Edit .env and re-run this script."
  exit 1
fi

echo -e "${GREEN}1/4${NC} Environment variables loaded"

# 3. Build containers
echo ""
echo -e "${YELLOW}2/4${NC} Building Docker images (this may take a few minutes)..."
docker compose build --quiet

echo -e "${GREEN}2/4${NC} Images built"

# 4. Generate wallets if they don't exist
echo ""
WALLET_COUNT=$(docker compose run --rm -T darwin sh -c "ls /app/wallets/*.enc 2>/dev/null | wc -l")
if [ "$WALLET_COUNT" -gt 0 ]; then
  echo -e "${GREEN}3/4${NC} Wallets already exist (${WALLET_COUNT} files). Skipping generation."
else
  echo -e "${YELLOW}3/4${NC} Generating encrypted wallets..."
  docker compose run --rm -T darwin node scripts/setup-wallets.js
  echo -e "${GREEN}3/4${NC} Wallets generated. Fund the addresses above before starting."
fi

# 5. Start services
echo ""
echo -e "${YELLOW}4/4${NC} Starting Darwin..."
docker compose up -d

echo ""
echo "============================================"
echo -e "  ${GREEN}Darwin is running!${NC}"
echo "============================================"
echo ""
echo "  Dashboard:  http://localhost:7760"
echo "  API:        http://localhost:7761/api/health"
echo ""
echo "  Logs:       docker compose logs -f darwin"
echo "  Stop:       docker compose down"
echo ""

# Check health
sleep 3
HEALTH=$(curl -s http://localhost:7761/api/health 2>/dev/null || echo "waiting...")
echo "  Health:     ${HEALTH}"
echo ""

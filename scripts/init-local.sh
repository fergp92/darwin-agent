#!/bin/bash
# Darwin Agent — Local setup (no Docker)
# Usage: ./scripts/init-local.sh
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "============================================"
echo "  Darwin Agent — Local Setup (no Docker)"
echo "============================================"
echo ""

# 1. Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 22 ]; then
  echo -e "${RED}ERROR: Node.js 22+ required. Current: $(node -v 2>/dev/null || echo 'not found')${NC}"
  exit 1
fi
echo -e "${GREEN}1/5${NC} Node.js $(node -v) detected"

# 2. Install dependencies
echo ""
echo -e "${YELLOW}2/5${NC} Installing dependencies..."
npm install --silent
cd dashboard && npm install --silent && cd ..
echo -e "${GREEN}2/5${NC} Dependencies installed"

# 3. Check .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}3/5${NC} Created .env from template. Edit it with your values."
else
  echo -e "${GREEN}3/5${NC} .env exists"
fi

source .env 2>/dev/null || true
if [ -z "$DARWIN_WALLET_PASSPHRASE" ] || [ "$DARWIN_WALLET_PASSPHRASE" = "your-secure-passphrase-min-12-chars" ]; then
  echo -e "${RED}Set DARWIN_WALLET_PASSPHRASE in .env (>= 12 chars), then re-run.${NC}"
  exit 1
fi

# 4. Generate wallets
echo ""
if ls wallets/*.enc 1>/dev/null 2>&1; then
  echo -e "${GREEN}4/5${NC} Wallets already exist. Skipping."
else
  echo -e "${YELLOW}4/5${NC} Generating wallets..."
  node scripts/setup-wallets.js
  echo -e "${GREEN}4/5${NC} Wallets generated. Fund the addresses above."
fi

# 5. Create data directory
mkdir -p data logs
echo -e "${GREEN}5/5${NC} Data directories ready"

echo ""
echo "============================================"
echo -e "  ${GREEN}Setup complete!${NC}"
echo "============================================"
echo ""
echo "  Paper trade:  npm run paper"
echo "  Production:   npm start"
echo "  Dashboard:    cd dashboard && npm run dev"
echo "  Tests:        npm test"
echo ""

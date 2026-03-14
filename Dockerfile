# Darwin Autonomous Trading Agent
# Multi-stage build: build dashboard → production image

# --- Stage 1: Build dashboard ---
FROM node:22-slim AS dashboard-build

WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# --- Stage 2: Production ---
FROM node:22-slim AS production

# better-sqlite3 needs build tools for native compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application code
COPY core/ ./core/
COPY chains/ ./chains/
COPY strategies/ ./strategies/
COPY monitoring/ ./monitoring/
COPY prompts/ ./prompts/
COPY scripts/ ./scripts/
COPY config/ ./config/
COPY data/ ./data/
COPY darwin.js ./

# Copy built dashboard
COPY --from=dashboard-build /app/dashboard/dist ./dashboard/dist

# Create directories for persistent data
RUN mkdir -p /app/data /app/wallets /app/logs

# Non-root user for security
RUN groupadd -r darwin && useradd -r -g darwin -d /app darwin \
    && chown -R darwin:darwin /app
USER darwin

# Expose API port
EXPOSE 7761

# Health check against the API
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:7761/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Default command
CMD ["node", "darwin.js"]

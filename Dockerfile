FROM node:20-slim

# Install PM2 globally
RUN npm install -g pm2 openclaw

# Create app directory
WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source
COPY ecosystem.docker.config.js ecosystem.config.js
COPY hermes-interactive.js hermes-bot.js gaius-hermes-responder.js gaius-request-watcher.js ./
COPY src/ ./src/
COPY FRAMEWORK-GROUNDSMAN.md ./

# Create data directory for persistent state
RUN mkdir -p /data /app/data /app/logs /app/memory /app/patterns /app/output

# Symlink data paths to /data volume for persistence
RUN ln -sf /data/channel-cache.json /app/data/channel-cache.json \
    && ln -sf /data/state /app/state \
    && mkdir -p /data/state /data/logs

# Non-root user for security
RUN groupadd -r hermes && useradd -r -g hermes -d /app hermes \
    && chown -R hermes:hermes /app /data

USER hermes

# No ports exposed — Slack uses outbound API, iMessage requires host bridge
# EXPOSE none

# Health check via PM2
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD pm2 ping || exit 1

# Start all processes via PM2 (no-daemon keeps container alive)
CMD ["pm2-runtime", "ecosystem.config.js"]

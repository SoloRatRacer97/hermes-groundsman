#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <client-name>"
    echo "Example: $0 groundsman-landscaping"
    exit 1
fi

CLIENT_NAME="$1"
CLIENT_DIR="${PROJECT_ROOT}/clients/${CLIENT_NAME}"

if [ -d "$CLIENT_DIR" ]; then
    echo "Error: Client directory already exists: ${CLIENT_DIR}"
    exit 1
fi

echo "Creating client deployment: ${CLIENT_NAME}"
mkdir -p "${CLIENT_DIR}"

# Generate docker-compose.yml for this client
cat > "${CLIENT_DIR}/docker-compose.yml" << 'COMPOSE'
version: "3.8"

services:
  hermes-groundsman:
    build:
      context: ../../
      dockerfile: Dockerfile
    container_name: hermes-${CLIENT_NAME:-groundsman}
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - GROUNDSMAN_MODE=true
    volumes:
      - hermes-data:/data
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
    networks:
      - hermes-isolated
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true

networks:
  hermes-isolated:
    driver: bridge
    internal: true

volumes:
  hermes-data:
    driver: local
COMPOSE

# Patch container name with actual client name
sed -i '' "s/\${CLIENT_NAME:-groundsman}/${CLIENT_NAME}/g" "${CLIENT_DIR}/docker-compose.yml" 2>/dev/null || \
sed -i "s/\${CLIENT_NAME:-groundsman}/${CLIENT_NAME}/g" "${CLIENT_DIR}/docker-compose.yml"

# Copy env template
cp "${PROJECT_ROOT}/.env.template" "${CLIENT_DIR}/.env"

# Copy framework as starting point for customization
cp "${PROJECT_ROOT}/FRAMEWORK-GROUNDSMAN.md" "${CLIENT_DIR}/FRAMEWORK.md"

echo ""
echo "========================================"
echo " Client created: ${CLIENT_NAME}"
echo "========================================"
echo ""
echo "Directory: ${CLIENT_DIR}"
echo ""
echo "Next steps:"
echo "  1. Edit ${CLIENT_DIR}/.env with client credentials:"
echo "     - ANTHROPIC_API_KEY"
echo "     - SLACK_BOT_TOKEN and SLACK_APP_TOKEN"
echo "     - COMPANY_NAME"
echo "     - TWILIO credentials (if using SMS)"
echo ""
echo "  2. Customize ${CLIENT_DIR}/FRAMEWORK.md for this client"
echo ""
echo "  3. Start the client:"
echo "     cd ${CLIENT_DIR} && docker compose up -d"
echo ""
echo "  Or use: scripts/start-client.sh ${CLIENT_NAME}"
echo ""

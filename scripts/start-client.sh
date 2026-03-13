#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <client-name>"
    echo ""
    echo "Available clients:"
    if [ -d "${PROJECT_ROOT}/clients" ]; then
        ls -1 "${PROJECT_ROOT}/clients/" 2>/dev/null || echo "  (none)"
    else
        echo "  (none)"
    fi
    exit 1
fi

CLIENT_NAME="$1"
CLIENT_DIR="${PROJECT_ROOT}/clients/${CLIENT_NAME}"

if [ ! -d "$CLIENT_DIR" ]; then
    echo "Error: Client not found: ${CLIENT_NAME}"
    echo "Run scripts/add-client.sh ${CLIENT_NAME} first."
    exit 1
fi

if [ ! -f "${CLIENT_DIR}/.env" ]; then
    echo "Error: .env file missing in ${CLIENT_DIR}"
    exit 1
fi

echo "Starting Hermes Groundsman for: ${CLIENT_NAME}"
cd "${CLIENT_DIR}"
docker compose up -d --build

echo ""
echo "Container started. Check logs with:"
echo "  cd ${CLIENT_DIR} && docker compose logs -f"

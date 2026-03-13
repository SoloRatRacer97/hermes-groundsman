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
    exit 1
fi

echo "Stopping Hermes Groundsman for: ${CLIENT_NAME}"
cd "${CLIENT_DIR}"
docker compose down

echo "Stopped. Data volume preserved."

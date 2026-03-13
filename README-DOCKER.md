# Hermes Groundsman — Docker Deployment

Per-client containerized deployment of Hermes Groundsman.

## Architecture

Each client runs in an isolated Docker container with:
- Its own Anthropic API key (direct calls, no shared routing)
- Its own Slack bot credentials
- Its own OpenClaw instance
- Isolated network (no host access, no cross-container access)
- Persistent data volume at `/data`
- Resource limits: 256MB RAM, 0.5 CPU

## Quick Start

```bash
# 1. Add a new client
./scripts/add-client.sh acme-landscaping

# 2. Configure credentials
vi clients/acme-landscaping/.env

# 3. Start
./scripts/start-client.sh acme-landscaping

# 4. Check logs
cd clients/acme-landscaping && docker compose logs -f

# 5. Stop
./scripts/stop-client.sh acme-landscaping
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for this client |
| `SLACK_BOT_TOKEN` | Yes | Slack bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Yes | Slack app-level token (`xapp-...`) |
| `SLACK_CHANNEL_NAME` | Yes | Slack channel to monitor (default: `new-leads`) |
| `COMPANY_NAME` | Yes | Client business name |
| `SERVICE_AREA_ZIPS` | No | Zip code range for service area |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID for SMS |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio phone number |

## Security Model

- **Isolated network**: Containers use a bridge network with `internal: true` — no outbound internet access except through explicitly allowed APIs (Slack, Anthropic, Twilio).
- **Read-only filesystem**: Container root is mounted read-only. Only `/data` (volume) and `/tmp` (tmpfs) are writable.
- **No privilege escalation**: `no-new-privileges` security option enabled.
- **Non-root user**: Application runs as `hermes` user inside the container.
- **No host filesystem access**: Only the named Docker volume is mounted.
- **Per-client API keys**: Each container has its own credentials. No shared secrets.

## iMessage Limitation

iMessage sending requires macOS `osascript`, which is not available inside a Linux Docker container. For deployments that need iMessage:

**Option A: SMS-only (recommended for Docker)**
Configure Twilio credentials and use SMS exclusively.

**Option B: iMessage Bridge (future)**
Run a lightweight HTTP bridge on the host Mac that accepts `POST {phone, text}` and calls `osascript`. The container would call this bridge for iMessage delivery. This bridge is not yet implemented — for now, Docker deployments should use SMS via Twilio.

**Option C: Run natively on macOS**
For iMessage support, run Hermes directly on macOS using PM2 (no Docker).

## Managing Clients

```bash
# List all clients
ls clients/

# View logs
cd clients/<name> && docker compose logs -f

# Restart
cd clients/<name> && docker compose restart

# Rebuild after code changes
cd clients/<name> && docker compose up -d --build

# Remove client (preserves data volume)
cd clients/<name> && docker compose down

# Remove client AND data
cd clients/<name> && docker compose down -v
```

## File Structure

```
hermes-groundsman/
├── Dockerfile                    # Container image definition
├── docker-compose.yml            # Root compose (for single-client use)
├── ecosystem.docker.config.js    # PM2 config for container
├── .env.template                 # Environment variable template
├── .dockerignore                 # Build exclusions
├── scripts/
│   ├── add-client.sh             # Create new client deployment
│   ├── start-client.sh           # Start a client container
│   └── stop-client.sh            # Stop a client container
└── clients/
    └── <client-name>/
        ├── docker-compose.yml    # Client-specific compose
        ├── .env                  # Client credentials
        └── FRAMEWORK.md          # Customized decision framework
```

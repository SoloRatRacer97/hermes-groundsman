'use strict';

const http = require('node:http');
const { WebClient } = require('@slack/web-api');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const leadSchema = require('./schema/lead.json');

// --- Configuration -----------------------------------------------------------

const PORT = Number(process.env.PORT) || 3099;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30_000;
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR) || 20;
const CRM_ADAPTER = process.env.CRM_ADAPTER || 'webhook';
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const SLACK_READ_TOKEN = process.env.SLACK_READ_TOKEN;

// --- JSON Schema Validator ---------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validateLead = ajv.compile(leadSchema);

// --- Rate Limiter ------------------------------------------------------------

const writeTimestamps = [];

function isRateLimited() {
  const oneHourAgo = Date.now() - 3_600_000;
  // Prune old entries
  while (writeTimestamps.length && writeTimestamps[0] < oneHourAgo) {
    writeTimestamps.shift();
  }
  return writeTimestamps.length >= RATE_LIMIT_PER_HOUR;
}

function recordWrite() {
  writeTimestamps.push(Date.now());
}

// --- CRM Adapter Loader -----------------------------------------------------

function loadAdapter() {
  const adapterMap = {
    webhook: './adapters/webhook',
    gohighlevel: './adapters/gohighlevel',
    hubspot: './adapters/hubspot',
  };

  const adapterPath = adapterMap[CRM_ADAPTER];
  if (!adapterPath) {
    throw new Error(`Unknown CRM_ADAPTER: ${CRM_ADAPTER}. Must be one of: ${Object.keys(adapterMap).join(', ')}`);
  }

  const Adapter = require(adapterPath);
  return new Adapter({
    url: process.env.CRM_WEBHOOK_URL,
    apiKey: process.env.CRM_API_KEY,
  });
}

// --- Logging -----------------------------------------------------------------

function log(level, msg, data) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(data && { data }),
  };
  console.log(JSON.stringify(entry));
}

// --- Slack Poller ------------------------------------------------------------

const LEAD_BLOCK_RE = /```lead\s*\n([\s\S]*?)```/;

function parseLeadFromMessage(text) {
  const match = text.match(LEAD_BLOCK_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function pollSlack(slack, adapter, state) {
  try {
    const params = {
      channel: SLACK_CHANNEL_ID,
      limit: 50,
    };
    if (state.lastTs) {
      params.oldest = state.lastTs;
    }

    const result = await slack.conversations.history(params);
    if (!result.ok || !result.messages?.length) return;

    // Process oldest-first
    const messages = result.messages.slice().reverse();

    for (const msg of messages) {
      // Skip already-processed
      if (msg.ts <= (state.lastTs || '0')) continue;

      // Check thread replies for lead blocks
      const textsToCheck = [msg.text || ''];

      if (msg.reply_count > 0) {
        try {
          const thread = await slack.conversations.replies({
            channel: SLACK_CHANNEL_ID,
            ts: msg.ts,
            limit: 100,
          });
          if (thread.ok && thread.messages) {
            for (const reply of thread.messages) {
              if (reply.ts !== msg.ts) {
                textsToCheck.push(reply.text || '');
              }
            }
          }
        } catch (err) {
          log('warn', 'Failed to fetch thread replies', { ts: msg.ts, error: err.message });
        }
      }

      for (const text of textsToCheck) {
        const lead = parseLeadFromMessage(text);
        if (!lead) continue;

        // Validate
        const valid = validateLead(lead);
        if (!valid) {
          log('warn', 'Lead rejected: schema validation failed', {
            errors: validateLead.errors,
            payload: lead,
          });
          continue;
        }

        // Rate limit
        if (isRateLimited()) {
          log('warn', 'Lead rejected: rate limit exceeded', { lead: lead.name });
          continue;
        }

        // Push to CRM
        try {
          const result = await adapter.create(lead);
          recordWrite();
          log('info', 'Lead synced to CRM', {
            name: lead.name,
            adapter: CRM_ADAPTER,
            crmId: result.id,
          });
        } catch (err) {
          log('error', 'CRM write failed', {
            name: lead.name,
            adapter: CRM_ADAPTER,
            error: err.message,
          });
        }
      }

      state.lastTs = msg.ts;
    }
  } catch (err) {
    log('error', 'Slack poll failed', { error: err.message });
  }
}

// --- Health Check Server -----------------------------------------------------

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        adapter: CRM_ADAPTER,
        uptimeSeconds: Math.floor(process.uptime()),
        writesLastHour: writeTimestamps.filter(t => t > Date.now() - 3_600_000).length,
        rateLimitPerHour: RATE_LIMIT_PER_HOUR,
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, () => {
    log('info', `CRM sync service started on port ${PORT}`, { adapter: CRM_ADAPTER });
  });

  return server;
}

// --- Main --------------------------------------------------------------------

function main() {
  if (!SLACK_READ_TOKEN) {
    log('error', 'SLACK_READ_TOKEN is required');
    process.exit(1);
  }
  if (!SLACK_CHANNEL_ID) {
    log('error', 'SLACK_CHANNEL_ID is required');
    process.exit(1);
  }

  const adapter = loadAdapter();
  const slack = new WebClient(SLACK_READ_TOKEN);
  const state = { lastTs: null };

  startServer();

  // Initial poll then interval
  pollSlack(slack, adapter, state);
  setInterval(() => pollSlack(slack, adapter, state), POLL_INTERVAL_MS);

  log('info', 'Polling started', { intervalMs: POLL_INTERVAL_MS, channel: SLACK_CHANNEL_ID });
}

main();

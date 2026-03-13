#!/usr/bin/env node

/**
 * Gaius Request Watcher
 * Watches .gaius-requests/ for new .json files and processes them
 * using `openclaw agent` to generate responses via the Gateway.
 * 
 * Replaces the 15-second cron job poller, saving massive token usage.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const os = require('os');
const chokidar = require('chokidar');

const REQUESTS_DIR = path.join(__dirname, process.env.REQUESTS_DIR || 'shared-requests');
const RESPONSES_DIR = path.join(__dirname, process.env.RESPONSES_DIR || 'shared-responses');
const PROCESSING = new Set();

// Ensure dirs exist
[REQUESTS_DIR, RESPONSES_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

function log(msg) {
  console.log(`[${new Date().toISOString()}] [watcher] ${msg}`);
}

// Map modelOverride values to openclaw agent IDs
const TIER_AGENT_MAP = {
  'claude-haiku-3-5': 'hermes-t1',
  'claude-haiku-4-5': 'hermes-t1',
  'claude-haiku-4-5-20251001': 'hermes-t1',
  'claude-sonnet-4': 'hermes-t2',
  'claude-sonnet-4-20250514': 'hermes-t2',
};
const DEFAULT_AGENT = 'hermes-t2'; // Sonnet by default

function generateResponse(prompt, agentId, attempt = 1) {
  // Write prompt to temp file to avoid ARG_MAX limits (prompts can be 15k+ chars)
  const tmpFile = path.join(os.tmpdir(), `hermes-prompt-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf8');

  try {
    // Use shell to read prompt from temp file via $() substitution
    const sessionId = `hermes-resp-${Date.now()}`;
    const agentFlag = agentId ? ` --agent ${agentId}` : '';
    const result = spawnSync('/bin/sh', [
      '-c',
      `/opt/homebrew/bin/openclaw agent -m "$(cat '${tmpFile}')" --session-id "${sessionId}" --thinking off --timeout 90${agentFlag}`
    ], {
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' }
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`openclaw agent exit ${result.status}: ${(result.stderr || '').slice(0, 500)}`);
    }

    const output = (result.stdout || '').trim();
    if (!output) throw new Error('Empty response from openclaw agent');
    return output;
  } catch (err) {
    if (attempt < 2) {
      log(`Attempt ${attempt} failed (${err.message}), retrying...`);
      return generateResponse(prompt, agentId, attempt + 1);
    }
    throw err;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  }
}

async function processRequest(filePath) {
  const basename = path.basename(filePath);
  if (!basename.endsWith('.json') || basename.startsWith('.')) return;

  const requestId = basename.replace('.json', '');
  if (PROCESSING.has(requestId)) return;
  PROCESSING.add(requestId);

  log(`Processing ${requestId}...`);

  try {
    if (!fs.existsSync(filePath)) { PROCESSING.delete(requestId); return; }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const prompt = data.prompt;

    if (!prompt) {
      log(`${requestId}: No prompt field, skipping`);
      PROCESSING.delete(requestId);
      return;
    }

    // Resolve agent based on modelOverride from tier router
    const modelOverride = data.modelOverride || null;
    const agentId = modelOverride ? (TIER_AGENT_MAP[modelOverride] || DEFAULT_AGENT) : DEFAULT_AGENT;
    log(`${requestId}: Calling openclaw agent --agent ${agentId} (model: ${modelOverride || 'default'}, ${prompt.length} chars)...`);
    const response = generateResponse(prompt, agentId);

    // Write response
    const responseFile = path.join(RESPONSES_DIR, `${requestId}.txt`);
    fs.writeFileSync(responseFile, response, 'utf8');
    log(`${requestId}: ✅ Response written (${response.length} chars): "${response.substring(0, 100)}"`);

    // Delete request file
    try { fs.unlinkSync(filePath); } catch (e) { /* already gone */ }
    log(`${requestId}: Request file cleaned up`);

  } catch (err) {
    log(`${requestId}: ERROR - ${err.message}`);
  } finally {
    PROCESSING.delete(requestId);
  }
}

// Process existing requests on startup
function processExisting() {
  try {
    const files = fs.readdirSync(REQUESTS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('.'));
    if (files.length > 0) {
      log(`Found ${files.length} existing request(s), processing...`);
      files.forEach(f => processRequest(path.join(REQUESTS_DIR, f)));
    }
  } catch (e) {
    log(`Error scanning existing: ${e.message}`);
  }
}

// Start watcher
log('Starting file watcher on ' + REQUESTS_DIR);

const watcher = chokidar.watch(REQUESTS_DIR, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  depth: 0
});

watcher.on('add', (filePath) => {
  if (filePath.endsWith('.json') && !path.basename(filePath).startsWith('.')) {
    log(`New file detected: ${path.basename(filePath)}`);
    processRequest(filePath);
  }
});

watcher.on('error', (err) => log(`Watcher error: ${err.message}`));

watcher.on('ready', () => {
  log('Watcher ready. Engine: openclaw agent via gateway (tiered: hermes-t1=Haiku, hermes-t2=Sonnet)');
  processExisting();
});

process.on('SIGINT', () => { log('Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { log('Shutting down...'); process.exit(0); });

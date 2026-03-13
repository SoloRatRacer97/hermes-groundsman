/**
 * iMessage Bridge — lightweight HTTP server for sending iMessages via osascript.
 * Runs natively on macOS (NOT in Docker). Docker containers POST here to send.
 *
 * Auth: requires X-Bridge-Token header matching BRIDGE_TOKEN env var.
 * Rate limit: 60 sends/minute.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.BRIDGE_PORT || 3098;
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;

if (!BRIDGE_TOKEN) {
  console.error('[bridge] BRIDGE_TOKEN env var is required');
  process.exit(1);
}

app.use(express.json());

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers['x-bridge-token'];
  if (!token || token !== BRIDGE_TOKEN) {
    console.warn(`[bridge] ❌ Unauthorized request from ${req.ip}`);
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// --- Rate limiter: 60 sends per minute ---
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded (60/min)' },
});

// --- Validation ---
const E164_RE = /^\+1\d{10}$/;

function validateSendBody(body) {
  const { phone, text } = body || {};
  if (!phone || typeof phone !== 'string' || !E164_RE.test(phone)) {
    return 'Invalid phone: must be E.164 format (+1XXXXXXXXXX)';
  }
  if (!text || typeof text !== 'string') {
    return 'Invalid text: must be a non-empty string';
  }
  if (text.length < 1 || text.length > 1600) {
    return 'Invalid text: must be 1-1600 characters';
  }
  // Block script injection patterns
  if (/<script/i.test(text) || /javascript:/i.test(text)) {
    return 'Invalid text: contains disallowed content';
  }
  return null;
}

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'imessage-bridge', uptime: process.uptime() });
});

// --- Send endpoint ---
app.post('/send', authMiddleware, sendLimiter, (req, res) => {
  const validationError = validateSendBody(req.body);
  if (validationError) {
    console.warn(`[bridge] ❌ Validation failed: ${validationError}`);
    return res.status(400).json({ success: false, error: validationError });
  }

  const { phone, text } = req.body;
  const maskedPhone = phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);

  // Build osascript command to send via Messages.app
  const appleScript = `tell application "Messages" to send "${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" to buddy "${phone}" of (1st account whose service type = iMessage)`;

  console.log(`[bridge] 📱 Sending to ${maskedPhone} (${text.length} chars)`);

  execFile('osascript', ['-e', appleScript], { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[bridge] ❌ Send failed to ${maskedPhone}: ${error.message}`);
      return res.status(500).json({ success: false, error: `osascript failed: ${error.message}` });
    }

    const sentAt = new Date().toISOString();
    console.log(`[bridge] ✅ Sent to ${maskedPhone} at ${sentAt}`);
    res.json({ success: true, phone, sentAt });
  });
});

// --- Poll endpoint: read recent messages from a phone number ---
app.get('/poll', authMiddleware, (req, res) => {
  const { phone, since } = req.query;
  if (!phone || !E164_RE.test(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone param' });
  }
  
  const sinceTs = since ? parseInt(since) : Math.floor(Date.now() / 1000) - 300; // default last 5 min
  const db = require('path').join(process.env.HOME, 'Library/Messages/chat.db');
  const sqlite3 = require('child_process');
  
  // Query chat.db for recent inbound messages from this phone
  const query = `SELECT m.text, m.date/1000000000 + 978307200 as unix_ts, m.is_from_me 
    FROM message m 
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id 
    JOIN chat c ON cmj.chat_id = c.ROWID 
    WHERE c.chat_identifier = '${phone}' 
    AND m.is_from_me = 0 
    AND (m.date/1000000000 + 978307200) > ${sinceTs}
    ORDER BY m.date DESC LIMIT 5`;
  
  sqlite3.execFile('sqlite3', ['-json', db, query], { timeout: 5000 }, (error, stdout) => {
    if (error) {
      console.error(`[bridge] ❌ Poll failed: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
    try {
      const messages = stdout.trim() ? JSON.parse(stdout) : [];
      res.json({ success: true, phone, messages });
    } catch (e) {
      res.json({ success: true, phone, messages: [] });
    }
  });
});

app.listen(PORT, () => {
  console.log(`[bridge] iMessage Bridge listening on port ${PORT}`);
  console.log(`[bridge] Auth: X-Bridge-Token required`);
  console.log(`[bridge] Rate limit: 60 sends/min`);
});

/**
 * iMessage Adapter
 * Handles sending/receiving iMessages via imsg CLI
 * Uses execFileSync (no shell injection) for all CLI calls
 */

const { execFileSync } = require('child_process');

const IMSG_BIN = '/opt/homebrew/bin/imsg';
const phoneToChatId = new Map();

// Bridge mode: when IMESSAGE_BRIDGE_URL is set, POST to HTTP bridge instead of local CLI
const BRIDGE_URL = process.env.IMESSAGE_BRIDGE_URL || '';
const BRIDGE_TOKEN = process.env.IMESSAGE_BRIDGE_TOKEN || '';

/**
 * Send iMessage via imsg CLI (safe from shell injection)
 * @param {string} phone - Recipient phone number
 * @param {string} text - Message text
 * @param {object} opts - { maskPhone, alertSlack } helper functions
 * @returns {boolean} Success
 */
async function sendIMessage(phone, text, opts = {}) {
  try {
    text = text.replace(/\[TRANSFER\]/gi, '').replace(/\[CONTINUE\]/gi, '').replace(/\[COMPLETE\]/gi, '').trim();
    
    // Block single-word status responses that aren't human conversation
    const STATUS_WORDS = /^(completed|complete|done|noted|acknowledged|received|transferred|closed|resolved|finished)\.?$/i;
    if (STATUS_WORDS.test(text)) {
      console.log(`[iMessage] 📱 Blocked status-word response: "${text}"`);
      return true;
    }
    
    // Block error/system messages from reaching leads
    if (text.includes('API rate limit') || text.includes('⚠️') || text.includes('try again later') || text.includes('error') || text.startsWith('[')) {
      console.log(`[iMessage] 📱 Blocked system/error message: "${text.substring(0, 50)}"`);
      return true;
    }

    const logPhone = opts.maskPhone ? opts.maskPhone(phone) : phone;
    console.log(`[iMessage] 📱 Sending to ${logPhone}`);

    if (BRIDGE_URL) {
      // Bridge mode: POST to HTTP bridge (used when running in Docker)
      const res = await fetch(`${BRIDGE_URL}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Token': BRIDGE_TOKEN,
        },
        body: JSON.stringify({ phone, text }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Bridge send failed');
      console.log(`[iMessage] 📱 Sent via bridge at ${data.sentAt}`);
    } else {
      // Direct mode: use local imsg CLI (native macOS)
      execFileSync(IMSG_BIN, ['send', '--to', phone, '--text', text], { timeout: 15000 });
      console.log(`[iMessage] 📱 Sent successfully`);
    }
    return true;
  } catch (error) {
    console.error(`[iMessage] 📱 Send failed:`, error.message);
    if (opts.alertSlack) {
      const logPhone = opts.maskPhone ? opts.maskPhone(phone) : phone;
      opts.alertSlack(`📱❌ iMessage send failed to ${logPhone}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Format phone number for imsg (ensure +prefix)
 * @param {string} phone - Raw phone number
 * @returns {string|null} Formatted phone or null
 */
function formatPhone(phone) {
  if (!phone || phone === 'Unknown') return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 10) return null;
  return '+' + digits;
}

/**
 * Look up imsg chat-id for a phone number
 * @param {string} phone - Phone number
 * @returns {number|null} Chat ID or null
 */
function getChatIdForPhone(phone) {
  if (phoneToChatId.has(phone)) return phoneToChatId.get(phone);
  try {
    const output = execFileSync(IMSG_BIN, ['chats', '--json'], { timeout: 10000, encoding: 'utf8' });
    const lines = output.trim().split('\n').filter(l => l.trim());
    for (const line of lines) {
      const chat = JSON.parse(line);
      if (chat.identifier === phone || chat.identifier === phone.replace('+', '')) {
        phoneToChatId.set(phone, chat.id);
        return chat.id;
      }
    }
  } catch (e) {
    console.error(`[iMessage] 📱 Failed to look up chat-id:`, e.message);
  }
  return null;
}

/**
 * Get recent iMessage history for a phone number
 * @param {string} phone - Phone number
 * @param {number} limit - Max messages to fetch
 * @returns {Array} Messages
 */
async function getIMessageHistory(phone, limit = 5) {
  // Bridge mode: poll via HTTP
  if (BRIDGE_URL) {
    try {
      const since = Math.floor(Date.now() / 1000) - 600; // last 10 min
      const url = `${BRIDGE_URL}/poll?phone=${encodeURIComponent(phone)}&since=${since}`;
      const resp = await fetch(url, { headers: { 'X-Bridge-Token': BRIDGE_TOKEN }, signal: AbortSignal.timeout(10000) });
      const data = await resp.json();
      if (!data.success || !data.messages) return [];
      return data.messages.map((m, i) => ({
        id: m.unix_ts || (since + i),
        text: m.text,
        is_from_me: false,
        fromMe: false
      }));
    } catch (error) {
      console.error(`[iMessage] 📱 Bridge poll failed:`, error.message);
      return [];
    }
  }
  
  // Direct mode: use imsg CLI
  try {
    const chatId = getChatIdForPhone(phone);
    if (!chatId) return [];
    const output = execFileSync(IMSG_BIN, ['history', '--chat-id', String(chatId), '--limit', String(limit), '--json'], { timeout: 10000, encoding: 'utf8' });
    const lines = output.trim().split('\n').filter(l => l.trim());
    return lines.map(l => JSON.parse(l));
  } catch (error) {
    if (!error.message.includes('No chat found')) {
      console.error(`[iMessage] 📱 History fetch failed:`, error.message);
    }
    return [];
  }
}

module.exports = { sendIMessage, formatPhone, getChatIdForPhone, getIMessageHistory };

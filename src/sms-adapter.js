/**
 * SMS Adapter — Twilio SMS Fallback for Hermes
 * Sends SMS via Twilio when iMessage is unavailable.
 */

const { defaultAuditLog } = require('./security-audit-log');
const { checkRateLimit } = require('./rate-limiter');

let twilioClient = null;

function _getClient() {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  const twilio = require('twilio');
  twilioClient = twilio(sid, token);
  return twilioClient;
}

/**
 * Check if Twilio credentials are configured
 */
function canSendSMS() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

/**
 * Send an SMS via Twilio
 * @param {string} to - Recipient phone number (E.164 format)
 * @param {string} body - Message text
 * @returns {Promise<string|null>} Message SID on success, null on failure
 */
async function sendSMS(to, body) {
  if (!canSendSMS()) {
    console.error('[SMS] ❌ Twilio credentials not configured');
    return null;
  }

  // Rate limit check
  const rateCheck = checkRateLimit(to, null);
  if (!rateCheck.allowed) {
    console.warn(`[SMS] ⚠️ Rate limited: ${rateCheck.reason}`);
    defaultAuditLog.logRateLimit({ phone: to, reason: rateCheck.reason, blocked: true });
    return null;
  }

  try {
    const client = _getClient();
    if (!client) {
      console.error('[SMS] ❌ Failed to initialize Twilio client');
      return null;
    }

    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    console.log(`[SMS] ✅ Sent to ${to.slice(-4).padStart(to.length, '*')} — SID: ${message.sid}`);

    // Audit log
    defaultAuditLog._write({
      type: 'sms_send',
      phone: to.slice(-4).padStart(to.length, '*'),
      sid: message.sid,
      bodyLength: body.length,
      status: 'success',
    });

    return message.sid;
  } catch (error) {
    const errCode = error.code || 'UNKNOWN';
    const errMsg = error.message || 'Unknown error';
    console.error(`[SMS] ❌ Send failed (${errCode}): ${errMsg}`);

    defaultAuditLog._write({
      type: 'sms_send',
      phone: to.slice(-4).padStart(to.length, '*'),
      bodyLength: body.length,
      status: 'error',
      errorCode: errCode,
      errorMessage: errMsg,
    });

    return null;
  }
}

// Allow resetting client for tests
function _resetClient() {
  twilioClient = null;
}

module.exports = { sendSMS, canSendSMS, _resetClient };

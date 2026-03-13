/**
 * iMessage Delivery Detector
 * Checks Messages.app SQLite DB for delivery confirmation after sending.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const CHAT_DB = path.join(process.env.HOME, 'Library/Messages/chat.db');
const SQLITE_BIN = '/usr/bin/sqlite3';

/**
 * Query the Messages.app SQLite database
 * @param {string} sql - SQL query
 * @returns {string} Raw output
 */
function queryDB(sql) {
  return execFileSync(SQLITE_BIN, [CHAT_DB, '-json', sql], {
    timeout: 5000,
    encoding: 'utf8',
  });
}

/**
 * Parse JSON output from sqlite3 -json
 * @param {string} raw - Raw sqlite3 JSON output
 * @returns {Array<object>}
 */
function parseRows(raw) {
  try {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[]') return [];
    return JSON.parse(trimmed);
  } catch {
    return [];
  }
}

/**
 * Check delivery status of the most recent outbound message to a phone number.
 * Polls the Messages DB until delivery is confirmed or timeout expires.
 *
 * @param {string} phoneNumber - E.164 phone number (e.g. +15551234567)
 * @param {number} timeoutMs - Max ms to wait for delivery (default 10000)
 * @returns {Promise<{delivered: boolean, service: 'imessage'|'sms'|'unknown'}>}
 */
async function checkDelivery(phoneNumber, timeoutMs = 10000) {
  const pollInterval = 1000;
  const deadline = Date.now() + timeoutMs;
  const normalized = phoneNumber.replace('+', '');

  // SQL: find the most recent outbound message to this number
  const sql = `
    SELECT m.is_delivered, m.is_from_me, m.date, m.service,
           h.id AS handle_id_str, h.service AS handle_service
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE h.id LIKE '%${normalized}%'
      AND m.is_from_me = 1
    ORDER BY m.date DESC
    LIMIT 1;
  `.replace(/\n/g, ' ');

  while (Date.now() < deadline) {
    try {
      const raw = queryDB(sql);
      const rows = parseRows(raw);

      if (rows.length > 0) {
        const row = rows[0];
        if (row.is_delivered === 1) {
          const service = (row.service || row.handle_service || '').toLowerCase().includes('imessage')
            ? 'imessage' : 'sms';
          return { delivered: true, service };
        }
      }
    } catch (e) {
      console.error(`[iMessage-Detector] DB query error: ${e.message}`);
    }

    // Wait before next poll
    await new Promise(r => setTimeout(r, pollInterval));
  }

  return { delivered: false, service: 'unknown' };
}

/**
 * Check if we've ever had an iMessage conversation with this number.
 * Queries chat.db for the service type used with this handle.
 *
 * @param {string} phoneNumber - E.164 phone number
 * @returns {boolean} True if iMessage service found for this number
 */
function isIMessageUser(phoneNumber) {
  const normalized = phoneNumber.replace('+', '');
  const sql = `
    SELECT h.service FROM handle h
    WHERE h.id LIKE '%${normalized}%'
    ORDER BY h.ROWID DESC LIMIT 1;
  `.replace(/\n/g, ' ');

  try {
    const raw = queryDB(sql);
    const rows = parseRows(raw);
    if (rows.length > 0) {
      return (rows[0].service || '').toLowerCase().includes('imessage');
    }
  } catch (e) {
    console.error(`[iMessage-Detector] isIMessageUser error: ${e.message}`);
  }
  return false;
}

module.exports = { checkDelivery, isIMessageUser };

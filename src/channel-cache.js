/**
 * Channel Cache — remembers whether a phone number uses iMessage or SMS.
 * In-memory Map backed by a JSON file for persistence across restarts.
 */

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'channel-cache.json');

// In-memory cache: phone → 'imessage' | 'sms'
const cache = new Map();

/**
 * Load cache from disk
 */
function load() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      for (const [k, v] of Object.entries(data)) {
        cache.set(k, v);
      }
      console.log(`[ChannelCache] Loaded ${cache.size} entries`);
    }
  } catch (e) {
    console.error(`[ChannelCache] Load error: ${e.message}`);
  }
}

/**
 * Save cache to disk
 */
function save() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(cache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error(`[ChannelCache] Save error: ${e.message}`);
  }
}

/**
 * Get cached channel for a phone number
 * @param {string} phone
 * @returns {'imessage'|'sms'|null}
 */
function get(phone) {
  return cache.get(phone) || null;
}

/**
 * Set channel for a phone number and persist
 * @param {string} phone
 * @param {'imessage'|'sms'} channel
 */
function set(phone, channel) {
  cache.set(phone, channel);
  save();
}

/**
 * Check if phone is in cache
 * @param {string} phone
 * @returns {boolean}
 */
function has(phone) {
  return cache.has(phone);
}

/**
 * Get all entries (for debugging)
 * @returns {object}
 */
function getAll() {
  return Object.fromEntries(cache);
}

/**
 * Clear cache (for testing)
 */
function clear() {
  cache.clear();
}

// Load on require
load();

module.exports = { get, set, has, getAll, clear, load, save };

/**
 * Rate Limiter — V16.3 Security Hardening
 * Sliding window rate limiting per phone number and IP address.
 * In-memory store with TTL cleanup.
 */

const PHONE_LIMIT = 5;      // max submissions per phone per hour
const IP_LIMIT = 10;         // max submissions per IP per hour
const WINDOW_MS = 60 * 60 * 1000; // 1 hour in ms
const CLEANUP_INTERVAL = 5 * 60 * 1000; // cleanup every 5 minutes

class RateLimiter {
  constructor(options = {}) {
    this.phoneLimit = options.phoneLimit || PHONE_LIMIT;
    this.ipLimit = options.ipLimit || IP_LIMIT;
    this.windowMs = options.windowMs || WINDOW_MS;
    this.phoneStore = new Map(); // phone -> [timestamp, timestamp, ...]
    this.ipStore = new Map();    // ip -> [timestamp, timestamp, ...]
    
    // Start cleanup timer (only in production, not tests)
    if (!options.noCleanup) {
      this._cleanupTimer = setInterval(() => this._cleanup(), options.cleanupInterval || CLEANUP_INTERVAL);
      if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    }
  }

  /**
   * Check if a submission is allowed under rate limits
   * @param {string} phone - Phone number (can be null)
   * @param {string} ip - IP address (can be null)
   * @returns {{ allowed: boolean, reason?: string }}
   */
  checkRateLimit(phone, ip) {
    const now = Date.now();

    // Check phone limit
    if (phone) {
      const phoneTimes = this._getValidTimestamps(this.phoneStore, phone, now);
      if (phoneTimes.length >= this.phoneLimit) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${phoneTimes.length}/${this.phoneLimit} submissions from phone ${phone} in the last hour`
        };
      }
    }

    // Check IP limit
    if (ip) {
      const ipTimes = this._getValidTimestamps(this.ipStore, ip, now);
      if (ipTimes.length >= this.ipLimit) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${ipTimes.length}/${this.ipLimit} submissions from IP ${ip} in the last hour`
        };
      }
    }

    // Record this submission
    if (phone) {
      const phoneTimes = this._getValidTimestamps(this.phoneStore, phone, now);
      phoneTimes.push(now);
      this.phoneStore.set(phone, phoneTimes);
    }
    if (ip) {
      const ipTimes = this._getValidTimestamps(this.ipStore, ip, now);
      ipTimes.push(now);
      this.ipStore.set(ip, ipTimes);
    }

    return { allowed: true };
  }

  /**
   * Get timestamps within the current window
   */
  _getValidTimestamps(store, key, now) {
    const times = store.get(key) || [];
    const valid = times.filter(t => (now - t) < this.windowMs);
    store.set(key, valid);
    return valid;
  }

  /**
   * Cleanup expired entries
   */
  _cleanup() {
    const now = Date.now();
    for (const [key, times] of this.phoneStore) {
      const valid = times.filter(t => (now - t) < this.windowMs);
      if (valid.length === 0) this.phoneStore.delete(key);
      else this.phoneStore.set(key, valid);
    }
    for (const [key, times] of this.ipStore) {
      const valid = times.filter(t => (now - t) < this.windowMs);
      if (valid.length === 0) this.ipStore.delete(key);
      else this.ipStore.set(key, valid);
    }
  }

  /**
   * Reset all rate limit data
   */
  reset() {
    this.phoneStore.clear();
    this.ipStore.clear();
  }

  /**
   * Stop cleanup timer
   */
  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

// Singleton instance
const defaultLimiter = new RateLimiter({ noCleanup: true });

/**
 * Check rate limit using default singleton
 * @param {string} phone
 * @param {string} ip
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkRateLimit(phone, ip) {
  return defaultLimiter.checkRateLimit(phone, ip);
}

module.exports = { RateLimiter, checkRateLimit, defaultLimiter };

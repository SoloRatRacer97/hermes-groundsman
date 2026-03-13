/**
 * Thread Manager
 * Manages active conversation threads, phone→thread mappings,
 * and the unified state between hermes-interactive and StateManager
 *
 * This is the SINGLE SOURCE OF TRUTH for thread/phone state (#5)
 */

const fs = require('fs');
const path = require('path');

/**
 * Atomic file write: temp + rename
 */
function atomicWriteSync(filePath, data) {
  const tmpFile = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, data, 'utf8');
  fs.renameSync(tmpFile, filePath);
}

class ThreadManager {
  /**
   * @param {string} stateFile - Path to the persistent state file
   */
  constructor(stateFile) {
    this.STATE_FILE = stateFile;
    this.lastTimestamp = null;
    this.processedMessages = new Set();
    this.activeThreads = new Map();   // threadTs -> { sessionId, phone, threadTs, transferred, ... }
    this.phoneToThread = new Map();   // phone -> threadTs
    this.imsgLastSeen = new Map();    // phone -> last numeric message ID
    this.phoneGeneratingLock = new Map(); // phone -> bool
    this.isFirstRun = false;
  }

  /**
   * Load state from disk
   */
  load() {
    try {
      if (fs.existsSync(this.STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(this.STATE_FILE, 'utf8'));
        this.lastTimestamp = data.lastTimestamp || null;
        if (data.processedMessages && Array.isArray(data.processedMessages)) {
          data.processedMessages.forEach(id => this.processedMessages.add(id));
        }
        if (data.activeThreads && Array.isArray(data.activeThreads)) {
          data.activeThreads.forEach(([threadTs, value]) => {
            if (typeof value === 'string') {
              this.activeThreads.set(threadTs, { sessionId: value, phone: null, threadTs });
            } else if (value && typeof value === 'object') {
              const entry = { ...value, threadTs };
              if (value.transferred) {
                entry.transferred = true;
                entry.transferredAt = value.transferredAt || Date.now();
                entry.postTransferReplies = value.postTransferReplies || 0;
              }
              this.activeThreads.set(threadTs, entry);
              if (value.phone) {
                this.phoneToThread.set(value.phone, threadTs);
              }
            }
          });
        }
        if (data.imsgLastSeen && typeof data.imsgLastSeen === 'object') {
          Object.entries(data.imsgLastSeen).forEach(([phone, ts]) => {
            this.imsgLastSeen.set(phone, ts);
          });
        }
        console.log(`[ThreadManager] State loaded: ${this.activeThreads.size} threads, ${this.processedMessages.size} processed`);
        this.isFirstRun = false;
      } else {
        console.log('[ThreadManager] No state file — first run');
        this.isFirstRun = true;
      }
    } catch (error) {
      console.error('[ThreadManager] Error loading state:', error.message);
      this.isFirstRun = true;
    }
  }

  /**
   * Save state to disk (atomic write)
   */
  save() {
    try {
      const state = {
        lastTimestamp: this.lastTimestamp,
        processedMessages: Array.from(this.processedMessages),
        activeThreads: Array.from(this.activeThreads.entries()),
        imsgLastSeen: Object.fromEntries(this.imsgLastSeen),
        lastUpdated: new Date().toISOString()
      };
      atomicWriteSync(this.STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('[ThreadManager] Error saving state:', error.message);
      throw error; // Let caller handle alerting
    }
  }

  /**
   * Register a new thread for a lead
   */
  registerThread(threadTs, sessionId, phone) {
    this.activeThreads.set(threadTs, { sessionId, phone, threadTs });
    if (phone) {
      this.phoneToThread.set(phone, threadTs);
    }
    this.save();
  }

  /**
   * Mark thread as transferred
   */
  markTransferred(threadTs) {
    const data = this.activeThreads.get(threadTs);
    if (data) {
      data.transferred = true;
      data.transferredAt = Date.now();
      data.postTransferReplies = 0;
      this.save();
    }
  }

  /**
   * Revive a transferred thread
   */
  reviveThread(threadTs) {
    const data = this.activeThreads.get(threadTs);
    if (data) {
      data.transferred = false;
      data.revived = true;
      data.reviveCount = (data.reviveCount || 0) + 1;
      data.revivedAt = Date.now();
      this.save();
      return data;
    }
    return null;
  }

  /**
   * Close old phone collision
   */
  closePhoneCollision(phone) {
    if (this.phoneToThread.has(phone)) {
      const oldThreadTs = this.phoneToThread.get(phone);
      const oldData = this.activeThreads.get(oldThreadTs);
      if (oldData && !oldData.transferred) {
        oldData.transferred = true;
        oldData.transferredAt = Date.now();
        this.phoneToThread.delete(phone);
      }
    }
  }

  /**
   * Trim processedMessages to prevent unbounded growth
   */
  trimProcessed(maxSize = 1000) {
    if (this.processedMessages.size > maxSize) {
      const arr = Array.from(this.processedMessages);
      this.processedMessages.clear();
      arr.slice(-500).forEach(id => this.processedMessages.add(id));
    }
  }

  /**
   * Expire old transferred threads
   */
  expireOldThreads(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [threadTs, data] of this.activeThreads) {
      if (data.transferred && data.transferredAt && (now - data.transferredAt > maxAgeMs)) {
        if (data.phone) {
          this.phoneToThread.delete(data.phone);
          this.imsgLastSeen.delete(data.phone);
        }
        this.activeThreads.delete(threadTs);
      }
    }
  }
}

module.exports = ThreadManager;

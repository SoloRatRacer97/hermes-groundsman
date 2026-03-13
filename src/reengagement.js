/**
 * Re-Engagement Module
 * Tier 1: Cold open (no reply to first outbound) — 20min + 2hr follow-ups (max 2)
 * Tier 2: Conversation started but went quiet mid-qualify — 15min follow-up (max 1)
 *
 * All follow-ups are LLM-generated via the conversation engine.
 * Quiet hours: 8 PM – 8 AM America/Los_Angeles
 */

const { classifyMessage } = require('./message-classifier');

class ReengagementManager {
  constructor() {
    // Tier 1 timing (cold open — lead never replied)
    this.TIER1_BUMP1_MS = process.env.TEST_FOLLOWUP ? 2 * 60 * 1000 : 20 * 60 * 1000;       // 2 min (test) or 20 minutes
    this.TIER1_BUMP2_MS = process.env.TEST_FOLLOWUP ? 5 * 60 * 1000 : 2 * 60 * 60 * 1000;   // 5 min (test) or 2 hours

    // Tier 2 timing (conversation went quiet mid-qualify)
    this.TIER2_BUMP1_MS = 15 * 60 * 1000;        // 15 minutes

    // Quiet hours (America/Los_Angeles)
    this.QUIET_START_HOUR = 20; // 8 PM
    this.QUIET_END_HOUR = 8;   // 8 AM
    this.TIMEZONE = 'America/Los_Angeles';

    // Active timers (sessionId -> timer info)
    this.activeTimers = new Map();
  }

  /**
   * Start monitoring a session for follow-up
   * @param {string} sessionId - Session identifier
   * @param {object} sessionData - { name, phone, serviceType, ... }
   * @param {object} callbacks - { onFollowUp(sessionId, context) }
   */
  startMonitoring(sessionId, sessionData, callbacks = {}) {
    this.stopMonitoring(sessionId);

    const timerInfo = {
      sessionId,
      sessionData,
      callbacks,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      leadHasReplied: false,
      followUpsSent: 0,
      optedOut: false,
      timers: [],
    };

    this.activeTimers.set(sessionId, timerInfo);

    // Start Tier 1 sequence (cold open — lead hasn't replied yet)
    this._scheduleTier1(sessionId);
  }

  /**
   * Reset activity timer when lead responds
   * @param {string} sessionId
   * @param {string} message - The lead's message (to check for opt-out)
   */
  resetActivity(sessionId, message) {
    const timerInfo = this.activeTimers.get(sessionId);
    if (!timerInfo) return;

    // Check for opt-out signals
    if (message) {
      const classification = classifyMessage(message);
      if (classification.signals.includes('opt_out')) {
        console.log(`[Reengagement] 🛑 Opt-out detected for ${sessionId} — stopping all follow-ups`);
        timerInfo.optedOut = true;
        this.stopMonitoring(sessionId);
        return;
      }
    }

    timerInfo.lastActivity = Date.now();
    timerInfo.leadHasReplied = true;

    // Clear all pending timers
    this._clearTimers(timerInfo);

    // Now in Tier 2 territory (conversation started)
    this._scheduleTier2(sessionId);
  }

  /**
   * Stop monitoring a session entirely
   * @param {string} sessionId
   */
  stopMonitoring(sessionId) {
    const timerInfo = this.activeTimers.get(sessionId);
    if (!timerInfo) return;

    this._clearTimers(timerInfo);
    this.activeTimers.delete(sessionId);
  }

  /**
   * Check if current time is within quiet hours (8 PM – 8 AM America/Los_Angeles)
   * @param {Date} [now]
   * @returns {boolean}
   */
  isQuietHours(now = new Date()) {
    const laTime = new Date(now.toLocaleString('en-US', { timeZone: this.TIMEZONE }));
    const hour = laTime.getHours();
    return hour >= this.QUIET_START_HOUR || hour < this.QUIET_END_HOUR;
  }

  /**
   * Calculate ms until quiet hours end (next 8 AM LA time)
   * @param {Date} [now]
   * @returns {number} ms until 8 AM LA
   */
  _msUntilQuietEnd(now = new Date()) {
    // Get current LA time
    const laStr = now.toLocaleString('en-US', { timeZone: this.TIMEZONE });
    const laTime = new Date(laStr);
    const hour = laTime.getHours();

    // Calculate hours until 8 AM
    let hoursUntil;
    if (hour >= this.QUIET_START_HOUR) {
      hoursUntil = (24 - hour) + this.QUIET_END_HOUR;
    } else {
      hoursUntil = this.QUIET_END_HOUR - hour;
    }

    return hoursUntil * 60 * 60 * 1000;
  }

  // ========== PRIVATE ==========

  _clearTimers(timerInfo) {
    for (const t of timerInfo.timers) {
      clearTimeout(t);
    }
    timerInfo.timers = [];
  }

  /**
   * Schedule Tier 1 follow-ups (cold open)
   * Bump 1 at 20 min, Bump 2 at 2 hours
   */
  _scheduleTier1(sessionId) {
    const timerInfo = this.activeTimers.get(sessionId);
    if (!timerInfo) return;

    // Bump 1: 20 minutes
    const t1 = setTimeout(() => {
      this._fireFollowUp(sessionId, 1, 1, this.TIER1_BUMP1_MS);
    }, this.TIER1_BUMP1_MS);
    timerInfo.timers.push(t1);

    // Bump 2: 2 hours
    const t2 = setTimeout(() => {
      this._fireFollowUp(sessionId, 1, 2, this.TIER1_BUMP2_MS);
    }, this.TIER1_BUMP2_MS);
    timerInfo.timers.push(t2);
  }

  /**
   * Schedule Tier 2 follow-up (mid-qualify dropout)
   * Single bump at 15 minutes after last activity
   */
  _scheduleTier2(sessionId) {
    const timerInfo = this.activeTimers.get(sessionId);
    if (!timerInfo) return;

    const t = setTimeout(() => {
      this._fireFollowUp(sessionId, 2, 1, this.TIER2_BUMP1_MS);
    }, this.TIER2_BUMP1_MS);
    timerInfo.timers.push(t);
  }

  /**
   * Fire a follow-up via the registered callback
   * @param {string} sessionId
   * @param {number} tier - 1 or 2
   * @param {number} bumpNumber - which bump in the tier
   * @param {number} elapsedMs - how long since last activity
   */
  async _fireFollowUp(sessionId, tier, bumpNumber, elapsedMs) {
    const timerInfo = this.activeTimers.get(sessionId);
    if (!timerInfo) return;
    if (timerInfo.optedOut) return;

    // If lead replied since this timer was set, skip (tier changed)
    if (tier === 1 && timerInfo.leadHasReplied) return;

    // Check max follow-ups
    const maxForTier = tier === 1 ? 2 : 1;
    const sentForTier = tier === 1
      ? timerInfo.followUpsSent
      : (timerInfo.followUpsSent - (timerInfo.leadHasReplied ? 0 : 0)); // Tier 2 tracks from 0 after reset
    if (timerInfo.followUpsSent >= maxForTier && tier === 1) return;
    if (tier === 2 && timerInfo.followUpsSent > 0) return; // Tier 2 resets counter on resetActivity

    // Check quiet hours — defer until morning
    if (this.isQuietHours()) {
      const deferMs = this._msUntilQuietEnd();
      console.log(`[Reengagement] 🌙 Quiet hours — deferring T${tier}B${bumpNumber} for ${sessionId} (${Math.round(deferMs / 60000)}min)`);
      const t = setTimeout(() => {
        this._fireFollowUp(sessionId, tier, bumpNumber, elapsedMs);
      }, deferMs);
      timerInfo.timers.push(t);
      return;
    }

    timerInfo.followUpsSent++;
    const elapsedMinutes = Math.round(elapsedMs / 60000);

    const context = {
      tier,
      bumpNumber,
      elapsedMinutes,
      isLastFollowUp: (tier === 1 && bumpNumber === 2) || tier === 2,
      sessionData: timerInfo.sessionData,
    };

    console.log(`[Reengagement] 📨 T${tier}B${bumpNumber} for ${sessionId} (${elapsedMinutes}min elapsed, ${timerInfo.followUpsSent}/${maxForTier} sent)`);

    if (timerInfo.callbacks.onFollowUp) {
      try {
        await timerInfo.callbacks.onFollowUp(sessionId, context);
      } catch (err) {
        console.error(`[Reengagement] Follow-up callback error for ${sessionId}:`, err.message);
      }
    }

    // If we've hit the max, stop monitoring
    if (tier === 1 && timerInfo.followUpsSent >= 2) {
      console.log(`[Reengagement] ⏹️ Max Tier 1 follow-ups reached for ${sessionId} — stopping`);
      // Don't delete from map yet — resetActivity might still come in
    }
  }
}

module.exports = ReengagementManager;

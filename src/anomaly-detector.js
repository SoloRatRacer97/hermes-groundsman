/**
 * Behavioral Anomaly Detection — V16.3 Security Hardening
 * Tracks per-session metrics and flags anomalous behavior.
 */

const SERVICE_KEYWORDS = [
  'plumbing', 'hvac', 'repair', 'fix', 'install', 'installation',
  'heating', 'cooling', 'air conditioning', 'ac', 'furnace', 'thermostat',
  'water heater', 'pipe', 'leak', 'drain', 'toilet', 'faucet',
  'electrical', 'wiring', 'outlet', 'breaker', 'panel',
  'roofing', 'roof', 'gutter', 'siding',
  'maintenance', 'service', 'replace', 'replacement', 'broken',
  'not working', 'emergency', 'urgent', 'schedule', 'appointment',
  'estimate', 'quote', 'price', 'cost',
];

// Questions end with ? or start with common question words
const QUESTION_PATTERN = /\?$|^(what|where|when|why|how|who|which|is|are|do|does|can|could|would|will|should|did)\b/i;

class AnomalyDetector {
  constructor(options = {}) {
    this.sessions = new Map();
    this.questionThreshold = options.questionThreshold || 5;
    this.stripThreshold = options.stripThreshold || 3;
    this.messageFloodCount = options.messageFloodCount || 10;
    this.messageFloodWindowMs = options.messageFloodWindowMs || 2 * 60 * 1000; // 2 minutes
  }

  /**
   * Track a message for a session
   * @param {string} sessionId
   * @param {string} message - The lead's message
   * @param {string[]} sanitizationActions - Actions taken by sanitizer (can be empty)
   */
  trackMessage(sessionId, message, sanitizationActions = []) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        questionCount: 0,
        serviceKeywordCount: 0,
        stripCount: 0,
        messageTimes: [],
        totalMessages: 0,
      });
    }

    const session = this.sessions.get(sessionId);
    session.totalMessages++;
    session.messageTimes.push(Date.now());

    // Count questions
    if (message && QUESTION_PATTERN.test(message.trim())) {
      session.questionCount++;
    }

    // Count service keywords
    if (message) {
      const lower = message.toLowerCase();
      for (const kw of SERVICE_KEYWORDS) {
        if (lower.includes(kw)) {
          session.serviceKeywordCount++;
          break; // count once per message
        }
      }
    }

    // Count sanitization strips
    if (sanitizationActions && sanitizationActions.length > 0) {
      session.stripCount += sanitizationActions.length;
    }
  }

  /**
   * Check if a session is anomalous
   * @param {string} sessionId
   * @returns {{ flagged: boolean, reasons: string[] }}
   */
  isAnomalous(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { flagged: false, reasons: [] };

    const reasons = [];

    // Check: 5+ questions without service mentions
    if (session.questionCount >= this.questionThreshold && session.serviceKeywordCount === 0) {
      reasons.push(`Lead asked ${session.questionCount} questions without mentioning any service needs`);
    }

    // Check: 3+ sanitizer strips
    if (session.stripCount >= this.stripThreshold) {
      reasons.push(`Sanitizer stripped content ${session.stripCount} times in this session`);
    }

    // Check: 10+ messages in 2 minutes
    const now = Date.now();
    const recentMessages = session.messageTimes.filter(t => (now - t) < this.messageFloodWindowMs);
    if (recentMessages.length >= this.messageFloodCount) {
      reasons.push(`${recentMessages.length} messages sent in under ${Math.round(this.messageFloodWindowMs / 60000)} minutes`);
    }

    return {
      flagged: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Reset a session
   */
  resetSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Reset all sessions
   */
  reset() {
    this.sessions.clear();
  }
}

// Singleton
const defaultDetector = new AnomalyDetector();

function trackMessage(sessionId, message, sanitizationActions) {
  return defaultDetector.trackMessage(sessionId, message, sanitizationActions);
}

function isAnomalous(sessionId) {
  return defaultDetector.isAnomalous(sessionId);
}

module.exports = { AnomalyDetector, trackMessage, isAnomalous, defaultDetector, SERVICE_KEYWORDS };

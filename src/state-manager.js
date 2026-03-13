/**
 * State Manager
 * Manages per-session conversation state for Hermes v2
 * Tracks: current_question, lead_temp, frustration_score, questions_asked, data_collected
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./config');

const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '..');
const SESSIONS_FILE = path.join(STATE_DIR, '.hermes-sessions.json');

/**
 * Mask phone number for logging (show last 4 digits only)
 * @param {string} phone - Phone number
 * @returns {string} Masked phone
 */
function maskPhone(phone) {
  if (!phone || phone === 'Unknown') return phone;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

/**
 * Atomic file write: write to temp file then rename
 * Prevents corruption on crash
 * @param {string} filePath - Target file path
 * @param {string} data - Data to write
 */
function atomicWriteSync(filePath, data) {
  const tmpFile = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, data, 'utf8');
  fs.renameSync(tmpFile, filePath);
}

class StateManager {
  constructor() {
    // Sessions keyed by leadId (primary key)
    this.sessions = new Map();
    // Reverse lookup: phone → leadId (most recent active session)
    this.phoneToLeadId = new Map();
    this._loadSessions();
  }

  _loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        for (const [id, session] of Object.entries(data)) {
          // Load active, paused, and recently completed sessions (for re-engagement)
          const isActive = session.status === 'active' || session.status === 'paused';
          const isRecentCompleted = session.status === 'completed' && session.completedAt &&
            (Date.now() - new Date(session.completedAt).getTime()) < 24 * 60 * 60 * 1000;
          if (isActive || isRecentCompleted) {
            this.sessions.set(id, session);
            // Rebuild phone → leadId reverse map (most recent wins)
            if (session.phone && isActive) {
              this.phoneToLeadId.set(session.phone, id);
            }
          }
        }
        console.log(`[StateManager] Loaded ${this.sessions.size} active sessions from disk`);
        console.log(`[StateManager] Phone→LeadId mappings: ${this.phoneToLeadId.size}`);
      }
    } catch (err) {
      console.error(`[StateManager] Failed to load sessions: ${err.message}`);
    }
  }

  _saveSessions() {
    try {
      const data = Object.fromEntries(this.sessions);
      atomicWriteSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`[StateManager] Failed to save sessions: ${err.message}`);
    }
  }

  /**
   * Create new session from lead data
   * @param {object} leadData - Initial lead data from form
   * @returns {object} Session object
   */
  createSession(leadData) {
    const sessionId = leadData.leadId || this._generateId();
    
    // Close/archive any existing session on the same phone
    if (leadData.phone) {
      const existingLeadId = this.phoneToLeadId.get(leadData.phone);
      if (existingLeadId && existingLeadId !== sessionId) {
        const existingSession = this.sessions.get(existingLeadId);
        if (existingSession && (existingSession.status === 'active' || existingSession.status === 'paused')) {
          console.log(`[StateManager] 🔄 Closing old session ${existingLeadId} on phone ${maskPhone(leadData.phone)} (new lead: ${sessionId})`);
          existingSession.status = 'archived';
          existingSession.archivedAt = new Date().toISOString();
          existingSession.archivedReason = `Replaced by new lead ${sessionId}`;
        }
      }
      // Update phone → leadId mapping to new session
      this.phoneToLeadId.set(leadData.phone, sessionId);
    }
    
    const session = {
      sessionId,
      leadId: sessionId,
      
      // Lead info (from form)
      name: leadData.name,
      phone: leadData.phone,
      email: leadData.email,
      serviceType: leadData.serviceType || 'Unknown',
      existingCustomer: leadData.existingCustomer || false,
      address: leadData.address,
      zip: leadData.zip,
      source: leadData.source,
      framework: leadData.framework || null,
      originalMessage: leadData.message || '',
      
      // Conversation state
      path: null,
      currentQuestion: null,
      questionsAsked: 0,
      
      // Collected data
      dataCollected: {},
      transcript: [],
      
      // Scoring & classification
      leadTemp: 'COLD',
      frustrationScore: 0,
      emergencyFlag: false,
      parachuteTriggered: false,
      optedOut: false,
      optOutReason: null,
      
      // Metadata
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      businessHours: this._isBusinessHours(leadData.timestamp),
      status: 'active',
      
      // Engagement tracking
      responseLength: [],
      lastResponseTime: null,
    };

    this.sessions.set(sessionId, session);
    this._saveSessions();
    const logPhone = config.logging.logPii ? leadData.phone : maskPhone(leadData.phone);
    console.log(`[StateManager] Created session ${sessionId} for ${leadData.name} (${logPhone})`);
    
    this._saveSessions();
    return session;
  }

  /**
   * Get session by ID (leadId)
   * @param {string} sessionId - Session identifier (leadId)
   * @returns {object|null} Session object or null
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get most recent active session by phone number
   * Used for inbound iMessage routing (phone → leadId → session)
   * @param {string} phone - Phone number
   * @returns {object|null} Session object or null
   */
  getSessionByPhone(phone) {
    const leadId = this.phoneToLeadId.get(phone);
    if (!leadId) return null;
    return this.sessions.get(leadId) || null;
  }

  /**
   * Get leadId for a phone number
   * @param {string} phone - Phone number
   * @returns {string|null} leadId or null
   */
  getLeadIdByPhone(phone) {
    return this.phoneToLeadId.get(phone) || null;
  }

  /**
   * Update session data
   * @param {string} sessionId - Session identifier
   * @param {object} updates - Fields to update
   * @returns {object|null} Updated session or null
   */
  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[StateManager] Session not found: ${sessionId}`);
      return null;
    }

    Object.assign(session, updates);
    session.lastMessageAt = new Date().toISOString();
    this._saveSessions();
    return session;
  }

  /**
   * Add message to transcript
   * @param {string} sessionId - Session identifier
   * @param {string} sender - 'hermes' or 'lead'
   * @param {string} text - Message text
   */
  addToTranscript(sessionId, sender, text) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.transcript.push({
      sender,
      text,
      timestamp: new Date().toISOString()
    });

    // Track response length for engagement scoring (lead messages only)
    if (sender === 'lead') {
      session.responseLength.push(text.length);
      session.lastResponseTime = new Date();
    }
    this._saveSessions();
  }

  /**
   * Rebuild transcript from full Slack thread history
   * CRITICAL FIX: Ensures Gaius has FULL conversation context, not just what Hermes has processed
   * @param {string} sessionId - Session identifier
   * @param {array} fullTranscript - Full conversation history from Slack
   */
  rebuildTranscript(sessionId, fullTranscript) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[StateManager] Cannot rebuild transcript - session not found: ${sessionId}`);
      return;
    }

    // Replace transcript with full Slack history
    session.transcript = fullTranscript;

    // Recalculate response lengths from full history (for engagement scoring)
    session.responseLength = fullTranscript
      .filter(msg => msg.sender === 'lead')
      .map(msg => msg.text.length);

    console.log(`[StateManager] ✅ Rebuilt transcript for ${sessionId}: ${fullTranscript.length} messages`);
  }

  /**
   * Record answer to a question
   * @param {string} sessionId - Session identifier
   * @param {string} questionId - Question identifier (q1, q2, etc.)
   * @param {string} answer - Lead's answer
   */
  recordAnswer(sessionId, questionId, answer) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.dataCollected[questionId] = answer;
    session.questionsAsked++;
    
    // Auto-upgrade lead temp to WARM if they've engaged (answered at least 1 question)
    if (session.leadTemp === 'COLD' && session.questionsAsked >= 1) {
      session.leadTemp = 'WARM';
      console.log(`[StateManager] Lead temp auto-upgraded to WARM: ${sessionId} (engaged in conversation)`);
    }
  }

  /**
   * Update lead temperature
   * @param {string} sessionId - Session identifier
   * @param {string} temp - 'COLD', 'WARM', or 'HOT'
   */
  setLeadTemp(sessionId, temp) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.leadTemp = temp;
    console.log(`[StateManager] Lead temp updated: ${sessionId} → ${temp}`);
  }

  /**
   * Update frustration score
   * @param {string} sessionId - Session identifier
   * @param {number} score - Frustration score (0-100)
   */
  setFrustrationScore(sessionId, score) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.frustrationScore = score;
    
    if (score >= 70) {
      console.log(`[StateManager] ⚡ HIGH FRUSTRATION: ${sessionId} (score: ${score})`);
    }
  }

  /**
   * Mark session as emergency
   * @param {string} sessionId - Session identifier
   */
  markAsEmergency(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.emergencyFlag = true;
    session.path = 'EMERGENCY';
    session.leadTemp = 'HOT';
    
    console.log(`[StateManager] 🚨 Session upgraded to EMERGENCY: ${sessionId}`);
  }

  /**
   * Trigger parachute protocol
   * @param {string} sessionId - Session identifier
   * @param {string} reason - Why parachute was triggered
   */
  triggerParachute(sessionId, reason) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.parachuteTriggered = true;
    session.parachuteReason = reason;
    session.status = 'parachute';
    
    console.log(`[StateManager] 🪂 PARACHUTE TRIGGERED: ${sessionId} - Reason: ${reason}`);
  }

  /**
   * Mark session as opted out
   * @param {string} sessionId - Session identifier
   * @param {string} trigger - What message triggered opt-out
   */
  markAsOptedOut(sessionId, trigger) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.optedOut = true;
    session.optOutReason = trigger;
    session.status = 'opted_out';
    
    console.log(`[StateManager] ⛔ OPTED OUT: ${sessionId} - Trigger: "${trigger}"`);
  }

  /**
   * Check if lead is engaged (based on response patterns)
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if engaged
   */
  isEngaged(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const responseLengths = session.responseLength;
    
    // Not enough data yet
    if (responseLengths.length < 2) return true;

    // Check last 2 responses
    const lastTwo = responseLengths.slice(-2);
    const avgLength = lastTwo.reduce((a, b) => a + b, 0) / lastTwo.length;

    // Engaged if average response > 10 chars
    return avgLength > 10;
  }

  /**
   * Check if lead is highly responsive (for Q5 conditional)
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if highly responsive
   */
  isHighlyResponsive(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const responseLengths = session.responseLength;
    
    // Need at least 3 responses
    if (responseLengths.length < 3) return false;

    // Check if all responses are substantial (>20 chars)
    const avgLength = responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length;
    
    return avgLength > 20;
  }

  /**
   * Revive a transferred session (transferred → revived)
   * @param {string} sessionId - Session identifier
   */
  reviveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[StateManager] Cannot revive - session not found: ${sessionId}`);
      return null;
    }

    session.status = 'active';
    session.revived = true;
    session.reviveCount = (session.reviveCount || 0) + 1;
    session.revivedAt = new Date().toISOString();
    session.lastMessageAt = new Date().toISOString();

    this._saveSessions();
    console.log(`[StateManager] 🔄 Session REVIVED: ${sessionId} (revive #${session.reviveCount})`);
    return session;
  }

  /**
   * Mark session as complete
   * @param {string} sessionId - Session identifier
   */
  completeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    // Note: Keep phoneToLeadId mapping so revive system can still find this session
    this._saveSessions();
    console.log(`[StateManager] ✅ Session completed: ${sessionId}`);
  }

  /**
   * Get handoff payload for CSR
   * @param {string} sessionId - Session identifier
   * @returns {object} Structured handoff data
   */
  getHandoffPayload(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      // Lead Info
      leadId: session.leadId,
      name: session.name,
      phone: session.phone,
      email: session.email,
      serviceType: session.serviceType,
      address: session.address,
      zip: session.zip,
      source: session.source,
      
      // Qualification Data
      problemDescription: session.dataCollected.q1,
      urgencyLevel: session.dataCollected.q2,
      systemAge: session.dataCollected.q3,
      issueDuration: session.dataCollected.q4,
      additionalNotes: session.dataCollected.q5,
      
      // Classification
      leadTemp: session.leadTemp,
      frustrationFlag: this._getFrustrationLevel(session.frustrationScore),
      emergencyFlag: session.emergencyFlag,
      parachuteTriggered: session.parachuteTriggered,
      parachuteReason: session.parachuteReason,
      
      // V5: Buying Intent Data
      buyingIntent: session.buyingIntent || null,
      buyingIntentTriggers: session.buyingIntentTriggers || [],
      urgencyDetected: session.urgencyDetected || false,
      
      // Metadata
      questionsAsked: session.questionsAsked,
      conversationPath: session.path,
      businessHours: session.businessHours,
      transcript: session.transcript,
      timestamp: session.createdAt,
    };
  }

  /**
   * Clean up old sessions (garbage collection)
   * @param {number} maxAgeHours - Max age in hours
   */
  cleanupOldSessions(maxAgeHours = 24) {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const createdAt = new Date(session.createdAt);
      const ageHours = (now - createdAt) / (1000 * 60 * 60);

      if (ageHours > maxAgeHours) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[StateManager] Cleaned up ${cleaned} old sessions`);
    }
  }

  /**
   * Get stats
   * @returns {object} Stats object
   */
  getStats() {
    const all = Array.from(this.sessions.values());
    
    return {
      total: all.length,
      active: all.filter(s => s.status === 'active').length,
      completed: all.filter(s => s.status === 'completed').length,
      parachute: all.filter(s => s.parachuteTriggered).length,
      emergency: all.filter(s => s.emergencyFlag).length,
      hot: all.filter(s => s.leadTemp === 'HOT').length,
      warm: all.filter(s => s.leadTemp === 'WARM').length,
    };
  }

  // Private helpers

  _isBusinessHours(timestamp) {
    // Default: M-F 8AM-5PM (using UTC for now)
    // TODO: Make timezone-aware based on lead's zip code
    const date = timestamp ? new Date(timestamp) : new Date();
    const day = date.getUTCDay(); // 0=Sun, 6=Sat
    const hour = date.getUTCHours();

    // Weekend
    if (day === 0 || day === 6) return false;

    // After hours (UTC hours for testing: 10 AM UTC = business hours, 22 PM UTC = after hours)
    // In production, this should be localized to client timezone
    if (hour < 8 || hour >= 20) return false;

    return true;
  }

  _getFrustrationLevel(score) {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'NONE';
  }

  _generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = StateManager;

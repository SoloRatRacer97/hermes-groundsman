/**
 * Momentum Tracker — V18.1
 * Casino floor design: track engagement momentum per conversation.
 * Transfer only fires when momentum >= archetype threshold.
 * Self-calibrating: successful conversions update thresholds.
 */

// Yes-signal patterns — CONVERSATIONAL buy signals only.
// We already have name, phone, email, address, service type from the form fill.
// These signals track engagement and intent DURING the conversation.
const YES_SIGNALS = [
  { pattern: /\?/,                          weight: 0.5, reason: 'asks question' },
  { pattern: /\b(yes|yeah|yep|sure|okay|ok|absolutely|definitely|right|exactly|great|perfect|sounds good|alright|fine|for sure|of course|please)\b/i, weight: 0.7, reason: 'agreement' },
  { pattern: /\b(my house|my home|our house|our home|I have a|I live|my (?:ac|hvac|furnace|heater|unit|system|plumbing|roof|pipes|wiring|deck|dishwasher|dryer|fridge|washing machine|oven)|our (?:restaurant|office|warehouse|hotel|building)|been (?:a problem|bugging|going on|having)|started (?:last|yesterday|today|this)|getting worse|been leaking|keeps happening|noticed that)\b/i, weight: 1.0, reason: 'detail sharing' },
  { pattern: /\b(when can|how soon|what time|schedul\w*|available|appointment|come out|come now|send someone|get someone out|next step|whats next|how do we start|need someone|when.+free|what days|tomorrow|this week|today|set it up|get it set up)\b/i, weight: 1.2, reason: 'scheduling intent' },
  { pattern: /\b(thank|thanks|appreciate|helpful)\b/i, weight: 0.5, reason: 'gratitude' },
  // Urgency/emergency signals
  { pattern: /\b(emergency|urgent|ASAP|right now|immediately|hurry|desperate|please help|need help|help me|cant wait|can't wait|getting worse|need this done|need it fixed|need this fixed|need.+fixed)\b/i, weight: 1.5, reason: 'urgency' },
  { pattern: /!{2,}/, weight: 1.0, reason: 'strong emphasis' },
  { pattern: /\b(burst pipe|pipe burst|no heat|no ac|no a\/c|no hot water|flooding|flooded|sparking|gas leak|carbon monoxide|water everywhere|sewage|overflowing|tree fell|roof caved|caught fire|smoke|dangerous)\b/i, weight: 2.0, reason: 'emergency situation' },
  // Buying commitment — explicit intent signals
  { pattern: /\b(lets do it|let's do it|go ahead|convinced me|im interested|i'm interested|send someone|ready to|go for it|sign me up|book it|get a quote|at least get|makes sense|that makes sense|alright fine|ok fine|you convinced|i want to go ahead|lets book it|let's book it|set it up|lets get it done|let's get it done)\b/i, weight: 1.5, reason: 'buying commitment' },
  // Returning customer / prior relationship
  { pattern: /\b(came out|used your service|last month|same issue|same thing|following up|move forward|ready to move|same tech)\b/i, weight: 1.0, reason: 'returning customer' },
  // Insurance / estimate request (moderate signal - they need service but comparing)
  { pattern: /\b(insurance|adjuster|written estimate|file.+claim|flood damage|storm damage)\b/i, weight: 0.8, reason: 'insurance inquiry' },
  // Multi-unit / commercial signals
  { pattern: /\b(\d+\s+units?|sq\s*ft|commercial|property manag|multiple|ongoing service)\b/i, weight: 1.0, reason: 'commercial scope' },
  // Positive sentiment shift
  { pattern: /\b(actually yeah|you know what|on second thought|changed my mind|why not|might as well)\b/i, weight: 1.0, reason: 'positive sentiment shift' },
];

// Resistance-signal patterns
const RESISTANCE_SIGNALS = [
  { pattern: /^(ok|k|no|nah|nope|idk|maybe|meh)\.?$/i, weight: -1.0, reason: 'minimal response' },
  { pattern: /\b(not sure|don't know|let me think|need to think|think about it|sleep on it)\b/i, weight: -0.8, reason: 'hesitation' },
  { pattern: /\b(too (much|expensive|high)|can't afford|budget|cost too|pricey)\b/i, weight: -1.0, reason: 'price resistance' },
  { pattern: /\b(spouse|wife|husband|partner|talk to my|check with)\b/i, weight: -0.7, reason: 'third-party deferral' },
  { pattern: /\b(not now|bad time|busy|later|another time|not interested|no thanks)\b/i, weight: -1.2, reason: 'timing resistance' },
  { pattern: /(?<!(wont|won't|won't|doesnt|doesn't|doesn't|cant|can't|can't|not|never)\s)\b(stop)\b|\b(unsubscribe|remove me|don't contact|leave me alone)\b/i, weight: -2.0, reason: 'opt-out signal' },
  { pattern: /\b(wrong number|who is this|dont need|don't need|get lost|reported|spam|im good thanks|i'm good thanks|pass|not for me|dont text|don't text|can you not|didnt ask|didn't ask|why are you texting|lol no)\b/i, weight: -2.0, reason: 'hostile rejection' },
];

// Default momentum thresholds by archetype pattern
const DEFAULT_THRESHOLDS = {
  'emergency': 1,    // Emergencies convert fast
  'critical': 1.5,   // Urgent = fewer steps
  'buying': 1.5,     // Ready buyers need less nurturing
  'soon': 2,         // Moderate urgency
  'shopping': 2,     // Comparing options
  'planning': 1.8,    // Long-term = more nurturing needed
  'browsing': 1.8,    // Info-gathering
  'emotional': 1.5,   // Emotional leads convert when validated
  'analytical': 1.8,  // Need more data before committing
  'complaining': 1.8, // Need recovery arc
  '_default': 1.8,    // Fallback
};

class MomentumTracker {
  constructor() {
    // conversationId → { momentum, signals[], threshold }
    this.conversations = new Map();
    // archetype → { threshold, calibrationCount, totalSuccessMomentum }
    this.thresholds = new Map();
  }

  /**
   * Score a message and update momentum
   * @param {string} conversationId
   * @param {string} message - Lead's message text
   * @param {string} archetype - Archetype hash
   * @returns {{ momentum: number, delta: number, signals: string[], readyForTransfer: boolean }}
   */
  score(conversationId, message, archetype) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        momentum: 0,
        signals: [],
        archetype,
        messageCount: 0,
      });
    }

    const conv = this.conversations.get(conversationId);
    conv.messageCount++;
    let delta = 0;
    const signals = [];

    // Check yes signals
    for (const sig of YES_SIGNALS) {
      if (sig.pattern.test(message)) {
        delta += sig.weight;
        signals.push(sig.reason);
      }
    }

    // Check resistance signals
    for (const sig of RESISTANCE_SIGNALS) {
      if (sig.pattern.test(message)) {
        delta += sig.weight; // weight is already negative
        signals.push(sig.reason);
      }
    }

    // Message length bonus: longer messages = more engaged
    if (message.length > 80) delta += 0.3;
    if (message.length > 150) delta += 0.3;

    // Short message penalty (if no other signals)
    if (message.length < 10 && signals.length === 0) {
      delta -= 0.5;
      signals.push('very short message');
    }

    conv.momentum += delta;
    // Floor at 0
    if (conv.momentum < 0) conv.momentum = 0;
    conv.signals.push(...signals.map(s => ({ signal: s, delta, messageIndex: conv.messageCount })));

    const threshold = this.getThreshold(archetype);
    const readyForTransfer = conv.momentum >= threshold;

    return {
      momentum: conv.momentum,
      delta,
      signals,
      readyForTransfer,
      threshold,
    };
  }

  /**
   * Get current momentum for a conversation
   */
  getMomentum(conversationId) {
    const conv = this.conversations.get(conversationId);
    if (!conv) return { momentum: 0, signals: [], messageCount: 0 };
    return {
      momentum: conv.momentum,
      signals: conv.signals,
      messageCount: conv.messageCount,
    };
  }

  /**
   * Get base (uncalibrated) threshold for an archetype
   */
  _getBaseThreshold(archetype) {
    const dims = (archetype || '').split(':');
    for (const dim of dims) {
      if (DEFAULT_THRESHOLDS[dim] !== undefined) {
        return DEFAULT_THRESHOLDS[dim];
      }
    }
    return DEFAULT_THRESHOLDS._default;
  }

  /**
   * Get threshold for an archetype
   */
  getThreshold(archetype) {
    // Check calibrated thresholds first
    const calibrated = this.thresholds.get(archetype);
    if (calibrated) return calibrated.threshold;

    // Derive from archetype dimensions
    const dims = (archetype || '').split(':');
    for (const dim of dims) {
      if (DEFAULT_THRESHOLDS[dim] !== undefined) {
        return DEFAULT_THRESHOLDS[dim];
      }
    }
    return DEFAULT_THRESHOLDS._default;
  }

  /**
   * Self-calibrate: update threshold after a conversion outcome
   * @param {string} conversationId
   * @param {string} archetype
   * @param {boolean} converted - Did this lead convert (transfer)?
   */
  calibrate(conversationId, archetype, converted) {
    const conv = this.conversations.get(conversationId);
    if (!conv) return;

    const baseThreshold = this.thresholds.has(archetype) 
      ? (this.thresholds.get(archetype).baseThreshold || this._getBaseThreshold(archetype))
      : this._getBaseThreshold(archetype);

    if (!this.thresholds.has(archetype)) {
      this.thresholds.set(archetype, {
        threshold: baseThreshold,
        baseThreshold,
        calibrationCount: 0,
        totalSuccessMomentum: 0,
        failCount: 0,
      });
    }
    const cal = this.thresholds.get(archetype);
    if (!cal.baseThreshold) cal.baseThreshold = baseThreshold;
    if (cal.failCount === undefined) cal.failCount = 0;

    if (converted) {
      cal.calibrationCount++;
      cal.totalSuccessMomentum += conv.momentum;
      cal.failCount = Math.max(0, cal.failCount - 1); // Decay fail count on success
      // Moving average of successful conversion momentum
      cal.threshold = cal.totalSuccessMomentum / cal.calibrationCount;
      // Clamp between 0.5 and base+2 (don't drift too far from default)
      cal.threshold = Math.max(0.5, Math.min(baseThreshold + 2, Math.round(cal.threshold * 10) / 10));
    }
    // Failed conversions: raise threshold slightly but with diminishing effect and hard cap
    else {
      cal.failCount++;
      // Diminishing increase: 0.1 / failCount (first fail +0.1, second +0.05, etc.)
      const increase = 0.1 / cal.failCount;
      // Cap at base threshold + 1 (never drift more than 1 above default)
      cal.threshold = Math.min(baseThreshold + 1, cal.threshold + increase);
    }
  }

  /**
   * Check if conversation is ready for transfer
   */
  isReadyForTransfer(conversationId, archetype) {
    const conv = this.conversations.get(conversationId);
    if (!conv) return false;
    return conv.momentum >= this.getThreshold(archetype);
  }

  /**
   * Reset a conversation's momentum
   */
  reset(conversationId) {
    this.conversations.delete(conversationId);
  }

  /**
   * Set threshold directly (for testing)
   */
  setThreshold(archetype, threshold) {
    this.thresholds.set(archetype, {
      threshold,
      baseThreshold: threshold,
      calibrationCount: 0,
      totalSuccessMomentum: 0,
    });
  }
}

module.exports = { MomentumTracker, YES_SIGNALS, RESISTANCE_SIGNALS, DEFAULT_THRESHOLDS };

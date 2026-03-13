/**
 * Novelty Detector — V18 Conversation Antibodies (Enhanced V18.1)
 * Detects when a conversation deviates from expected archetype patterns.
 * V18.1: Distinguishes objections (→ flow-around) from genuine novelty (→ Tier 2).
 * Adds pivot classification: service-change, scope-change, urgency-change, emotional-shift.
 */

// Anger/frustration indicators
const ANGER_PATTERNS = /\b(fuck|shit|damn|pissed|furious|angry|livid|unacceptable|ridiculous|terrible|worst|horrible|incompetent|scam|rip off|sue|lawyer|bbb|complaint|manager|supervisor)\b/i;

// Question patterns (things skeletons usually don't cover)
const UNEXPECTED_QUESTIONS = /\b(warranty|guarantee|license|insured|bonded|reviews|references|how long.{0,10}business|what brand|which brand|do you|can you|are you|will you|experience)\b/i;

// Service category keywords for cross-detection
const SERVICE_KEYWORDS = {
  repair: /\b(repair|fix|broken|not working|stopped)\b/i,
  install: /\b(install|new system|replacement|upgrade)\b/i,
  maintenance: /\b(maintenance|tune.?up|check.?up|routine)\b/i,
  emergency: /\b(emergency|flood|fire|gas leak|carbon monoxide|burst pipe|dangerous)\b/i,
};

// Urgency keywords for contradiction detection
const URGENCY_KEYWORDS = {
  critical: /\b(emergency|urgent|asap|right now|immediately|dangerous|help)\b/i,
  planning: /\b(eventually|no rush|when you can|next month|thinking about|down the road)\b/i,
};

// V18.1: Objection patterns (mirror of objection-router for detection)
const OBJECTION_INDICATORS = /\b(too (much|expensive|high|pricey)|can't afford|need to think|think about it|sleep on it|spouse|wife|husband|partner|talk to my|check with|not now|bad time|busy|later|another time|not ready|other (company|quote)|getting quotes|do it myself|diy)\b/i;

// V18.1: Pivot classification patterns
const PIVOT_PATTERNS = {
  'service-change': /\b(actually|instead|what about|also need|different|switch to|rather have|changed my mind about the service)\b/i,
  'scope-change': /\b(whole house|multiple|all of them|bigger|smaller|add|additional|more than|less than|expand|reduce)\b/i,
  'urgency-change': {
    escalate: /\b(getting worse|now it's|just (started|happened|broke)|emergency|can't wait anymore|desperate)\b/i,
    deescalate: /\b(not as bad|actually it's|working again|false alarm|never ?mind|hold off|not urgent)\b/i,
  },
  'emotional-shift': {
    toAngry: /\b(that's it|had enough|done with|sick of|fed up|last straw|waste of time)\b/i,
    toCalm: /\b(okay|I understand|fair enough|makes sense|sorry|I overreacted|my bad)\b/i,
  },
};

class NoveltyDetector {
  /**
   * Check if a message deviates from the expected pattern
   * @param {object} expectedStep - Skeleton step { type, keyPoints, avgLength }
   * @param {string} actualMessage - Lead's message
   * @param {string} archetype - Archetype hash (e.g., "repair:critical:brief:buying")
   * @param {object} options - { previousMessages: [], momentumData: {} }
   * @returns {{ novel: boolean, confidence: number, reason: string, classification: string, pivotType: string|null }}
   */
  check(expectedStep, actualMessage, archetype, options = {}) {
    if (!actualMessage || !archetype) {
      return { novel: false, confidence: 0, reason: 'insufficient data', classification: 'none', pivotType: null };
    }

    const reasons = [];
    let maxConfidence = 0;
    const msg = actualMessage;
    const dims = archetype.split(':');
    const [serviceCategory, urgency, personality] = dims;

    // V18.1: Check for objections FIRST — these route to flow-around, not Tier 2
    const isObjection = OBJECTION_INDICATORS.test(msg);

    // V18.1: Classify pivots
    const pivotType = this._classifyPivot(msg, archetype, options);

    // 1. Anger/frustration detection (unless archetype predicts it)
    if (ANGER_PATTERNS.test(msg)) {
      const predictedAngry = archetype.includes('emotional') || archetype.includes('complaining');
      if (!predictedAngry) {
        reasons.push('unexpected anger/frustration');
        maxConfidence = Math.max(maxConfidence, 0.9);
      }
    }

    // 2. Topic change — different service category mentioned
    for (const [cat, pattern] of Object.entries(SERVICE_KEYWORDS)) {
      if (pattern.test(msg) && cat !== serviceCategory && serviceCategory !== 'unknown') {
        reasons.push(`topic shift: ${serviceCategory} → ${cat}`);
        maxConfidence = Math.max(maxConfidence, 0.85);
        break;
      }
    }

    // 3. Urgency contradiction
    if (urgency === 'planning' && URGENCY_KEYWORDS.critical.test(msg)) {
      reasons.push('urgency escalation: planning → critical');
      maxConfidence = Math.max(maxConfidence, 0.9);
    }
    if (urgency === 'critical' && URGENCY_KEYWORDS.planning.test(msg)) {
      reasons.push('urgency de-escalation: critical → planning');
      maxConfidence = Math.max(maxConfidence, 0.7);
    }

    // 4. Unexpected questions the skeleton doesn't cover
    if (UNEXPECTED_QUESTIONS.test(msg) && expectedStep) {
      const keyPoints = (expectedStep.keyPoints || []).join(' ').toLowerCase();
      if (!keyPoints.includes('question') && !keyPoints.includes('qualify')) {
        reasons.push('unexpected question outside skeleton scope');
        maxConfidence = Math.max(maxConfidence, 0.75);
      }
    }

    // 5. Message length deviation
    if (expectedStep && expectedStep.avgLength) {
      const ratio = msg.length / expectedStep.avgLength;
      if (ratio > 3.0) {
        reasons.push(`message much longer than expected (${msg.length} vs avg ${expectedStep.avgLength})`);
        maxConfidence = Math.max(maxConfidence, 0.7);
      }
      if (ratio < 0.2 && msg.length < 5) {
        reasons.push(`message much shorter than expected (${msg.length} vs avg ${expectedStep.avgLength})`);
        maxConfidence = Math.max(maxConfidence, 0.5);
      }
    }

    // 6. Sentiment shift from previous messages
    if (options.previousMessages && options.previousMessages.length > 0) {
      const prevTexts = options.previousMessages.map(m => m.text || '').join(' ');
      const prevAnger = ANGER_PATTERNS.test(prevTexts);
      const currAnger = ANGER_PATTERNS.test(msg);
      if (!prevAnger && currAnger) {
        reasons.push('sentiment shift: calm → angry');
        maxConfidence = Math.max(maxConfidence, 0.85);
      }
    }

    // 7. V18.1: Objection itself is a form of deviation
    if (isObjection && reasons.length === 0) {
      reasons.push('objection detected');
      maxConfidence = Math.max(maxConfidence, 0.7);
    }

    // 8. V18.1: Pivot-based novelty
    if (pivotType && !isObjection) {
      reasons.push(`pivot: ${pivotType}`);
      maxConfidence = Math.max(maxConfidence, 0.8);
    }

    if (reasons.length === 0) {
      return { novel: false, confidence: 0, reason: 'within expected pattern', classification: 'none', pivotType: null };
    }

    // V18.1: Determine classification
    // objection → route to ObjectionRouter (flow-around)
    // genuine → escalate to Tier 2
    const classification = isObjection ? 'objection' : 'genuine';

    return {
      novel: maxConfidence >= 0.6,
      confidence: maxConfidence,
      reason: reasons.join('; '),
      classification,
      pivotType,
    };
  }

  /**
   * V18.1: Classify the type of pivot
   * @returns {string|null} pivot type or null
   */
  _classifyPivot(message, archetype, options) {
    const dims = archetype.split(':');
    const urgency = dims[1];

    // Urgency change (check early — "working again", "false alarm" etc.)
    if (urgency === 'planning' && PIVOT_PATTERNS['urgency-change'].escalate.test(message)) {
      return 'urgency-change';
    }
    if (urgency === 'critical' && PIVOT_PATTERNS['urgency-change'].deescalate.test(message)) {
      return 'urgency-change';
    }

    // Emotional shift
    if (options.previousMessages && options.previousMessages.length > 0) {
      const prevTexts = options.previousMessages.map(m => m.text || '').join(' ');
      const wasAngry = ANGER_PATTERNS.test(prevTexts);
      const nowAngry = PIVOT_PATTERNS['emotional-shift'].toAngry.test(message);
      const nowCalm = PIVOT_PATTERNS['emotional-shift'].toCalm.test(message);
      if (!wasAngry && nowAngry) return 'emotional-shift';
      if (wasAngry && nowCalm) return 'emotional-shift';
    }

    // Scope change (check before service-change so "whole house" doesn't get caught by "actually")
    if (PIVOT_PATTERNS['scope-change'].test(message)) {
      return 'scope-change';
    }

    // Service change — needs actual service keyword shift
    if (PIVOT_PATTERNS['service-change'].test(message)) {
      for (const [cat, pattern] of Object.entries(SERVICE_KEYWORDS)) {
        if (pattern.test(message) && cat !== dims[0] && dims[0] !== 'unknown') {
          return 'service-change';
        }
      }
    }

    return null;
  }

  /**
   * V18.1: Quick check — is this an objection vs genuine novelty?
   * @param {string} message
   * @returns {'objection'|'genuine'|'none'}
   */
  quickClassify(message) {
    if (!message) return 'none';
    if (OBJECTION_INDICATORS.test(message)) return 'objection';
    // Check for genuine novelty indicators
    if (ANGER_PATTERNS.test(message)) return 'genuine';
    for (const [, pattern] of Object.entries(SERVICE_KEYWORDS)) {
      if (pattern.test(message)) return 'genuine';
    }
    return 'none';
  }
}

module.exports = { NoveltyDetector };

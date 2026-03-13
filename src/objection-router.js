/**
 * Objection Router — V18.1
 * Fluid dynamics: when a lead hits a wall, redirect around it.
 * Classifies objections and routes to alternative paths.
 */

// Objection type classifiers
const OBJECTION_PATTERNS = {
  price: {
    pattern: /\b(too (much|expensive|high|pricey)|can'?t afford|over budget|cost(s)? too|cheaper|discount|deal|coupon|free estimate|payment plan|financing|what.{0,10}cost|how much|price|fixed income|can'?t spend|budget|spend (a lot|much|that)|tight month|throwing money|expensive for|really expensive|sounds expensive|insane.{0,15}\$|monthly payments?|senior discount|invest that much|not.{0,15}(afford|spend)|a lot of money|that'?s steep|more than I expected|pricey|pretty penny|sticker shock|way more than|wasn'?t expecting that)\b/i,
    weight: 0.85,
  },
  thinking: {
    pattern: /\b(need to think|think about it|sleep on it|not sure yet|let me consider|mull it over|give me time|deciding|weigh.{0,10}options|haven'?t decided|not sure (if|I|about|whether)|crunch the numbers|look into it|is it (worth|really)|seems like a (lot|gimmick|scam)|think it over|sit with it|chew on it|digest this|process this|let it marinate|need a minute|wrap my head around)\b/i,
    weight: 0.8,
  },
  spouse: {
    pattern: /\b(spouse|wife|husband|partner|talk to my|check with|ask my|run it by|other half|significant other|co-owner|landlord|my son|my (dad|father|brother)|he (said|says|wants|needs)|she (said|says|wants|needs)|need to check|check my lease)\b/i,
    weight: 0.8,
  },
  timing: {
    pattern: /\b(not now|bad time|busy right now|later|another time|next (week|month)|after the|too soon|not ready|wait (until|till|for)|good time\??|almost summer|almost winter|sell.{0,10}(house|home|it)|might (sell|move)|leaving town|busy this week|crazy week|slammed right now|hectic (week|month|time)|swamped|tied up|got a lot going on|not a good (time|week)|not a great time)\b/i,
    weight: 0.8,
  },
  trust: {
    pattern: /\b(reviews|references|how long.{0,25}business|license|insured|bonded|guarantee|warranty|bbb|accredit|certified|legit|last (company|guy|tech|repair)|terrible|broke again|same thing|bad experience|how do I know|trust)\b/i,
    weight: 0.75,
  },
  competitor: {
    pattern: /\b(other (company|companies|quote|quotes|estimate)|getting quotes|compare|already have someone|another company|second opinion|competitor|quoted \$|can you (beat|match)|beat that|competitive|3 quotes|three quotes)\b/i,
    weight: 0.8,
  },
  diy: {
    pattern: /\b(do it myself|diy|youtube|watch a video|figure it out|my (buddy|friend|uncle|neighbor|son)|know a guy|fix it myself|try it myself|he.{0,5}(look|fix|check)|window unit instead|just buy the part)\b/i,
    weight: 0.75,
  },
};

// Flow-around strategies per objection type
const FLOW_AROUND_PATHS = {
  price: [
    { strategy: 'free_estimate', response: "Totally understand — we can send someone out for a free estimate so you know exactly what you're looking at. No commitment. Want to set that up?" },
    { strategy: 'financing', response: "We actually offer financing options that can make it a lot more manageable. Want me to have someone walk you through it?" },
    { strategy: 'value_reframe', response: "I hear you on cost. The good news is getting it handled now usually saves a lot more down the road. Want a free quote to see where things stand?" },
  ],
  thinking: [
    { strategy: 'low_pressure_info', response: "No rush at all! Want me to send over some info so you have it when you're ready?" },
    { strategy: 'callback_offer', response: "Totally fair. How about I have someone follow up in a day or two? That way you've got time but don't have to remember to call back." },
    { strategy: 'question_prompt', response: "Of course — take your time. Is there anything specific you're weighing that I could help clarify?" },
  ],
  spouse: [
    { strategy: 'include_both', response: "Makes sense! We could set up a time when you're both available — that way everyone's on the same page. Would that work?" },
    { strategy: 'info_packet', response: "Totally — want me to send over the details so you can go over it together?" },
    { strategy: 'free_estimate_both', response: "No problem! Our estimates are free and no-obligation, so you could both be there when the tech explains everything. Want to schedule one?" },
  ],
  timing: [
    { strategy: 'future_callback', response: "No problem! When would be a better time? I can make a note and have someone reach out then." },
    { strategy: 'quick_info', response: "Totally get it. Just so you have it — want me to grab your info so we can reach out when the timing's better?" },
    { strategy: 'urgency_check', response: "Understood. Just want to make sure — is everything working okay for now? Don't want anything getting worse in the meantime." },
  ],
  trust: [
    { strategy: 'credentials', response: "Great question! We're fully licensed, insured, and bonded. Happy to share references too. Want me to send those over?" },
    { strategy: 'social_proof', response: "Totally fair to check. We've been doing this for years and have great reviews. Want me to point you to some?" },
    { strategy: 'no_obligation', response: "I appreciate you being thorough! We do free, no-obligation estimates — so you can meet the team and see if it's a good fit. Interested?" },
  ],
  competitor: [
    { strategy: 'match_offer', response: "Smart to compare! We'd love a shot at earning your business. Want a free estimate to stack up against what you've got?" },
    { strategy: 'differentiator', response: "Makes sense to shop around. What we hear a lot is people appreciate our response time and the fact we don't upsell. Want to see for yourself?" },
    { strategy: 'free_quote', response: "Getting multiple quotes is a great move. Ours are free and there's no pressure. Want me to set one up?" },
  ],
  diy: [
    { strategy: 'safety_angle', response: "Respect the DIY spirit! Just a heads up — some of this stuff can be tricky (and sometimes unsafe) without the right tools. Want a free diagnostic to see what you're dealing with?" },
    { strategy: 'diagnostic_offer', response: "Totally get it. If you want, we can at least do a diagnostic so you know exactly what needs fixing before you dive in. No charge for the assessment." },
    { strategy: 'hybrid_approach', response: "Nice — handy person! Some parts you can definitely tackle yourself. Want me to have a tech give you a quick call to talk through what makes sense to DIY vs. what's better left to a pro?" },
  ],
};

class ObjectionRouter {
  constructor() {
    // archetype → objectionType → { attempts, successes, bestStrategy }
    this.flowAroundStats = new Map();
  }

  /**
   * Classify an objection from a message
   * @param {string} message
   * @returns {{ objectionType: string|null, confidence: number, reason: string }}
   */
  classify(message) {
    if (!message) return { objectionType: null, confidence: 0, reason: 'empty message' };

    let bestType = null;
    let bestConfidence = 0;
    let bestReason = '';

    for (const [type, config] of Object.entries(OBJECTION_PATTERNS)) {
      if (config.pattern.test(message)) {
        if (config.weight > bestConfidence) {
          bestType = type;
          bestConfidence = config.weight;
          bestReason = type;
        }
      }
    }

    if (!bestType) return { objectionType: null, confidence: 0, reason: 'no objection detected' };
    return { objectionType: bestType, confidence: bestConfidence, reason: bestReason };
  }

  /**
   * Get flow-around response for an objection
   * @param {string} objectionType
   * @param {string} archetype
   * @returns {{ strategy: string, response: string, escalate: boolean }}
   */
  route(objectionType, archetype) {
    const paths = FLOW_AROUND_PATHS[objectionType];
    if (!paths || paths.length === 0) {
      return { strategy: 'escalate', response: null, escalate: true };
    }

    // Check if we have stats on best strategy for this archetype
    const key = `${archetype}:${objectionType}`;
    const stats = this.flowAroundStats.get(key);

    if (stats && stats.bestStrategy) {
      const best = paths.find(p => p.strategy === stats.bestStrategy);
      if (best) return { ...best, escalate: false };
    }

    // Default: pick first (most common) strategy
    // In production, could rotate or use weighted random
    const selected = paths[0];
    return { strategy: selected.strategy, response: selected.response, escalate: false };
  }

  /**
   * Record outcome of a flow-around attempt
   * @param {string} archetype
   * @param {string} objectionType
   * @param {string} strategy
   * @param {boolean} succeeded
   */
  recordOutcome(archetype, objectionType, strategy, succeeded) {
    const key = `${archetype}:${objectionType}`;
    if (!this.flowAroundStats.has(key)) {
      this.flowAroundStats.set(key, { attempts: 0, successes: 0, strategyStats: {}, bestStrategy: null });
    }

    const stats = this.flowAroundStats.get(key);
    stats.attempts++;
    if (succeeded) stats.successes++;

    if (!stats.strategyStats[strategy]) {
      stats.strategyStats[strategy] = { attempts: 0, successes: 0 };
    }
    stats.strategyStats[strategy].attempts++;
    if (succeeded) stats.strategyStats[strategy].successes++;

    // Update best strategy
    let bestRate = -1;
    let bestStrat = null;
    for (const [strat, s] of Object.entries(stats.strategyStats)) {
      if (s.attempts >= 2) { // Need at least 2 attempts
        const rate = s.successes / s.attempts;
        if (rate > bestRate) {
          bestRate = rate;
          bestStrat = strat;
        }
      }
    }
    if (bestStrat) stats.bestStrategy = bestStrat;
  }

  /**
   * Get stats for an archetype+objection combo
   */
  getStats(archetype, objectionType) {
    const key = `${archetype}:${objectionType}`;
    return this.flowAroundStats.get(key) || null;
  }

  /**
   * Get all available objection types
   */
  getObjectionTypes() {
    return Object.keys(OBJECTION_PATTERNS);
  }

  /**
   * Get all flow-around paths for an objection type
   */
  getPaths(objectionType) {
    return FLOW_AROUND_PATHS[objectionType] || [];
  }
}

module.exports = { ObjectionRouter, OBJECTION_PATTERNS, FLOW_AROUND_PATHS };

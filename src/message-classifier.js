/**
 * Message Classifier — V17 Tiered Model Routing
 * Local classifier that pre-screens messages BEFORE any API call.
 * Zero tokens, <1ms. Routes to cheapest capable tier.
 */

// Keyword bucket patterns
const PATTERNS = {
  AFFIRMATIVE: /^(yes|yeah|yep|yup|sure|ok|okay|sounds good|perfect|great|absolutely|definitely|for sure|agreed|got it|works for me|ok cool|yeah go ahead|yep thats right|yep that's right|great thanks|yeah for sure)[\s!.]*$/i,
  AFFIRMATIVE_LOOSE: /\b(yes|yeah|yep|yup|sure|ok|okay|sounds good|perfect|great|absolutely|definitely|for sure)\b/i,
  NEGATIVE: /\b(no thanks|not interested|unsubscribe|remove me|wrong number|opt out|opt-out|take me off|don't text|dont text|no more|stop texting|stop messaging|stop contacting)\b|^stop[\s!.]*$/i,
  NEGATIVE_SHORT: /^(no|nope|nah|pass)[\s!.]*$/i,
  PRICING: /\b(how much|cost|price|quote|estimate|pricing|rates?|fees?|charges?|expensive|cheap|afford|budget|payment|financing)\b/i,
  EMERGENCY: /\b(leak(ing|s|ed)?|flood(ing|ed|s)?|overflowing|overflow|fire|gas smell|smell.{0,5}gas|no heat|no ac|no a\/c|no hot water|burst\s*pipes?|pipes?\s*burst|sparking|smoke|carbon monoxide|emergency|urgent|asap|immediately|right now|dangerous|water\s*everywhere|urgente|emergencia|notfall|dringend|mold)\b/i,
  SCHEDULING: /\b(when|available|schedule|appointment|tomorrow|today|this week|next week|what time|book|slot|earliest|soonest|come out)\b/i,
  TRANSFER_SIGNAL_PHONE: /\(?\d{3}\)?[\-.\s]?\d{3}[\-.\s]?\d{4}/,
  TRANSFER_SIGNAL_TEXT: /\b(call me|talk to someone|speak to|real person|human|representative|rep)\b/i,
  ANGRY_WORDS: /\b(fuck|shit|damn|ass|hell|bullshit|crap|wtf|manager|supervisor|complaint|terrible|worst|ridiculous|horrible|pathetic|incompetent|lawsuit|attorney|lawyer|bbb|better business)\b/i,
  TECHNICAL: /\b(model\s*#?\s*\w+|error\s*(code|e\d+)|serial\s*number|part\s*number|btu|seer|compressor|condenser|evaporator|capacitor|blower\s*motor|thermocouple|igniter|heat\s*exchanger|refrigerant|freon|r-?\d{2,3}|circuit\s*breaker|amperage|voltage|wattage)\b/i,
  GREETING: /^(hi|hello|hey|good morning|good afternoon|good evening|howdy|what's up|whats up|sup)[\s!.,]*$/i,
  GREETING_LOOSE: /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
  EMOJI_ONLY: /^[\p{Emoji}\s\u200d\ufe0f]+$/u,
  INJECTION: /\b(ignore|disregard|forget|override|reveal|system\s*prompt|instructions|you\s*are\s*now|act\s*as|pretend|jailbreak|dan\s*mode|dev\s*mode)\b/i,
  URGENCY: /\b(hurry|rush|please help|help me|kids|children|elderly|baby|pregnant|disabled|asap|right now|immediately|send someone)\b/i,
  ESCALATION: /\b(refund|money back|cancel|sue|lawyer|attorney|bbb|complaint|report you|full refund)\b/i,
  PRODUCT_REC: /\b(which\s+brand|what\s+brand|best\s+(ac|hvac|furnace|unit|system|thermostat)|should\s+i\s+get|recommend|nest\s+or|ecobee|carrier\s+or|trane\s+or|lennox\s+or|compare|comparison)\b/i,
  MINOR: /\b(i'?m\s+\d{1,2}\s*(years?\s*old|yr)|i'?m\s+(a\s+)?(kid|teen|teenager|minor|child)|my\s+parents?\s+(are|is)|home\s+alone|(\b\d{1,2}\b)\s+and\s+(our|my)\s+(parents?|mom|dad))\b/i,
  VULNERABILITY: /\b(elderly|disabled|wheelchair|deaf|blind|disability|special\s+needs|handicap|senior\s+citizen|lives?\s+alone|home\s+alone)\b/i,
  PROXY: /\b(on\s+behalf|texting\s+for|calling\s+for|my\s+(mom|dad|mother|father|parent|grandma|grandmother|grandfather|grandpa|wife|husband|spouse|tenant|landlord)\s+(needs?|wants?|asked|said))\b/i,
  RETURNING: /\b(talked?\s+(to|with)\s+(someone|you|a\s+rep)|spoke\s+(last|a\s+few)|following\s+up|follow\s*-?\s*up|heard\s+back|called\s+(before|last|earlier)|previous\s+(conversation|call|visit))\b/i,
  COMMERCIAL: /\b(office\s+building|commercial|business|restaurant|warehouse|apartment\s+complex|multi.?unit|industrial|retail|store|shop|hotel)\b/i,
  INSURANCE: /\b(insurance\s+(claim|company|adjuster)|file\s+(a\s+)?claim|storm\s+damage|flood\s+damage|covered\s+by\s+insurance)\b/i,
  PRICE_MATCH: /\b(price\s+match|beat\s+(that|their)\s+(price|quote)|lower\s+quote|cheaper\s+quote|got\s+a\s+quote\s+from)\b/i,
};

// Profanity for anger detection (subset)
const PROFANITY = /\b(fuck|shit|damn|ass|bitch|bastard|crap|wtf|stfu|idiot|stupid)\b/i;

/**
 * Classify a message into tier 0/1/2 with confidence score
 * @param {string} message - The raw message text
 * @param {object} ctx - Conversation context
 * @param {number} ctx.messageIndex - Position in conversation (0-based)
 * @param {number} [ctx.previousTier] - Last tier used
 * @param {object} [ctx.leadData] - Lead info (name, serviceType)
 * @param {boolean} [ctx.isTransferred] - Whether already transferred
 * @param {string[]} [ctx.sanitizationActions] - Actions from V16 sanitizer
 * @param {boolean} [ctx.anomalyFlagged] - Whether anomaly detector flagged this session
 * @returns {{ tier: number, confidence: number, signals: string[], reasoning: string }}
 */
function classifyMessage(message, ctx = {}) {
  const {
    messageIndex = 0,
    previousTier,
    leadData = {},
    isTransferred = false,
    sanitizationActions = [],
    anomalyFlagged = false,
  } = ctx;

  const signals = [];
  const msg = (message || '').trim();
  const msgLower = msg.toLowerCase();
  const len = msg.length;

  // --- Signal detection ---

  // Length signals
  if (len < 15) signals.push('very_short');
  else if (len < 50) signals.push('short_message');
  else if (len > 100) signals.push('long_message');

  // Keyword buckets
  if (PATTERNS.AFFIRMATIVE.test(msg)) signals.push('affirmative');
  else if (PATTERNS.AFFIRMATIVE_LOOSE.test(msg)) signals.push('affirmative_loose');

  if (PATTERNS.NEGATIVE.test(msg)) signals.push('opt_out');
  if (PATTERNS.NEGATIVE_SHORT.test(msg)) signals.push('negative_short');
  if (PATTERNS.PRICING.test(msg)) signals.push('pricing');
  if (PATTERNS.EMERGENCY.test(msg)) signals.push('emergency');
  if (PATTERNS.SCHEDULING.test(msg)) signals.push('scheduling');
  if (PATTERNS.TRANSFER_SIGNAL_PHONE.test(msg)) signals.push('phone_number');
  if (PATTERNS.TRANSFER_SIGNAL_TEXT.test(msg)) signals.push('transfer_request');
  if (PATTERNS.ANGRY_WORDS.test(msg)) signals.push('angry_words');
  if (PATTERNS.TECHNICAL.test(msg)) signals.push('technical');
  if (PATTERNS.GREETING.test(msg)) signals.push('greeting');
  else if (PATTERNS.GREETING_LOOSE.test(msg)) signals.push('greeting_loose');
  if (PATTERNS.EMOJI_ONLY.test(msg) && len > 0) signals.push('emoji_only');
  if (PATTERNS.INJECTION.test(msg)) signals.push('injection_attempt');
  if (PATTERNS.URGENCY.test(msg)) signals.push('urgency');
  if (PATTERNS.ESCALATION.test(msg)) signals.push('escalation');
  if (PATTERNS.PRODUCT_REC.test(msg)) signals.push('product_recommendation');
  if (PATTERNS.MINOR.test(msg)) signals.push('minor_detected');
  if (PATTERNS.VULNERABILITY.test(msg)) signals.push('vulnerability');
  if (PATTERNS.PROXY.test(msg)) signals.push('proxy_contact');
  if (PATTERNS.RETURNING.test(msg)) signals.push('returning_lead');
  if (PATTERNS.COMMERCIAL.test(msg)) signals.push('commercial');
  if (PATTERNS.INSURANCE.test(msg)) signals.push('insurance');
  if (PATTERNS.PRICE_MATCH.test(msg)) signals.push('price_match');

  // ALL CAPS detection (min 20 chars, >50% uppercase)
  if (len >= 20) {
    const alphaChars = msg.replace(/[^a-zA-Z]/g, '');
    const upperChars = alphaChars.replace(/[^A-Z]/g, '');
    if (alphaChars.length > 0 && upperChars.length / alphaChars.length > 0.5) {
      signals.push('all_caps');
    }
  }

  // Question marks
  const questionMarks = (msg.match(/\?/g) || []).length;
  if (questionMarks >= 1) signals.push('has_question');
  if (questionMarks >= 2) signals.push('multi_question');

  // Complexity score
  const words = msgLower.split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);
  const complexityRatio = words.length > 0 ? uniqueWords.size / words.length : 0;
  if (words.length > 15 && complexityRatio > 0.75) signals.push('high_complexity');

  // Multi-intent: multiple distinct topic signals
  const intentSignals = ['pricing', 'scheduling', 'emergency', 'technical', 'transfer_request'].filter(s => signals.includes(s));
  if (intentSignals.length >= 2) signals.push('multi_intent');

  // Conversation position
  if (messageIndex === 0) signals.push('first_message');
  else if (messageIndex === 1) signals.push('second_message');
  else signals.push('position_3_plus');

  // Sanitization signals from V16
  if (sanitizationActions.length > 0) {
    const dangerousActions = sanitizationActions.filter(a =>
      a.includes('injection') || a.includes('social_engineering') || a.includes('advanced_injection')
    );
    if (dangerousActions.length > 0) signals.push('sanitization_flagged');
  }

  if (anomalyFlagged) signals.push('anomaly_flagged');

  // --- Tier decision ---

  // ALWAYS Tier 2: first message, emergency, anger, injection, anomaly
  if (signals.includes('first_message')) {
    return result(2, 0.95, signals, 'First message from lead — always full qualification');
  }
  if (signals.includes('anomaly_flagged')) {
    return result(2, 0.95, signals, 'Anomaly detector flagged this session');
  }
  if (signals.includes('injection_attempt') || signals.includes('sanitization_flagged')) {
    return result(2, 0.99, signals, 'Potential injection attempt — route to max scrutiny');
  }
  if (signals.includes('emergency')) {
    return result(2, 0.95, signals, 'Emergency keywords detected');
  }
  if (signals.includes('angry_words') || signals.includes('all_caps')) {
    return result(2, 0.90, signals, 'Anger signals detected — needs careful handling');
  }
  if (signals.includes('urgency')) {
    return result(2, 0.85, signals, 'Urgency signals detected — needs immediate attention');
  }
  if (signals.includes('escalation')) {
    return result(2, 0.90, signals, 'Escalation/complaint — needs careful handling');
  }
  if (signals.includes('multi_intent')) {
    return result(2, 0.85, signals, 'Multiple intents detected — complex message');
  }
  if (signals.includes('technical')) {
    return result(2, 0.85, signals, 'Technical question requiring expertise');
  }
  if (signals.includes('long_message') && signals.includes('high_complexity')) {
    return result(2, 0.80, signals, 'Long complex message needs full reasoning');
  }
  if (signals.includes('transfer_request')) {
    return result(2, 0.85, signals, 'Transfer/human request — needs careful handling');
  }
  if (signals.includes('product_recommendation')) {
    return result(2, 0.85, signals, 'Product recommendation — needs expert knowledge');
  }
  if (signals.includes('minor_detected')) {
    return result(2, 0.95, signals, 'Minor/child detected — needs careful handling');
  }
  if (signals.includes('vulnerability')) {
    return result(2, 0.85, signals, 'Vulnerability/accessibility — needs careful handling');
  }
  if (signals.includes('returning_lead')) {
    return result(2, 0.85, signals, 'Returning lead — needs context-aware handling');
  }
  if (signals.includes('commercial')) {
    return result(2, 0.85, signals, 'Commercial service — needs specialized handling');
  }
  if (signals.includes('insurance')) {
    return result(2, 0.85, signals, 'Insurance claim — needs specialized handling');
  }
  if (signals.includes('price_match')) {
    return result(2, 0.85, signals, 'Price match/comparison — needs careful handling');
  }
  if (signals.includes('proxy_contact')) {
    return result(2, 0.80, signals, 'Proxy/third-party contact — needs careful handling');
  }

  // Tier 0: simple template responses
  if (signals.includes('affirmative') && !signals.includes('has_question') && len < 20) {
    return result(0, 0.95, signals, 'Short affirmative, no question');
  }
  if (signals.includes('greeting') && !signals.includes('has_question')) {
    return result(0, 0.90, signals, 'Simple greeting, no question');
  }
  if (signals.includes('opt_out')) {
    return result(0, 0.95, signals, 'Opt-out/stop message');
  }
  if (signals.includes('negative_short') && !signals.includes('has_question') && len < 10) {
    return result(0, 0.85, signals, 'Short negative response');
  }
  if (signals.includes('emoji_only')) {
    return result(0, 0.90, signals, 'Emoji-only message');
  }
  if (signals.includes('phone_number') && !signals.includes('has_question') && !signals.includes('transfer_request') && len < 50) {
    return result(0, 0.90, signals, 'Phone number provided for transfer');
  }

  // Tier 1: simple follow-ups
  if ((signals.includes('position_3_plus') || signals.includes('second_message')) && signals.includes('short_message') && !signals.includes('emergency') && !signals.includes('angry_words')) {
    return result(1, 0.80, signals, 'Short follow-up in conversation');
  }
  if (signals.includes('scheduling') && !signals.includes('multi_intent') && len < 60) {
    return result(1, 0.80, signals, 'Simple scheduling question');
  }
  if (signals.includes('pricing') && !signals.includes('multi_intent') && len < 60) {
    return result(1, 0.80, signals, 'Simple pricing question');
  }
  if (signals.includes('greeting_loose') && signals.includes('has_question') && !signals.includes('multi_question') && len < 80) {
    return result(1, 0.75, signals, 'Greeting with simple question');
  }
  if ((signals.includes('position_3_plus') || signals.includes('second_message')) && signals.includes('very_short')) {
    return result(1, 0.75, signals, 'Very short response in conversation');
  }
  if (signals.includes('affirmative_loose') && signals.includes('has_question') && len < 60) {
    return result(1, 0.75, signals, 'Affirmative with follow-up question');
  }

  // Default: if we can't confidently categorize, route to Tier 2
  if (signals.includes('long_message')) {
    return result(2, 0.70, signals, 'Long message — defaulting to full model');
  }

  // Short-ish messages we're not sure about
  if (len < 50 && signals.includes('position_3_plus')) {
    return result(1, 0.65, signals, 'Short message in established conversation — Tier 1 with lower confidence');
  }

  return result(2, 0.60, signals, 'Cannot confidently categorize — routing to full model');
}

function result(tier, confidence, signals, reasoning) {
  return { tier, confidence, signals: [...signals], reasoning };
}

module.exports = { classifyMessage, PATTERNS };

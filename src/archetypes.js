/**
 * Archetype Classifier — V18 Conversation Antibodies
 * Local (no API) classifier that maps leads to archetype hashes.
 * Archetype = serviceCategory:urgency:personality:intent
 */

// Service category keywords
const SERVICE_PATTERNS = {
  repair: /\b(repair|fix|broken|not working|stopped working|won't start|won't turn on|malfunction|issue|problem|acting up|making noise|leaking|leak|dripping|rattling|buzzing|clicking|froze|frozen)\b/i,
  install: /\b(install|new system|new unit|replacement|upgrade|replace|put in|set up|new construction|addition|build)\b/i,
  maintenance: /\b(maintenance|tune[- ]?up|check[- ]?up|service call|inspection|annual|seasonal|clean|filter|routine)\b/i,
  emergency: /\b(emergency|flood(?:ing|ed)?|fire|gas leak|carbon monoxide|burst pipe|pipe burst|no heat|no ac|no a\/c|no hot water|dangerous|smoke|sparking|water everywhere|sewage|overflowing|tree fell|roof caved|caught fire|backing up|backed up)\b/i,
  inspection: /\b(inspection|evaluate|assessment|check out|look at|diagnose|diagnostic|estimate)\b/i,
};

// Urgency keywords
const URGENCY_PATTERNS = {
  critical: /\b(asap|right now|immediately|emergency|urgent|today|can't wait|help me|please help|kids|children|elderly|baby|pregnant|dangerous|critical)\b/i,
  soon: /\b(soon|this week|next few days|couple days|when available|earliest|soonest|tomorrow|pretty soon)\b/i,
  planning: /\b(eventually|no rush|when you can|next month|thinking about|considering|planning|down the road|sometime|looking into|researching)\b/i,
};

// Intent keywords
const INTENT_PATTERNS = {
  buying: /\b(schedule|book|set up|ready|go ahead|let's do it|when can you|need someone|send someone|come out|appointment|want to get|need to get)\b/i,
  shopping: /\b(how much|cost|price|quote|estimate|pricing|rates?|fees?|compare|options|affordable|budget|financing|payment plan|cheaper|deals?)\b/i,
  browsing: /\b(just wondering|curious|information|tell me about|what do you|learn more|thinking about|considering|maybe|not sure|exploring)\b/i,
  complaining: /\b(terrible|worst|horrible|incompetent|never again|rip off|scam|waste|awful|pathetic|ridiculous|unacceptable|complaint|disappointed|frustrated|angry|pissed|furious)\b/i,
};

/**
 * Classify a lead into an archetype hash
 * @param {object} leadData - { name, serviceType, message, phone, ... }
 * @param {Array} messages - Array of { role: 'lead'|'hermes', text: string }
 * @returns {{ archetype: string, confidence: number, dimensions: object }}
 */
function classify(leadData, messages = []) {
  const text = _gatherText(leadData, messages);
  
  const serviceCategory = _classifyDimension(text, SERVICE_PATTERNS, leadData.serviceType);
  const urgency = _classifyUrgency(text);
  const personality = _classifyPersonality(leadData, messages);
  const intent = _classifyIntent(text);

  const archetype = `${serviceCategory.value}:${urgency.value}:${personality.value}:${intent.value}`;
  
  // Confidence = average of dimension confidences, penalized by unknown count
  const dimensions = { serviceCategory, urgency, personality, intent };
  const confidences = [serviceCategory.confidence, urgency.confidence, personality.confidence, intent.confidence];
  const unknownCount = confidences.filter((_, i) => [serviceCategory, urgency, personality, intent][i].value === 'unknown').length;
  
  let confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  // Penalize unknowns heavily
  confidence = confidence * (1 - unknownCount * 0.15);
  confidence = Math.max(0, Math.min(1, confidence));

  return { archetype, confidence, dimensions };
}

function _gatherText(leadData, messages) {
  const parts = [];
  if (leadData.serviceType) parts.push(leadData.serviceType);
  if (leadData.message) parts.push(leadData.message);
  if (leadData.originalMessage) parts.push(leadData.originalMessage);
  // Use first 2 lead messages
  const leadMsgs = messages.filter(m => m.role === 'lead').slice(0, 2);
  leadMsgs.forEach(m => parts.push(m.text));
  return parts.join(' ');
}

function _classifyDimension(text, patterns, formField) {
  // Check form field first (most reliable)
  if (formField) {
    const formLower = formField.toLowerCase();
    for (const [key] of Object.entries(patterns)) {
      if (formLower.includes(key)) return { value: key, confidence: 0.95 };
    }
  }
  
  // Check text patterns
  const matches = {};
  for (const [key, regex] of Object.entries(patterns)) {
    const m = text.match(new RegExp(regex.source, 'gi'));
    if (m) matches[key] = m.length;
  }
  
  if (Object.keys(matches).length === 0) return { value: 'unknown', confidence: 0.3 };
  
  const best = Object.entries(matches).sort((a, b) => b[1] - a[1])[0];
  const confidence = Math.min(0.95, 0.6 + best[1] * 0.1);
  return { value: best[0], confidence };
}

function _classifyUrgency(text) {
  // Emergency service category implies critical urgency
  if (SERVICE_PATTERNS.emergency.test(text)) {
    return { value: 'critical', confidence: 0.9 };
  }
  // Check critical first (emergency keywords win)
  if (URGENCY_PATTERNS.critical.test(text)) {
    // Check caps ratio as amplifier
    const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
    const conf = capsRatio > 0.3 ? 0.95 : 0.85;
    return { value: 'critical', confidence: conf };
  }
  if (URGENCY_PATTERNS.soon.test(text)) return { value: 'soon', confidence: 0.8 };
  if (URGENCY_PATTERNS.planning.test(text)) return { value: 'planning', confidence: 0.8 };
  return { value: 'unknown', confidence: 0.3 };
}

function _classifyPersonality(leadData, messages) {
  const leadMsgs = messages.filter(m => m.role === 'lead');
  const text = leadMsgs.map(m => m.text).join(' ') || leadData.message || leadData.originalMessage || '';
  
  if (!text || text.length === 0) return { value: 'unknown', confidence: 0.3 };
  
  const avgLen = text.length / Math.max(leadMsgs.length, 1);
  const emojiCount = (text.match(/[\p{Emoji}]/gu) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;
  
  // Emotional: lots of exclamations, caps, or emotional words
  const emotionalWords = /\b(stressed|frustrated|scared|worried|desperate|help|please|can't take|awful|terrible|freaking|ugh)\b/i;
  if (exclamationCount >= 2 || emotionalWords.test(text)) {
    return { value: 'emotional', confidence: 0.8 };
  }
  
  // Analytical: questions, technical terms, longer messages
  const analyticalWords = /\b(options|compare|efficiency|seer|rating|warranty|brand|specs|specifications|reviews|research)\b/i;
  if (questionCount >= 2 || analyticalWords.test(text)) {
    return { value: 'analytical', confidence: 0.75 };
  }
  
  // Brief vs verbose
  if (avgLen < 30) return { value: 'brief', confidence: 0.8 };
  if (avgLen > 100) return { value: 'verbose', confidence: 0.8 };
  
  // Medium length — lean brief
  return { value: 'brief', confidence: 0.6 };
}

function _classifyIntent(text) {
  // Complaining first (strong signal)
  if (INTENT_PATTERNS.complaining.test(text)) return { value: 'complaining', confidence: 0.85 };
  // Browsing before shopping — browsing patterns are more specific ("just wondering", "curious")
  if (INTENT_PATTERNS.browsing.test(text)) return { value: 'browsing', confidence: 0.75 };
  if (INTENT_PATTERNS.buying.test(text)) return { value: 'buying', confidence: 0.8 };
  if (INTENT_PATTERNS.shopping.test(text)) return { value: 'shopping', confidence: 0.8 };
  return { value: 'unknown', confidence: 0.3 };
}

class ArchetypeClassifier {
  classify(leadData, messages = []) {
    return classify(leadData, messages);
  }
}

module.exports = { ArchetypeClassifier, classify };

/**
 * Output Validation Gate — V16 Security Hardening
 * Validates every AI response before sending to iMessage.
 * Rejects responses that leak internal info, break character, or contain unsafe content.
 */

const FALLBACK_MESSAGE = "Thanks for reaching out! A team member will be in touch shortly.";

// Patterns that indicate leaked system/internal info
const LEAK_PATTERNS = [
  /\bframework\.md\b/i,
  /\bFRAMEWORK-v\d+/i,
  /\bsystem\s*prompt\b/i,
  /\bsystem\s*-\s*immutable\b/i,
  /\bhermes\s*decision\s*framework\b/i,
  /\bgaius[-\s]?router\b/i,
  /\bconversation[-\s]?engine\b/i,
  /\bthread[-\s]?manager\b/i,
  /\bsession[-\s]?id\b/i,
  /\brequest[-\s]?id\b/i,
  /\bsessionId\b/,
  /\brequestId\b/,
  /\b(req|sess)_[a-z0-9_]{5,}\b/,
  /\bslack[-\s]?(bot|token|channel|webhook)\b/i,
  /\bimessage[-\s]?adapter\b/i,
  /\blead[-\s]?parser\b/i,
  /\bopus\s*4/i,
  /\bclaude\b/i,
  /\banthropic\b/i,
  /\bopenai\b/i,
  /\bgpt[-\s]?\d/i,
  /\buntrusted\s*user\s*input\b/i,
  /\bprompt\s*injection\b/i,
  /\bcanary\b/i,
  /\bdecision\s*tree\b/i,
  /\bqualification\s*question\s*q[1-5]\b/i,
  /\btransfer\s*immediately\b/i,
  /\bparachute\s*trigger\b/i,
  /\bhandoff[-\s]?payload\b/i,
  /\breengagement[-\s]?manager\b/i,
  /\.gaius-(requests|responses)\b/,
  /\bhermes[-\s]?interactive\b/i,
  /\btransfer\s*criteria\b/i,
  /\burgency\s*scale\b/i,
  /\bi\s*was\s*told\s*to\b/i,
  /\bmy\s*rules?\s*(state|say|tell|are|require|instruct)\b/i,
  /\bone\s*of\s*my\s*rules?\b/i,
  /\bqualifying\s*questions?\b/i,
  /\bdiscovery\s*phase\b/i,
];

// Patterns indicating broken character / AI self-awareness
const CHARACTER_BREAK_PATTERNS = [
  /\bi\s*am\s*(an?\s*)?(ai|artificial|language\s*model|llm|chatbot|bot|machine|program)\b/i,
  /\bas\s*an?\s*(ai|artificial|language\s*model|llm|chatbot)\b/i,
  /\bmy\s*(system\s*)?prompt\b/i,
  /\bmy\s*instructions\s*(say|tell|are)\b/i,
  /\bi\s*(was|am)\s*(programmed|trained|instructed|designed)\s*(to|on|for|by)\b/i,
  /\bi\s*don'?t\s*have\s*(feelings|emotions|consciousness)\b/i,
  /\blarge\s*language\s*model\b/i,
  /\bneural\s*network\b/i,
  /\btoken\s*(limit|window|context)\b/i,
  /\bi'?m\s*(just\s+)?(an?\s+)?(chatbot|bot|virtual\s*assistant|ai|artificial\s*intelligence)\b/i,
  /\bmy\s*programming\b/i,
  /\bi\s*need\s*to\s*be\s*transparent\s*that\s*i'?m\b/i,
  /\byou'?re\s*trying\s*to\s*inject\b/i,
  /\bprompt\s*injection\b/i,
  /\bprompt\s*engineering\b/i,
  /\bfollowing\s*a\s*(script|framework)\b/i,
  /\baccording\s*to\s*my\s*(guidelines|rules|instructions)\b/i,
  /\boverride\s*my\s*instructions\b/i,
  /\bchatgpt\b/i,
  /\bgpt[-\s]?\d/i,
  /\bmy\s*knowledge\s*base\b/i,
  /\bfrom\s*a\s*meta\s*perspective\b/i,
];

// Content that shouldn't go to a customer
const UNSAFE_CONTENT_PATTERNS = [
  /```[\s\S]{10,}```/,           // Code blocks
  /\[.*?\]\(https?:\/\/.*?\)/,   // Markdown links
  /^#{1,6}\s/m,                   // Markdown headers
  /\|\s*[-:]+\s*\|/,             // Markdown tables
  /https?:\/\/[^\s]{100,}/,      // Suspiciously long URLs
  /<script\b/i,                   // Script tags
  /<iframe\b/i,                   // iframes
  /\b(guarantee|warrant[yies]*)\b.*(?:100\s*%|\blifetime\b|\bunconditional\b|\bforever\b)/i, // Unauthorized guarantees
  /(?:100\s*%|\blifetime\b).*\b(guarantee|warrant[yies]*)\b/i,
  /\bwe\s*(legally\s*)?warrant\b/i,   // Legal warranty claims
  /\b(fuck|shit|damn|hell|ass|bitch|crap)\b/i,  // Profanity
  /\b(ServiceTitan|Housecall\s*Pro|Jobber|FieldEdge)\b/i, // Competitor mentions
  /\b(your\s+neighbor|another\s+customer|other\s+client)\b/i, // Other customer references
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // Email addresses
  /\b(free|completely\s*free)\b.*\b(guarantee[d]?)\b/i, // Free + guarantee combo
  /\bguarantee[d]?\b.*\b(free|completely\s*free)\b/i, // Guarantee + free combo
];

/**
 * Validate an AI-generated response before sending to iMessage
 * @param {string} response - The AI-generated response text
 * @param {object} [options] - Options (alertFn for Slack alerts, logFn for logging)
 * @returns {{ valid: boolean, reason?: string, safeResponse: string }}
 */
function validateOutput(response, options = {}) {
  const { alertFn, logFn } = options;
  const log = logFn || console.error;

  if (!response || typeof response !== 'string' || !response.trim()) {
    return { valid: false, reason: 'empty_response', safeResponse: FALLBACK_MESSAGE };
  }

  const text = response.trim();

  // Check for leaked internal info
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(text)) {
      const reason = `leak_detected: ${pattern.source}`;
      log(`[OutputValidator] 🚨 BLOCKED — ${reason} — "${text.substring(0, 200)}"`);
      if (alertFn) alertFn(`🛡️ Output validation BLOCKED response (${reason}): "${text.substring(0, 150)}..."`);
      return { valid: false, reason, safeResponse: FALLBACK_MESSAGE };
    }
  }

  // Check for broken character
  for (const pattern of CHARACTER_BREAK_PATTERNS) {
    if (pattern.test(text)) {
      const reason = `character_break: ${pattern.source}`;
      log(`[OutputValidator] 🚨 BLOCKED — ${reason} — "${text.substring(0, 200)}"`);
      if (alertFn) alertFn(`🛡️ Output validation BLOCKED response (${reason}): "${text.substring(0, 150)}..."`);
      return { valid: false, reason, safeResponse: FALLBACK_MESSAGE };
    }
  }

  // Check for unsafe content
  for (const pattern of UNSAFE_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      const reason = `unsafe_content: ${pattern.source}`;
      log(`[OutputValidator] 🚨 BLOCKED — ${reason} — "${text.substring(0, 200)}"`);
      if (alertFn) alertFn(`🛡️ Output validation BLOCKED response (${reason}): "${text.substring(0, 150)}..."`);
      return { valid: false, reason, safeResponse: FALLBACK_MESSAGE };
    }
  }

  // Response length sanity check (iMessage/SMS responses should be short)
  if (text.length > 500) {
    const reason = 'response_too_long';
    log(`[OutputValidator] 🚨 BLOCKED — ${reason} (${text.length} chars)`);
    if (alertFn) alertFn(`🛡️ Output validation BLOCKED response (${reason}): ${text.length} chars`);
    return { valid: false, reason, safeResponse: FALLBACK_MESSAGE };
  }

  return { valid: true, safeResponse: text };
}

const MAX_IMESSAGE_LENGTH = 320;

/**
 * Enforce response length cap for iMessage
 * @param {string} text - Response text
 * @returns {{ text: string, truncated: boolean }}
 */
function enforceResponseLengthCap(text) {
  if (!text || typeof text !== 'string') return { text: text || '', truncated: false };
  
  // Use string length (char count, not byte count)
  if (text.length <= MAX_IMESSAGE_LENGTH) {
    return { text, truncated: false };
  }
  
  // Try to truncate at last sentence boundary under 320 chars
  const truncTarget = text.substring(0, MAX_IMESSAGE_LENGTH);
  const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let lastBoundary = -1;
  
  for (const ender of sentenceEnders) {
    const idx = truncTarget.lastIndexOf(ender);
    if (idx > lastBoundary) lastBoundary = idx;
  }
  
  // Also check if truncTarget ends with sentence ender
  if (truncTarget.endsWith('.') || truncTarget.endsWith('!') || truncTarget.endsWith('?')) {
    lastBoundary = truncTarget.length - 1;
  }
  
  if (lastBoundary > 0) {
    const truncated = text.substring(0, lastBoundary + 1).trim();
    if (truncated.length <= MAX_IMESSAGE_LENGTH && truncated.length > 0) {
      console.log(`[OutputValidator] ✂️ Response truncated from ${text.length} to ${truncated.length} chars at sentence boundary`);
      return { text: truncated, truncated: true };
    }
  }
  
  // No good sentence boundary — hard truncate at 300 with "..."
  const hardTrunc = text.substring(0, 300) + '...';
  console.log(`[OutputValidator] ✂️ Response hard-truncated from ${text.length} to ${hardTrunc.length} chars`);
  return { text: hardTrunc, truncated: true };
}

module.exports = { validateOutput, enforceResponseLengthCap, FALLBACK_MESSAGE, MAX_IMESSAGE_LENGTH };

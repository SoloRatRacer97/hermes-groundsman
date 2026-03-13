/**
 * Handoff Payload Formatter
 * Creates structured payload for CSR handoff to #new-leads
 */

/**
 * Extract timeline from conversation transcript
 * Searches for timeline keywords and patterns in the conversation
 * V7: Added robust timeline extraction from transcript
 * @param {Object} session - Session state from state-manager
 * @returns {string} - Extracted timeline or 'Not specified'
 */

/**
 * Summarize raw timeline text into a clean category
 */
function summarizeTimeline(raw) {
  if (!raw || raw === 'Not specified') return 'Unsure';
  const lower = raw.toLowerCase();
  if (/today|asap|right now|immediately|emergency|urgent/.test(lower)) return 'Today';
  if (/tomorrow|next day/.test(lower)) return 'Tomorrow';
  if (/this week|few days|couple days|within.*week/.test(lower)) return 'This week';
  if (/next week/.test(lower)) return 'Next week';
  if (/this month|couple weeks|few weeks|within.*month/.test(lower)) return 'This month';
  if (/no rush|whenever|flexible|not urgent|no hurry/.test(lower)) return 'Flexible';
  if (/before.*summer|before.*spring|before.*winter|before.*fall|seasonal/.test(lower)) return 'Seasonal';
  // If it's short enough, use as-is; otherwise default
  if (raw.length <= 20) return raw;
  return 'Unsure';
}

/**
 * Build a synthesized problem summary from the full conversation, not raw lead text.
 * Extracts: what they need + key details (size, scope, urgency) into one sentence.
 */
function buildProblemSummary(session, serviceType) {
  const data = session.dataCollected || {};
  const originalMessage = session.originalMessage || data.problem || data.q1 || '';
  const transcript = session.transcript || [];
  
  // Collect all lead messages for context
  const leadMessages = transcript
    .filter(t => (t.sender === 'lead') && t.text)
    .map(t => t.text.toLowerCase());
  const allLeadText = [originalMessage, ...leadMessages.map(t => t)].join(' ').toLowerCase();
  
  // Extract key details from conversation
  const details = [];
  
  // Size/scope indicators
  const sizeMatch = allLeadText.match(/(\d+)\s*(ft|feet|foot|sqft|sq ft|square|acre|yard)/i);
  if (sizeMatch) details.push(`${sizeMatch[1]}${sizeMatch[2]}`);
  
  // Quantity indicators
  const qtyMatch = allLeadText.match(/(\d+)\s*(tree|bush|zone|section|room|area|bed)/i);
  if (qtyMatch) details.push(`${qtyMatch[1]} ${qtyMatch[2]}${parseInt(qtyMatch[1]) > 1 ? 's' : ''}`);
  
  // Build summary: service type + core need + details
  const coreNeed = originalMessage.split(/[.!?]/)[0].trim();
  const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
  
  // Keep it brief — one sentence max
  let summary = coreNeed || `${serviceType} service requested`;
  if (summary.length > 60) summary = summary.substring(0, 60).trim();
  summary = summary + detailStr;
  
  // Capitalize first letter
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

function extractTimeline(session) {
  // Try stored timeline first
  if (session.timeline) return session.timeline;
  
  const data = session.dataCollected || {};
  
  // Try dataCollected fields
  if (data.timeline) return data.timeline;
  if (data.q2) return data.q2;
  if (data.urgencyLevel) return data.urgencyLevel;
  
  // Search conversation for timeline keywords
  const transcript = session.transcript || [];
  const allMessages = transcript
    .map(t => {
      if (typeof t === 'string') return t;
      if (t.text) return t.text;
      return '';
    })
    .join(' ')
    .toLowerCase();
  
  // Timeline patterns (ordered by specificity)
  if (allMessages.includes('this afternoon')) return 'This afternoon';
  if (allMessages.includes('today')) return 'Today';
  if (allMessages.includes('tonight')) return 'Tonight';
  if (allMessages.includes('tomorrow morning')) return 'Tomorrow morning';
  if (allMessages.includes('tomorrow afternoon')) return 'Tomorrow afternoon';
  if (allMessages.includes('tomorrow')) return 'Tomorrow';
  if (allMessages.includes('this week')) return 'This week';
  if (allMessages.includes('next week')) return 'Next week';
  if (allMessages.includes('this weekend')) return 'This weekend';
  if (allMessages.includes('asap') || allMessages.includes('as soon as possible')) return 'ASAP';
  if (allMessages.includes('urgent') || allMessages.includes('emergency')) return 'URGENT';
  if (allMessages.includes('whenever') || allMessages.includes('flexible') || allMessages.includes('no rush')) return 'Flexible';
  
  // Check for urgency flags as fallback
  if (session.urgencyDetected || (session.buyingIntent && session.buyingIntent.hasBuyingIntent)) {
    return 'IMMEDIATE';
  }
  
  return 'Not specified';
}

/**
 * Format handoff payload as readable Slack message
 * V7: Added robust timeline extraction from transcript
 * @param {Object} session - Session state from state-manager
 * @param {Object} leadInfo - Original lead info from form
 * @returns {string} - Formatted Slack message
 */
function formatHandoffMessage(session, leadInfo) {
  const data = session.dataCollected || {};
  const leadTemp = session.leadTemp || 'COLD';
  
  // Determine emoji based on lead temperature
  const emoji = leadTemp === 'HOT' ? '🔥' : leadTemp === 'WARM' ? '🌟' : '❄️';
  
  // Build message sections
  const sections = [];
  
  // Header
  sections.push(`${emoji} *NEW LEAD - ${leadTemp}*`);
  sections.push(`*${leadInfo.name}* | ${leadInfo.phone}`);
  
  // Extract service type (fix: handle both service and serviceType fields)
  const serviceType = leadInfo.service || leadInfo.serviceType || session.serviceType || 'HVAC service';
  
  // Summarize timeline into simple categories
  const rawTimeline = extractTimeline(session);
  const timelineLabel = summarizeTimeline(rawTimeline);
  
  sections.push(`Service: ${serviceType} | Timeline: ${timelineLabel}`);
  sections.push('');
  
  // Build problem summary from conversation context — not just raw lead text
  const problemSummary = buildProblemSummary(session, serviceType);
  sections.push(`*Problem:* ${problemSummary}`);
  
  // Source
  sections.push(`Source: ${leadInfo.source || session.source || 'Groundsman Website'}`);
  
  // Conversation transcript (fix: format objects properly)
  if (session.transcript && session.transcript.length > 0) {
    sections.push('');
    sections.push('*Conversation:*');
    // Take last 6 messages, deduplicate, and format
    const seen = new Set();
    const formattedTranscript = session.transcript.slice(-6).map(msg => {
      if (typeof msg === 'string') return msg;
      if (msg.sender && msg.text) {
        const key = `${msg.sender}:${msg.text}`;
        if (seen.has(key)) return ''; // Skip duplicates
        seen.add(key);
        const sender = msg.sender === 'lead' ? 'Lead' : 'Hermes';
        return `${sender}: "${msg.text}"`;
      }
      return '';
    }).filter(line => line);
    
    sections.push(formattedTranscript.join('\n'));
  }
  
  return sections.join('\n');
}

/**
 * Create structured JSON payload
 * V5: Added buying intent data
 * @param {Object} session - Session state from state-manager
 * @param {Object} leadInfo - Original lead info from form
 * @returns {Object} - Structured payload
 */
function createHandoffPayload(session, leadInfo) {
  const data = session.dataCollected || {};
  
  return {
    leadName: leadInfo.name,
    phone: leadInfo.phone,
    serviceType: leadInfo.service,
    problemDescription: data.problem || '',
    urgencyLevel: data.timeline || '',
    systemAge: data.system_age || '',
    issueDuration: data.issue_duration || '',
    additionalNotes: data.notes || '',
    leadTemperature: session.leadTemp || 'COLD',
    frustrationFlag: getFrustrationLevel(session.frustrationScore),
    parachuteReason: session.parachuteReason || null,
    emergencyFlag: session.emergencyFlag || false,
    buyingIntent: session.buyingIntent || null,
    buyingIntentTriggers: session.buyingIntentTriggers || [],
    urgencyDetected: session.urgencyDetected || false,
    conversationTranscript: session.transcript || [],
    timestamp: new Date().toISOString(),
    source: leadInfo.source || 'HVAC Website',
    path: session.path || 'STANDARD',
    questionsAsked: session.questionsAsked || 0,
    sessionStatus: session.status || 'completed'
  };
}

/**
 * Get frustration level label
 * @param {number} score - Frustration score
 * @returns {string} - Level label
 */
function getFrustrationLevel(score = 0) {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'None';
}

/**
 * Get path label
 * @param {string} path - Path identifier
 * @returns {string} - Human-readable path label
 */
function getPathLabel(path) {
  const labels = {
    'EXISTING_CUSTOMER': 'Existing Customer',
    'EMERGENCY': 'Emergency',
    'STANDARD': 'Standard Qualification'
  };
  return labels[path] || path || 'Unknown';
}

module.exports = {
  formatHandoffMessage,
  createHandoffPayload
};

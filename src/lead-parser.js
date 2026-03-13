/**
 * Lead Parser
 * Parses lead data from Zapier messages in Slack
 */

/**
 * Parse lead data from Zapier message text
 * @param {string} text - Raw Slack message text
 * @returns {object} Parsed lead data
 */
function parseLeadData(text) {
  console.log(`[parseLeadData] === PARSING LEAD DATA ===`);
  
  const nameMatch = text.match(/Name:\s*([^\n:]+)/i);
  const phoneMatch = text.match(/Phone:\s*(?:<tel:([^|>]+)|([^\n:]+))/i);
  const emailMatch = text.match(/Email:\s*([^\n:]+)/i);
  const serviceMatch = text.match(/Service:\s*([^\n:]+)/i);
  const zipMatch = text.match(/(?:ZIP|Zip Code):\s*([^\n:]+)/i);
  const sourceMatch = text.match(/Source:\s*([^\n:]+)/i);
  const frameworkMatch = text.match(/Framework:\s*([^\n:]+)/i);
  const messageMatch = text.match(/Message:\s*([^\n]+)/i);
  const existingMatch = text.match(/Existing Customer:\s*([^\n:]+)/i);
  const websiteMatch = text.match(/Website:\s*([^\n]+)/i);
  const companyMatch = text.match(/Company:\s*([^\n:]+)/i);
  
  const rawService = serviceMatch ? serviceMatch[1].trim() : 'Unknown';
  const message = messageMatch ? messageMatch[1].trim() : '';
  
  // Map service types from form (Groundsman Landscaping)
  let serviceType = rawService;
  const serviceLower = rawService.toLowerCase();

  if (serviceLower.includes('emergency') || serviceLower.includes('fallen tree') || serviceLower.includes('storm damage')) {
    serviceType = 'Emergency Service';
  } else if (serviceLower.includes('lawn') || serviceLower.includes('mow') || serviceLower.includes('grass')) {
    serviceType = 'Lawn Maintenance';
  } else if (serviceLower.includes('design') || serviceLower.includes('landscape design') || serviceLower.includes('planting')) {
    serviceType = 'Landscape Design';
  } else if (serviceLower.includes('tree') || serviceLower.includes('trim') || serviceLower.includes('removal') || serviceLower.includes('stump')) {
    serviceType = 'Tree Service';
  } else if (serviceLower.includes('patio') || serviceLower.includes('retaining wall') || serviceLower.includes('hardscap') || serviceLower.includes('walkway') || serviceLower.includes('pavers')) {
    serviceType = 'Hardscaping';
  } else if (serviceLower.includes('irrigation') || serviceLower.includes('sprinkler') || serviceLower.includes('drip')) {
    serviceType = 'Irrigation';
  } else if (serviceLower.includes('cleanup') || serviceLower.includes('clean up') || serviceLower.includes('leaf') || serviceLower.includes('seasonal')) {
    serviceType = 'Seasonal Cleanup';
  } else if (serviceLower.includes('maintenance')) {
    serviceType = 'Maintenance';
  }
  
  const existingCustomer = existingMatch ? existingMatch[1].trim().toLowerCase() === 'yes' : false;
  
  const email = emailMatch ? emailMatch[1].trim() : null;

  // Determine source with fallback
  let source = sourceMatch ? sourceMatch[1].trim() : 'Groundsman Website';
  if (source === 'Groundsman Website' && text.toLowerCase().includes('generic-v15')) {
    source = 'generic-v15';
  }

  // Determine framework
  let framework = frameworkMatch ? frameworkMatch[1].trim() : null;
  if (!framework && source === 'generic-v15') {
    framework = 'FRAMEWORK-v15';
  }

  return {
    name: nameMatch ? nameMatch[1].trim() : 'there',
    phone: phoneMatch ? (phoneMatch[1] || phoneMatch[2]).trim() : 'Unknown',
    serviceType: serviceType,
    existingCustomer: existingCustomer,
    zip: zipMatch ? zipMatch[1].trim() : null,
    email: email,
    source: source,
    framework: framework,
    message: message,
    website: websiteMatch ? websiteMatch[1].trim() : undefined,
    company: companyMatch ? companyMatch[1].trim() : undefined,
    leadId: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * Smart filter for honeypot values — ignore common "empty" answers
 */
const HONEYPOT_IGNORE = ['n/a', 'na', 'none', 'no', '-', ''];

/**
 * Check if honeypot fields are triggered (bot detection)
 * Real humans leave website/company blank on a service request form.
 * @param {object} leadData - Parsed lead data (or raw object with website/company fields)
 * @returns {{ triggered: boolean, field?: string, value?: string }}
 */
function isHoneypotTriggered(leadData) {
  if (!leadData) return { triggered: false };
  
  for (const field of ['website', 'company']) {
    const val = leadData[field];
    if (val && typeof val === 'string') {
      const trimmed = val.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed.length === 0 || HONEYPOT_IGNORE.includes(lower)) {
        continue;
      }
      return { triggered: true, field, value: trimmed };
    }
  }
  
  return { triggered: false };
}

module.exports = { parseLeadData, isHoneypotTriggered };

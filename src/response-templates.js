/**
 * Response Templates — V17 Tier 0
 * Pre-built responses for zero-API-cost routing.
 * Each category has 3-5 variants to avoid sounding robotic.
 */

const TEMPLATES = {
  affirmative: [
    "Sounds good. Let me get one of our team members to reach out to you.",
    "Perfect. I'll have someone from the team give you a call shortly.",
    "Got it. Let me connect you with our team to get that taken care of.",
    "Great. I'll get someone on it — they'll be in touch soon.",
  ],
  greeting: [
    "Hey {name}! Thanks for reaching out. What can I help you with?",
    "Hi {name}, thanks for getting in touch. What's going on?",
    "Hey {name}. What can we help you with today?",
    "Hi {name}! What's going on — how can we help?",
    "Hey {name}, thanks for reaching out. What do you need help with?",
  ],
  opt_out: [
    "No problem at all. If you ever need {serviceType} help down the road, don't hesitate to reach out. Take care!",
    "Understood — you're all set. If anything comes up in the future, we're here. Take care.",
    "Got it, no worries. If you need {serviceType} help in the future, just reach out. Have a good one!",
    "No problem. We're here if you ever need us. Take care!",
  ],
  transfer_phone: [
    "Perfect, I'll have someone give you a call at {phone}. They'll be in touch shortly.",
    "Got it. One of our team members will reach out to you at {phone} soon.",
    "Sounds good. Someone from the team will call you at {phone} shortly.",
    "Great, we'll have someone reach out to {phone}. Expect a call soon.",
  ],
  scheduling: [
    "We've got availability this week. Let me connect you with our scheduling team to find a good time.",
    "We can get you in soon. Let me have our team reach out to set something up.",
    "We should have openings. I'll connect you with someone who can get you on the schedule.",
    "Let me get you set up — I'll have our scheduling team reach out to find a time that works.",
  ],
  negative_short: [
    "No worries. If anything changes, we're here.",
    "Got it. Reach out anytime if you need us.",
    "Understood. We're here if you need anything down the road.",
  ],
  emoji_acknowledgment: [
    "Let me know if there's anything I can help with.",
    "We're here if you need anything.",
    "Just let us know how we can help.",
  ],
};

/**
 * Get a template response for the given intent
 * @param {string} intent - Template category (affirmative, greeting, opt_out, transfer_phone, scheduling, negative_short, emoji_acknowledgment)
 * @param {object} leadData - Lead info for personalization
 * @param {string} [leadData.name] - Lead's name
 * @param {string} [leadData.serviceType] - Service type
 * @param {string} [leadData.phone] - Phone number (for transfer_phone)
 * @param {number} [variant] - Specific variant index (random if omitted)
 * @returns {string} The template response
 */
function getTemplateResponse(intent, leadData = {}, variant) {
  const templates = TEMPLATES[intent];
  if (!templates || templates.length === 0) {
    return "Thanks for reaching out! A team member will be in touch shortly.";
  }

  const idx = (variant != null) ? (variant % templates.length) : Math.floor(Math.random() * templates.length);
  let response = templates[idx];

  // Personalize
  const firstName = leadData.name ? leadData.name.split(' ')[0] : 'there';
  const serviceType = leadData.serviceType || 'service';
  const phone = leadData.phone || '';

  response = response.replace(/\{name\}/g, firstName);
  response = response.replace(/\{serviceType\}/g, serviceType);
  response = response.replace(/\{phone\}/g, phone);

  return response;
}

module.exports = { getTemplateResponse, TEMPLATES };

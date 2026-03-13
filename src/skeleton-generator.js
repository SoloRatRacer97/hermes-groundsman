/**
 * Skeleton Generator — V18 Conversation Antibodies
 * Converts skeleton steps into personalized responses.
 * Simple steps = template (Tier 0). Complex steps = Haiku-guided (Tier 1).
 */

const STEP_TEMPLATES = {
  empathy_opener: [
    "Hey {firstName}! That sounds rough. What's going on with your {serviceType}?",
    "Hi {firstName}. Sorry to hear that — what's happening with your {serviceType}?",
    "Hey {firstName}, that's no fun. What's going on?",
    "Hi {firstName}! What's the deal with your {serviceType}?",
  ],
  greeting: [
    "Hey {firstName}! Thanks for reaching out. What can I help you with?",
    "Hi {firstName}, thanks for getting in touch. What's going on?",
    "Hey {firstName}. What can we help you with today?",
  ],
  quick_qualify: [
    "When did this start? And what area are you in?",
    "Got it. How long has this been going on? And where are you located?",
    "Okay. When did you first notice it? What part of town are you in?",
  ],
  discovery: [
    "Can you tell me a bit more about what's happening?",
    "Walk me through what you're seeing — when did it start?",
    "What exactly is going on? Any details help.",
  ],
  transfer: [
    "I've got someone who can help. Best number to reach you at?",
    "Let me get one of our guys on this. What's the best number for you?",
    "I'll have someone reach out — what number works best?",
    "Got it. Let me connect you with our team. Best callback number?",
  ],
  empathy: [
    "I hear you, that's frustrating. Let's get this sorted out.",
    "Yeah, that's a pain. We'll get someone on it.",
    "Totally understand. Let me see what we can do.",
  ],
  follow_up: [
    "Got it. Anything else I should pass along to the team?",
    "Okay, that helps. Anything else going on with it?",
    "Thanks for that. Let me make sure we've got everything.",
  ],
  closing: [
    "Alright, we'll be in touch. Hang tight.",
    "Someone from the team will follow up shortly.",
    "We'll get back to you soon. Thanks for reaching out.",
  ],
};

// Steps that can be handled with pure templates (Tier 0)
const TEMPLATE_STEPS = new Set([
  'empathy_opener', 'greeting', 'quick_qualify', 'transfer',
  'empathy', 'follow_up', 'closing', 'discovery',
]);

class SkeletonGenerator {
  /**
   * Generate a personalized response from a skeleton step
   * @param {object} skeletonStep - { step, type, keyPoints, avgLength, examples }
   * @param {object} leadData - { name, serviceType, phone, location, ... }
   * @param {Array} conversationHistory - Previous messages
   * @returns {{ text: string, tier: number }}
   */
  generate(skeletonStep, leadData = {}, conversationHistory = []) {
    const firstName = leadData.name ? leadData.name.split(' ')[0] : 'there';
    const serviceType = leadData.serviceType || 'system';
    const phone = leadData.phone || '';
    const location = leadData.location || leadData.city || '';

    const stepType = skeletonStep.type || 'follow_up';

    if (TEMPLATE_STEPS.has(stepType)) {
      // Tier 0: template response
      const templates = STEP_TEMPLATES[stepType] || STEP_TEMPLATES.follow_up;
      const idx = Math.floor(Math.random() * templates.length);
      let text = templates[idx];
      
      text = text.replace(/\{firstName\}/g, firstName);
      text = text.replace(/\{serviceType\}/g, serviceType);
      text = text.replace(/\{phone\}/g, phone);
      text = text.replace(/\{location\}/g, location);

      // Incorporate key points from skeleton if examples exist
      // Keep under 320 chars
      if (text.length > 320) {
        text = text.substring(0, 317) + '...';
      }

      return { text, tier: 0 };
    }

    // Complex step — would normally go to Tier 1 (Haiku)
    // For now, use examples from the skeleton step
    if (skeletonStep.examples && skeletonStep.examples.length > 0) {
      let text = skeletonStep.examples[Math.floor(Math.random() * skeletonStep.examples.length)];
      text = text.replace(/\[service\]/gi, serviceType);
      text = text.replace(/\[name\]/gi, firstName);
      if (text.length > 320) text = text.substring(0, 317) + '...';
      return { text, tier: 1 };
    }

    // Fallback
    return { text: STEP_TEMPLATES.follow_up[0].replace(/\{firstName\}/g, firstName).replace(/\{serviceType\}/g, serviceType), tier: 0 };
  }

  /**
   * Check if a step type can be handled as Tier 0 (template)
   */
  isTemplateStep(stepType) {
    return TEMPLATE_STEPS.has(stepType);
  }
}

module.exports = { SkeletonGenerator, STEP_TEMPLATES };

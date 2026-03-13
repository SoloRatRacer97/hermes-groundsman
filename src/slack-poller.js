/**
 * Slack Poller
 * Polls #new-leads channel for new Zapier lead messages
 */

/**
 * Check if a Slack message is a new lead from Zapier
 * @param {string} text - Message text
 * @returns {boolean}
 */
function isNewLeadMessage(text) {
  return text.includes('New Lead') && 
         text.includes('Name:') && 
         !text.includes('NEW LEAD -') && 
         !text.includes('*Conversation:*') && 
         !text.includes('*Problem:*');
}

module.exports = { isNewLeadMessage };

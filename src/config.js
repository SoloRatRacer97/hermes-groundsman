/**
 * Hermes Configuration
 * Environment variables and default settings
 */

require('dotenv').config();

module.exports = {
  // Zapier webhook URL for sending SMS requests
  zapierWebhookUrl: process.env.ZAPIER_WEBHOOK_URL || '',
  
  // Slack channel ID for receiving lead notifications
  slackChannelId: process.env.SLACK_CHANNEL_ID || '',
  
  // Lead score threshold for hot lead alerts (0-100)
  alertThreshold: parseInt(process.env.ALERT_THRESHOLD) || 80,
  
  // Conversation timeouts
  timeouts: {
    reminderHours: 4,      // Send reminder if no response after 4 hours
    abandonHours: 24       // Mark abandoned if no response after 24 hours
  },
  
  // Retry settings for webhook failures
  retry: {
    maxAttempts: 3,
    backoffMs: [1000, 2000, 4000]  // Exponential backoff
  },
  
  // SMS settings
  sms: {
    maxLength: 320,  // Max SMS length (2 segments)
    preferredLength: 160  // Ideal length (1 segment)
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',  // debug, info, warn, error
    logPii: false  // Never log phone/email in plain text
  }
};

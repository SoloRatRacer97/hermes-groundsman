#!/usr/bin/env node

/**
 * Hermes Slack Listener
 * Listens to the #new-leads channel and responds to new lead notifications
 */

const { App } = require('@slack/bolt');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const CHANNEL_NAME = process.env.SLACK_CHANNEL_NAME || 'new-leads';
const CHANNEL_ID = 'C0AF9862EAJ'; // From config

console.log('🏛️  Hermes Slack Bot Starting...');
console.log(`📱 Listening to channel: #${CHANNEL_NAME} (${CHANNEL_ID})`);

// Listen for messages in the channel
app.message(async ({ message, say }) => {
  // Only respond to messages in our target channel
  if (message.channel !== CHANNEL_ID) {
    return;
  }

  // Ignore bot messages (avoid loops)
  if (message.bot_id) {
    return;
  }

  const text = message.text || '';
  console.log(`\n📩 Received message in #${CHANNEL_NAME}:`);
  console.log(`   User: ${message.user}`);
  console.log(`   Text: ${text}`);

  // Parse lead data from Zapier format
  // Expected format:
  // 🆕 New Lead: John Doe
  // 📞 Phone: +1-555-123-4567
  // 🌿 Service: Lawn Mowing
  // 📅 Submitted: 2026-02-27T16:00:00Z

  const leadData = parseLead
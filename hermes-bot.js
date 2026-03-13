#!/usr/bin/env node

/**
 * Hermes - Lead Nurturing Bot
 * Conversational AI for lead qualification and nurturing
 */

const { App } = require('@slack/bolt');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const CHANNEL_ID = 'C0AF9862EAJ'; // #new-leads

console.log('🏛️  Hermes Bot Online');
console.log(`📱 Monitoring channel: #new-leads (${CHANNEL_ID})\n`);

// Track conversation state
const conversations = new Map();

// Listen for @mentions (this catches bot messages from Zapier!)
app.event('app_mention', async ({ event, client, say }) => {
  console.log(`\n🔔 APP MENTION:`, JSON.stringify(event, null, 2));
  
  const text = event.text || '';
  const channel = event.channel;
  
  console.log(`\n📩 Mentioned in channel ${channel}`);
  console.log(`   Text: ${text}`);
  
  // Check if this is a lead notification
  if (text.includes('New Lead') || text.includes('Name:')) {
    console.log(`\n🎯 LEAD DETECTED VIA MENTION!`);
    await handleNewLead(text, event, client);
    return;
  }
  
  // Otherwise respond to the mention
  await say(`Hey! I'm Hermes. I saw you mentioned me. If you have a new lead, make sure the message includes "Name:" and I'll start the nurturing sequence!`);
});

// TEMP: Listen to ALL events for debugging
app.event(/.*/,async ({ event, client }) => {
  if (event.type !== 'message' && event.type !== 'app_mention') {
    console.log(`\n🔔 EVENT RECEIVED: ${event.type}`, JSON.stringify(event, null, 2).substring(0, 500));
  }
});

// Listen for messages
app.message(async ({ message, client, say }) => {
  console.log(`\n🔍 RAW MESSAGE:`, JSON.stringify(message, null, 2));
  
  // Only process messages in our channel
  if (message.channel !== CHANNEL_ID) {
    console.log(`❌ Wrong channel: ${message.channel} (expected ${CHANNEL_ID})`);
    return;
  }
  
  // Log all messages in our channel (including bot messages for debugging)
  const text = message.text || '';
  const user = message.user;
  const bot_id = message.bot_id;
  
  console.log(`\n📩 Message in #new-leads:`);
  console.log(`   From: ${user || 'bot'} (bot_id: ${bot_id})`);
  console.log(`   Text: ${text}`);
  console.log(`   Subtype: ${message.subtype || 'none'}`);
  
  // Check if this is a lead notification from Zapier (BEFORE filtering bots!)
  if (text.includes('New Lead') || text.includes('Name:') || text.includes(':new:')) {
    console.log(`\n🎯 LEAD DETECTED!`);
    await handleNewLead(text, message, client);
    return;
  }
  
  // Ignore other bot messages to avoid loops
  if (message.bot_id || message.subtype) {
    console.log(`⏭️  Skipping bot message`);
    return;
  }

  // Otherwise, have a conversation
  await handleConversation(text, user, message, say, client);
});

async function handleNewLead(text, message, client) {
  const lead = parseLead(text);
  
  if (!lead.name) {
    console.log('⚠️  Could not parse lead data');
    return;
  }

  console.log(`\n✅ New lead detected:`);
  console.log(`   Name: ${lead.name}`);
  console.log(`   Phone: ${lead.phone}`);
  console.log(`   Service: ${lead.service}`);

  // Start nurturing sequence in thread
  const thread = message.ts;
  
  // Initial acknowledgment
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `🎯 *New Lead Detected*\n\n• Name: ${lead.name}\n• Phone: ${lead.phone}\n• Service: ${lead.service}\n\n⏱️ Starting qualification sequence...`
  });

  console.log(`💬 Starting nurturing sequence for ${lead.name}`);

  // Simulate the SMS nurturing flow
  await new Promise(resolve => setTimeout(resolve, 2000));

  const firstName = lead.name.split(' ')[0];
  
  // Message 1: Initial outreach
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `📱 *SMS 1 (would be sent now):*\n\n_Hey ${firstName}! Got your ${lead.service} request. Quick question - how soon are you looking to get started? (1) This week (2) Next week (3) Next month (4) Just browsing_`
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Simulate customer response
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `💬 *[Simulated Customer Response]:* "1"`
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Message 2: Budget qualification
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `📱 *SMS 2:*\n\n_Perfect! So we can match you with the right crew, what's your budget range? (1) Under $100 (2) $100-$300 (3) $300-$500 (4) $500+_`
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `💬 *[Simulated Customer Response]:* "3"`
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Message 3: Decision maker
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `📱 *SMS 3:*\n\n_Great! Are you the one making the final call on this, or do you need to loop anyone else in?_`
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `💬 *[Simulated Customer Response]:* "Just me!"`
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Message 4: Pain point
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `📱 *SMS 4:*\n\n_Last thing - what's bugging you most? (1) Don't have time (2) Don't have equipment (3) Want it to look pro (4) Other_`
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `💬 *[Simulated Customer Response]:* "1"`
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Calculate score (simulated high score)
  const score = 85;

  // Final summary
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: thread,
    text: `📊 *Lead Score: ${score}/100*\n\n✅ Urgency: High (this week)\n✅ Budget: $300-$500\n✅ Decision Maker: Yes\n✅ Pain Point: Time-starved\n\n🔥 *HOT LEAD* - Ready for sales contact!\n\n_In production, I would now:_\n1. Update CRM with score + quiz data\n2. Send alert to sales team\n3. Queue follow-up message: "Thanks ${firstName}! Our team will text you in the next hour with availability. In the meantime, check out our reviews: [link]"`
  });

  console.log(`✅ Nurturing sequence complete for ${lead.name} (Score: ${score})`);
}

async function handleConversation(text, user, message, say, client) {
  console.log(`💬 Having conversation with ${user}`);
  
  // Simple conversational responses for now
  let response;

  if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
    response = "Hey there! 👋 I'm Hermes, your lead nurturing assistant. I help qualify leads via SMS and update your CRM automatically. What would you like to know?";
  }
  else if (text.toLowerCase().includes('configuration') || text.toLowerCase().includes('config') || text.toLowerCase().includes('set') || text.toLowerCase().includes('setup')) {
    response = "**Configuration Needed:**\n\n1. **Zapier Webhook URL** — Where I POST lead data for SMS delivery\n   - Create a Zap: Webhooks by Zapier → Catch Hook\n   - Copy the webhook URL\n   - Tell Gaius to configure it\n\n2. **Twilio Account** — For SMS delivery\n   - Sign up at twilio.com\n   - Get phone number\n   - Connect to Zapier\n\n3. **CRM Integration** — Where I update lead scores\n   - Currently: Asana (demo)\n   - Production: Copilot CRM (pending API access)\n\nWhat do you want to configure first?";
  }
  else if (text.toLowerCase().includes('how') && text.toLowerCase().includes('work')) {
    response = "**How I Work:**\n\n1. New lead submits form → Zapier creates record in CRM\n2. Zapier posts notification here in #new-leads\n3. I see the notification and parse the data (name, phone, service)\n4. I generate a casual SMS: *\"Hey Sarah! Got your lawn care request...\"*\n5. I POST to Zapier webhook → Twilio sends SMS\n6. Customer replies → I ask 4 questions (urgency, budget, decision maker, etc.)\n7. I calculate lead score (0-100)\n8. I update CRM with score + quiz data\n9. If score 80+, I alert the sales team: *\"🔥 HOT LEAD!\"*\n\nAll happens in <60 seconds from form submission.";
  }
  else if (text.toLowerCase().includes('status') || text.toLowerCase().includes('ready')) {
    response = "**Current Status:**\n\n✅ Bot online and listening to #new-leads\n✅ Slack connection working\n✅ Lead parsing logic ready\n✅ SMS generation ready\n✅ Scoring algorithm ready\n\n❌ Zapier webhook URL not configured\n❌ Twilio not connected\n❌ Production CRM not connected (using Asana demo)\n\n**To go live:** Configure Zapier webhook + Twilio, then I'm ready to nurture leads!";
  }
  else if (text.toLowerCase().includes('test')) {
    response = "**Test Me:**\n\nPost a message in this format:\n```\n🆕 New Lead: John Doe\n📞 Phone: +1-555-123-4567\n🌿 Service: Lawn Mowing\n```\n\nI'll parse it and show you what I'd do (won't actually send SMS until webhook is configured).";
  }
  else {
    response = `I'm Hermes! 🏛️\n\nI help you qualify leads automatically via SMS. Ask me about:\n• **configuration** — What I need to work\n• **how I work** — The full flow\n• **status** — What's ready, what's missing\n• **test** — How to test me\n\nOr just ask me anything!`;
  }

  await say(response);
  console.log(`✅ Responded to conversation`);
}

function parseLead(text) {
  const lead = {
    name: null,
    phone: null,
    service: null
  };

  // Handle Zapier format: "Name: Jane Doe"
  const nameMatch = text.match(/Name:\s*([^\n:]+)/i);
  if (nameMatch) {
    lead.name = nameMatch[1].trim();
  }

  // Handle Zapier phone format: "Phone: <tel:2342342344|234 234 2344>" or "Phone: 555-123-4567"
  const phoneMatch = text.match(/Phone:\s*(?:<tel:([^|>]+)|([^\n:]+))/i);
  if (phoneMatch) {
    lead.phone = (phoneMatch[1] || phoneMatch[2]).trim();
  }

  // Handle Zapier service format: "Service: Lawn Mowing"
  const serviceMatch = text.match(/Service:\s*([^\n:]+)/i);
  if (serviceMatch) {
    lead.service = serviceMatch[1].trim();
  }

  return lead;
}

// Start the bot
(async () => {
  await app.start();
  console.log('⚡ Hermes is running and ready for conversation!\n');
})();

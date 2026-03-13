#!/usr/bin/env node

/**
 * Hermes Channel Poller
 * Polls #new-leads for new messages (including from bots like Zapier)
 * NOW WITH PERSISTENT STATE TRACKING
 */

const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = 'C0AF9862EAJ'; // #new-leads
const POLL_INTERVAL = 10000; // 10 seconds
const STATE_FILE = path.join(__dirname, '.hermes-poller-state.json');

let lastTimestamp = null;
const processedMessages = new Set(); // Track processed message IDs

/**
 * Load persistent state from disk
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      lastTimestamp = data.lastTimestamp || null;
      if (data.processedMessages && Array.isArray(data.processedMessages)) {
        data.processedMessages.forEach(id => processedMessages.add(id));
      }
      console.log(`[Hermes Poller] State loaded: last timestamp = ${lastTimestamp}`);
      console.log(`[Hermes Poller] Processed messages: ${processedMessages.size}`);
    } else {
      console.log('[Hermes Poller] No state file found - starting fresh');
    }
  } catch (error) {
    console.error('[Hermes Poller] Error loading state:', error.message);
    console.log('[Hermes Poller] Starting fresh...');
  }
}

/**
 * Save persistent state to disk
 */
function saveState() {
  try {
    const state = {
      lastTimestamp,
      processedMessages: Array.from(processedMessages),
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    console.log(`[Hermes Poller] State saved: ${processedMessages.size} messages tracked`);
  } catch (error) {
    console.error('[Hermes Poller] Error saving state:', error.message);
  }
}

console.log('[Hermes Poller] Online');
console.log(`[Hermes Poller] Monitoring channel: #new-leads (${CHANNEL_ID})`);
console.log(`[Hermes Poller] Poll interval: ${POLL_INTERVAL}ms`);
console.log(`[Hermes Poller] State file: ${STATE_FILE}\n`);

// Load state on startup
loadState();

async function pollChannel() {
  try {
    // Build request params
    const params = {
      channel: CHANNEL_ID,
      limit: 10
    };
    
    // If we have a lastTimestamp, only fetch messages AFTER it
    if (lastTimestamp) {
      params.oldest = lastTimestamp;
    }
    
    const result = await client.conversations.history(params);

    if (result.messages && result.messages.length > 0) {
      // Process messages in chronological order (oldest first)
      const messages = result.messages.reverse();
      
      let newMessagesProcessed = 0;
      
      for (const message of messages) {
        // Skip if we've already processed this message
        if (processedMessages.has(message.ts)) {
          console.log(`[Hermes Poller] Skipping already-processed message: ${message.ts}`);
          continue;
        }
        
        // Skip if this message has the same timestamp as our last (edge case)
        if (lastTimestamp && message.ts === lastTimestamp) {
          console.log(`[Hermes Poller] Skipping message at lastTimestamp boundary: ${message.ts}`);
          continue;
        }
        
        const text = message.text || '';
        const user = message.user || 'bot';
        const bot_id = message.bot_id || message.app_id;
        
        console.log(`\n[Hermes Poller] New message:`);
        console.log(`[Hermes Poller] Timestamp: ${message.ts}`);
        console.log(`[Hermes Poller] From: ${user} (bot: ${bot_id || 'none'})`);
        console.log(`[Hermes Poller] Text: ${text.substring(0, 200)}`);
        
        // Check if this is a lead
        if (text.includes('New Lead') || text.includes('Name:')) {
          console.log(`\n[Hermes Poller] LEAD DETECTED!`);
          await handleLead(text, message);
        }
        
        // Mark as processed
        processedMessages.add(message.ts);
        lastTimestamp = message.ts;
        newMessagesProcessed++;
        
        // Keep processedMessages set from growing forever (keep last 1000)
        if (processedMessages.size > 1000) {
          const arr = Array.from(processedMessages);
          processedMessages.clear();
          arr.slice(-500).forEach(id => processedMessages.add(id));
        }
      }
      
      // Save state after processing new messages
      if (newMessagesProcessed > 0) {
        console.log(`\n[Hermes Poller] Processed ${newMessagesProcessed} new message(s)`);
        saveState();
      }
    } else {
      console.log('[Hermes Poller] No new messages');
    }
  } catch (error) {
    console.error('[Hermes Poller] Polling error:', error.message);
    if (error.data) {
      console.error('[Hermes Poller] Error data:', error.data);
    }
  }
}

async function handleLead(text, message) {
  // Parse the lead
  const nameMatch = text.match(/Name:\s*([^\n:]+)/i);
  const phoneMatch = text.match(/Phone:\s*(?:<tel:([^|>]+)|([^\n:]+))/i);
  const serviceMatch = text.match(/Service:\s*([^\n:]+)/i);
  
  const lead = {
    name: nameMatch ? nameMatch[1].trim() : 'Unknown',
    phone: phoneMatch ? (phoneMatch[1] || phoneMatch[2]).trim() : 'Unknown',
    service: serviceMatch ? serviceMatch[1].trim() : 'Unknown'
  };
  
  console.log(`\n[Hermes Poller] Lead parsed:`);
  console.log(`[Hermes Poller] Name: ${lead.name}`);
  console.log(`[Hermes Poller] Phone: ${lead.phone}`);
  console.log(`[Hermes Poller] Service: ${lead.service}`);
  
  // Post the nurturing sequence in a thread
  try {
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*New Lead Detected*\n\n• Name: ${lead.name}\n• Phone: ${lead.phone}\n• Service: ${lead.service}\n\nStarting qualification sequence...`
    });
    
    // Simulate the nurturing flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const firstName = lead.name.split(' ')[0];
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*SMS 1 (would be sent now):*\n\n_Hey ${firstName}! Got your ${lead.service} request. Quick question - how soon are you looking to get started? (1) This week (2) Next week (3) Next month (4) Just browsing_`
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*[Simulated Response]:* "1"`
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*SMS 2:*\n\n_Perfect! So we can match you with the right crew, what's your budget range? (1) Under $100 (2) $100-$300 (3) $300-$500 (4) $500+_`
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*[Simulated Response]:* "3"`
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*SMS 3:*\n\n_Great! Are you the one making the final call on this, or do you need to loop anyone else in?_`
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*[Simulated Response]:* "Just me!"`
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*SMS 4:*\n\n_Last thing - what's bugging you most? (1) Don't have time (2) Don't have equipment (3) Want it to look pro (4) Other_`
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*[Simulated Response]:* "1"`
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const score = 85;
    
    await client.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: message.ts,
      text: `*Lead Score: ${score}/100*\n\nUrgency: High (this week)\nBudget: $300-$500\nDecision Maker: Yes\nPain Point: Time-starved\n\n*HOT LEAD* - Ready for sales contact!\n\n_In production, I would now:_\n1. Update CRM with score + quiz data\n2. Send alert to sales team\n3. Queue follow-up: "Thanks ${firstName}! Our team will text you in the next hour. Check out our reviews: [link]"`
    });
    
    console.log(`[Hermes Poller] Nurturing sequence complete for ${lead.name}`);
  } catch (error) {
    console.error('[Hermes Poller] Error posting to Slack:', error.message);
  }
}

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n\n[Hermes Poller] Received SIGINT - shutting down gracefully...');
  saveState();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n[Hermes Poller] Received SIGTERM - shutting down gracefully...');
  saveState();
  process.exit(0);
});

// Start polling
console.log('[Hermes Poller] Starting poller...\n');
setInterval(pollChannel, POLL_INTERVAL);

// Do an initial poll
pollChannel();

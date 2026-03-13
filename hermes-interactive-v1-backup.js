#!/usr/bin/env node

/**
 * Hermes Interactive Bot
 * Detects new leads and has conversations with them
 * WITH STATE PERSISTENCE TO PREVENT DUPLICATES
 */

const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = 'C0AF9862EAJ'; // #new-leads
const POLL_INTERVAL = 10000; // 10 seconds
const STATE_FILE = path.join(__dirname, '.hermes-interactive-state.json');

let lastTimestamp = null;
const processedMessages = new Set();
const activeLeads = new Map(); // Track conversation state per lead
let isFirstRun = false;

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
      console.log(`[Hermes Interactive] State loaded: last timestamp = ${lastTimestamp}`);
      console.log(`[Hermes Interactive] Processed messages: ${processedMessages.size}`);
      isFirstRun = false;
    } else {
      console.log('[Hermes Interactive] No state file found - first run');
      console.log('[Hermes Interactive] Will set timestamp to NOW and only process future messages');
      isFirstRun = true;
    }
  } catch (error) {
    console.error('[Hermes Interactive] Error loading state:', error.message);
    console.log('[Hermes Interactive] Starting fresh...');
    isFirstRun = true;
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
    console.log(`[Hermes Interactive] State saved: ${processedMessages.size} messages tracked`);
  } catch (error) {
    console.error('[Hermes Interactive] Error saving state:', error.message);
  }
}

console.log('[Hermes Interactive] Online');
console.log(`[Hermes Interactive] Monitoring channel: #new-leads (${CHANNEL_ID})`);
console.log(`[Hermes Interactive] Poll interval: ${POLL_INTERVAL}ms`);
console.log(`[Hermes Interactive] State file: ${STATE_FILE}\n`);

// Load state on startup
loadState();

// Poll for new leads from Zapier
async function pollForLeads() {
  try {
    const params = {
      channel: CHANNEL_ID,
      limit: 10
    };
    
    // CRITICAL: On first run, set lastTimestamp to NOW and skip old messages
    if (isFirstRun) {
      console.log('[Hermes Interactive] First run - getting latest timestamp and skipping old messages...');
      const result = await client.conversations.history(params);
      if (result.messages && result.messages.length > 0) {
        // Set lastTimestamp to the most recent message
        lastTimestamp = result.messages[0].ts;
        console.log(`[Hermes Interactive] Set lastTimestamp to ${lastTimestamp} (now only processing future messages)`);
        saveState();
      }
      isFirstRun = false;
      return; // Skip processing on first run
    }
    
    // If we have a lastTimestamp, only fetch messages AFTER it
    if (lastTimestamp) {
      params.oldest = lastTimestamp;
    }
    
    const result = await client.conversations.history(params);

    if (result.messages && result.messages.length > 0) {
      const messages = result.messages.reverse();
      
      let newMessagesProcessed = 0;
      
      for (const message of messages) {
        // Skip if we've already processed this message
        if (processedMessages.has(message.ts)) {
          console.log(`[Hermes Interactive] Skipping already-processed message: ${message.ts}`);
          continue;
        }
        
        // Skip if this message has the same timestamp as our last (edge case)
        if (lastTimestamp && message.ts === lastTimestamp) {
          console.log(`[Hermes Interactive] Skipping message at lastTimestamp boundary: ${message.ts}`);
          continue;
        }
        
        const text = message.text || '';
        
        // Check if this is a lead from Zapier
        if (text.includes('New Lead') || text.includes('Name:')) {
          console.log(`\n[Hermes Interactive] NEW LEAD DETECTED!`);
          await startLeadConversation(text, message);
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
        console.log(`\n[Hermes Interactive] Processed ${newMessagesProcessed} new message(s)`);
        saveState();
      }
    }
  } catch (error) {
    console.error('[Hermes Interactive] Polling error:', error.message);
    if (error.data) {
      console.error('[Hermes Interactive] Error data:', error.data);
    }
  }
}

async function startLeadConversation(text, message) {
  // Parse lead info
  const nameMatch = text.match(/Name:\s*([^\n:]+)/i);
  const phoneMatch = text.match(/Phone:\s*(?:<tel:([^|>]+)|([^\n:]+))/i);
  const serviceMatch = text.match(/Service:\s*([^\n:]+)/i);
  
  const lead = {
    name: nameMatch ? nameMatch[1].trim() : 'there',
    phone: phoneMatch ? (phoneMatch[1] || phoneMatch[2]).trim() : 'Unknown',
    service: serviceMatch ? serviceMatch[1].trim() : 'Unknown'
  };
  
  console.log(`[Hermes Interactive] Name: ${lead.name}`);
  console.log(`[Hermes Interactive] Phone: ${lead.phone}`);
  console.log(`[Hermes Interactive] Service: ${lead.service}`);
  
  const firstName = lead.name.split(' ')[0];
  
  // Store lead state
  activeLeads.set(message.ts, {
    lead,
    step: 1,
    responses: {}
  });
  
  // Send first question in thread
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: message.ts,
    text: `Hey ${firstName}! Got your ${lead.service} request.\n\nQuick question - how soon are you looking to get started?\n\n(1) This week\n(2) Next week\n(3) Next month\n(4) Just browsing`
  });
  
  console.log(`[Hermes Interactive] Started conversation with ${lead.name}`);
}

// Listen for replies in threads
app.message(async ({ message, client: slackClient }) => {
  // Only process messages in our channel
  if (message.channel !== CHANNEL_ID) return;
  
  // Only process messages that are in a thread
  if (!message.thread_ts) return;
  
  // Don't respond to our own messages
  if (message.bot_id) return;
  
  const threadId = message.thread_ts;
  const leadState = activeLeads.get(threadId);
  
  if (!leadState) return; // Not a lead we're tracking
  
  const text = message.text || '';
  const { lead, step, responses } = leadState;
  const firstName = lead.name.split(' ')[0];
  
  console.log(`\n[Hermes Interactive] Reply from lead ${lead.name} (step ${step}): "${text}"`);
  
  // Process based on current step
  if (step === 1) {
    // Urgency response
    responses.urgency = text;
    leadState.step = 2;
    
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: threadId,
      text: `Perfect! So we can match you with the right crew, what's your budget range?\n\n(1) Under $100\n(2) $100-$300\n(3) $300-$500\n(4) $500+`
    });
  } else if (step === 2) {
    // Budget response
    responses.budget = text;
    leadState.step = 3;
    
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: threadId,
      text: `Great! Are you the one making the final call on this, or do you need to loop anyone else in?`
    });
  } else if (step === 3) {
    // Decision maker response
    responses.decisionMaker = text;
    leadState.step = 4;
    
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: threadId,
      text: `Last thing - what's bugging you most?\n\n(1) Don't have time\n(2) Don't have equipment\n(3) Want it to look pro\n(4) Other`
    });
  } else if (step === 4) {
    // Pain point response - final question
    responses.painPoint = text;
    leadState.step = 5;
    
    // Calculate score based on responses
    let score = 50; // Base score
    
    // Urgency scoring
    if (responses.urgency.includes('1')) score += 20;
    else if (responses.urgency.includes('2')) score += 15;
    else if (responses.urgency.includes('3')) score += 10;
    
    // Budget scoring
    if (responses.budget.includes('4')) score += 15;
    else if (responses.budget.includes('3')) score += 10;
    else if (responses.budget.includes('2')) score += 5;
    
    // Decision maker (yes-like responses)
    if (responses.decisionMaker.toLowerCase().includes('yes') || 
        responses.decisionMaker.toLowerCase().includes('me') ||
        responses.decisionMaker.toLowerCase().includes('just')) {
      score += 10;
    }
    
    // Pain point
    if (responses.painPoint.includes('1') || responses.painPoint.includes('3')) {
      score += 5;
    }
    
    const quality = score >= 80 ? 'HOT LEAD' : score >= 60 ? 'WARM LEAD' : 'COLD LEAD';
    
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: threadId,
      text: `*Lead Score: ${score}/100* - *${quality}*\n\n*Summary:*\n• Urgency: ${responses.urgency}\n• Budget: ${responses.budget}\n• Decision Maker: ${responses.decisionMaker}\n• Pain Point: ${responses.painPoint}\n\n---\n\nThanks ${firstName}! Our team will text you in the next hour with availability. In the meantime, check out our reviews!`
    });
    
    console.log(`[Hermes Interactive] Completed conversation with ${lead.name} - Score: ${score}`);
    
    // Remove from active tracking
    activeLeads.delete(threadId);
  }
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n\n[Hermes Interactive] Received SIGINT - shutting down gracefully...');
  saveState();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n[Hermes Interactive] Received SIGTERM - shutting down gracefully...');
  saveState();
  process.exit(0);
});

// Start polling and event listener
(async () => {
  await app.start();
  console.log('[Hermes Interactive] Event listener started');
  console.log('[Hermes Interactive] Starting lead poller...\n');
  setInterval(pollForLeads, POLL_INTERVAL);
  pollForLeads(); // Initial poll
})();

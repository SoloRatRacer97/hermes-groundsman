#!/usr/bin/env node

/**
 * Hermes Interactive Bot v2
 * Full integration with conversation engine, state management, and handoff
 * Detects new leads, qualifies them, and hands off to CSR team
 */

const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import Hermes v2 modules
const ConversationEngine = require('./src/conversation-engine');
const ReengagementManager = require('./src/reengagement');
const ServiceArea = require('./src/service-area');
const Handoff = require('./src/handoff');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = 'C0AF9862EAJ'; // #new-leads
const POLL_INTERVAL = 10000; // 10 seconds
const STATE_FILE = path.join(__dirname, '.hermes-interactive-state.json');

// Core engine instances
const engine = new ConversationEngine();
const reengagement = new ReengagementManager();

let lastTimestamp = null;
const processedMessages = new Set();
const activeThreads = new Map(); // threadTs -> sessionId mapping
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
      console.log(`[Hermes v2] State loaded: last timestamp = ${lastTimestamp}`);
      console.log(`[Hermes v2] Processed messages: ${processedMessages.size}`);
      isFirstRun = false;
    } else {
      console.log('[Hermes v2] No state file found - first run');
      console.log('[Hermes v2] Will set timestamp to NOW and only process future messages');
      isFirstRun = true;
    }
  } catch (error) {
    console.error('[Hermes v2] Error loading state:', error.message);
    console.log('[Hermes v2] Starting fresh...');
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
  } catch (error) {
    console.error('[Hermes v2] Error saving state:', error.message);
  }
}

console.log('[Hermes v2] Online');
console.log(`[Hermes v2] Monitoring channel: #new-leads (${CHANNEL_ID})`);
console.log(`[Hermes v2] Poll interval: ${POLL_INTERVAL}ms`);
console.log(`[Hermes v2] State file: ${STATE_FILE}\n`);

// Load state on startup
loadState();

/**
 * Parse lead data from Zapier message
 */
function parseLeadData(text) {
  const nameMatch = text.match(/Name:\s*([^\n:]+)/i);
  const phoneMatch = text.match(/Phone:\s*(?:<tel:([^|>]+)|([^\n:]+))/i);
  const serviceMatch = text.match(/Service:\s*([^\n:]+)/i);
  const zipMatch = text.match(/(?:ZIP|Zip Code):\s*([^\n:]+)/i);
  const sourceMatch = text.match(/Source:\s*([^\n:]+)/i);
  
  return {
    name: nameMatch ? nameMatch[1].trim() : 'there',
    phone: phoneMatch ? (phoneMatch[1] || phoneMatch[2]).trim() : 'Unknown',
    service: serviceMatch ? serviceMatch[1].trim() : 'Unknown',
    zip: zipMatch ? zipMatch[1].trim() : null,
    source: sourceMatch ? sourceMatch[1].trim() : 'HVAC Website'
  };
}

/**
 * Start conversation with new lead
 */
async function startLeadConversation(text, message) {
  console.log(`\n[Hermes v2] ═══════════════════════════════════════`);
  console.log(`[Hermes v2] NEW LEAD DETECTED!`);
  
  // Parse lead info
  const leadData = parseLeadData(text);
  
  console.log(`[Hermes v2] Name: ${leadData.name}`);
  console.log(`[Hermes v2] Phone: ${leadData.phone}`);
  console.log(`[Hermes v2] Service: ${leadData.service}`);
  console.log(`[Hermes v2] ZIP: ${leadData.zip || 'Not provided'}`);
  console.log(`[Hermes v2] Source: ${leadData.source}`);
  
  // === SERVICE AREA CHECK ===
  if (leadData.zip) {
    const inArea = ServiceArea.isInServiceArea(leadData.zip);
    
    if (!inArea) {
      console.log(`[Hermes v2] ⛔ OUT OF SERVICE AREA: ${leadData.zip}`);
      const firstName = leadData.name.split(' ')[0];
      const declineMessage = ServiceArea.getDeclineMessage(firstName, leadData.zip);
      
      // Send decline message in thread
      await client.chat.postMessage({
        channel: CHANNEL_ID,
        thread_ts: message.ts,
        text: declineMessage
      });
      
      console.log(`[Hermes v2] Sent out-of-area decline message`);
      console.log(`[Hermes v2] ═══════════════════════════════════════\n`);
      return; // Don't start conversation
    }
    
    console.log(`[Hermes v2] ✅ In service area: ${leadData.zip}`);
  }
  
  // === START CONVERSATION ===
  const result = await engine.startConversation(leadData);
  
  if (!result || !result.shouldSend) {
    console.error(`[Hermes v2] No opener message generated`);
    return;
  }
  
  console.log(`[Hermes v2] Path: ${result.session.path}`);
  console.log(`[Hermes v2] Status: ${result.session.status}`);
  
  // Map thread to session
  activeThreads.set(message.ts, result.session.id);
  
  // Send opener in thread
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: message.ts,
    text: result.message
  });
  
  console.log(`[Hermes v2] Sent opener message`);
  
  // === CHECK IF IMMEDIATE HANDOFF ===
  if (result.action === 'TRANSFER' || result.session.status === 'completed') {
    console.log(`[Hermes v2] Immediate handoff (Existing Customer or Emergency)`);
    await sendHandoffPayload(result.session, leadData, message.ts);
  } else {
    // === START RE-ENGAGEMENT MONITORING ===
    reengagement.startMonitoring(result.session.id, {
      onSoftBump: async () => {
        const bumpMessage = reengagement.getSoftBumpMessage();
        await client.chat.postMessage({
          channel: CHANNEL_ID,
          thread_ts: message.ts,
          text: bumpMessage
        });
        console.log(`[Hermes v2] Sent soft bump to ${leadData.name}`);
      },
      onHardTimeout: async () => {
        console.log(`[Hermes v2] Hard timeout for ${leadData.name} - starting SMS re-engagement`);
        // TODO: Trigger SMS re-engagement sequence
        reengagement.stopMonitoring(result.session.id);
      },
      onReengagementBump: async (bumpMessage) => {
        console.log(`[Hermes v2] SMS re-engagement: ${bumpMessage}`);
        // TODO: Send via SMS
      }
    });
  }
  
  console.log(`[Hermes v2] ═══════════════════════════════════════\n`);
}

/**
 * Send handoff payload to CSR
 */
async function sendHandoffPayload(session, leadData, threadTs) {
  console.log(`\n[Hermes v2] 🚀 HANDOFF TO CSR`);
  console.log(`[Hermes v2] Session: ${session.id}`);
  console.log(`[Hermes v2] Lead Temp: ${session.lead_temp}`);
  console.log(`[Hermes v2] Status: ${session.status}`);
  
  // Format handoff message
  const handoffMessage = Handoff.formatHandoffMessage(session, leadData);
  
  // Send as new message (not in thread)
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    text: handoffMessage
  });
  
  console.log(`[Hermes v2] Handoff payload sent`);
  console.log(`[Hermes v2] ═══════════════════════════════════════\n`);
  
  // Stop re-engagement monitoring
  reengagement.stopMonitoring(session.id);
  
  // Clean up thread mapping
  activeThreads.delete(threadTs);
}

/**
 * Poll for new leads from Zapier
 */
async function pollForLeads() {
  try {
    const params = {
      channel: CHANNEL_ID,
      limit: 10
    };
    
    // CRITICAL: On first run, set lastTimestamp to NOW and skip old messages
    if (isFirstRun) {
      console.log('[Hermes v2] First run - getting latest timestamp and skipping old messages...');
      const result = await client.conversations.history(params);
      if (result.messages && result.messages.length > 0) {
        lastTimestamp = result.messages[0].ts;
        console.log(`[Hermes v2] Set lastTimestamp to ${lastTimestamp} (now only processing future messages)`);
        saveState();
      }
      isFirstRun = false;
      return;
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
          continue;
        }
        
        // Skip if this message has the same timestamp as our last
        if (lastTimestamp && message.ts === lastTimestamp) {
          continue;
        }
        
        const text = message.text || '';
        
        // Check if this is a lead from Zapier
        if (text.includes('New Lead') || text.includes('Name:')) {
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
        saveState();
      }
    }
  } catch (error) {
    console.error('[Hermes v2] Polling error:', error.message);
    if (error.data) {
      console.error('[Hermes v2] Error data:', error.data);
    }
  }
}

/**
 * Handle replies from leads in threads
 */
app.message(async ({ message, client: slackClient }) => {
  // Only process messages in our channel
  if (message.channel !== CHANNEL_ID) return;
  
  // Only process messages that are in a thread
  if (!message.thread_ts) return;
  
  // Don't respond to our own messages
  if (message.bot_id) return;
  
  const threadTs = message.thread_ts;
  const sessionId = activeThreads.get(threadTs);
  
  if (!sessionId) {
    console.log(`[Hermes v2] No active session for thread ${threadTs}`);
    return;
  }
  
  const text = message.text || '';
  console.log(`\n[Hermes v2] ─────────────────────────────────────`);
  console.log(`[Hermes v2] Inbound from session ${sessionId.substring(0, 8)}...`);
  console.log(`[Hermes v2] Message: "${text}"`);
  
  // Reset re-engagement timer
  reengagement.resetActivity(sessionId);
  
  // Process message through engine
  const result = await engine.processMessage(sessionId, text);
  
  if (!result || !result.session) {
    console.error(`[Hermes v2] Failed to process message`);
    return;
  }
  
  console.log(`[Hermes v2] Action: ${result.action}`);
  console.log(`[Hermes v2] Status: ${result.session.status}`);
  
  // Send response if needed
  if (result.shouldSend && result.response) {
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: threadTs,
      text: result.response
    });
    console.log(`[Hermes v2] Sent response`);
  }
  
  // Check for handoff conditions
  if (result.action === 'TRANSFER' || 
      result.action === 'TRANSFER_PARACHUTE' ||
      result.action === 'TRANSFER_FRUSTRATION' ||
      result.session.status === 'completed' ||
      result.session.status === 'parachute') {
    
    console.log(`[Hermes v2] Handoff condition met: ${result.action}`);
    
    // Get original lead data (parse from parent message)
    const parentMessage = await slackClient.conversations.replies({
      channel: CHANNEL_ID,
      ts: threadTs,
      limit: 1
    });
    
    if (parentMessage.messages && parentMessage.messages.length > 0) {
      const leadData = parseLeadData(parentMessage.messages[0].text);
      await sendHandoffPayload(result.session, leadData, threadTs);
    }
  }
  
  console.log(`[Hermes v2] ─────────────────────────────────────\n`);
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n\n[Hermes v2] Received SIGINT - shutting down gracefully...');
  saveState();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n[Hermes v2] Received SIGTERM - shutting down gracefully...');
  saveState();
  process.exit(0);
});

// Start polling and event listener
(async () => {
  await app.start();
  console.log('[Hermes v2] Event listener started');
  console.log('[Hermes v2] Starting lead poller...\n');
  setInterval(pollForLeads, POLL_INTERVAL);
  pollForLeads(); // Initial poll
})();

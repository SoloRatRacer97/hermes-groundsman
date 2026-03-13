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
const activeThreads = new Map(); // threadTs -> { sessionId, threadTs }
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
      if (data.activeThreads && Array.isArray(data.activeThreads)) {
        data.activeThreads.forEach(([threadTs, value]) => {
          if (typeof value === 'string') {
            activeThreads.set(threadTs, { sessionId: value, threadTs });
          } else if (value && typeof value === 'object') {
            const entry = { sessionId: value.sessionId, threadTs };
            if (value.transferred) {
              entry.transferred = true;
              entry.transferredAt = value.transferredAt || Date.now();
              entry.postTransferReplies = value.postTransferReplies || 0;
            }
            activeThreads.set(threadTs, entry);
          }
        });
      }
      console.log(`[Hermes v2] State loaded: last timestamp = ${lastTimestamp}`);
      console.log(`[Hermes v2] Processed messages: ${processedMessages.size}`);
      console.log(`[Hermes v2] Active threads: ${activeThreads.size}`);
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
      activeThreads: Array.from(activeThreads.entries()),
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
  console.log(`[parseLeadData] === PARSING LEAD DATA ===`);
  console.log(`[parseLeadData] Raw text:\n${text}\n`);
  
  const nameMatch = text.match(/Name:\s*([^\n:]+)/i);
  const phoneMatch = text.match(/Phone:\s*(?:<tel:([^|>]+)|([^\n:]+))/i);
  const serviceMatch = text.match(/Service:\s*([^\n:]+)/i);
  const zipMatch = text.match(/(?:ZIP|Zip Code):\s*([^\n:]+)/i);
  const sourceMatch = text.match(/Source:\s*([^\n:]+)/i);
  const messageMatch = text.match(/Message:\s*([^\n]+)/i);
  
  const rawService = serviceMatch ? serviceMatch[1].trim() : 'Unknown';
  const message = messageMatch ? messageMatch[1].trim() : '';
  
  console.log(`[parseLeadData] Name match: "${nameMatch ? nameMatch[1].trim() : 'NONE'}"`);
  console.log(`[parseLeadData] Phone match: "${phoneMatch ? (phoneMatch[1] || phoneMatch[2]).trim() : 'NONE'}"`);
  console.log(`[parseLeadData] Service match: "${rawService}"`);
  console.log(`[parseLeadData] ZIP match: "${zipMatch ? zipMatch[1].trim() : 'NONE'}"`);
  console.log(`[parseLeadData] Source match: "${sourceMatch ? sourceMatch[1].trim() : 'NONE'}"`);
  console.log(`[parseLeadData] Message match: "${message}"`);
  
  // Map service types from form (handle various formats)
  let serviceType = rawService;
  const serviceLower = rawService.toLowerCase();
  
  if (serviceLower.includes('emergency')) {
    serviceType = 'Emergency Repair';
  } else if (serviceLower.includes('cooling') || serviceLower.includes('ac') || serviceLower.includes('air conditioning')) {
    serviceType = 'Cooling';
  } else if (serviceLower.includes('heating') || serviceLower.includes('furnace') || serviceLower.includes('heat')) {
    serviceType = 'Heating';
  } else if (serviceLower.includes('air quality') || serviceLower.includes('air-quality')) {
    serviceType = 'Air Quality';
  } else if (serviceLower.includes('maintenance')) {
    serviceType = 'Maintenance';
  } else if (serviceLower.includes('installation') || serviceLower.includes('new system')) {
    serviceType = 'Installation';
  }
  
  console.log(`[parseLeadData] Mapped service type: "${serviceType}"`);
  
  return {
    name: nameMatch ? nameMatch[1].trim() : 'there',
    phone: phoneMatch ? (phoneMatch[1] || phoneMatch[2]).trim() : 'Unknown',
    serviceType: serviceType,
    zip: zipMatch ? zipMatch[1].trim() : null,
    source: sourceMatch ? sourceMatch[1].trim() : 'HVAC Website',
    message: message,
    leadId: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * Start conversation with new lead
 */
async function startLeadConversation(text, message) {
  console.log(`\n[Hermes v2] ═══════════════════════════════════════`);
  console.log(`[Hermes v2] NEW LEAD DETECTED!`);
  
  // 🔒 DEDUPLICATION CHECK: Don't start conversation if thread already active
  if (activeThreads.has(message.ts)) {
    console.log(`[Hermes v2] ⚠️  Thread ${message.ts} already has active conversation - skipping duplicate`);
    console.log(`[Hermes v2] ═══════════════════════════════════════\n`);
    return;
  }
  
  // Parse lead info
  const leadData = parseLeadData(text);
  
  console.log(`[Hermes v2] Name: ${leadData.name}`);
  console.log(`[Hermes v2] Phone: ${leadData.phone}`);
  console.log(`[Hermes v2] Service: ${leadData.serviceType}`);
  console.log(`[Hermes v2] ZIP: ${leadData.zip || 'Not provided'}`);
  console.log(`[Hermes v2] Source: ${leadData.source}`);
  console.log(`[Hermes v2] Message: "${leadData.message}"`);
  
  // === SERVICE AREA CHECK ===
  if (leadData.zip) {
    const inArea = ServiceArea.isInServiceArea(leadData.zip);
    
    if (!inArea) {
      console.log(`[Hermes v2] ⛔ OUT OF SERVICE AREA: ${leadData.zip}`);
      const firstName = leadData.name.split(' ')[0];
      const declineMessage = ServiceArea.getDeclineMessage(firstName, leadData.zip);
      
      // Send decline message in Slack thread
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
  
  // 🔒 CRITICAL FIX: Map thread to session BEFORE sending message
  activeThreads.set(message.ts, { 
    sessionId: result.session.sessionId, 
    threadTs: message.ts 
  });
  console.log(`[Hermes v2] Thread mapping: ${message.ts} → ${result.session.sessionId}`);
  saveState(); // Persist immediately
  
  // Send opener in Slack thread
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
    reengagement.startMonitoring(result.session.sessionId, {
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
        reengagement.stopMonitoring(result.session.sessionId);
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
  
  // Mark thread as transferred (keep for post-transfer monitoring)
  const threadData = activeThreads.get(threadTs);
  if (threadData) {
    threadData.transferred = true;
    threadData.transferredAt = Date.now();
    threadData.postTransferReplies = 0;
  }
  saveState();
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
        
        // 🔒 CRITICAL FIX: Mark as processed BEFORE processing to prevent race conditions
        processedMessages.add(message.ts);
        lastTimestamp = message.ts;
        newMessagesProcessed++;
        saveState(); // Save immediately to prevent duplicates
        
        const text = message.text || '';
        
        // Check if this is a lead from Zapier
        if (text.includes('New Lead') || text.includes('Name:')) {
          await startLeadConversation(text, message);
        }
        
        // Keep processedMessages set from growing forever (keep last 1000)
        if (processedMessages.size > 1000) {
          const arr = Array.from(processedMessages);
          processedMessages.clear();
          arr.slice(-500).forEach(id => processedMessages.add(id));
        }
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
  const threadData = activeThreads.get(threadTs);
  const sessionId = threadData ? threadData.sessionId : null;
  console.log(`[Hermes v2] Looking up thread ${threadTs}, found: ${sessionId || 'NOT FOUND'}`);
  console.log(`[Hermes v2] Active threads in memory: ${Array.from(activeThreads.keys()).join(', ')}`);
  
  if (!sessionId) {
    console.log(`[Hermes v2] No active session for thread ${threadTs}`);
    return;
  }
  
  const text = message.text || '';
  
  // === POST-TRANSFER HANDLING (simple hardcoded responses, no AI) ===
  if (threadData.transferred === true) {
    const replies = threadData.postTransferReplies || 0;
    console.log(`[Hermes v2] Post-transfer message in thread ${threadTs} (reply #${replies + 1})`);
    console.log(`[Hermes v2] Message: "${text}"`);
    
    if (replies >= 3) {
      console.log(`[Hermes v2] Max post-transfer replies reached (3) — ignoring`);
      return;
    }
    
    threadData.postTransferReplies = replies + 1;
    saveState();
    
    if (replies === 0) {
      // First post-transfer reply — reassure
      await slackClient.chat.postMessage({
        channel: CHANNEL_ID,
        thread_ts: threadTs,
        text: "Hey — the team has your info, someone should be reaching out shortly. Anything else come up in the meantime?"
      });
      console.log(`[Hermes v2] Sent post-transfer reassurance`);
    } else {
      // Subsequent replies — flag for team with a NEW channel message (not in thread)
      // Get lead name from parent message
      let leadName = 'Lead';
      try {
        const parentMsg = await slackClient.conversations.replies({
          channel: CHANNEL_ID, ts: threadTs, limit: 1
        });
        if (parentMsg.messages && parentMsg.messages.length > 0) {
          const parsed = parseLeadData(parentMsg.messages[0].text);
          leadName = parsed.name;
        }
      } catch (e) { /* use default */ }
      
      await slackClient.chat.postMessage({
        channel: CHANNEL_ID,
        thread_ts: threadTs,
        text: "Let me flag this for the team — hang tight!"
      });
      
      await slackClient.chat.postMessage({
        channel: CHANNEL_ID,
        text: `⚠️ *Post-transfer follow-up from ${leadName}* — they're still active in <${`https://slack.com/archives/${CHANNEL_ID}/p${threadTs.replace('.', '')}`}|this thread> and may need attention.`
      });
      console.log(`[Hermes v2] Flagged post-transfer follow-up for team`);
    }
    return;
  }
  
  console.log(`\n[Hermes v2] ─────────────────────────────────────`);
  console.log(`[Hermes v2] Inbound from session ${sessionId.substring(0, 8)}...`);
  console.log(`[Hermes v2] Message: "${text}"`);
  
  // 🔒 CRITICAL FIX: Fetch full Slack thread history to rebuild conversation context
  console.log(`[Hermes v2] Fetching full thread history for context...`);
  try {
    const threadHistory = await slackClient.conversations.replies({
      channel: CHANNEL_ID,
      ts: threadTs,
      limit: 100 // Get up to 100 messages (more than enough for any conversation)
    });
    
    if (threadHistory.messages && threadHistory.messages.length > 0) {
      // Rebuild session transcript from actual Slack messages
      const fullTranscript = [];
      
      for (const msg of threadHistory.messages) {
        // Skip the original lead message (parent)
        if (msg.ts === threadTs) continue;
        
        const sender = msg.bot_id ? 'hermes' : 'lead';
        const msgText = msg.text || '';
        
        fullTranscript.push({
          sender: sender,
          text: msgText,
          timestamp: msg.ts
        });
      }
      
      // Update session with full conversation history
      engine.stateManager.rebuildTranscript(sessionId, fullTranscript);
      
      console.log(`[Hermes v2] ✅ Rebuilt transcript with ${fullTranscript.length} messages from Slack thread`);
    }
  } catch (error) {
    console.error(`[Hermes v2] ⚠️  Failed to fetch thread history:`, error.message);
    console.log(`[Hermes v2] Continuing with existing transcript...`);
  }
  
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
  // Cleanup expired transferred threads every poll cycle
  setInterval(() => {
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    for (const [threadTs, data] of activeThreads) {
      if (data.transferred && data.transferredAt && (now - data.transferredAt > TWENTY_FOUR_HOURS)) {
        console.log(`[Hermes v2] Expiring transferred thread ${threadTs} (>24h old)`);
        activeThreads.delete(threadTs);
      }
    }
  }, POLL_INTERVAL);
  
  setInterval(pollForLeads, POLL_INTERVAL);
  pollForLeads(); // Initial poll
})();

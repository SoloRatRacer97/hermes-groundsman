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
const { execSync } = require('child_process');
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

const IMSG_BIN = '/opt/homebrew/bin/imsg';
const IMSG_POLL_INTERVAL = 5000; // 5 seconds

let lastTimestamp = null;
const processedMessages = new Set();
const activeThreads = new Map(); // threadTs -> { sessionId, phone, threadTs }
const phoneToThread = new Map(); // phone -> threadTs (reverse lookup)
const imsgLastSeen = new Map(); // phone -> last message timestamp we processed
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
          // Handle both old format (string sessionId) and new format (object)
          if (typeof value === 'string') {
            activeThreads.set(threadTs, { sessionId: value, phone: null, threadTs });
          } else if (value && typeof value === 'object') {
            activeThreads.set(threadTs, value);
            if (value.phone) {
              phoneToThread.set(value.phone, threadTs);
            }
          }
        });
      }
      if (data.imsgLastSeen && typeof data.imsgLastSeen === 'object') {
        Object.entries(data.imsgLastSeen).forEach(([phone, ts]) => {
          imsgLastSeen.set(phone, ts);
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
      imsgLastSeen: Object.fromEntries(imsgLastSeen),
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('[Hermes v2] Error saving state:', error.message);
  }
}

/**
 * Send iMessage via imsg CLI
 */
async function sendIMessage(phone, text) {
  try {
    // Strip system tags before sending to lead
    text = text.replace(/\[TRANSFER\]/gi, '').replace(/\[CONTINUE\]/gi, '').replace(/\[COMPLETE\]/gi, '').trim();
    
    // Escape double quotes and backslashes for shell
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const cmd = `${IMSG_BIN} send --to "${phone}" --text "${escaped}"`;
    console.log(`[Hermes v2] 📱 Sending iMessage to ${phone}`);
    execSync(cmd, { timeout: 15000 });
    console.log(`[Hermes v2] 📱 iMessage sent successfully`);
    return true;
  } catch (error) {
    console.error(`[Hermes v2] 📱 iMessage send failed:`, error.message);
    return false;
  }
}

/**
 * Format phone number for imsg (ensure +prefix)
 */
function formatPhone(phone) {
  if (!phone || phone === 'Unknown') return null;
  // Strip everything non-numeric
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 10) return null;
  return '+' + digits;
}

/**
 * Cache of phone → chat-id mappings
 */
const phoneToChatId = new Map();

/**
 * Look up imsg chat-id for a phone number
 */
function getChatIdForPhone(phone) {
  if (phoneToChatId.has(phone)) return phoneToChatId.get(phone);
  console.log(`[Hermes v2] 📱 Looking up chat-id for ${phone}...`);
  try {
    const output = execSync(`${IMSG_BIN} chats --json`, { timeout: 10000, encoding: 'utf8' });
    // Each line is a JSON object
    const lines = output.trim().split('\n').filter(l => l.trim());
    for (const line of lines) {
      const chat = JSON.parse(line);
      if (chat.identifier === phone || chat.identifier === phone.replace('+', '')) {
        phoneToChatId.set(phone, chat.id);
        return chat.id;
      }
    }
  } catch (e) {
    console.error(`[Hermes v2] 📱 Failed to look up chat-id for ${phone}:`, e.message);
  }
  return null;
}

/**
 * Get recent iMessage history for a phone number
 */
function getIMessageHistory(phone, limit = 5) {
  try {
    const chatId = getChatIdForPhone(phone);
    if (!chatId) {
      // Send a message first to create the chat, then retry
      return [];
    }
    const cmd = `${IMSG_BIN} history --chat-id ${chatId} --limit ${limit} --json`;
    const output = execSync(cmd, { timeout: 10000, encoding: 'utf8' });
    // Each line is a separate JSON object
    const lines = output.trim().split('\n').filter(l => l.trim());
    const msgs = lines.map(l => JSON.parse(l));
    if (msgs.length > 0) {
      console.log(`[Hermes v2] 📱 Got ${msgs.length} messages from chat-id ${chatId}, newest from_me=${msgs[0].is_from_me}, text="${(msgs[0].text || '').substring(0, 50)}"`);
    }
    return msgs;
  } catch (error) {
    if (!error.message.includes('No chat found')) {
      console.error(`[Hermes v2] 📱 iMessage history fetch failed:`, error.message);
    }
    return [];
  }
}

/**
 * Poll all active iMessage conversations for replies
 */
async function pollIMessageReplies() {
  if (phoneToThread.size === 0) return; // Nothing to poll
  for (const [phone, threadTs] of phoneToThread.entries()) {
    console.log(`[Hermes v2] 📱 Polling iMessage for ${phone} (thread: ${threadTs})`);
    const threadData = activeThreads.get(threadTs);
    if (!threadData) {
      phoneToThread.delete(phone);
      continue;
    }

    try {
      const history = getIMessageHistory(phone, 3);
      if (!history || !Array.isArray(history) || history.length === 0) continue;

      // Find new inbound messages (from them, not from us)
      const lastSeenId = imsgLastSeen.get(phone) || 0;

      for (const msg of history) {
        // Skip our own outgoing messages
        if (msg.is_from_me || msg.fromMe) continue;
        
        // Skip already-processed messages (use numeric id for reliable comparison)
        const msgNumId = msg.id || 0;
        if (msgNumId <= lastSeenId) continue;

        const text = msg.text || msg.body || '';
        if (!text.trim()) continue;

        console.log(`\n[Hermes v2] 📱 ═══════════════════════════════════════`);
        console.log(`[Hermes v2] 📱 INBOUND iMESSAGE from ${phone}`);
        console.log(`[Hermes v2] 📱 Message: "${text}"`);

        // Update last seen (numeric id)
        imsgLastSeen.set(phone, msgNumId);

        // Reset re-engagement timer
        reengagement.resetActivity(threadData.sessionId);

        // Fetch Slack thread history for full context
        try {
          const threadHistory = await client.conversations.replies({
            channel: CHANNEL_ID,
            ts: threadTs,
            limit: 100
          });

          if (threadHistory.messages && threadHistory.messages.length > 0) {
            const fullTranscript = [];
            for (const m of threadHistory.messages) {
              if (m.ts === threadTs) continue;
              fullTranscript.push({
                sender: m.bot_id ? 'hermes' : 'lead',
                text: m.text || '',
                timestamp: m.ts
              });
            }
            // Add this iMessage as the latest lead message
            fullTranscript.push({
              sender: 'lead',
              text: text,
              timestamp: String(Date.now() / 1000)
            });
            engine.stateManager.rebuildTranscript(threadData.sessionId, fullTranscript);
          }
        } catch (err) {
          console.error(`[Hermes v2] 📱 Failed to fetch thread history:`, err.message);
        }

        // Process through conversation engine
        console.log(`[Hermes v2] 📱 Processing via engine, sessionId: ${threadData.sessionId}`);
        let result;
        try {
          result = await engine.processMessage(threadData.sessionId, text);
        } catch (engineErr) {
          console.error(`[Hermes v2] 📱 Engine error:`, engineErr.message);
          continue;
        }

        if (!result || !result.session) {
          console.error(`[Hermes v2] 📱 Failed to process iMessage - no result from engine, result:`, JSON.stringify(result));
          continue;
        }

        console.log(`[Hermes v2] 📱 Action: ${result.action}`);
        console.log(`[Hermes v2] 📱 Status: ${result.session.status}`);

        if (result.shouldSend && result.response) {
          // Send via iMessage (PRIMARY)
          await sendIMessage(phone, result.response);

          // Mirror to Slack: lead message first, then response (correct order)
          await client.chat.postMessage({
            channel: CHANNEL_ID,
            thread_ts: threadTs,
            text: `Lead: "${text}"`
          });
          await client.chat.postMessage({
            channel: CHANNEL_ID,
            thread_ts: threadTs,
            text: `Hermes: "${result.response}"`
          });
        }

        // Check for handoff
        if (result.action === 'TRANSFER' ||
            result.action === 'TRANSFER_PARACHUTE' ||
            result.action === 'TRANSFER_FRUSTRATION' ||
            result.session.status === 'completed' ||
            result.session.status === 'parachute') {

          console.log(`[Hermes v2] 📱 Handoff condition met: ${result.action}`);
          const parentMessage = await client.conversations.replies({
            channel: CHANNEL_ID,
            ts: threadTs,
            limit: 1
          });

          if (parentMessage.messages && parentMessage.messages.length > 0) {
            const leadData = parseLeadData(parentMessage.messages[0].text);
            await sendHandoffPayload(result.session, leadData, threadTs);
          }

          // Clean up iMessage tracking
          phoneToThread.delete(phone);
          imsgLastSeen.delete(phone);
        }

        console.log(`[Hermes v2] 📱 ═══════════════════════════════════════\n`);
      }
    } catch (error) {
      console.error(`[Hermes v2] 📱 Poll error for ${phone}:`, error.message);
    }
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
      
      // Send decline via iMessage if we have phone
      const declinePhone = formatPhone(leadData.phone);
      if (declinePhone) {
        await sendIMessage(declinePhone, declineMessage);
      }
      
      // Send decline message in Slack thread
      await client.chat.postMessage({
        channel: CHANNEL_ID,
        thread_ts: message.ts,
        text: declinePhone ? `📱 _[Sent via iMessage]_\n${declineMessage}` : declineMessage
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
  
  // Format phone for iMessage
  const imsgPhone = formatPhone(leadData.phone);
  
  // 🔒 CRITICAL FIX: Map thread to session BEFORE sending message
  activeThreads.set(message.ts, { 
    sessionId: result.session.sessionId, 
    phone: imsgPhone, 
    threadTs: message.ts 
  });
  if (imsgPhone) {
    phoneToThread.set(imsgPhone, message.ts);
  }
  console.log(`[Hermes v2] Thread mapping: ${message.ts} → ${result.session.sessionId} (phone: ${imsgPhone})`);
  saveState(); // Persist immediately
  
  // Send opener via iMessage (PRIMARY)
  if (imsgPhone) {
    await sendIMessage(imsgPhone, result.message);
  } else {
    console.log(`[Hermes v2] ⚠️  No valid phone number - iMessage skipped`);
  }
  
  // Also send opener in Slack thread (internal visibility)
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: message.ts,
    text: imsgPhone ? `📱 _[Sent via iMessage to ${imsgPhone}]_\n${result.message}` : result.message
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
  
  // Clean up thread mapping and iMessage tracking
  const threadInfo = activeThreads.get(threadTs);
  if (threadInfo && threadInfo.phone) {
    phoneToThread.delete(threadInfo.phone);
    imsgLastSeen.delete(threadInfo.phone);
  }
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
  
  // If this thread has iMessage active, skip Slack processing (iMessage poller handles it)
  if (threadData.phone && phoneToThread.has(threadData.phone)) {
    console.log(`[Hermes v2] Skipping Slack reply - iMessage active for ${threadData.phone}`);
    return;
  }
  
  const text = message.text || '';
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
    // Send via iMessage (PRIMARY) if we have a phone
    if (threadData.phone) {
      await sendIMessage(threadData.phone, result.response);
    }
    
    // Also post to Slack thread (internal visibility)
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: threadTs,
      text: threadData.phone ? `📱 _[via iMessage]_\n${result.response}` : result.response
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
  console.log('[Hermes v2] Starting lead poller...');
  console.log('[Hermes v2] Starting iMessage reply poller...\n');
  setInterval(pollForLeads, POLL_INTERVAL);
  setInterval(pollIMessageReplies, IMSG_POLL_INTERVAL);
  pollForLeads(); // Initial poll
})();

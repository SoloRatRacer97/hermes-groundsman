#!/usr/bin/env node

/**
 * Hermes Interactive Bot v2 — Orchestrator
 * Wires together: lead-parser, imessage-adapter, thread-manager, slack-poller, handoff-formatter
 * Detects new leads, qualifies via Gaius, hands off to CSR team
 */

const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./src/config');

// Module imports (#4: God file split)
const ConversationEngine = require('./src/conversation-engine');
const ReengagementManager = require('./src/reengagement');
const ServiceArea = require('./src/service-area');
const Handoff = require('./src/handoff');
const { parseLeadData } = require('./src/lead-parser');
const { sendIMessage, formatPhone, getChatIdForPhone, getIMessageHistory } = require('./src/imessage-adapter');
const { sendSMS, canSendSMS } = require('./src/sms-adapter');
const { isNewLeadMessage } = require('./src/slack-poller');
const ThreadManager = require('./src/thread-manager');
const { validateOutput } = require('./src/output-validator');
const { sanitizeLeadInput } = require('./src/gaius-router');
const { checkDelivery } = require('./src/imessage-detector');
const channelCache = require('./src/channel-cache');

const DELIVERY_TIMEOUT = parseInt(process.env.IMESSAGE_DELIVERY_TIMEOUT_MS, 10) || 10000;

// --- Rate limiting & cost protection ---
const ALERT_WEBHOOK = process.env.QUALIFIED_WEBHOOK_URL || '';
const DAILY_LEAD_CAP = 40;
const DAILY_CAP_WARNING = 35;
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const SPAM_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SPAM_THRESHOLD = 3;

const leadCooldowns = new Map(); // phone -> last processed timestamp
const phoneSubmissions = new Map(); // phone -> [timestamps] for spam detection
let dailyLeadCount = 0;
let dailyResetDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });

function resetDailyCountIfNeeded() {
  const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
  if (today !== dailyResetDate) {
    console.log(`[Hermes] 🔄 Daily lead counter reset (${dailyLeadCount} → 0)`);
    dailyLeadCount = 0;
    dailyResetDate = today;
  }
}

function cleanupCooldowns() {
  const now = Date.now();
  for (const [phone, ts] of leadCooldowns.entries()) {
    if (now - ts > COOLDOWN_MS) leadCooldowns.delete(phone);
  }
  for (const [phone, timestamps] of phoneSubmissions.entries()) {
    const recent = timestamps.filter(t => now - t < SPAM_WINDOW_MS);
    if (recent.length === 0) phoneSubmissions.delete(phone);
    else phoneSubmissions.set(phone, recent);
  }
}

async function sendRateLimitAlert(type, details) {
  console.log(`[Hermes] 🚨 Alert (${type}): ${details}`);
  try {
    await fetch(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert: true, type, details }),
    });
  } catch (err) {
    console.error(`[Hermes] ⚠️ Alert webhook failed: ${err.message}`);
  }
  alertSlack(`🚨 Rate limit alert (${type}): ${details}`);
}

// --- PII masking (#10) ---
function maskPhone(phone) {
  if (!phone || phone === 'Unknown') return phone;
  if (config.logging.logPii) return phone;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

// --- iMessage adapter helpers (pass maskPhone/alertSlack) ---
const imsgOpts = { maskPhone, alertSlack };
async function sendMsg(phone, text, { preferSMS = false, skipDelay = false, isFirstMessage = false } = {}) {
  // Human-like response delay
  if (!skipDelay) {
    const delayMs = isFirstMessage
      ? 10000 + Math.floor(Math.random() * 5000)   // First message: 10-15s
      : 35000 + Math.floor(Math.random() * 15000);  // Follow-ups: 35-50s
    console.log(`[Hermes] ⏳ Response delay: ${Math.round(delayMs/1000)}s (${isFirstMessage ? 'first' : 'follow-up'})`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  
  // Check channel cache first
  const cachedChannel = channelCache.get(phone);

  // If cached as SMS or explicitly preferSMS, go straight to Twilio
  if ((preferSMS || cachedChannel === 'sms') && canSendSMS()) {
    console.log(`[Hermes] 📲 Using SMS channel for ${maskPhone(phone)}${cachedChannel === 'sms' ? ' (cached)' : ''}`);
    const sid = await sendSMS(phone, text);
    if (sid) return true;
    console.warn(`[Hermes] ⚠️ SMS failed, trying iMessage...`);
  }

  // If cached as iMessage, send directly without delivery check
  if (cachedChannel === 'imessage') {
    console.log(`[Hermes] 📱 Using iMessage for ${maskPhone(phone)} (cached)`);
    const ok = await sendIMessage(phone, text, imsgOpts);
    if (ok) return true;
    // iMessage failed unexpectedly — fall through to SMS
  }

  // Not cached or cache miss — try iMessage with delivery detection
  if (cachedChannel !== 'sms') {
    const ok = await sendIMessage(phone, text, imsgOpts);
    if (ok) {
      // Check delivery
      console.log(`[Hermes] 🔍 Checking iMessage delivery for ${maskPhone(phone)} (timeout: ${DELIVERY_TIMEOUT}ms)`);
      const result = await checkDelivery(phone, DELIVERY_TIMEOUT);
      console.log(`[Hermes] 🔍 Delivery result: delivered=${result.delivered}, service=${result.service}`);

      if (result.delivered) {
        channelCache.set(phone, 'imessage');
        console.log(`[Hermes] ✅ iMessage delivered to ${maskPhone(phone)} — cached as iMessage`);
        return true;
      }

      // Not delivered confirmation — but iMessage was sent successfully above, so trust it
      console.log(`[Hermes] 📲 iMessage delivery not confirmed for ${maskPhone(phone)}, but message was sent — skipping SMS fallback`);
      channelCache.set(phone, 'imessage');
      return true;
    }
  }

  // SMS fallback disabled for Groundsman (no Twilio configured)
  console.log(`[Hermes] ⚠️ No delivery method available for ${maskPhone(phone)}`);
  return false;
}

/**
 * V16: Send AI-generated message with output validation gate
 * Validates response before sending; sends fallback + alerts on failure
 */
async function sendValidatedMsg(phone, text, { preferSMS = false, isFirstMessage = false } = {}) {
  const result = validateOutput(text, {
    alertFn: alertSlack,
    logFn: (msg) => console.error(msg),
  });
  if (!result.valid) {
    console.error(`[Hermes] 🛡️ Output blocked (${result.reason}) — sending fallback`);
    return sendMsg(phone, result.safeResponse, { preferSMS, isFirstMessage });
  }
  return sendMsg(phone, text, { preferSMS, isFirstMessage });
}

// --- Slack setup ---
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = 'C0AF9862EAJ'; // #new-leads
const POLL_INTERVAL = 10000;
const IMSG_POLL_INTERVAL = 5000;

// --- Error alerting to Slack (#8) ---
const ALERT_CHANNEL = 'C09HV2XHVA7';
async function alertSlack(message) {
  try {
    await client.chat.postMessage({
      channel: ALERT_CHANNEL,
      text: `🚨 *Hermes Alert:* ${message}`
    });
  } catch (e) {
    console.error(`[Hermes] Failed to send Slack alert: ${e.message}`);
  }
}

// --- Core instances ---
const engine = new ConversationEngine();
const reengagement = new ReengagementManager();
const STATE_DIR = process.env.STATE_DIR || __dirname;
const threads = new ThreadManager(path.join(STATE_DIR, '.hermes-interactive-state.json'));
const pendingMessages = new Map(); // phone -> [{ text, msgNumId, rawText }]

console.log('[Hermes] Online');
console.log(`[Hermes] Monitoring: #new-leads (${CHANNEL_ID})`);
threads.load();

// ============================================================
// LEAD CONVERSATION START
// ============================================================
async function startLeadConversation(text, message) {
  console.log(`\n[Hermes] ═══ NEW LEAD DETECTED ═══`);

  if (threads.activeThreads.has(message.ts)) {
    console.log(`[Hermes] ⚠️ Duplicate thread ${message.ts} — skipping`);
    return;
  }

  const leadData = parseLeadData(text);
  const phone = formatPhone(leadData.phone);

  // --- Rate limiting checks ---
  resetDailyCountIfNeeded();

  // Per-phone cooldown (10 min)
  if (phone && leadCooldowns.has(phone)) {
    const elapsed = Date.now() - leadCooldowns.get(phone);
    if (elapsed < COOLDOWN_MS) {
      console.log(`[Hermes] ⏱️ Cooldown: ${maskPhone(phone)} submitted ${Math.round(elapsed / 1000)}s ago — skipping`);
      return;
    }
  }

  // Daily lead cap
  if (dailyLeadCount >= DAILY_LEAD_CAP) {
    console.warn(`[Hermes] 🛑 DAILY CAP REACHED (${dailyLeadCount}/${DAILY_LEAD_CAP}) — skipping lead`);
    return;
  }

  // Track phone submissions for spam detection
  if (phone) {
    const now = Date.now();
    if (!phoneSubmissions.has(phone)) phoneSubmissions.set(phone, []);
    phoneSubmissions.get(phone).push(now);
    const recentCount = phoneSubmissions.get(phone).filter(t => now - t < SPAM_WINDOW_MS).length;
    if (recentCount >= SPAM_THRESHOLD) {
      sendRateLimitAlert('rate_limit', `Phone ${maskPhone(phone)} submitted ${recentCount} times in the last hour`);
    }
    leadCooldowns.set(phone, now);
  }

  // Increment daily counter and check warning threshold
  dailyLeadCount++;
  if (dailyLeadCount === DAILY_CAP_WARNING) {
    sendRateLimitAlert('daily_cap_warning', `Daily lead count hit warning threshold: ${dailyLeadCount}/${DAILY_LEAD_CAP}`);
  }
  if (dailyLeadCount === DAILY_LEAD_CAP) {
    sendRateLimitAlert('daily_cap_warning', `Daily lead cap REACHED: ${dailyLeadCount}/${DAILY_LEAD_CAP} — no more leads will be processed today`);
  }

  console.log(`[Hermes] 📊 Daily leads: ${dailyLeadCount}/${DAILY_LEAD_CAP}`);
  
  console.log(`[Hermes] Name: ${leadData.name}`);
  console.log(`[Hermes] Phone: ${maskPhone(leadData.phone)}`);
  console.log(`[Hermes] Service: ${leadData.serviceType}`);
  
  // Service area check
  if (leadData.zip) {
    if (!ServiceArea.isInServiceArea(leadData.zip)) {
      console.log(`[Hermes] ⛔ OUT OF SERVICE AREA: ${leadData.zip}`);
      const firstName = leadData.name.split(' ')[0];
      const declineMessage = ServiceArea.getDeclineMessage(firstName, leadData.zip);
      const declinePhone = formatPhone(leadData.phone);
      if (declinePhone) await sendMsg(declinePhone, declineMessage);
      await client.chat.postMessage({
        channel: CHANNEL_ID, thread_ts: message.ts,
        text: declinePhone ? `📱 _[Sent via iMessage]_\n${declineMessage}` : declineMessage
      });
      return;
    }
  }
  
  const imsgPhone = phone; // already formatted above for rate limiting
  
  // Close old thread on same phone (#5: unified state)
  if (imsgPhone) threads.closePhoneCollision(imsgPhone);
  
  const result = await engine.startConversation(leadData);
  if (!result || !result.shouldSend) {
    console.error(`[Hermes] No opener generated`);
    return;
  }
  
  // Register thread in unified state
  threads.registerThread(message.ts, result.session.sessionId, imsgPhone);
  console.log(`[Hermes] Thread: ${message.ts} → ${result.session.sessionId}`);
  
  // Set imsgLastSeen before sending opener
  if (imsgPhone) {
    const preHistory = await getIMessageHistory(imsgPhone, 1);
    if (preHistory && preHistory.length > 0) {
      threads.imsgLastSeen.set(imsgPhone, preHistory[0].id || 0);
    }
    await sendValidatedMsg(imsgPhone, result.message, { isFirstMessage: true });
  }
  
  await client.chat.postMessage({
    channel: CHANNEL_ID, thread_ts: message.ts,
    text: imsgPhone ? `📱 _[Sent via iMessage to ${maskPhone(imsgPhone)}]_\n${result.message}` : result.message
  });
  
  // Check for immediate handoff
  if (result.action === 'TRANSFER' || result.session.status === 'completed') {
    await sendHandoffPayload(result.session, leadData, message.ts);
  } else {
    reengagement.startMonitoring(
      result.session.sessionId,
      { name: leadData.name, phone: imsgPhone, serviceType: leadData.serviceType },
      {
        onFollowUp: async (sessionId, ctx) => {
          const followUpMsg = await engine.generateFollowUp(sessionId, ctx);
          if (!followUpMsg) return;

          // Send via iMessage
          if (imsgPhone) {
            await sendValidatedMsg(imsgPhone, followUpMsg);
          }

          // Log to Slack thread
          const label = `T${ctx.tier}B${ctx.bumpNumber}`;
          await client.chat.postMessage({
            channel: CHANNEL_ID,
            thread_ts: message.ts,
            text: `🔄 _[Follow-up ${label} — ${ctx.elapsedMinutes}min no reply]_\n${followUpMsg}`,
          });

          console.log(`[Hermes] 🔄 Follow-up ${label} sent for ${maskPhone(imsgPhone)} (${ctx.elapsedMinutes}min)`);
        },
      }
    );
  }
  
  console.log(`[Hermes] ═══════════════════════════════\n`);
}

// ============================================================
// HANDOFF
// ============================================================
async function sendHandoffPayload(session, leadData, threadTs) {
  console.log(`[Hermes] 🚀 HANDOFF — ${session.sessionId}`);
  
  const handoffMessage = Handoff.formatHandoffMessage(session, leadData);
  
  // If this is a revival (thread already exists with a parent message), 
  // EDIT the original message instead of creating a new top-level entry.
  // Slack = CRM: one entry per lead, update status in-place.
  const threadData = threads.activeThreads.get(threadTs);
  if (threadData && threadData.transferred) {
    // Revival — edit the original thread parent message with updated status
    try {
      await client.chat.update({ channel: CHANNEL_ID, ts: threadTs, text: handoffMessage });
      console.log(`[Hermes] 📝 Updated existing CRM entry (revival) for ${threadTs}`);
    } catch (e) {
      // If edit fails (e.g. Zapier message), post update in-thread instead
      await client.chat.postMessage({ channel: CHANNEL_ID, thread_ts: threadTs, text: `📝 *Status Update:* ${session.leadTemp || 'WARM'}\n${handoffMessage}` });
      console.log(`[Hermes] 📝 Couldn't edit original, posted update in thread`);
    }
  } else {
    // First qualification — post as new top-level message
    await client.chat.postMessage({ channel: CHANNEL_ID, text: handoffMessage });
  }
  
  reengagement.stopMonitoring(session.sessionId);
  threads.markTransferred(threadTs);
  
  // POST qualified lead data to Zapier for CRM update + owner notification
  const QUALIFIED_WEBHOOK = process.env.QUALIFIED_WEBHOOK_URL;
  if (QUALIFIED_WEBHOOK) {
    const data = session.dataCollected || {};
    const payload = {
      firstName: (leadData.name || '').split(' ')[0] || '',
      lastName: (leadData.name || '').split(' ').slice(1).join(' ') || '',
      name: leadData.name || '',
      phone: leadData.phone || '',
      email: leadData.email || '',
      address: leadData.address || '',
      service: leadData.serviceType || leadData.service || '',
      source: leadData.source || 'groundsman-website',
      status: 'QUALIFIED',
      temperature: session.leadTemp || 'COLD',
      timeline: data.timeline || 'Flexible',
      problem_summary: data.problem || session.problemSummary || '',
      message: (session.transcript || []).map(t => `${t.role === 'lead' ? 'Lead' : 'Hermes'}: ${t.text}`).join('\n'),
      conversation_url: `https://app.slack.com/client/${process.env.SLACK_TEAM_ID || 'T09HQMN24GQ'}/${CHANNEL_ID}/thread/${threadTs}`,
      qualified_at: new Date().toISOString()
    };
    
    try {
      const resp = await fetch(QUALIFIED_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log(`[Hermes] 📤 Qualified webhook sent (${resp.status})`);
    } catch (err) {
      console.error(`[Hermes] ⚠️ Qualified webhook failed: ${err.message}`);
    }
  }
}

// ============================================================
// iMESSAGE REPLY POLLER
// ============================================================
async function pollIMessageReplies() {
  if (threads.phoneToThread.size === 0) return;
  
  for (const [phone, threadTs] of threads.phoneToThread.entries()) {
    const threadData = threads.activeThreads.get(threadTs);
    if (!threadData) { threads.phoneToThread.delete(phone); continue; }

    try {
      const history = await getIMessageHistory(phone, 3);
      if (!history || !Array.isArray(history) || history.length === 0) continue;

      const lastSeenId = threads.imsgLastSeen.get(phone) || 0;

      for (const msg of history) {
        if (msg.is_from_me || msg.fromMe) continue;
        const msgNumId = msg.id || 0;
        if (msgNumId <= lastSeenId) continue;
        const text = msg.text || msg.body || '';
        if (!text.trim()) continue;

        console.log(`\n[Hermes] 📱 ═══ INBOUND from ${maskPhone(phone)} ═══`);
        console.log(`[Hermes] 📱 "${text}"`);

        // V16: Sanitize inbound iMessage before using in prompts
        const { sanitized: sanitizedText, actions: sanitizeActions } = sanitizeLeadInput(text);

        threads.imsgLastSeen.set(phone, msgNumId);

        // Generation lock
        if (threads.phoneGeneratingLock.get(phone)) {
          console.log(`[Hermes] 📱 🔒 Already generating — queuing message`);
          if (!pendingMessages.has(phone)) pendingMessages.set(phone, []);
          pendingMessages.get(phone).push({ text: sanitizedText, msgNumId, rawText: text });
          continue;
        }

        // Revive transferred threads
        if (threadData.transferred === true) {
          const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
          if (threadData.transferredAt && (Date.now() - threadData.transferredAt > SEVENTY_TWO_HOURS)) {
            continue;
          }
          const revived = threads.reviveThread(threadTs);
          engine.stateManager.reviveSession(threadData.sessionId);
          
          let reviveName = 'Lead';
          try {
            const parentMsg = await client.conversations.replies({ channel: CHANNEL_ID, ts: threadTs, limit: 1 });
            if (parentMsg.messages && parentMsg.messages.length > 0) {
              reviveName = parseLeadData(parentMsg.messages[0].text).name;
            }
          } catch (e) { /* default */ }
          
          // Post revival update IN the thread, not as a new top-level message
          await client.chat.postMessage({
            channel: CHANNEL_ID,
            thread_ts: threadTs,
            text: `🔄 Lead texted back — "${text.substring(0, 100)}" (revive #${revived.reviveCount})`
          });
        }

        reengagement.resetActivity(threadData.sessionId, text);

        // Rebuild transcript from Slack
        try {
          const threadHistory = await client.conversations.replies({ channel: CHANNEL_ID, ts: threadTs, limit: 100 });
          if (threadHistory.messages && threadHistory.messages.length > 0) {
            const fullTranscript = [];
            for (const m of threadHistory.messages) {
              if (m.ts === threadTs) continue;
              // V16: Sanitize all lead messages in transcript before prompt inclusion
              const tText = m.bot_id ? (m.text || '') : sanitizeLeadInput(m.text || '').sanitized;
              fullTranscript.push({ sender: m.bot_id ? 'hermes' : 'lead', text: tText, timestamp: m.ts });
            }
            fullTranscript.push({ sender: 'lead', text: sanitizedText, timestamp: String(Date.now() / 1000) });
            engine.stateManager.rebuildTranscript(threadData.sessionId, fullTranscript);
          }
        } catch (err) {
          console.error(`[Hermes] Failed to fetch thread history:`, err.message);
        }

        const iMsgSession = engine.stateManager.sessions.get(threadData.sessionId);
        const iMsgQId = iMsgSession ? `q${iMsgSession.questionsAsked + 1}` : 'q1';
        engine.stateManager.recordAnswer(threadData.sessionId, iMsgQId, sanitizedText);

        // Process with LAST-LOOK GATE
        threads.phoneGeneratingLock.set(phone, true);
        const startMsgId = threads.imsgLastSeen.get(phone) || 0;
        let result;
        try {
          result = await engine.processMessage(threadData.sessionId, sanitizedText);
        } catch (engineErr) {
          console.error(`[Hermes] Engine error:`, engineErr.message);
          alertSlack(`🧠 Gaius engine error for ${maskPhone(phone)}: ${engineErr.message}`);
          threads.phoneGeneratingLock.delete(phone);
          continue;
        }

        // Last-look gate
        if (result && result.shouldSend && result.response) {
          let lastLookAttempts = 0;
          const MAX_LAST_LOOK = 2;
          
          while (lastLookAttempts < MAX_LAST_LOOK) {
            const recentMsgs = await getIMessageHistory(phone, 5);
            const currentLastSeen = threads.imsgLastSeen.get(phone) || 0;
            const unseenMessages = recentMsgs.filter(m => {
              const mId = m.id || 0;
              return !m.is_from_me && !m.fromMe && mId > currentLastSeen && (m.text || m.body || '').trim();
            });
            
            if (unseenMessages.length === 0) break;
            
            lastLookAttempts++;
            console.log(`[Hermes] 📱 LAST-LOOK: ${unseenMessages.length} new message(s) — re-prompting (${lastLookAttempts}/${MAX_LAST_LOOK})`);
            
            for (const newMsg of unseenMessages) {
              const newText = sanitizeLeadInput(newMsg.text || newMsg.body || '').sanitized;
              threads.imsgLastSeen.set(phone, newMsg.id || 0);
              engine.stateManager.addToTranscript(threadData.sessionId, 'lead', newText);
              engine.stateManager.recordAnswer(threadData.sessionId, `q_lastlook_${lastLookAttempts}`, newText);
              await client.chat.postMessage({ channel: CHANNEL_ID, thread_ts: threadTs, text: `Lead: "${newText}"` });
            }
            
            const session = engine.stateManager.getSession(threadData.sessionId);
            if (session && session.transcript && session.transcript.length > 0) {
              const lastEntry = session.transcript[session.transcript.length - 1];
              if (lastEntry.sender === 'hermes') session.transcript.pop();
            }
            
            try {
              const latestText = sanitizeLeadInput(unseenMessages[unseenMessages.length - 1].text || unseenMessages[unseenMessages.length - 1].body || '').sanitized;
              result = await engine.processMessage(threadData.sessionId, latestText);
            } catch (reErr) {
              console.error(`[Hermes] LAST-LOOK re-prompt failed:`, reErr.message);
              break;
            }
            
            if (!result || !result.shouldSend || !result.response) break;
          }
        }

        if (!result || !result.session) {
          threads.phoneGeneratingLock.delete(phone);
          continue;
        }

        if (result.shouldSend && result.response) {
          const validated = validateOutput(result.response, { alertFn: alertSlack });
          const msgToSend = validated.valid ? result.response : validated.safeResponse;
          await sendMsg(phone, msgToSend);
          await client.chat.postMessage({ channel: CHANNEL_ID, thread_ts: threadTs, text: `Lead: "${text}"` });
          await client.chat.postMessage({ channel: CHANNEL_ID, thread_ts: threadTs, text: `Hermes: "${msgToSend}"` });
        }

        // Check for handoff
        if (result.action === 'TRANSFER' || result.action === 'TRANSFER_PARACHUTE' ||
            result.action === 'TRANSFER_FRUSTRATION' || result.session.status === 'completed' ||
            result.session.status === 'parachute') {
          const parentMessage = await client.conversations.replies({ channel: CHANNEL_ID, ts: threadTs, limit: 1 });
          if (parentMessage.messages && parentMessage.messages.length > 0) {
            const leadData = parseLeadData(parentMessage.messages[0].text);
            await sendHandoffPayload(result.session, leadData, threadTs);
          }
        }

        threads.phoneGeneratingLock.delete(phone);

        // Process queued messages that arrived during generation
        if (pendingMessages.has(phone) && pendingMessages.get(phone).length > 0) {
          const queued = pendingMessages.get(phone);
          pendingMessages.delete(phone);
          console.log(`[Hermes] 📱 Processing ${queued.length} queued message(s) for ${maskPhone(phone)}`);

          // Combine all queued messages into one
          const combinedText = queued.map(q => q.text).join(' ');
          const latestId = Math.max(...queued.map(q => q.msgNumId));
          threads.imsgLastSeen.set(phone, latestId);

          // Post queued lead messages to Slack thread
          for (const q of queued) {
            await client.chat.postMessage({ channel: CHANNEL_ID, thread_ts: threadTs, text: `Lead: "${q.rawText}"` });
          }

          // Add to transcript
          engine.stateManager.addToTranscript(threadData.sessionId, 'lead', combinedText);
          const qSession = engine.stateManager.sessions.get(threadData.sessionId);
          const qId = qSession ? `q${qSession.questionsAsked + 1}` : 'q1';
          engine.stateManager.recordAnswer(threadData.sessionId, qId, combinedText);

          // Process through engine
          threads.phoneGeneratingLock.set(phone, true);
          try {
            const qResult = await engine.processMessage(threadData.sessionId, combinedText);
            if (qResult && qResult.shouldSend && qResult.response) {
              const qValidated = validateOutput(qResult.response, { alertFn: alertSlack });
              const qMsgToSend = qValidated.valid ? qResult.response : qValidated.safeResponse;
              await sendMsg(phone, qMsgToSend);
              await client.chat.postMessage({ channel: CHANNEL_ID, thread_ts: threadTs, text: `Hermes: "${qMsgToSend}"` });
            }
            if (qResult && (qResult.action === 'TRANSFER' || qResult.action === 'TRANSFER_PARACHUTE' ||
                qResult.action === 'TRANSFER_FRUSTRATION' || qResult.session?.status === 'completed' ||
                qResult.session?.status === 'parachute')) {
              const parentMessage = await client.conversations.replies({ channel: CHANNEL_ID, ts: threadTs, limit: 1 });
              if (parentMessage.messages && parentMessage.messages.length > 0) {
                const leadData = parseLeadData(parentMessage.messages[0].text);
                await sendHandoffPayload(qResult.session, leadData, threadTs);
              }
            }
          } catch (qErr) {
            console.error(`[Hermes] Queued message processing error:`, qErr.message);
          }
          threads.phoneGeneratingLock.delete(phone);
        }
      }
    } catch (error) {
      threads.phoneGeneratingLock.delete(phone);
      console.error(`[Hermes] Poll error for ${maskPhone(phone)}:`, error.message);
    }
  }
}

// ============================================================
// SLACK LEAD POLLER
// ============================================================
async function pollForLeads() {
  try {
    const params = { channel: CHANNEL_ID, limit: 10 };
    
    if (threads.isFirstRun) {
      const result = await client.conversations.history(params);
      if (result.messages && result.messages.length > 0) {
        threads.lastTimestamp = result.messages[0].ts;
        threads.save();
      }
      threads.isFirstRun = false;
      return;
    }
    
    if (threads.lastTimestamp) params.oldest = threads.lastTimestamp;
    
    const result = await client.conversations.history(params);

    if (result.messages && result.messages.length > 0) {
      const messages = result.messages.reverse();
      
      for (const message of messages) {
        if (threads.processedMessages.has(message.ts)) continue;
        if (threads.lastTimestamp && message.ts === threads.lastTimestamp) continue;
        
        threads.processedMessages.add(message.ts);
        threads.lastTimestamp = message.ts;
        threads.save();
        
        const text = message.text || '';
        if (isNewLeadMessage(text)) {
          await startLeadConversation(text, message);
        }
        
        threads.trimProcessed();
      }
    }
  } catch (error) {
    console.error('[Hermes] Polling error:', error.message);
  }
}

// ============================================================
// SLACK THREAD REPLY HANDLER
// ============================================================
app.message(async ({ message, client: slackClient }) => {
  if (message.channel !== CHANNEL_ID) return;
  if (!message.thread_ts) return;
  if (message.bot_id) return;
  
  const threadTs = message.thread_ts;
  const threadData = threads.activeThreads.get(threadTs);
  if (!threadData) return;
  
  const sessionId = threadData.sessionId;
  
  // Post-transfer revive
  if (threadData.transferred === true) {
    const text = message.text || '';
    const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    if (threadData.transferredAt && (Date.now() - threadData.transferredAt > SEVENTY_TWO_HOURS)) return;
    
    threads.reviveThread(threadTs);
    engine.stateManager.reviveSession(sessionId);
    
    let leadName = 'Lead';
    try {
      const parentMsg = await slackClient.conversations.replies({ channel: CHANNEL_ID, ts: threadTs, limit: 1 });
      if (parentMsg.messages && parentMsg.messages.length > 0) {
        leadName = parseLeadData(parentMsg.messages[0].text).name;
      }
    } catch (e) { /* default */ }
    
    // Post revival update IN the thread, not as a new top-level message
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID,
      thread_ts: threadTs,
      text: `🔄 Lead texted back — continuing conversation`
    });
  }
  
  // If iMessage active, skip Slack processing
  if (threadData.phone && threads.phoneToThread.has(threadData.phone)) return;
  
  const text = message.text || '';
  console.log(`[Hermes] Inbound Slack reply for ${sessionId.substring(0, 8)}...`);
  
  // Rebuild transcript from Slack thread
  try {
    const threadHistory = await slackClient.conversations.replies({ channel: CHANNEL_ID, ts: threadTs, limit: 100 });
    if (threadHistory.messages && threadHistory.messages.length > 0) {
      const fullTranscript = threadHistory.messages
        .filter(m => m.ts !== threadTs)
        .map(m => ({
          sender: m.bot_id ? 'hermes' : 'lead',
          text: m.bot_id ? (m.text || '') : sanitizeLeadInput(m.text || '').sanitized,
          timestamp: m.ts,
        }));
      engine.stateManager.rebuildTranscript(sessionId, fullTranscript);
    }
  } catch (error) {
    console.error(`[Hermes] Failed to fetch thread history:`, error.message);
  }
  
  reengagement.resetActivity(sessionId, text);

  const { sanitized: sanitizedSlackText } = sanitizeLeadInput(text);
  const slackSession = engine.stateManager.sessions.get(sessionId);
  const slackQId = slackSession ? `q${slackSession.questionsAsked + 1}` : 'q1';
  engine.stateManager.recordAnswer(sessionId, slackQId, sanitizedSlackText);

  const result = await engine.processMessage(sessionId, sanitizedSlackText);
  if (!result || !result.session) return;
  
  if (result.shouldSend && result.response) {
    const slackValidated = validateOutput(result.response, { alertFn: alertSlack });
    const slackMsgToSend = slackValidated.valid ? result.response : slackValidated.safeResponse;
    if (threadData.phone) await sendMsg(threadData.phone, slackMsgToSend);
    await slackClient.chat.postMessage({
      channel: CHANNEL_ID, thread_ts: threadTs,
      text: threadData.phone ? `📱 _[via iMessage]_\n${slackMsgToSend}` : slackMsgToSend
    });
  }
  
  if (result.action === 'TRANSFER' || result.action === 'TRANSFER_PARACHUTE' ||
      result.action === 'TRANSFER_FRUSTRATION' || result.session.status === 'completed' ||
      result.session.status === 'parachute') {
    const parentMessage = await slackClient.conversations.replies({ channel: CHANNEL_ID, ts: threadTs, limit: 1 });
    if (parentMessage.messages && parentMessage.messages.length > 0) {
      const leadData = parseLeadData(parentMessage.messages[0].text);
      await sendHandoffPayload(result.session, leadData, threadTs);
    }
  }
});

// ============================================================
// LIFECYCLE
// ============================================================
process.on('SIGINT', () => {
  console.log('\n[Hermes] SIGINT — saving state...');
  threads.save();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Hermes] SIGTERM — saving state...');
  threads.save();
  process.exit(0);
});

(async () => {
  await app.start();
  console.log('[Hermes] Event listener started');
  
  setInterval(() => threads.expireOldThreads(), POLL_INTERVAL);
  setInterval(pollForLeads, POLL_INTERVAL);
  setInterval(pollIMessageReplies, IMSG_POLL_INTERVAL);
  setInterval(cleanupCooldowns, 5 * 60 * 1000); // Clean up rate limit maps every 5 min
  pollForLeads();
})();

#!/usr/bin/env node

/**
 * Final validation test - Real-world scenario
 */

const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = 'C0AF9862EAJ';

async function runFinalTest() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║     FINAL VALIDATION - Real Production Scenario       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const timestamp = Date.now();
  const testLead = {
    name: 'Test Customer Final',
    email: `test.final.${timestamp}@example.com`,
    phone: '(619)555-9999',
    service: 'AC Repair',
    zip: '92103', // Valid SD ZIP
    source: 'Final Test',
    message: 'Need AC repair ASAP'
  };
  
  const message = `🔥 New Lead Alert!

Name: ${testLead.name}
📧 Email: ${testLead.email}
📱 Phone: ${testLead.phone}
🔧 Service: ${testLead.service}
📍 ZIP: ${testLead.zip}
🌐 Source: ${testLead.source}
💬 Message: ${testLead.message}`;

  console.log('Sending test lead...');
  const result = await client.chat.postMessage({
    channel: CHANNEL_ID,
    text: message
  });
  
  console.log(`✅ Lead sent (ts: ${result.ts})`);
  console.log('\nWaiting 8 seconds for processing...\n');
  
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Check thread
  const thread = await client.conversations.replies({
    channel: CHANNEL_ID,
    ts: result.ts
  });
  
  const botMessages = thread.messages.filter(m => m.bot_id && !m.text.includes('New Lead'));
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('RESULTS:');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total messages in thread: ${thread.messages.length}`);
  console.log(`Bot responses: ${botMessages.length}`);
  console.log('');
  
  if (botMessages.length === 1) {
    console.log('✅ SUCCESS: Exactly ONE opener message sent');
    console.log('✅ NO DUPLICATES DETECTED');
    console.log('\nFirst 150 chars of response:');
    console.log(botMessages[0].text.substring(0, 150) + '...');
    console.log('\n🎉 DUPLICATE FIX VALIDATED - SYSTEM WORKING CORRECTLY\n');
    return true;
  } else if (botMessages.length > 1) {
    console.log(`❌ FAILURE: ${botMessages.length} messages sent (expected 1)`);
    console.log('\nAll bot messages:');
    botMessages.forEach((m, i) => {
      console.log(`\n--- Message ${i + 1} ---`);
      console.log(m.text.substring(0, 200));
    });
    console.log('\n⚠️  DUPLICATE ISSUE STILL EXISTS\n');
    return false;
  } else {
    console.log('❌ No bot response found - check if system is running');
    return false;
  }
}

runFinalTest()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

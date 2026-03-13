#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Duplicate Message Fix
 * Tests all scenarios to ensure no duplicate responses
 */

const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = 'C0AF9862EAJ'; // #new-leads
const STATE_FILE = path.join(__dirname, '.hermes-interactive-state.json');

// Test utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique test lead
function generateTestLead(name) {
  const timestamp = Date.now();
  return {
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@test-${timestamp}.com`,
    phone: `(555)${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
    service: 'Cooling',
    zip: '92101',
    source: 'Test Suite',
    message: `Test lead created at ${new Date().toISOString()}`
  };
}

// Format lead message like Zapier does
function formatLeadMessage(lead) {
  return `🔥 New Lead Alert!

Name: ${lead.name}
📧 Email: ${lead.email}
📱 Phone: ${lead.phone}
🔧 Service: ${lead.service}
📍 ZIP: ${lead.zip}
🌐 Source: ${lead.source}
💬 Message: ${lead.message}`;
}

// Send test lead
async function sendTestLead(lead) {
  const message = formatLeadMessage(lead);
  const result = await client.chat.postMessage({
    channel: CHANNEL_ID,
    text: message
  });
  console.log(`✅ Sent test lead: ${lead.name} (ts: ${result.ts})`);
  return result;
}

// Check thread for responses
async function checkThreadResponses(threadTs, expectedCount = 1) {
  await sleep(5000); // Wait for processing
  
  const result = await client.conversations.replies({
    channel: CHANNEL_ID,
    ts: threadTs
  });
  
  const botMessages = result.messages.filter(m => m.bot_id && !m.text.includes('New Lead'));
  const count = botMessages.length;
  
  console.log(`Thread ${threadTs}: Found ${count} bot messages (expected ${expectedCount})`);
  
  if (count !== expectedCount) {
    console.error(`❌ FAIL: Expected ${expectedCount} messages, got ${count}`);
    botMessages.forEach((m, i) => {
      console.error(`  Message ${i + 1}: ${m.text.substring(0, 80)}...`);
    });
    return false;
  }
  
  console.log(`✅ PASS: Correct message count`);
  return true;
}

// Read state file
function readState() {
  if (!fs.existsSync(STATE_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

// Test 1: Single lead, no replies
async function test1_SingleLeadNoReplies() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('TEST 1: Single lead, no replies');
  console.log('Expected: Single opener message, no duplicates');
  console.log('═══════════════════════════════════════════════════════');
  
  const lead = generateTestLead('Alice Smith');
  const result = await sendTestLead(lead);
  
  const passed = await checkThreadResponses(result.ts, 1);
  return { test: 'Test 1: Single Lead', passed };
}

// Test 2: Single lead with one reply
async function test2_SingleLeadWithReply() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('TEST 2: Single lead with one reply');
  console.log('Expected: Opener + single Q2, no duplicates');
  console.log('═══════════════════════════════════════════════════════');
  
  const lead = generateTestLead('Bob Johnson');
  const result = await sendTestLead(lead);
  
  await sleep(6000); // Wait for opener
  
  // Send customer reply
  await client.chat.postMessage({
    channel: CHANNEL_ID,
    thread_ts: result.ts,
    text: "I'd like to schedule a repair"
  });
  
  console.log('Sent customer reply, waiting for Q2...');
  
  const passed = await checkThreadResponses(result.ts, 2); // Opener + Q2
  return { test: 'Test 2: Reply Once', passed };
}

// Test 3: Multiple leads simultaneously
async function test3_MultipleLeadsSimultaneously() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('TEST 3: Multiple leads simultaneously');
  console.log('Expected: Each gets one opener, no cross-contamination');
  console.log('═══════════════════════════════════════════════════════');
  
  const leads = [
    generateTestLead('Charlie Davis'),
    generateTestLead('Diana Martinez'),
    generateTestLead('Eric Wilson')
  ];
  
  // Send all three rapidly
  const results = await Promise.all(leads.map(lead => sendTestLead(lead)));
  
  console.log('Waiting for all to process...');
  await sleep(8000);
  
  // Check each thread
  const checks = await Promise.all(
    results.map(r => checkThreadResponses(r.ts, 1))
  );
  
  const passed = checks.every(c => c === true);
  return { test: 'Test 3: Multiple Simultaneous', passed };
}

// Test 4: State persistence
async function test4_StatePersistence() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('TEST 4: State persistence check');
  console.log('Expected: State file correctly tracks processed messages');
  console.log('═══════════════════════════════════════════════════════');
  
  const stateBefore = readState();
  console.log(`State before: ${stateBefore.processedMessages.length} processed messages`);
  
  const lead = generateTestLead('Frank Thompson');
  const result = await sendTestLead(lead);
  
  await sleep(6000);
  
  const stateAfter = readState();
  console.log(`State after: ${stateAfter.processedMessages.length} processed messages`);
  
  const messageAdded = stateAfter.processedMessages.includes(result.ts);
  const threadAdded = stateAfter.activeThreads.some(([ts]) => ts === result.ts);
  
  console.log(`Message in processedMessages: ${messageAdded}`);
  console.log(`Thread in activeThreads: ${threadAdded}`);
  
  const passed = messageAdded && threadAdded;
  
  if (passed) {
    console.log('✅ PASS: State correctly persisted');
  } else {
    console.error('❌ FAIL: State not properly persisted');
  }
  
  return { test: 'Test 4: State Persistence', passed };
}

// Test 5: Deduplication check
async function test5_DeduplicationCheck() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('TEST 5: Deduplication validation');
  console.log('Expected: Duplicate detection prevents re-processing');
  console.log('═══════════════════════════════════════════════════════');
  
  const state = readState();
  const hasProcessedMessages = state.processedMessages.length > 0;
  const hasActiveThreads = state.activeThreads.length > 0;
  
  console.log(`Processed messages count: ${state.processedMessages.length}`);
  console.log(`Active threads count: ${state.activeThreads.length}`);
  
  // Check that no message appears more than once
  const messageSet = new Set(state.processedMessages);
  const noDuplicates = messageSet.size === state.processedMessages.length;
  
  console.log(`Unique messages: ${messageSet.size}`);
  console.log(`Total messages: ${state.processedMessages.length}`);
  console.log(`No duplicates in state: ${noDuplicates}`);
  
  const passed = hasProcessedMessages && hasActiveThreads && noDuplicates;
  
  if (passed) {
    console.log('✅ PASS: Deduplication working correctly');
  } else {
    console.error('❌ FAIL: Deduplication issues detected');
  }
  
  return { test: 'Test 5: Deduplication', passed };
}

// Run all tests
async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║                                                       ║');
  console.log('║   HERMES DUPLICATE FIX - COMPREHENSIVE TEST SUITE     ║');
  console.log('║                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const results = [];
  
  try {
    results.push(await test1_SingleLeadNoReplies());
    results.push(await test2_SingleLeadWithReply());
    results.push(await test3_MultipleLeadsSimultaneously());
    results.push(await test4_StatePersistence());
    results.push(await test5_DeduplicationCheck());
    
    // Summary
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║                   TEST SUMMARY                        ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    
    results.forEach(r => {
      const status = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${r.test}`);
    });
    
    console.log('');
    const allPassed = results.every(r => r.passed);
    const passedCount = results.filter(r => r.passed).length;
    
    console.log(`Total: ${passedCount}/${results.length} tests passed`);
    
    if (allPassed) {
      console.log('\n🎉 ALL TESTS PASSED! System is working correctly.');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED - Review failures above');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ TEST SUITE ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();

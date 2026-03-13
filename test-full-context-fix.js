#!/usr/bin/env node

/**
 * Test: Full Context Fix
 * Verifies that Hermes reads full conversation history before responding
 * 
 * Scenario: Customer asks for representative mid-conversation
 * Expected: Hermes should transfer immediately, not ask more questions
 */

const ConversationEngine = require('./src/conversation-engine');

async function testFullContextFix() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   TEST: Full Conversation Context Fix                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const engine = new ConversationEngine();

  // Simulate the problematic scenario
  console.log('📋 Scenario: Customer asks for representative mid-conversation\n');

  // 1. Create lead
  const leadData = {
    name: 'John Smith',
    phone: '+15551234567',
    email: 'john@example.com',
    serviceType: 'Heating',
    message: 'Pilot light keeps going out',
    leadId: 'test_full_context_001'
  };

  console.log('1️⃣  Lead submits form: "Pilot light keeps going out"');
  const start = await engine.startConversation(leadData);
  console.log(`   Hermes: "${start.message}"\n`);

  // 2. Customer responds
  console.log('2️⃣  Customer responds: "yesterday"');
  const response1 = await engine.processMessage(start.session.sessionId, 'yesterday');
  console.log(`   Hermes: "${response1.response}"\n`);

  // 3. Customer triggers parachute - THIS IS THE CRITICAL TEST
  console.log('3️⃣  Customer says: "speak to a representative" ← PARACHUTE TRIGGER');
  
  // Simulate full conversation history being present
  const fullTranscript = [
    { sender: 'hermes', text: start.message, timestamp: new Date().toISOString() },
    { sender: 'lead', text: 'yesterday', timestamp: new Date().toISOString() },
    { sender: 'hermes', text: response1.response, timestamp: new Date().toISOString() },
  ];
  
  // Rebuild transcript with full history (simulating what Slack fetch would do)
  engine.stateManager.rebuildTranscript(start.session.sessionId, fullTranscript);
  
  const response2 = await engine.processMessage(start.session.sessionId, 'speak to a representative');
  
  console.log(`   Action: ${response2.action}`);
  console.log(`   Hermes: "${response2.response}"\n`);

  // VERIFICATION
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('🔍 VERIFICATION:\n');

  const passed = [];
  const failed = [];

  // Check 1: Should be parachute transfer
  if (response2.action === 'TRANSFER_PARACHUTE') {
    console.log('✅ Action is TRANSFER_PARACHUTE (correct)');
    passed.push('Parachute triggered');
  } else {
    console.log(`❌ Action is ${response2.action} (should be TRANSFER_PARACHUTE)`);
    failed.push('Parachute not triggered');
  }

  // Check 2: Should NOT ask another question
  const isQuestion = response2.response && response2.response.includes('?');
  if (!isQuestion) {
    console.log('✅ Response is NOT a question (correct)');
    passed.push('No follow-up question');
  } else {
    console.log('❌ Response is a question (should be transfer message)');
    failed.push('Asked another question instead of transferring');
  }

  // Check 3: Session should be in parachute status
  const session = engine.getSession(start.session.sessionId);
  if (session.status === 'parachute') {
    console.log('✅ Session status is "parachute" (correct)');
    passed.push('Status updated correctly');
  } else {
    console.log(`❌ Session status is "${session.status}" (should be "parachute")`);
    failed.push('Status not updated');
  }

  // Check 4: Transcript should have full history
  if (session.transcript.length >= 3) {
    console.log(`✅ Transcript has ${session.transcript.length} messages (full history preserved)`);
    passed.push('Full transcript preserved');
  } else {
    console.log(`❌ Transcript has only ${session.transcript.length} messages (should have at least 3)`);
    failed.push('Transcript incomplete');
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  if (failed.length === 0) {
    console.log('✅ ALL CHECKS PASSED - Full context fix is working!\n');
    console.log('Summary:');
    passed.forEach(p => console.log(`  ✅ ${p}`));
    return true;
  } else {
    console.log('❌ SOME CHECKS FAILED - Full context fix needs work\n');
    console.log('Passed:');
    passed.forEach(p => console.log(`  ✅ ${p}`));
    console.log('\nFailed:');
    failed.forEach(f => console.log(`  ❌ ${f}`));
    return false;
  }
}

// Run test
testFullContextFix()
  .then(success => {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(success ? '✅ TEST PASSED' : '❌ TEST FAILED');
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

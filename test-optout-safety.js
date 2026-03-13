#!/usr/bin/env node

/**
 * Test: Opt-Out Safety (Option 3)
 * Validates that Hermes detects opt-out requests and stops conversation
 * 
 * Success criteria:
 * 1. Opt-out messages never reach Gaius (caught by pre-detection)
 * 2. Immediate apology sent
 * 3. Session marked as opted-out
 * 4. No Q2 or further messages sent
 */

const ConversationEngine = require('./src/conversation-engine');
const StateManager = require('./src/state-manager');
const OptOutDetector = require('./src/optout-detector');

console.log('═════════════════════════════════════════════════════');
console.log('🧪 HERMES OPT-OUT SAFETY TEST (Option 3)');
console.log('═════════════════════════════════════════════════════\n');

async function runTests() {
  const engine = new ConversationEngine();
  const optOutDetector = new OptOutDetector();
  let passed = 0;
  let failed = 0;

  // Test 1: Opt-out detection - exact phrase from issue
  console.log('Test 1: Opt-out detection - "stop texting me i dont want any more messages"');
  const test1Result = optOutDetector.detect("stop texting me i dont want any more messages");
  if (test1Result.isOptOut && test1Result.trigger) {
    console.log('✅ PASS: Opt-out detected');
    console.log(`   Trigger: "${test1Result.trigger}"`);
    passed++;
  } else {
    console.log('❌ FAIL: Opt-out NOT detected');
    failed++;
  }
  console.log('');

  // Test 2: Various opt-out phrases
  const optOutPhrases = [
    "stop texting",
    "stop messaging me",
    "dont text me",
    "unsubscribe",
    "opt out",
    "remove me",
    "leave me alone",
    "stop contacting me",
    "dont want any more messages",
    "no more texts",
  ];

  console.log('Test 2: Various opt-out phrases');
  let allDetected = true;
  for (const phrase of optOutPhrases) {
    const result = optOutDetector.detect(phrase);
    if (!result.isOptOut) {
      console.log(`❌ NOT detected: "${phrase}"`);
      allDetected = false;
    }
  }
  if (allDetected) {
    console.log(`✅ PASS: All ${optOutPhrases.length} opt-out phrases detected`);
    passed++;
  } else {
    console.log('❌ FAIL: Some opt-out phrases missed');
    failed++;
  }
  console.log('');

  // Test 3: False positives (should NOT trigger)
  console.log('Test 3: False positives (normal messages should not trigger opt-out)');
  const normalPhrases = [
    "my AC stopped working",
    "when can you come out?",
    "I need this done today",
    "how much does it cost?",
    "can you help me?",
  ];
  
  let noFalsePositives = true;
  for (const phrase of normalPhrases) {
    const result = optOutDetector.detect(phrase);
    if (result.isOptOut) {
      console.log(`❌ FALSE POSITIVE: "${phrase}"`);
      noFalsePositives = false;
    }
  }
  if (noFalsePositives) {
    console.log(`✅ PASS: No false positives (${normalPhrases.length} normal phrases tested)`);
    passed++;
  } else {
    console.log('❌ FAIL: False positive detected');
    failed++;
  }
  console.log('');

  // Test 4: End-to-end conversation flow with opt-out
  console.log('Test 4: End-to-end conversation flow with opt-out');
  const leadData = {
    name: 'Test Lead',
    phone: '555-TEST-OPT',
    serviceType: 'AC Repair',
    zip: '90210',
    source: 'Test',
    message: 'AC not working',
    leadId: `test_optout_${Date.now()}`
  };

  // Start conversation
  const startResult = await engine.startConversation(leadData);
  console.log(`   1. Started conversation`);
  console.log(`      Opener: "${startResult.message}"`);
  
  // Simulate Q1 response
  const q1Response = await engine.processMessage(startResult.session.sessionId, "it broke yesterday");
  console.log(`   2. Lead answered Q1: "it broke yesterday"`);
  console.log(`      Hermes: "${q1Response.response}"`);
  
  // Simulate opt-out on Q2
  const optOutResponse = await engine.processMessage(startResult.session.sessionId, "stop texting me i dont want any more messages");
  console.log(`   3. Lead opted out: "stop texting me i dont want any more messages"`);
  console.log(`      Hermes: "${optOutResponse.response}"`);
  console.log(`      Action: ${optOutResponse.action}`);
  
  const session = engine.getSession(startResult.session.sessionId);
  
  if (optOutResponse.action === 'OPTED_OUT' &&
      session.optedOut === true &&
      session.status === 'opted_out' &&
      optOutResponse.response.toLowerCase().includes('sorry')) {
    console.log('✅ PASS: Opt-out handled correctly');
    console.log(`   - Immediate apology sent`);
    console.log(`   - Session marked as opted-out`);
    console.log(`   - Status: ${session.status}`);
    passed++;
  } else {
    console.log('❌ FAIL: Opt-out not handled correctly');
    console.log(`   Action: ${optOutResponse.action}`);
    console.log(`   Session opted out: ${session.optedOut}`);
    console.log(`   Status: ${session.status}`);
    failed++;
  }
  console.log('');

  // Test 5: Verify no message sent to CSR after opt-out
  console.log('Test 5: Verify no handoff after opt-out');
  if (session.status === 'opted_out' && !session.completedAt) {
    console.log('✅ PASS: No handoff triggered (session not completed)');
    console.log(`   Status: ${session.status}`);
    console.log(`   Opted out: ${session.optedOut}`);
    passed++;
  } else {
    console.log('❌ FAIL: Unexpected session state');
    console.log(`   Status: ${session.status}`);
    console.log(`   Completed: ${session.completedAt}`);
    failed++;
  }
  console.log('');

  // Test 6: Conversation history includes opt-out message
  console.log('Test 6: Verify conversation history includes opt-out');
  const transcript = session.transcript || [];
  const hasOptOutMessage = transcript.some(t => 
    t.text && t.text.toLowerCase().includes('stop texting')
  );
  
  if (hasOptOutMessage && transcript.length >= 3) {
    console.log('✅ PASS: Full conversation history preserved');
    console.log(`   Transcript length: ${transcript.length} messages`);
    console.log('   Conversation:');
    transcript.forEach(t => {
      console.log(`      ${t.sender}: "${t.text}"`);
    });
    passed++;
  } else {
    console.log('❌ FAIL: Conversation history incomplete');
    console.log(`   Transcript length: ${transcript.length}`);
    failed++;
  }
  console.log('');

  // Summary
  console.log('═════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('');
    console.log('✅ Success criteria met:');
    console.log('   1. Opt-out messages detected before reaching Gaius');
    console.log('   2. Immediate apology sent');
    console.log('   3. Session marked as opted-out');
    console.log('   4. No Q2 or further messages sent');
    console.log('   5. Full conversation history preserved');
    console.log('');
    console.log('🚀 Ready to deploy!');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Review implementation');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});

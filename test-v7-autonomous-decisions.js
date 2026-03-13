/**
 * Test V7: Autonomous Decisions
 * Verify that Gaius makes ALL decisions without pre-decision logic
 */

const ConversationEngine = require('./src/conversation-engine');

// Mock Gaius responses for testing
const mockGaiusResponses = {
  'parachute_call_request': 'sounds good. let me get someone to give you a call right now.',
  'buying_intent_quote': 'sounds good. someone from the team will call you soon to get this scheduled.',
  'normal_timeline_answer': 'sounds good. how old is your system? no worries if you dont know.'
};

class MockGaiusRouter {
  constructor() {
    console.log('[MockGaiusRouter] Using mock responses for testing');
  }

  async askGaius(session, message, context) {
    const lowerMessage = message.toLowerCase();
    
    // Parachute: "can you guys give me a call?"
    if (lowerMessage.includes('can you') && lowerMessage.includes('call')) {
      console.log('[MockGaius] DETECTED: Parachute trigger (call request)');
      return mockGaiusResponses.parachute_call_request;
    }
    
    // Buying intent: "quote", "schedule", "price"
    if (lowerMessage.includes('quote') || lowerMessage.includes('schedule') || lowerMessage.includes('price')) {
      console.log('[MockGaius] DETECTED: Buying intent');
      return mockGaiusResponses.buying_intent_quote;
    }
    
    // Normal timeline answer
    if (lowerMessage.includes('afternoon') || lowerMessage.includes('this week') || lowerMessage.includes('tomorrow')) {
      console.log('[MockGaius] DETECTED: Normal timeline answer - continue questions');
      return mockGaiusResponses.normal_timeline_answer;
    }
    
    // Opener
    if (context.isFirstMessage) {
      return 'hey sarah, thanks for reaching out. when did this start?';
    }
    
    // Default: continue
    return 'sounds good. someone from the team will call you soon.';
  }
}

// Inject mock
const originalGaiusRouter = require('./src/gaius-router');
require.cache[require.resolve('./src/gaius-router')].exports = MockGaiusRouter;

async function runTests() {
  console.log('=== V7 AUTONOMOUS DECISIONS TEST SUITE ===\n');
  
  const engine = new ConversationEngine();
  let passCount = 0;
  let failCount = 0;

  // Test 1: Parachute trigger - "can you guys give me a call?"
  console.log('TEST 1: Parachute trigger - "can you guys give me a call?"');
  try {
    const startResult = await engine.startConversation({
      name: 'Sarah Johnson',
      phone: '555-1234',
      service: 'AC Repair',
      message: 'AC not cooling',
      timestamp: Date.now()
    });
    
    const response = await engine.processMessage(
      startResult.session.sessionId,
      'can you guys give me a call?'
    );
    
    const isTransfer = response.action === 'TRANSFER';
    const correctResponse = response.response.toLowerCase().includes('call');
    
    if (isTransfer && correctResponse) {
      console.log('✅ PASS - Immediate transfer detected\n');
      passCount++;
    } else {
      console.log(`❌ FAIL - Should transfer immediately`);
      console.log(`   Action: ${response.action}`);
      console.log(`   Response: ${response.response}\n`);
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL - Error: ${error.message}\n`);
    failCount++;
  }

  // Test 2: Buying intent - "I want a quote"
  console.log('TEST 2: Buying intent - "I want a quote"');
  try {
    const startResult = await engine.startConversation({
      name: 'David Miller',
      phone: '555-5678',
      service: 'Furnace Repair',
      message: 'Furnace not heating',
      timestamp: Date.now()
    });
    
    const response = await engine.processMessage(
      startResult.session.sessionId,
      'I want a quote'
    );
    
    const isTransfer = response.action === 'TRANSFER';
    const correctResponse = response.response.toLowerCase().includes('call') || 
                           response.response.toLowerCase().includes('scheduled');
    
    if (isTransfer && correctResponse) {
      console.log('✅ PASS - Immediate transfer for buying intent\n');
      passCount++;
    } else {
      console.log(`❌ FAIL - Should transfer immediately`);
      console.log(`   Action: ${response.action}`);
      console.log(`   Response: ${response.response}\n`);
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL - Error: ${error.message}\n`);
    failCount++;
  }

  // Test 3: Normal answer - "yesterday afternoon"
  console.log('TEST 3: Normal timeline answer - "yesterday afternoon"');
  try {
    const startResult = await engine.startConversation({
      name: 'Maria Garcia',
      phone: '555-9012',
      service: 'AC Repair',
      message: 'AC making noise',
      timestamp: Date.now()
    });
    
    const response = await engine.processMessage(
      startResult.session.sessionId,
      'yesterday afternoon'
    );
    
    const isContinue = response.action === 'CONTINUE';
    const isQuestion = response.response.includes('?');
    
    if (isContinue && isQuestion) {
      console.log('✅ PASS - Continues to next question\n');
      passCount++;
    } else {
      console.log(`❌ FAIL - Should continue with next question`);
      console.log(`   Action: ${response.action}`);
      console.log(`   Response: ${response.response}\n`);
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL - Error: ${error.message}\n`);
    failCount++;
  }

  // Summary
  console.log('=== TEST SUMMARY ===');
  console.log(`✅ Passed: ${passCount}/3`);
  console.log(`❌ Failed: ${failCount}/3`);
  
  if (failCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED - V7 autonomous decisions working correctly!');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Review implementation');
  }
  
  process.exit(failCount > 0 ? 1 : 0);
}

runTests();

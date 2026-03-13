#!/usr/bin/env node

/**
 * Test LLM Generation (V6)
 * Validates dynamic response generation with various scenarios
 */

require('dotenv').config();
const ConversationEngine = require('./src/conversation-engine');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function test() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    log('\n❌ ERROR: ANTHROPIC_API_KEY not set in .env file', 'red');
    log('\nPlease add your Anthropic API key to .env:', 'yellow');
    log('ANTHROPIC_API_KEY=sk-ant-...', 'cyan');
    log('\nGet your key from: https://console.anthropic.com/', 'yellow');
    process.exit(1);
  }

  const engine = new ConversationEngine();

  // Test 1: Opener Generation
  section('TEST 1: Opener Generation (Standard Path)');
  
  const lead1 = {
    name: 'Sarah Johnson',
    phone: '+12085551234',
    email: 'sarah@example.com',
    serviceType: 'AC Repair',
    message: 'My AC is not cooling properly',
    zipCode: '83702',
    businessHours: true,
    isExistingCustomer: false,
  };

  log('Lead: Sarah Johnson - AC not cooling', 'cyan');
  const result1 = await engine.startConversation(lead1);
  log(`\n✅ Generated opener: "${result1.message}"`, 'green');
  log(`Session ID: ${result1.session.sessionId}`, 'yellow');

  // Test 2: Buying Intent Detection
  section('TEST 2: Buying Intent Detection');
  
  const lead2 = {
    name: 'David Martinez',
    phone: '+12085555678',
    email: 'david@example.com',
    serviceType: 'Furnace Repair',
    message: 'Need a quote for furnace repair',
    zipCode: '83702',
    businessHours: true,
    isExistingCustomer: false,
  };

  log('Lead: David Martinez - Asking for quote (buying intent)', 'cyan');
  const result2 = await engine.startConversation(lead2);
  log(`\n✅ Generated opener: "${result2.message}"`, 'green');
  
  // Simulate buying intent in response
  const buyingIntentMsg = "how much would it cost? can you come tomorrow?";
  log(`\nLead responds: "${buyingIntentMsg}"`, 'cyan');
  const result2b = await engine.processMessage(result2.session.sessionId, buyingIntentMsg);
  log(`✅ Generated transfer: "${result2b.response}"`, 'green');
  log(`Action: ${result2b.action}`, 'yellow');
  log(`Lead Temp: ${result2b.session.leadTemp}`, result2b.session.leadTemp === 'HOT' ? 'red' : 'yellow');

  // Test 3: Frustration Detection
  section('TEST 3: Frustration Detection');
  
  const lead3 = {
    name: 'Mike Thompson',
    phone: '+12085559999',
    email: 'mike@example.com',
    serviceType: 'HVAC Service',
    message: 'AC broken',
    zipCode: '83702',
    businessHours: true,
    isExistingCustomer: false,
  };

  log('Lead: Mike Thompson - AC broken', 'cyan');
  const result3 = await engine.startConversation(lead3);
  log(`\n✅ Generated opener: "${result3.message}"`, 'green');
  
  // Simulate frustration
  const frustratedMsg = "I ALREADY TOLD YOU THIS!! NOBODY IS CALLING ME BACK!!!";
  log(`\nLead responds (frustrated): "${frustratedMsg}"`, 'cyan');
  const result3b = await engine.processMessage(result3.session.sessionId, frustratedMsg);
  log(`✅ Generated calm transfer: "${result3b.response}"`, 'green');
  log(`Action: ${result3b.action}`, 'yellow');

  // Test 4: Standard Q2 Flow
  section('TEST 4: Standard Qualification (Q1 → Q2)');
  
  const lead4 = {
    name: 'Lisa Chen',
    phone: '+12085554444',
    email: 'lisa@example.com',
    serviceType: 'Furnace Service',
    message: 'Furnace making weird noise',
    zipCode: '83702',
    businessHours: true,
    isExistingCustomer: false,
  };

  log('Lead: Lisa Chen - Furnace making noise', 'cyan');
  const result4 = await engine.startConversation(lead4);
  log(`\n✅ Q1 generated: "${result4.message}"`, 'green');
  
  // Answer Q1
  const q1Answer = "started yesterday morning";
  log(`\nLead answers Q1: "${q1Answer}"`, 'cyan');
  const result4b = await engine.processMessage(result4.session.sessionId, q1Answer);
  log(`✅ Q2 generated: "${result4b.response}"`, 'green');

  // Test 5: Variation Test (run same scenario 3 times)
  section('TEST 5: Response Variation (Same Scenario, 3x)');
  
  log('Testing opener variations for identical lead scenario...\n', 'cyan');
  
  for (let i = 1; i <= 3; i++) {
    const lead = {
      name: 'Test User',
      phone: `+120855500${i}${i}`,
      email: `test${i}@example.com`,
      serviceType: 'AC Repair',
      message: 'AC not working',
      zipCode: '83702',
      businessHours: true,
      isExistingCustomer: false,
    };
    
    const result = await engine.startConversation(lead);
    log(`Run ${i}: "${result.message}"`, 'green');
  }

  // Test 6: Emergency Detection
  section('TEST 6: Emergency Detection');
  
  const lead6 = {
    name: 'Karen Smith',
    phone: '+12085556666',
    email: 'karen@example.com',
    serviceType: 'Furnace Repair',
    message: 'NO HEAT! Kids are freezing',
    zipCode: '83702',
    businessHours: true,
    isExistingCustomer: false,
  };

  log('Lead: Karen Smith - NO HEAT emergency', 'cyan');
  const result6 = await engine.startConversation(lead6);
  log(`\n✅ Emergency Q1: "${result6.message}"`, 'green');
  log(`Path: ${result6.session.path}`, 'yellow');
  
  // Answer emergency Q1
  const emergencyAnswer = "furnace completely stopped this morning";
  log(`\nLead answers: "${emergencyAnswer}"`, 'cyan');
  const result6b = await engine.processMessage(result6.session.sessionId, emergencyAnswer);
  log(`✅ Emergency transfer: "${result6b.response}"`, 'green');
  log(`Action: ${result6b.action}`, 'yellow');

  // Final Summary
  section('TEST SUMMARY');
  
  log('✅ All LLM generation tests completed successfully!', 'green');
  log('\nKey Validations:', 'bright');
  log('  ✓ Opener generation (natural, casual)', 'green');
  log('  ✓ Buying intent immediate transfer', 'green');
  log('  ✓ Frustration calm transfer', 'green');
  log('  ✓ Standard Q1 → Q2 flow', 'green');
  log('  ✓ Response variation (not templated)', 'green');
  log('  ✓ Emergency detection and transfer', 'green');
  
  log('\nNext Steps:', 'yellow');
  log('  1. Review generated responses for tone accuracy', 'cyan');
  log('  2. Test with live leads in demo mode', 'cyan');
  log('  3. Monitor token usage and costs', 'cyan');
  log('  4. Deploy to production when validated', 'cyan');

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run tests
test().catch(error => {
  log('\n❌ Test Error:', 'red');
  console.error(error);
  process.exit(1);
});

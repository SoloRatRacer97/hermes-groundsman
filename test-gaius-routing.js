#!/usr/bin/env node

/**
 * Test Gaius Routing
 * Verify that Hermes can route to Gaius and get responses back
 */

const GaiusRouter = require('./src/gaius-router');
const fs = require('fs');
const path = require('path');

// Mock session for testing
const testSession = {
  sessionId: 'test_session_123',
  name: 'John Smith',
  phone: '555-1234',
  serviceType: 'Heating',
  path: 'STANDARD',
  questionsAsked: 0,
  currentQuestion: 'opener',
  businessHours: true,
  transcript: [],
};

const router = new GaiusRouter();

console.log('='.repeat(80));
console.log('HERMES → GAIUS ROUTING TEST');
console.log('='.repeat(80));
console.log('');

async function testOpener() {
  console.log('Test 1: Opener Message');
  console.log('-'.repeat(80));
  
  const context = {
    action: 'OPENER',
    isFirstMessage: true,
  };
  
  console.log('Sending request to Gaius...');
  console.log('Context:', JSON.stringify(context, null, 2));
  console.log('');
  
  try {
    const response = await router.askGaius(testSession, '', context);
    console.log(`✅ Got response from Gaius:`);
    console.log(`   "${response}"`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.log('');
  }
}

async function testBuyingIntent() {
  console.log('Test 2: Buying Intent Detection');
  console.log('-'.repeat(80));
  
  const context = {
    action: 'BUYING_INTENT_TRANSFER',
    buyingIntent: {
      confidence: 'high',
      confidenceScore: 0.9,
      triggers: ['quote', 'price'],
    },
  };
  
  const message = "how much would it cost to replace my furnace?";
  
  console.log('Sending request to Gaius...');
  console.log('Lead said:', message);
  console.log('Context:', JSON.stringify(context, null, 2));
  console.log('');
  
  try {
    const response = await router.askGaius(testSession, message, context);
    console.log(`✅ Got response from Gaius:`);
    console.log(`   "${response}"`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.log('');
  }
}

async function testFallback() {
  console.log('Test 3: Fallback (No Gaius Response)');
  console.log('-'.repeat(80));
  
  const context = {
    action: 'Q2',
  };
  
  const message = "yesterday";
  
  console.log('Sending request to Gaius (will timeout to test fallback)...');
  console.log('Lead said:', message);
  console.log('');
  
  // Temporarily reduce timeout for faster test
  const originalTimeout = router.responseTimeout;
  router.responseTimeout = 2000; // 2 seconds
  
  try {
    const response = await router.askGaius(testSession, message, context);
    console.log(`✅ Got fallback response:`);
    console.log(`   "${response}"`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.log('');
  }
  
  // Restore timeout
  router.responseTimeout = originalTimeout;
}

async function testManualResponse() {
  console.log('Test 4: Manual Response (Interactive)');
  console.log('-'.repeat(80));
  console.log('This test will create a request and wait for you to respond manually.');
  console.log('');
  console.log('Steps:');
  console.log('1. Request will be created');
  console.log('2. Open another terminal and run:');
  console.log('   node gaius-hermes-responder.js list');
  console.log('3. View the request:');
  console.log('   node gaius-hermes-responder.js show <requestId>');
  console.log('4. Respond:');
  console.log('   node gaius-hermes-responder.js respond <requestId> "hey john, thanks for reaching out. when did this start?"');
  console.log('');
  console.log('Press Enter to create request...');
  
  // Wait for Enter key
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  const context = {
    action: 'OPENER',
    isFirstMessage: true,
  };
  
  console.log('Creating request...');
  
  try {
    const response = await router.askGaius(testSession, '', context);
    console.log(`✅ Got response from Gaius:`);
    console.log(`   "${response}"`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.log('');
  }
}

async function runTests() {
  console.log('Starting Gaius routing tests...');
  console.log('');
  console.log('NOTE: These tests require Gaius to respond to the requests.');
  console.log('You can either:');
  console.log('  A) Let them timeout and test fallback responses');
  console.log('  B) Run "node gaius-hermes-responder.js watch" in another terminal');
  console.log('');
  console.log('Press Enter to continue...');
  
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('');
  
  // Run tests
  await testOpener();
  
  console.log('');
  console.log('='.repeat(80));
  console.log('Test complete!');
  console.log('');
  console.log('Check the .gaius-requests directory for pending requests');
  console.log('Run "node gaius-hermes-responder.js list" to see them');
  console.log('='.repeat(80));
  
  process.exit(0);
}

// Check if running in interactive mode
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

module.exports = { testOpener, testBuyingIntent, testFallback };

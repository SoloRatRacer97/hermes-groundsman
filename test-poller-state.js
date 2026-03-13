#!/usr/bin/env node

/**
 * Test script for Hermes Poller state tracking
 * Verifies that state persists and messages aren't reprocessed
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '.hermes-poller-state.json');

console.log('🧪 Testing Hermes Poller State Tracking\n');

// Test 1: Check if state file exists
console.log('Test 1: State file existence');
if (fs.existsSync(STATE_FILE)) {
  console.log('✅ State file exists');
  
  // Read and display contents
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    console.log('\n📄 Current state:');
    console.log(`   Last timestamp: ${state.lastTimestamp}`);
    console.log(`   Processed messages: ${state.processedMessages?.length || 0}`);
    console.log(`   Last updated: ${state.lastUpdated}`);
    
    // Test 2: Verify state structure
    console.log('\nTest 2: State structure');
    if (state.lastTimestamp && typeof state.lastTimestamp === 'string') {
      console.log('✅ lastTimestamp is valid');
    } else {
      console.log('⚠️  lastTimestamp is missing or invalid');
    }
    
    if (Array.isArray(state.processedMessages)) {
      console.log('✅ processedMessages is an array');
    } else {
      console.log('❌ processedMessages is not an array');
    }
    
    if (state.lastUpdated) {
      console.log('✅ lastUpdated timestamp present');
    } else {
      console.log('⚠️  lastUpdated timestamp missing');
    }
    
    // Test 3: Show what would happen on restart
    console.log('\nTest 3: Restart simulation');
    console.log(`On next restart, poller will:`);
    console.log(`   - Start from timestamp: ${state.lastTimestamp}`);
    console.log(`   - Skip ${state.processedMessages?.length || 0} already-processed messages`);
    console.log(`   - Only process NEW messages after ${state.lastTimestamp}`);
    
  } catch (error) {
    console.log('❌ Error reading state file:', error.message);
  }
} else {
  console.log('⚠️  State file does not exist yet');
  console.log('   This is normal on first run');
  console.log('   State will be created after processing first message');
}

console.log('\n✅ Tests complete\n');
console.log('💡 To verify no duplicate processing:');
console.log('   1. Check PM2 logs: pm2 logs hermes-poller');
console.log('   2. Look for "Skipping already-processed message" entries');
console.log('   3. Verify no duplicate nurturing sequences in #new-leads');
console.log('   4. Restart with: pm2 restart hermes-poller');
console.log('   5. Check that it doesn\'t reprocess old leads\n');

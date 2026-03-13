#!/usr/bin/env node

/**
 * Quick Test: Transcript Rebuild Functionality
 * Verifies that StateManager can rebuild transcript from Slack history
 */

const StateManager = require('./src/state-manager');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   TEST: Transcript Rebuild from Slack History             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const stateManager = new StateManager();

// 1. Create a session
const leadData = {
  name: 'Jane Doe',
  phone: '+15559876543',
  serviceType: 'Cooling',
  message: 'AC not working',
  leadId: 'test_rebuild_001'
};

const session = stateManager.createSession(leadData);
console.log(`✅ Created session: ${session.sessionId}\n`);

// 2. Add some messages using normal flow
stateManager.addToTranscript(session.sessionId, 'hermes', 'hey jane, when did this start?');
stateManager.addToTranscript(session.sessionId, 'lead', 'yesterday afternoon');

console.log(`📝 Added 2 messages via normal flow`);
console.log(`   Transcript length: ${session.transcript.length}\n`);

// 3. Simulate fetching full Slack thread history (like what hermes-interactive.js does)
const fullSlackHistory = [
  { sender: 'hermes', text: 'hey jane, when did this start?', timestamp: '2026-02-28T10:00:00Z' },
  { sender: 'lead', text: 'yesterday afternoon', timestamp: '2026-02-28T10:01:00Z' },
  { sender: 'hermes', text: 'when do you need this done?', timestamp: '2026-02-28T10:02:00Z' },
  { sender: 'lead', text: 'speak to a representative', timestamp: '2026-02-28T10:03:00Z' },
];

console.log(`🔄 Rebuilding transcript from Slack history (${fullSlackHistory.length} messages)...`);
stateManager.rebuildTranscript(session.sessionId, fullSlackHistory);

const updatedSession = stateManager.getSession(session.sessionId);
console.log(`   New transcript length: ${updatedSession.transcript.length}\n`);

// VERIFICATION
console.log('═══════════════════════════════════════════════════════════\n');
console.log('🔍 VERIFICATION:\n');

let allPassed = true;

// Check 1: Transcript length should match Slack history
if (updatedSession.transcript.length === fullSlackHistory.length) {
  console.log(`✅ Transcript length: ${updatedSession.transcript.length} (matches Slack history)`);
} else {
  console.log(`❌ Transcript length: ${updatedSession.transcript.length} (expected ${fullSlackHistory.length})`);
  allPassed = false;
}

// Check 2: Should include parachute trigger message
const hasParachuteTrigger = updatedSession.transcript.some(
  msg => msg.text && msg.text.toLowerCase().includes('representative')
);

if (hasParachuteTrigger) {
  console.log(`✅ Transcript includes parachute trigger "representative"`);
} else {
  console.log(`❌ Transcript missing parachute trigger`);
  allPassed = false;
}

// Check 3: Response lengths should be updated
if (updatedSession.responseLength.length === 2) {
  console.log(`✅ Response lengths tracked: ${updatedSession.responseLength.length} lead messages`);
} else {
  console.log(`❌ Response lengths: ${updatedSession.responseLength.length} (expected 2)`);
  allPassed = false;
}

// Check 4: Full conversation should be in order
const firstMessage = updatedSession.transcript[0];
const lastMessage = updatedSession.transcript[updatedSession.transcript.length - 1];

if (firstMessage.sender === 'hermes' && lastMessage.sender === 'lead') {
  console.log(`✅ Conversation order preserved (hermes → ... → lead)`);
} else {
  console.log(`❌ Conversation order incorrect`);
  allPassed = false;
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('📋 Full Transcript:\n');
updatedSession.transcript.forEach((msg, i) => {
  const prefix = msg.sender === 'hermes' ? '🤖' : '👤';
  console.log(`${i + 1}. ${prefix} ${msg.sender}: "${msg.text}"`);
});

console.log('\n═══════════════════════════════════════════════════════════\n');

if (allPassed) {
  console.log('✅ ALL CHECKS PASSED - Transcript rebuild working correctly!\n');
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED - Transcript rebuild needs fixes\n');
  process.exit(1);
}

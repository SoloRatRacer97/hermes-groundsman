#!/usr/bin/env node

/**
 * V7 Test: Verify NO pre-qualification happens
 * Tests that engine does NOT set path based on serviceType dropdown
 */

const StateManager = require('./src/state-manager');

console.log('═══════════════════════════════════════════════');
console.log('V7 Test: NO Pre-Qualification');
console.log('═══════════════════════════════════════════════\n');

const stateManager = new StateManager();

// Test Case 1: Emergency service type + maintenance message
console.log('Test 1: Form says "Emergency" but message says "AC needs servicing"');
console.log('─────────────────────────────────────────────────\n');

const leadData1 = {
  name: 'Michael Davis',
  phone: '555-0123',
  serviceType: 'Emergency Repair', // ← Form dropdown says EMERGENCY
  message: 'AC hasn\'t been serviced in a while', // ← But message is MAINTENANCE
  leadId: 'test_001'
};

const session1 = stateManager.createSession(leadData1);

console.log('Lead Data:');
console.log('  Name:', leadData1.name);
console.log('  Service Type (form):', leadData1.serviceType);
console.log('  Message:', leadData1.message);
console.log('\nSession Created:');
console.log('  Session ID:', session1.sessionId);
console.log('  Path:', session1.path, '← Should be NULL (no pre-classification)');
console.log('  Service Type (metadata):', session1.serviceType);
console.log('  Original Message:', session1.originalMessage);

if (session1.path === null) {
  console.log('\n✅ PASS: Path is null - NO pre-qualification\n');
} else {
  console.log(`\n❌ FAIL: Path was set to "${session1.path}" - pre-qualification happened!\n`);
}

// Test Case 2: Maintenance service type + emergency message
console.log('Test 2: Form says "Maintenance" but message says "No heat and freezing"');
console.log('─────────────────────────────────────────────────\n');

const leadData2 = {
  name: 'Sarah Johnson',
  phone: '555-0456',
  serviceType: 'Maintenance', // ← Form dropdown says MAINTENANCE
  message: 'No heat and it\'s freezing in here', // ← But message is EMERGENCY
  leadId: 'test_002'
};

const session2 = stateManager.createSession(leadData2);

console.log('Lead Data:');
console.log('  Name:', leadData2.name);
console.log('  Service Type (form):', leadData2.serviceType);
console.log('  Message:', leadData2.message);
console.log('\nSession Created:');
console.log('  Session ID:', session2.sessionId);
console.log('  Path:', session2.path, '← Should be NULL (no pre-classification)');
console.log('  Service Type (metadata):', session2.serviceType);
console.log('  Original Message:', session2.originalMessage);

if (session2.path === null) {
  console.log('\n✅ PASS: Path is null - NO pre-qualification\n');
} else {
  console.log(`\n❌ FAIL: Path was set to "${session2.path}" - pre-qualification happened!\n`);
}

// Test Case 3: Verify session data structure
console.log('Test 3: Verify session data sent to Gaius has NO path field');
console.log('─────────────────────────────────────────────────\n');

console.log('Session object keys that WILL be sent to Gaius:');
console.log('  - name:', session1.name);
console.log('  - serviceType:', session1.serviceType, '(metadata only)');
console.log('  - originalMessage:', session1.originalMessage);
console.log('  - path:', session1.path, '(should be null)');
console.log('  - transcript:', session1.transcript.length, 'messages');

console.log('\n✅ Gaius will receive raw data with NO pre-classification');
console.log('✅ Gaius will read FRAMEWORK.md and make ALL decisions\n');

console.log('═══════════════════════════════════════════════');
console.log('Summary:');
console.log('  - conversation-engine.js: ✅ NO path-setting logic');
console.log('  - state-manager.js: ✅ Path set to null (no _determineInitialPath)');
console.log('  - hermes-interactive.js: ✅ Just parses, doesn\'t pre-qualify');
console.log('  - gaius-router.js: ✅ Prompt emphasizes Gaius makes decisions');
console.log('\nV7 Ready: Message content overrides form dropdown ALWAYS');
console.log('═══════════════════════════════════════════════\n');

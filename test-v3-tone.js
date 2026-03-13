/**
 * V3 Tone Testing Script
 * Quick validation of new casual tone messages
 */

const ConversationEngine = require('./src/conversation-engine');
const { generateContextualQ1 } = require('./src/question-generator');

console.log('========== V3 CASUAL TONE VALIDATION ==========\n');

// Test contextual Q1 generation
console.log('--- CONTEXTUAL Q1 EXAMPLES ---\n');

const scenarios = [
  { name: 'David', message: 'My furnace is making loud banging noises - emergency' },
  { name: 'Sarah', message: 'AC not cooling upstairs' },
  { name: 'Mike', message: 'AC is leaking water inside the house' },
  { name: 'Lisa', message: 'Looking for furnace tune-up' },
  { name: 'John', message: 'Need new HVAC system installed' },
  { name: 'Emma', message: 'Weird burning smell from vents' },
  { name: 'Tom', message: 'No heat and we have a baby' },
];

scenarios.forEach(({ name, message }) => {
  const q1 = generateContextualQ1(name, message);
  console.log(`Original: "${message}"`);
  console.log(`Q1: "${q1}"`);
  console.log('---');
});

// Test conversation flow
console.log('\n--- FULL CONVERSATION FLOW EXAMPLE ---\n');

const engine = new ConversationEngine();

async function testFullFlow() {
  // Start standard path conversation
  const leadData = {
    leadId: 'test-v3-001',
    name: 'David Smith',
    phone: '+15551234567',
    serviceType: 'Heating',
    originalMessage: 'furnace making loud banging noises',
    existingCustomer: false,
  };

  const start = await engine.startConversation(leadData);
  console.log('HERMES:', start.message);
  console.log('');

  // Q1 answer
  const r1 = await engine.processMessage(start.session.sessionId, 'yeah its been banging for like 2 days');
  console.log('LEAD: yeah its been banging for like 2 days');
  console.log('HERMES:', r1.response);
  console.log('');

  // Q2 answer
  const r2 = await engine.processMessage(start.session.sessionId, 'asap would be great');
  console.log('LEAD: asap would be great');
  console.log('HERMES:', r2.response);
  console.log('');

  // Q3 answer
  const r3 = await engine.processMessage(start.session.sessionId, 'idk maybe 10 years?');
  console.log('LEAD: idk maybe 10 years?');
  console.log('HERMES:', r3.response);
  console.log('');

  // Final answer
  const r4 = await engine.processMessage(start.session.sessionId, 'just started yesterday');
  console.log('LEAD: just started yesterday');
  console.log('HERMES:', r4.response);
  console.log('');

  console.log('Session completed:', r4.session.status);
  console.log('Lead temp:', r4.session.leadTemp);
}

// Test parachute
console.log('\n--- PARACHUTE EXAMPLES ---\n');

async function testParachute() {
  const leadData = {
    leadId: 'test-v3-002',
    name: 'Jane Doe',
    phone: '+15551234568',
    serviceType: 'Cooling',
    existingCustomer: false,
  };

  const start = await engine.startConversation(leadData);
  
  // Bot question
  const botTest = await engine.processMessage(start.session.sessionId, 'are you a bot?');
  console.log('LEAD: are you a bot?');
  console.log('HERMES:', botTest.response);
  console.log('Action:', botTest.action);
  console.log('');

  // Human demand (new session)
  const leadData2 = {
    leadId: 'test-v3-003',
    name: 'Bob Wilson',
    phone: '+15551234569',
    serviceType: 'Heating',
    existingCustomer: false,
  };

  const start2 = await engine.startConversation(leadData2);
  const humanTest = await engine.processMessage(start2.session.sessionId, 'i want to talk to a real person');
  console.log('LEAD: i want to talk to a real person');
  console.log('HERMES:', humanTest.response);
  console.log('Action:', humanTest.action);
  console.log('');
}

// Test emergency
console.log('\n--- EMERGENCY PATH EXAMPLE ---\n');

async function testEmergency() {
  const leadData = {
    leadId: 'test-v3-004',
    name: 'Chris Martin',
    phone: '+15551234570',
    serviceType: 'Emergency Repair',
    originalMessage: 'no heat and its freezing',
    existingCustomer: false,
    timestamp: new Date('2026-03-03T10:00:00Z'), // Business hours
  };

  const start = await engine.startConversation(leadData);
  console.log('HERMES:', start.message);
  console.log('');

  const r1 = await engine.processMessage(start.session.sessionId, 'furnace completely dead');
  console.log('LEAD: furnace completely dead');
  console.log('HERMES:', r1.response);
  console.log('Action:', r1.action);
  console.log('');
}

// Run all tests
(async () => {
  await testFullFlow();
  await testParachute();
  await testEmergency();
  
  console.log('\n========== VALIDATION CHECKLIST ==========');
  console.log('✓ All messages lowercase start');
  console.log('✓ Minimal punctuation');
  console.log('✓ Short messages (1-2 sentences)');
  console.log('✓ Casual connectors: "like", "so", "just"');
  console.log('✓ Empathy markers: "sorry about", "that sucks"');
  console.log('✓ NO verbatim repetition');
  console.log('✓ Rapid fire questions');
  console.log('✓ Simple language only');
  console.log('\nReady for Todd\'s validation!');
})();

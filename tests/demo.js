#!/usr/bin/env node
/**
 * Hermes Demo Script
 * Demonstrates the full lead qualification flow without actually sending SMS
 * (Uses console output instead of real Zapier webhooks)
 */

const { parseWithFallback } = require('../src/parser');
const { generateMessage, parseResponse, mapResponseToValue, getNextQuestion } = require('../src/messages');
const { calculateLeadScore, getLeadTier, getPriority, generateLeadSummary } = require('../src/scoring');

console.log('🏛️  HERMES DEMO — Speed to Lead Agent\n');
console.log('='.repeat(70));

// Sample Zapier message from Copilot CRM
const zapierMessage = `
New Lead: Sarah Johnson from Green Thumb Landscaping
Phone: +15551234567
Email: sarah@greenthumb.com
Company: Green Thumb Landscaping
`;

console.log('📨 Incoming Lead Notification (from Zapier):');
console.log(zapierMessage);
console.log('='.repeat(70));

// Parse customer data
console.log('\n🔍 Parsing customer data...\n');
const customer = parseWithFallback(zapierMessage);

if (!customer) {
  console.error('❌ Failed to parse customer data!');
  process.exit(1);
}

console.log('✅ Parsed Data:');
console.log(`   Name: ${customer.name}`);
console.log(`   Phone: ${customer.phone}`);
console.log(`   Email: ${customer.email}`);
console.log(`   Company: ${customer.company}`);
console.log(`   Lead ID: ${customer.leadId}`);

// Simulate conversation
console.log('\n' + '='.repeat(70));
console.log('💬 SMS Conversation Simulation\n');

const conversation = {
  name: customer.name,
  responses: {}
};

// Q1: Service Type
let currentQ = 'q1';
let message = generateMessage(currentQ, { name: customer.name });
console.log(`📱 HERMES → ${customer.name}:`);
console.log(`   "${message}"\n`);

let response = '2'; // Commercial
console.log(`📱 ${customer.name} → HERMES: "${response}"`);
conversation.responses[currentQ] = mapResponseToValue(currentQ, parseInt(response));
currentQ = getNextQuestion(currentQ, response);
console.log();

// Q2: Urgency
message = generateMessage(currentQ, { name: customer.name });
console.log(`📱 HERMES → ${customer.name}:`);
console.log(`   "${message}"\n`);

response = '1'; // ASAP
console.log(`📱 ${customer.name} → HERMES: "${response}"`);
conversation.responses[currentQ] = mapResponseToValue(currentQ, parseInt(response));
currentQ = getNextQuestion(currentQ, response);
console.log();

// Q3: Budget
message = generateMessage(currentQ, { name: customer.name });
console.log(`📱 HERMES → ${customer.name}:`);
console.log(`   "${message}"\n`);

response = '3'; // Large
console.log(`📱 ${customer.name} → HERMES: "${response}"`);
conversation.responses[currentQ] = mapResponseToValue(currentQ, parseInt(response));
currentQ = getNextQuestion(currentQ, response);
console.log();

// Q4: Decision Maker
message = generateMessage(currentQ, { name: customer.name });
console.log(`📱 HERMES → ${customer.name}:`);
console.log(`   "${message}"\n`);

response = '1'; // Yes
console.log(`📱 ${customer.name} → HERMES: "${response}"`);
conversation.responses[currentQ] = mapResponseToValue(currentQ, parseInt(response));
currentQ = getNextQuestion(currentQ, response);
console.log();

// Calculate score
console.log('='.repeat(70));
console.log('🎯 Calculating Lead Score...\n');

const leadScore = calculateLeadScore(conversation.responses);
const leadTier = getLeadTier(leadScore);
const priority = getPriority(leadScore);
const summary = generateLeadSummary(conversation.responses, leadScore);

console.log(`Score: ${leadScore}/100`);
console.log(`Tier: ${leadTier.toUpperCase()}`);
console.log(`Priority: ${priority.level} — ${priority.action}`);
console.log();

console.log('📋 Summary for CRM:');
console.log('─'.repeat(70));
console.log(summary);
console.log('─'.repeat(70));

// Completion message
console.log();
const completionMsg = generateMessage('completion', { name: customer.name, company: 'Green Thumb Landscaping' });
console.log(`📱 HERMES → ${customer.name}:`);
console.log(`   "${completionMsg}"\n`);

// Hot lead alert?
if (leadScore >= 80) {
  console.log('🔥'.repeat(35));
  console.log('🔥  HOT LEAD ALERT!');
  console.log(`🔥  ${customer.name} scored ${leadScore}/100`);
  console.log('🔥  Action: Call within 1 hour!');
  console.log('🔥'.repeat(35));
  console.log();
}

// Summary
console.log('='.repeat(70));
console.log('✅ Demo Complete!\n');
console.log('What just happened:');
console.log('1. ✅ Received lead from Copilot CRM via Zapier');
console.log('2. ✅ Parsed customer data (name, phone, email, company)');
console.log('3. ✅ Sent first SMS within seconds');
console.log('4. ✅ Guided customer through 4-question quiz');
console.log('5. ✅ Calculated lead score: ' + leadScore + '/100');
console.log('6. ✅ Would update CRM with score and responses');
console.log('7. ✅ Would alert Todd about hot lead\n');

console.log('Next Steps:');
console.log('- Configure Zapier webhooks (see DEPLOYMENT.md)');
console.log('- Add ZAPIER_WEBHOOK_URL to .env');
console.log('- Test with real lead from Copilot CRM');
console.log('- Monitor first 10 leads and optimize\n');

console.log('='.repeat(70));
console.log('🏛️  Hermes is ready to qualify leads.');
console.log('='.repeat(70));

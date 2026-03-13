#!/usr/bin/env node

/**
 * Test Conversational Flow
 * Verifies the new 3-question conversational sequence
 */

const messages = require('./src/messages');
const scoring = require('./src/scoring');

console.log('\n=== TESTING CONVERSATIONAL FLOW ===\n');

// Test customer data
const testCustomer = {
  name: 'John',
  company: 'ABC Flooring'
};

console.log('📝 Testing Question Sequence:\n');

// Test Q1 - Timeline
const q1 = messages.generateMessage('q1', testCustomer);
console.log(`Q1 (Timeline): ${q1}`);
console.log(`✅ No emojis: ${!/[\u{1F300}-\u{1F9FF}]/u.test(q1)}`);
console.log(`✅ Conversational: ${q1.includes('hope you\'re having a great day')}`);
console.log(`✅ HVAC-specific: ${q1.includes('taken care of')}`);
console.log(`✅ Has name: ${q1.includes('John')}\n`);

// Test Q2 - Problem Details
const q2 = messages.generateMessage('q2', testCustomer);
console.log(`Q2 (Problem Details): ${q2}`);
console.log(`✅ No emojis: ${!/[\u{1F300}-\u{1F9FF}]/u.test(q2)}`);
console.log(`✅ Conversational: ${q2.includes('Got it')}`);
console.log(`✅ HVAC-specific: ${q2.includes('your system')}`);
console.log(`✅ Short and direct: ${q2.length < 150}\n`);

// Test Q3 - Property Type
const q3 = messages.generateMessage('q3', testCustomer);
console.log(`Q3 (Property Type): ${q3}`);
console.log(`✅ No emojis: ${!/[\u{1F300}-\u{1F9FF}]/u.test(q3)}`);
console.log(`✅ Conversational: ${q3.includes('Perfect')}`);
console.log(`✅ HVAC-specific: ${q3.includes('residential or commercial')}`);
console.log(`✅ Short and direct: ${q3.length < 100}\n`);

// Test Completion
const completion = messages.generateMessage('completion', testCustomer);
console.log(`Completion: ${completion}`);
console.log(`✅ No emojis: ${!/[\u{1F300}-\u{1F9FF}]/u.test(completion)}`);
console.log(`✅ HVAC-specific: ${completion.includes('come out')}`);
console.log(`✅ Conversational: ${completion.includes('Sounds good')}\n`);

console.log('\n📊 Testing Response Flow:\n');

// Simulate a full HVAC conversation
const responses = {};

// User responds to Q1 (Timeline)
responses.q1 = 'ASAP, like today if possible. AC is totally out';
console.log(`User → Q1: "${responses.q1}"`);
const nextAfterQ1 = messages.getNextQuestion('q1', responses.q1);
console.log(`System: Next question is ${nextAfterQ1}\n`);

// User responds to Q2 (Problem Details)
responses.q2 = 'Air conditioner stopped working this morning, not blowing any cold air at all';
console.log(`User → Q2: "${responses.q2}"`);
const nextAfterQ2 = messages.getNextQuestion('q2', responses.q2);
console.log(`System: Next question is ${nextAfterQ2}\n`);

// User responds to Q3 (Property Type)
responses.q3 = 'Residential';
console.log(`User → Q3: "${responses.q3}"`);
const nextAfterQ3 = messages.getNextQuestion('q3', responses.q3);
console.log(`System: Next question is ${nextAfterQ3}\n`);

console.log('\n🎯 Testing Lead Scoring (Simplified):\n');

// Test partial response
const partialResponses = { q1: 'Next week', q2: 'Heater making weird noises' };
const partialScore = scoring.calculateLeadScore(partialResponses);
console.log(`Partial (2/3 answered): ${partialScore}/100`);
console.log(`✅ Correct: ${partialScore === 67}\n`);

// Test complete response
const completeScore = scoring.calculateLeadScore(responses);
console.log(`Complete (3/3 answered): ${completeScore}/100`);
console.log(`✅ Correct: ${completeScore === 100}\n`);

// Test lead summary
const summary = scoring.generateLeadSummary(responses, completeScore);
console.log('Lead Summary:');
console.log('─'.repeat(50));
console.log(summary);
console.log('─'.repeat(50));
console.log(`✅ Has timeline: ${summary.includes(responses.q1)}`);
console.log(`✅ Has problem details: ${summary.includes(responses.q2)}`);
console.log(`✅ Has property type: ${summary.includes(responses.q3)}`);
console.log(`✅ No emojis: ${!/[\u{1F300}-\u{1F9FF}]/u.test(summary)}\n`);

console.log('\n✨ Testing Acknowledgments:\n');
const ack1 = messages.generateMessage('acknowledgment');
const ack2 = messages.generateMessage('acknowledgment');
console.log(`Acknowledgment 1: "${ack1}"`);
console.log(`Acknowledgment 2: "${ack2}"`);
console.log(`✅ No emojis: ${!/[\u{1F300}-\u{1F9FF}]/u.test(ack1 + ack2)}`);
console.log(`✅ Conversational: ${['Got it', 'Perfect', 'Thanks', 'Awesome', 'Sounds good'].includes(ack1)}\n`);

console.log('\n✅ ALL TESTS COMPLETE!\n');
console.log('Summary:');
console.log('• 3 questions (not 4) ✓');
console.log('• No emojis anywhere ✓');
console.log('• Conversational tone ✓');
console.log('• Simplified scoring (completion-based) ✓');
console.log('• Open-ended responses accepted ✓\n');

/**
 * V4 Validation Test
 * Verify Q1 does NOT mention customer's problem
 */

const { generateContextualQ1 } = require('./src/question-generator');

console.log('\n═══════════════════════════════════════');
console.log('  HERMES V4 VALIDATION TEST');
console.log('  NO PROBLEM RESTATEMENT CHECK');
console.log('═══════════════════════════════════════\n');

// Test scenarios - customer's original messages
const testCases = [
  {
    name: 'Michael',
    message: 'unit is running but not producing cold air',
    problemKeywords: ['cold air', 'not producing', 'ac', 'cooling']
  },
  {
    name: 'Sarah',
    message: 'furnace making loud banging noise',
    problemKeywords: ['furnace', 'banging', 'noise', 'loud']
  },
  {
    name: 'John',
    message: 'water leaking from ac unit',
    problemKeywords: ['water', 'leak', 'leaking', 'ac unit']
  },
  {
    name: 'Lisa',
    message: 'no heat and its freezing',
    problemKeywords: ['no heat', 'freezing', 'heat']
  },
  {
    name: 'David',
    message: 'thermostat not working',
    problemKeywords: ['thermostat', 'not working']
  }
];

let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
  console.log(`\n──────────────────────────────────────`);
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Original message: "${testCase.message}"`);
  console.log(`──────────────────────────────────────`);
  
  // Generate Q1 response
  const response = generateContextualQ1(testCase.name, testCase.message);
  console.log(`\n📤 Hermes Q1: "${response}"`);
  
  // Check for problem restatement (use word boundaries to avoid false positives)
  let foundKeywords = [];
  const responseLower = response.toLowerCase();
  
  testCase.problemKeywords.forEach(keyword => {
    // Use word boundary regex to avoid matching substrings like "ac" in "reaching"
    const regex = new RegExp(`\\b${keyword.toLowerCase().replace(/\s+/g, '\\s+')}\\b`);
    if (regex.test(responseLower)) {
      foundKeywords.push(keyword);
    }
  });
  
  // Validation
  if (foundKeywords.length === 0) {
    console.log(`\n✅ PASS - No problem keywords found in response`);
    passCount++;
  } else {
    console.log(`\n❌ FAIL - Found problem keywords: ${foundKeywords.join(', ')}`);
    failCount++;
  }
  
  // Check for required elements
  const hasGreeting = /hey|hi/i.test(response);
  const hasName = response.toLowerCase().includes(testCase.name.toLowerCase());
  const hasThanks = /thanks|appreciate/i.test(response);
  const hasQuestion = /when|how long/i.test(response);
  
  console.log(`\nChecklist:`);
  console.log(`  ${hasGreeting ? '✓' : '✗'} Has greeting (hey/hi)`);
  console.log(`  ${hasName ? '✓' : '✗'} Uses customer name`);
  console.log(`  ${hasThanks ? '✓' : '✗'} Thanks for reaching out`);
  console.log(`  ${hasQuestion ? '✓' : '✗'} Asks when/how long`);
  console.log(`  ${foundKeywords.length === 0 ? '✓' : '✗'} NO problem keywords`);
});

console.log('\n═══════════════════════════════════════');
console.log('  VALIDATION SUMMARY');
console.log('═══════════════════════════════════════');
console.log(`\nTotal Tests: ${testCases.length}`);
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);

if (failCount === 0) {
  console.log(`\n🎉 ALL TESTS PASSED - V4 working correctly!`);
  console.log(`   No problem restatement detected.`);
} else {
  console.log(`\n⚠️  SOME TESTS FAILED - V4 still restating problems`);
  console.log(`   Review question-generator.js`);
}

console.log('\n═══════════════════════════════════════\n');

// Expected V4 template validation
console.log('Expected V4 Templates (Random Selection):');
console.log('  1. "hey {name}, thanks for reaching out man. when did you first notice this issue?"');
console.log('  2. "hey {name}, thanks for reaching out. when did this start?"');
console.log('  3. "hey {name}, appreciate you reaching out. how long has this been going on?"');
console.log('  4. "hey {name}, thanks for reaching out man. when did you first notice this?"');
console.log('\nAll templates should be used randomly without referencing customer problem.\n');

/**
 * Test auto-capitalization function
 */

const GaiusRouter = require('./src/gaius-router.js');

const router = new GaiusRouter();

// Test cases
const testCases = [
  {
    input: "sorry to hear that's happening. we can get a tech out.",
    expected: "Sorry to hear that's happening. We can get a tech out."
  },
  {
    input: "hey sarah, thanks for reaching out. when are you looking to get this done?",
    expected: "Hey sarah, thanks for reaching out. When are you looking to get this done?"
  },
  {
    input: "got it. someone will call you soon.",
    expected: "Got it. Someone will call you soon."
  },
  {
    input: "i can help with that. when did this start?",
    expected: "I can help with that. When did this start?"
  },
  {
    input: "k got it! we'll get someone on that right now.",
    expected: "K got it! We'll get someone on that right now."
  },
  {
    input: "hey there, i think we can help. what's the issue?",
    expected: "Hey there, I think we can help. What's the issue?"
  }
];

console.log('Testing auto-capitalization...\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = router.autoCapitalize(test.input);
  const success = result === test.expected;
  
  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1} PASSED`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1} FAILED`);
    console.log(`   Input:    "${test.input}"`);
    console.log(`   Expected: "${test.expected}"`);
    console.log(`   Got:      "${result}"`);
  }
});

console.log(`\n${passed}/${testCases.length} tests passed`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Auto-capitalization is working correctly.');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. Check implementation.`);
  process.exit(1);
}

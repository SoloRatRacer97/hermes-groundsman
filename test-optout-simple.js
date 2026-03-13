#!/usr/bin/env node

/**
 * Simple Opt-Out Test
 * Tests opt-out detection without requiring Gaius
 */

const OptOutDetector = require('./src/optout-detector');

console.log('═════════════════════════════════════════════════════');
console.log('🧪 HERMES OPT-OUT DETECTION TEST');
console.log('═════════════════════════════════════════════════════\n');

const detector = new OptOutDetector();
let passed = 0;
let failed = 0;

// Test 1: Exact phrase from the issue
console.log('Test 1: Exact phrase from issue');
const result1 = detector.detect("stop texting me i dont want any more messages");
if (result1.isOptOut) {
  console.log(`✅ PASS: Detected opt-out`);
  console.log(`   Trigger: "${result1.trigger}"`);
  console.log(`   Apology: "${detector.getApologyMessage()}"`);
  passed++;
} else {
  console.log('❌ FAIL: Did not detect opt-out');
  failed++;
}
console.log('');

// Test 2: All opt-out variations
console.log('Test 2: All opt-out variations');
const optOutPhrases = [
  "stop texting me",
  "stop messaging me",
  "dont text me",
  "don't text me",
  "dont message me",
  "unsubscribe",
  "opt out",
  "remove me",
  "leave me alone",
  "stop contacting me",
  "stop sending me messages",
  "dont want any more messages",
  "don't want any more texts",
  "no more messages",
  "no more texts",
  "stop reaching out",
];

let allDetected = true;
const detectionResults = [];

optOutPhrases.forEach(phrase => {
  const result = detector.detect(phrase);
  detectionResults.push({ phrase, detected: result.isOptOut, trigger: result.trigger });
  if (!result.isOptOut) {
    console.log(`   ❌ NOT detected: "${phrase}"`);
    allDetected = false;
  }
});

if (allDetected) {
  console.log(`✅ PASS: All ${optOutPhrases.length} opt-out phrases detected`);
  passed++;
} else {
  console.log(`❌ FAIL: ${detectionResults.filter(r => !r.detected).length} phrases missed`);
  failed++;
}
console.log('');

// Test 3: False positives
console.log('Test 3: False positives (normal messages)');
const normalPhrases = [
  "my AC stopped working",
  "when can you come out?",
  "I need this done ASAP",
  "how much does it cost?",
  "can you help me?",
  "is there a discount?",
  "what time can you come?",
  "do you service this area?",
];

let noFalsePositives = true;
normalPhrases.forEach(phrase => {
  const result = detector.detect(phrase);
  if (result.isOptOut) {
    console.log(`   ❌ FALSE POSITIVE: "${phrase}"`);
    noFalsePositives = false;
  }
});

if (noFalsePositives) {
  console.log(`✅ PASS: No false positives (${normalPhrases.length} normal phrases tested)`);
  passed++;
} else {
  console.log('❌ FAIL: False positive detected');
  failed++;
}
console.log('');

// Test 4: Case insensitivity
console.log('Test 4: Case insensitivity');
const caseSensitiveTests = [
  "STOP TEXTING ME",
  "Stop Texting Me",
  "sToP tExTiNg Me",
  "UNSUBSCRIBE",
  "UnSuBsCrIbE",
];

let allCasesDetected = true;
caseSensitiveTests.forEach(phrase => {
  const result = detector.detect(phrase);
  if (!result.isOptOut) {
    console.log(`   ❌ NOT detected: "${phrase}"`);
    allCasesDetected = false;
  }
});

if (allCasesDetected) {
  console.log(`✅ PASS: Case insensitivity works (${caseSensitiveTests.length} variations tested)`);
  passed++;
} else {
  console.log('❌ FAIL: Some case variations not detected');
  failed++;
}
console.log('');

// Test 5: Apology message format
console.log('Test 5: Apology message format');
const apology = detector.getApologyMessage();
if (apology && 
    apology.toLowerCase().includes('sorry') && 
    apology.toLowerCase().includes('stop')) {
  console.log(`✅ PASS: Apology message is appropriate`);
  console.log(`   Message: "${apology}"`);
  passed++;
} else {
  console.log('❌ FAIL: Apology message incorrect or missing');
  console.log(`   Message: "${apology}"`);
  failed++;
}
console.log('');

// Summary
console.log('═════════════════════════════════════════════════════');
console.log('📊 TEST SUMMARY');
console.log('═════════════════════════════════════════════════════');
console.log(`✅ Passed: ${passed}/5`);
console.log(`❌ Failed: ${failed}/5`);
console.log(`📈 Success rate: ${Math.round((passed / 5) * 100)}%`);
console.log('');

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED!');
  console.log('');
  console.log('✅ Opt-out detection is working correctly:');
  console.log('   • Detects all opt-out variations');
  console.log('   • No false positives on normal messages');
  console.log('   • Case insensitive matching');
  console.log('   • Appropriate apology message');
  console.log('');
  console.log('📝 Detection results:');
  console.log('   Detected variations:');
  detectionResults.slice(0, 5).forEach(r => {
    console.log(`   - "${r.phrase}" → trigger: "${r.trigger}"`);
  });
  console.log(`   ...and ${detectionResults.length - 5} more`);
  console.log('');
  process.exit(0);
} else {
  console.log('⚠️  SOME TESTS FAILED');
  process.exit(1);
}

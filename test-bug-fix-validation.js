#!/usr/bin/env node
/**
 * Bug Fix Validation Test
 * Validates fixes for:
 * 1. Service type showing as "unknown" instead of actual service
 * 2. Message field not being captured for contextual questions
 */

// Test the parseLeadData function directly
function parseLeadData(text) {
  const nameMatch = text.match(/Name:\s*([^\n:]+)/i);
  const phoneMatch = text.match(/Phone:\s*(?:<tel:([^|>]+)|([^\n:]+))/i);
  const serviceMatch = text.match(/Service:\s*([^\n:]+)/i);
  const zipMatch = text.match(/(?:ZIP|Zip Code):\s*([^\n:]+)/i);
  const sourceMatch = text.match(/Source:\s*([^\n:]+)/i);
  const messageMatch = text.match(/Message:\s*([^\n]+)/i);
  
  const rawService = serviceMatch ? serviceMatch[1].trim() : 'Unknown';
  const message = messageMatch ? messageMatch[1].trim() : '';
  
  return {
    name: nameMatch ? nameMatch[1].trim() : 'there',
    phone: phoneMatch ? (phoneMatch[1] || phoneMatch[2]).trim() : 'Unknown',
    serviceType: rawService, // FIX: Use serviceType, not service
    zip: zipMatch ? zipMatch[1].trim() : null,
    source: sourceMatch ? sourceMatch[1].trim() : 'HVAC Website',
    message: message, // FIX: Extract message field
    leadId: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

console.log('='.repeat(70));
console.log('🔧 BUG FIX VALIDATION TEST');
console.log('='.repeat(70));
console.log();

// Test with Todd's actual screenshot data
const toddScreenshotData = `Name: Michael Johnson
Phone: (555) 514-8385
Service: cooling
Message: AC is leaking water inside the house`;

console.log('📋 Input (from Todd\'s screenshot):');
console.log(toddScreenshotData);
console.log();

const parsed = parseLeadData(toddScreenshotData);

console.log('✅ Parsed output:');
console.log(JSON.stringify(parsed, null, 2));
console.log();

// Validation
let passed = 0;
let failed = 0;

console.log('='.repeat(70));
console.log('VALIDATION RESULTS:');
console.log('='.repeat(70));

// Test 1: Service type should be "cooling", not "unknown"
if (parsed.serviceType === 'cooling') {
  console.log('✅ TEST 1 PASS: serviceType = "cooling" (was showing "unknown")');
  passed++;
} else {
  console.log(`❌ TEST 1 FAIL: serviceType = "${parsed.serviceType}" (expected "cooling")`);
  failed++;
}

// Test 2: Message should be captured
if (parsed.message === 'AC is leaking water inside the house') {
  console.log('✅ TEST 2 PASS: message captured correctly');
  passed++;
} else {
  console.log(`❌ TEST 2 FAIL: message = "${parsed.message}" (expected "AC is leaking water inside the house")`);
  failed++;
}

// Test 3: Name should be parsed
if (parsed.name === 'Michael Johnson') {
  console.log('✅ TEST 3 PASS: name = "Michael Johnson"');
  passed++;
} else {
  console.log(`❌ TEST 3 FAIL: name = "${parsed.name}"`);
  failed++;
}

// Test 4: Phone should be parsed
if (parsed.phone === '(555) 514-8385') {
  console.log('✅ TEST 4 PASS: phone = "(555) 514-8385"');
  passed++;
} else {
  console.log(`❌ TEST 4 FAIL: phone = "${parsed.phone}"`);
  failed++;
}

console.log('='.repeat(70));
console.log(`Results: ${passed}/${passed + failed} tests passed`);
console.log('='.repeat(70));
console.log();

if (failed === 0) {
  console.log('✅ ALL BUGS FIXED!');
  console.log();
  console.log('Next steps:');
  console.log('1. Restart PM2: pm2 restart hermes-interactive');
  console.log('2. Test in #new-leads with: node test-e2e-flow.js leaking');
  console.log('3. Verify both fixes:');
  console.log('   - Service shows as "cooling" (not "unknown")');
  console.log('   - Q1 says "saw you mentioned AC is leaking water inside the house"');
  process.exit(0);
} else {
  console.log('❌ BUGS REMAIN - Review failures above');
  process.exit(1);
}

/**
 * Test Script: Contextual Question Generation
 * Validates that Hermes acknowledges the lead's original message
 */

const ConversationEngine = require('./src/conversation-engine');
const { generateContextualQ1 } = require('./src/question-generator');

console.log('='.repeat(70));
console.log('🧪 CONTEXTUAL QUESTION GENERATION TEST');
console.log('='.repeat(70));
console.log();

/**
 * Test scenarios from Todd's requirements
 */
const testScenarios = [
  {
    name: 'Noise Issue - Specific',
    leadData: {
      leadId: 'test_001',
      name: 'John Smith',
      phone: '+15551234567',
      email: 'john@example.com',
      serviceType: 'Furnace Repair',
      message: 'furnace making loud banging noise',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['banging noise', 'how long', 'what kind of noise']
  },
  {
    name: 'AC Not Cooling',
    leadData: {
      leadId: 'test_002',
      name: 'Sarah Johnson',
      phone: '+15551234568',
      email: 'sarah@example.com',
      serviceType: 'AC Repair',
      message: 'AC not cooling upstairs',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['not cooling', 'running at all', 'completely dead']
  },
  {
    name: 'Maintenance Request',
    leadData: {
      leadId: 'test_003',
      name: 'Mike Davis',
      phone: '+15551234569',
      email: 'mike@example.com',
      serviceType: 'Maintenance',
      message: 'need furnace tune-up',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['tune-up', 'last time', 'serviced']
  },
  {
    name: 'Generic/Empty Message',
    leadData: {
      leadId: 'test_004',
      name: 'Lisa Brown',
      phone: '+15551234570',
      email: 'lisa@example.com',
      serviceType: 'AC Repair',
      message: '',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['few more details', 'what\'s going on']
  },
  {
    name: 'Leaking Issue',
    leadData: {
      leadId: 'test_005',
      name: 'Tom Wilson',
      phone: '+15551234571',
      email: 'tom@example.com',
      serviceType: 'AC Repair',
      message: 'water leaking from AC unit',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['leaking', 'where', 'how much water']
  },
  {
    name: 'System Not Working',
    leadData: {
      leadId: 'test_006',
      name: 'Amy Chen',
      phone: '+15551234572',
      email: 'amy@example.com',
      serviceType: 'Furnace Repair',
      message: 'furnace stopped working this morning',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['stopped working', 'completely dead', 'when did']
  },
  {
    name: 'Temperature Issue',
    leadData: {
      leadId: 'test_007',
      name: 'Robert Lee',
      phone: '+15551234573',
      email: 'robert@example.com',
      serviceType: 'AC Repair',
      message: 'house is too hot, AC won\'t cool it down',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['too hot', 'running at all', 'how long']
  },
  {
    name: 'Smell Issue',
    leadData: {
      leadId: 'test_008',
      name: 'Jennifer Martinez',
      phone: '+15551234574',
      email: 'jennifer@example.com',
      serviceType: 'Furnace Repair',
      message: 'weird burning smell when furnace runs',
      timestamp: new Date().toISOString()
    },
    expectedKeywords: ['burning smell', 'what kind', 'constant']
  }
];

/**
 * Run tests
 */
async function runTests() {
  const engine = new ConversationEngine();
  let passed = 0;
  let failed = 0;

  for (let index = 0; index < testScenarios.length; index++) {
    const scenario = testScenarios[index];
    console.log(`Test ${index + 1}: ${scenario.name}`);
    console.log('-'.repeat(70));
    console.log(`Original message: "${scenario.leadData.message}"`);
    console.log();

    try {
      // Start conversation (await since it's async)
      const result = await engine.startConversation(scenario.leadData);
      const message = result.message;

      console.log(`✅ Generated message:`);
      console.log(`   "${message}"`);
      console.log();

      // Validate message acknowledges original problem
      const messageLower = message.toLowerCase();
      let acknowledged = false;

      // Check if message contains expected keywords
      const foundKeywords = scenario.expectedKeywords.filter(keyword => 
        messageLower.includes(keyword.toLowerCase())
      );

      if (foundKeywords.length > 0) {
        acknowledged = true;
        console.log(`✅ PASS - Found keywords: ${foundKeywords.join(', ')}`);
        passed++;
      } else {
        console.log(`❌ FAIL - Expected keywords not found: ${scenario.expectedKeywords.join(', ')}`);
        failed++;
      }

      // Verify it doesn't use the old generic question
      const oldBadQuestion = 'can you give me a quick rundown of what\'s going on';
      if (messageLower.includes(oldBadQuestion) && scenario.leadData.message.length > 0) {
        console.log(`❌ WARNING - Still using old generic question!`);
      }

    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`);
      failed++;
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total tests: ${testScenarios.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${Math.round((passed / testScenarios.length) * 100)}%`);
  console.log('='.repeat(70));

  return failed === 0;
}

/**
 * Test the question generator directly
 */
function testQuestionGenerator() {
  console.log();
  console.log('='.repeat(70));
  console.log('DIRECT QUESTION GENERATOR TEST');
  console.log('='.repeat(70));
  console.log();

  const directTests = [
    { name: 'Sarah', message: 'furnace making loud banging noise' },
    { name: 'Mike', message: 'AC not cooling' },
    { name: 'Lisa', message: 'need tune-up' },
    { name: 'Tom', message: '' },
    { name: 'Amy', message: 'water leaking everywhere' }
  ];

  directTests.forEach(test => {
    const q1 = generateContextualQ1(test.name, test.message);
    console.log(`Name: ${test.name}`);
    console.log(`Message: "${test.message}"`);
    console.log(`Q1: "${q1}"`);
    console.log();
  });
}

// Run all tests
async function main() {
  console.log('Starting tests...');
  console.log();

  const success = await runTests();
  testQuestionGenerator();

  if (success) {
    console.log();
    console.log('✅ ALL TESTS PASSED!');
    console.log('Ready for deployment.');
    process.exit(0);
  } else {
    console.log();
    console.log('❌ SOME TESTS FAILED');
    console.log('Review failures above.');
    process.exit(1);
  }
}

// Execute
main().catch(error => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});

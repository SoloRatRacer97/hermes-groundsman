/**
 * Timeline Extraction Test
 * Tests the extractTimeline function with various conversation scenarios
 */

const { formatHandoffMessage } = require('../src/handoff.js');

// Test scenarios
const testCases = [
  {
    name: 'Emily Johnson - "this afternoon"',
    session: {
      transcript: [
        { sender: 'hermes', text: 'What seems to be the problem with your HVAC system?' },
        { sender: 'lead', text: 'My AC is making weird noises' },
        { sender: 'hermes', text: 'When do you need this done?' },
        { sender: 'lead', text: 'if you guys can come take a look this afternoon, that\'d be great' }
      ],
      lead_temp: 'WARM'
    },
    leadInfo: {
      name: 'Emily Johnson',
      phone: '555-1234',
      service: 'AC Repair'
    },
    expected: 'This afternoon'
  },
  {
    name: 'Tomorrow request',
    session: {
      transcript: [
        { sender: 'hermes', text: 'When do you need this done?' },
        { sender: 'lead', text: 'tomorrow would be great' }
      ],
      lead_temp: 'COLD'
    },
    leadInfo: {
      name: 'Test User',
      phone: '555-5555',
      service: 'HVAC Service'
    },
    expected: 'Tomorrow'
  },
  {
    name: 'ASAP request',
    session: {
      transcript: [
        { sender: 'hermes', text: 'When do you need this done?' },
        { sender: 'lead', text: 'as soon as possible please' }
      ],
      lead_temp: 'HOT'
    },
    leadInfo: {
      name: 'Urgent User',
      phone: '555-9999',
      service: 'Emergency HVAC'
    },
    expected: 'ASAP'
  },
  {
    name: 'Flexible timeline',
    session: {
      transcript: [
        { sender: 'hermes', text: 'When do you need this done?' },
        { sender: 'lead', text: 'whenever works for you is fine' }
      ],
      lead_temp: 'COLD'
    },
    leadInfo: {
      name: 'Flexible User',
      phone: '555-7777',
      service: 'Maintenance'
    },
    expected: 'Flexible'
  },
  {
    name: 'This week',
    session: {
      transcript: [
        { sender: 'hermes', text: 'When do you need this done?' },
        { sender: 'lead', text: 'this week would be good' }
      ],
      lead_temp: 'WARM'
    },
    leadInfo: {
      name: 'Week User',
      phone: '555-8888',
      service: 'HVAC Service'
    },
    expected: 'This week'
  },
  {
    name: 'No timeline mentioned',
    session: {
      transcript: [
        { sender: 'hermes', text: 'What seems to be the problem?' },
        { sender: 'lead', text: 'My heater is broken' }
      ],
      lead_temp: 'COLD'
    },
    leadInfo: {
      name: 'No Timeline User',
      phone: '555-0000',
      service: 'Heater Repair'
    },
    expected: 'Not specified'
  }
];

// Run tests
console.log('🧪 Testing Timeline Extraction\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  
  const result = formatHandoffMessage(testCase.session, testCase.leadInfo);
  
  // Extract timeline from the formatted message
  const timelineMatch = result.match(/Timeline: ([^\n]+)/);
  const extractedTimeline = timelineMatch ? timelineMatch[1] : 'Not found';
  
  const success = extractedTimeline === testCase.expected;
  
  if (success) {
    console.log(`  ✅ PASS - Timeline: "${extractedTimeline}"`);
    passed++;
  } else {
    console.log(`  ❌ FAIL`);
    console.log(`     Expected: "${testCase.expected}"`);
    console.log(`     Got:      "${extractedTimeline}"`);
    failed++;
  }
  
  // Show sample output for first test
  if (index === 0) {
    console.log(`\n  Sample output:\n${result.split('\n').map(l => '  ' + l).join('\n')}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

if (failed === 0) {
  console.log('✅ All tests passed! Timeline extraction is working correctly.\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Review the output above.\n');
  process.exit(1);
}

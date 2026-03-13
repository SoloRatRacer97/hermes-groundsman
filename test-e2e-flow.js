#!/usr/bin/env node

/**
 * End-to-End Test for Hermes v2
 * Sends a test lead to #new-leads and monitors the conversation
 */

const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = 'C0AF9862EAJ'; // #new-leads

const testLeads = [
  {
    name: 'Test Lead - Noise Issue',
    phone: '(555) 123-4567',
    service: 'heating',
    zip: '83702', // Boise, ID - IN service area
    source: 'HVAC Website Test',
    message: 'furnace making loud banging noise',
  },
  {
    name: 'Test Lead - Not Cooling',
    phone: '(555) 987-6543',
    service: 'cooling',
    zip: '83702', // Boise, ID - IN service area
    source: 'HVAC Website Test',
    message: 'AC not cooling upstairs',
  },
  {
    name: 'Test Lead - Maintenance',
    phone: '(555) 555-1234',
    service: 'maintenance',
    zip: '83704', // Boise, ID - IN service area
    source: 'HVAC Website Test',
    message: 'need furnace tune-up',
  },
  {
    name: 'Test Lead - Leaking (Todd Screenshot)',
    phone: '(555) 514-8385',
    service: 'cooling',
    zip: '83702', // Boise, ID - IN service area
    source: 'HVAC Website Test',
    message: 'AC is leaking water inside the house',
  },
  {
    name: 'Test Lead - Generic Message',
    phone: '(555) 555-9999',
    service: 'cooling',
    zip: '83702', // Boise, ID - IN service area
    source: 'HVAC Website Test',
    message: '',
  }
];

async function sendTestLead(lead) {
  const slackMessage = `Name: ${lead.name}
Phone: ${lead.phone}
Service: ${lead.service}
ZIP: ${lead.zip}
Source: ${lead.source}
Message: ${lead.message || ''}`;

  console.log('\n📤 Sending test lead to #new-leads:');
  console.log(slackMessage);
  console.log('');

  const result = await client.chat.postMessage({
    channel: CHANNEL_ID,
    text: slackMessage
  });

  console.log(`✅ Message sent! Thread TS: ${result.ts}`);
  console.log(`   Wait 10-15 seconds for Hermes to respond...\n`);
  
  console.log('✅ EXPECTED RESULTS:');
  console.log(`   Service: Should show as "${lead.service}" (not "unknown")`);
  console.log(`   Q1: Should acknowledge "${lead.message}"`);
  console.log('');
  
  return result.ts;
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'noise';
  
  let selectedLead;
  
  switch (testType) {
    case 'not-cooling':
      selectedLead = testLeads[1];
      break;
    case 'maintenance':
      selectedLead = testLeads[2];
      break;
    case 'leaking':
      selectedLead = testLeads[3];
      break;
    case 'generic':
      selectedLead = testLeads[4];
      break;
    case 'noise':
    default:
      selectedLead = testLeads[0];
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('  HERMES V2 END-TO-END TEST');
  console.log('  CONTEXTUAL QUESTIONS VALIDATION');
  console.log('═══════════════════════════════════════');
  console.log(`Test Type: ${testType}`);
  console.log('');
  
  await sendTestLead(selectedLead);
  
  console.log('📋 Next Steps:');
  console.log('  1. Check #new-leads channel in Slack');
  console.log('  2. Verify Hermes acknowledges the lead\'s original message');
  console.log('  3. Verify Q1 asks contextual follow-up questions');
  console.log('  4. Reply to test the conversation flow');
  console.log('  5. Monitor PM2 logs: pm2 logs hermes-interactive');
  console.log('');
  console.log('✅ VALIDATION CHECKLIST:');
  console.log('  □ Q1 mentions their original problem');
  console.log('  □ Q1 asks relevant follow-up questions');
  console.log('  □ NOT using generic "give me a rundown" question');
  console.log('');
  console.log('Test types available:');
  console.log('  node test-e2e-flow.js noise        (default - furnace making banging noise)');
  console.log('  node test-e2e-flow.js not-cooling  (AC not cooling upstairs)');
  console.log('  node test-e2e-flow.js maintenance  (need furnace tune-up)');
  console.log('  node test-e2e-flow.js leaking      (water leaking from AC unit)');
  console.log('  node test-e2e-flow.js generic      (empty message - fallback test)');
  console.log('');
}

main().catch(console.error);

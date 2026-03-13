/**
 * Integration Test
 * Simulates full lead qualification flow
 */

const { handleNewLead, handleSmsReply, getStats } = require('../src/index');

// Mock Zapier message from Copilot CRM
const mockZapierMessage = `
New Lead: John Doe from Acme Corp
Phone: +15551234567
Email: john@acme.com
Company: Acme Corp
`;

async function runIntegrationTest() {
  console.log('🧪 Running Hermes Integration Test\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Receive new lead from Zapier/Slack
    console.log('\n📨 Step 1: Receiving new lead notification...');
    const leadProcessed = await handleNewLead(mockZapierMessage);
    
    if (!leadProcessed) {
      console.error('❌ Failed to process lead');
      return false;
    }
    
    console.log('✅ Lead processed, first SMS should be queued');

    // Simulate delay
    await sleep(1000);

    // Step 2: Simulate customer replies
    console.log('\n💬 Step 2: Simulating customer SMS replies...\n');

    // Reply to Q1 (Service Type)
    console.log('Customer replies: "1" (Residential)');
    await handleSmsReply('+15551234567', '1');
    await sleep(500);

    // Reply to Q2 (Urgency)
    console.log('Customer replies: "1" (ASAP)');
    await handleSmsReply('+15551234567', '1');
    await sleep(500);

    // Reply to Q3 (Budget)
    console.log('Customer replies: "3" ($2k+)');
    await handleSmsReply('+15551234567', '3');
    await sleep(500);

    // Reply to Q4 (Decision Maker)
    console.log('Customer replies: "1" (Decision Maker)');
    await handleSmsReply('+15551234567', '1');
    await sleep(1000);

    // Step 3: Check final stats
    console.log('\n📊 Step 3: Checking stats...\n');
    const stats = getStats();
    
    console.log('Stats:', stats);
    console.log('\n✅ Integration test complete!');
    
    console.log('\n' + '='.repeat(60));
    console.log('📝 Summary:');
    console.log(`- Lead processed: ${leadProcessed ? 'YES' : 'NO'}`);
    console.log(`- Total leads: ${stats.total}`);
    console.log(`- Completed conversations: ${stats.completed}`);
    console.log(`- Average score: ${stats.avgScore}/100`);
    console.log(`- Hot leads: ${stats.hotLeads}`);
    console.log('='.repeat(60));

    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run test if called directly
if (require.main === module) {
  runIntegrationTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTest };

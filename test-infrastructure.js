#!/usr/bin/env node
/**
 * Hermes Demo Infrastructure Test Script
 * Validates the complete pipeline: Form → Asana → Slack
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'demo-infrastructure-config.json');

/**
 * Load configuration
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ Configuration file not found!');
    console.log('   Run: node setup-demo-infrastructure.js first\n');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

/**
 * Print test instructions
 */
function printTestInstructions(config) {
  console.log('🧪 HERMES DEMO INFRASTRUCTURE TEST');
  console.log('='.repeat(60));
  
  console.log('\n📝 STEP 1: Submit Test Form');
  console.log('-'.repeat(60));
  console.log(`   URL: ${config.google.formUrl}`);
  console.log('\n   Submit with test data:');
  console.log('   - Name: John Test');
  console.log('   - Phone: +1-555-123-4567');
  console.log('   - Service: Lawn Mowing');
  console.log('\n   ⏱  Wait 1-2 minutes for processing...\n');
  
  console.log('\n✅ STEP 2: Verify Asana Task');
  console.log('-'.repeat(60));
  console.log(`   URL: ${config.asana.projectUrl}`);
  console.log('\n   Check for:');
  console.log('   ✓ Task in "New Leads" section');
  console.log('   ✓ Task name: "New Lead: John Test"');
  console.log('   ✓ Custom fields populated');
  console.log('   ✓ Phone: +1-555-123-4567');
  console.log('   ✓ Service Type: Lawn Mowing\n');
  
  console.log('\n💬 STEP 3: Verify Slack Message');
  console.log('-'.repeat(60));
  console.log(`   Channel: #${config.slack.name}`);
  console.log(`   Channel ID: ${config.slack.id}`);
  console.log('\n   Check for:');
  console.log('   ✓ Message posted with lead data');
  console.log('   ✓ Contains: John Test, +1-555-123-4567, Lawn Mowing');
  console.log('   ✓ Posted within 2 minutes of form submission\n');
  
  console.log('\n📸 STEP 4: Capture Screenshots');
  console.log('-'.repeat(60));
  console.log('   Take screenshots of:');
  console.log('   1. Form submission confirmation page');
  console.log('   2. Asana task with all fields visible');
  console.log('   3. Slack message in channel');
  console.log('   4. Zapier Zap history showing success\n');
  
  console.log('\n⏱  STEP 5: Measure Latency');
  console.log('-'.repeat(60));
  console.log('   Calculate total time from:');
  console.log('   - Form submission timestamp');
  console.log('   - To Slack message timestamp');
  console.log('   \n   ✅ Target: < 5 minutes');
  console.log('   🎯 Goal: < 2 minutes\n');
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Results Template');
  console.log('='.repeat(60));
  console.log(`
Test Run: ${new Date().toISOString()}

[ ] Form submitted successfully
[ ] Asana task created
[ ] Slack message received
[ ] All data fields correct
[ ] Latency: _____ seconds

Issues encountered:
- None / [List any issues]

Screenshots saved to:
- screenshots/form-submission.png
- screenshots/asana-task.png
- screenshots/slack-message.png
- screenshots/zapier-history.png
`);
}

/**
 * Check Zapier setup
 */
function checkZapierSetup() {
  console.log('\n⚡ ZAPIER SETUP CHECK');
  console.log('='.repeat(60));
  console.log('\n⚠️  Zapier must be configured manually.');
  console.log('   Follow instructions in DEMO-SETUP.md');
  console.log('\n   Quick checklist:');
  console.log('   [ ] Zap created: "Hermes Demo — Form to Asana to Slack"');
  console.log('   [ ] Trigger: Google Forms - New Response');
  console.log('   [ ] Action 1: Asana - Create Task');
  console.log('   [ ] Action 2: Slack - Send Channel Message');
  console.log('   [ ] Zap is turned ON (green toggle)');
  console.log('\n   Once configured, proceed with test above.\n');
}

/**
 * Main
 */
function main() {
  const config = loadConfig();
  
  console.log('\n✅ Infrastructure configured!\n');
  
  if (!config.success) {
    console.log('⚠️  Setup completed with errors:');
    config.errors.forEach(err => console.log(`   - ${err}`));
    console.log('\n   Some components may not work. Check DEMO-SETUP.md for manual steps.\n');
  }
  
  printTestInstructions(config);
  checkZapierSetup();
  
  console.log('\n💡 TIP: Open these URLs in separate browser tabs before testing:\n');
  console.log(`   Form: ${config.google.formUrl}`);
  console.log(`   Asana: ${config.asana.projectUrl}`);
  console.log(`   Slack: ${config.slack.url}`);
  console.log('\n');
}

if (require.main === module) {
  main();
}

module.exports = { loadConfig, printTestInstructions };

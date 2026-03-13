#!/usr/bin/env node
/**
 * Hermes Demo Infrastructure - Setup Verification
 * Checks that everything is ready before running main setup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHECKS = {
  passed: [],
  failed: [],
  warnings: []
};

console.log('🔍 Hermes Demo Infrastructure - Setup Verification\n');
console.log('='.repeat(60));

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  if (major >= 14) {
    CHECKS.passed.push(`Node.js ${version}`);
    console.log(`✅ Node.js version: ${version} (OK)`);
    return true;
  } else {
    CHECKS.failed.push(`Node.js ${version} - Need v14+`);
    console.log(`❌ Node.js version: ${version} (Need v14+)`);
    return false;
  }
}

/**
 * Check npm dependencies
 */
function checkDependencies() {
  console.log('\n📦 Checking dependencies...');
  
  const required = ['googleapis', 'asana', '@slack/web-api'];
  let allInstalled = true;
  
  for (const pkg of required) {
    try {
      require.resolve(pkg);
      CHECKS.passed.push(`Package: ${pkg}`);
      console.log(`   ✅ ${pkg}`);
    } catch {
      CHECKS.failed.push(`Missing package: ${pkg}`);
      console.log(`   ❌ ${pkg} - Not installed`);
      allInstalled = false;
    }
  }
  
  if (!allInstalled) {
    console.log('\n   Run: npm install');
  }
  
  return allInstalled;
}

/**
 * Check environment variables
 */
function checkEnvironment() {
  console.log('\n🔐 Checking environment...');
  
  const envFile = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envFile)) {
    CHECKS.warnings.push('.env file not found');
    console.log('   ⚠️  .env file not found');
    console.log('      Run: cp .env.demo .env');
    return false;
  }
  
  require('dotenv').config({ path: envFile });
  
  const required = {
    'SLACK_BOT_TOKEN': 'Slack bot token',
    'ASANA_PAT': 'Asana personal access token'
  };
  
  let allSet = true;
  
  for (const [key, desc] of Object.entries(required)) {
    if (process.env[key] && process.env[key] !== `your-${key.toLowerCase()}-here`) {
      CHECKS.passed.push(`Env var: ${key}`);
      console.log(`   ✅ ${key} (set)`);
    } else {
      CHECKS.failed.push(`Missing: ${key}`);
      console.log(`   ❌ ${key} (not set)`);
      console.log(`      Add ${desc} to .env`);
      allSet = false;
    }
  }
  
  return allSet;
}

/**
 * Check Google credentials
 */
function checkGoogleCredentials() {
  console.log('\n🔑 Checking Google OAuth...');
  
  const configDir = path.join(__dirname, 'config');
  const credsPath = path.join(configDir, 'google-credentials.json');
  const tokenPath = path.join(configDir, 'google-token.json');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    CHECKS.warnings.push('config/ directory created');
  }
  
  if (!fs.existsSync(credsPath)) {
    CHECKS.failed.push('Google credentials not found');
    console.log('   ❌ google-credentials.json not found');
    console.log('      Download from: https://console.cloud.google.com/apis/credentials');
    console.log('      Save to: config/google-credentials.json');
    return false;
  } else {
    CHECKS.passed.push('Google credentials file exists');
    console.log('   ✅ google-credentials.json (found)');
  }
  
  if (!fs.existsSync(tokenPath)) {
    CHECKS.warnings.push('Google token not generated yet');
    console.log('   ⚠️  google-token.json not found');
    console.log('      Run: node setup-google-auth.js');
    return false;
  } else {
    CHECKS.passed.push('Google OAuth token exists');
    console.log('   ✅ google-token.json (found)');
  }
  
  return true;
}

/**
 * Check scripts are executable
 */
function checkScripts() {
  console.log('\n📜 Checking scripts...');
  
  const scripts = [
    'setup-demo-infrastructure.js',
    'setup-google-auth.js',
    'test-infrastructure.js',
    'create-slack-channel.sh'
  ];
  
  let allExecutable = true;
  
  for (const script of scripts) {
    const scriptPath = path.join(__dirname, script);
    
    if (!fs.existsSync(scriptPath)) {
      CHECKS.failed.push(`Script missing: ${script}`);
      console.log(`   ❌ ${script} (not found)`);
      allExecutable = false;
      continue;
    }
    
    try {
      fs.accessSync(scriptPath, fs.constants.X_OK);
      CHECKS.passed.push(`Script: ${script}`);
      console.log(`   ✅ ${script} (executable)`);
    } catch {
      CHECKS.warnings.push(`Script not executable: ${script}`);
      console.log(`   ⚠️  ${script} (not executable)`);
      console.log(`      Run: chmod +x ${script}`);
      allExecutable = false;
    }
  }
  
  return allExecutable;
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Passed: ${CHECKS.passed.length} checks`);
  console.log(`❌ Failed: ${CHECKS.failed.length} checks`);
  console.log(`⚠️  Warnings: ${CHECKS.warnings.length} items`);
  
  if (CHECKS.failed.length === 0 && CHECKS.warnings.length === 0) {
    console.log('\n🎉 Everything is ready!');
    console.log('\n   Next step:');
    console.log('   → node setup-demo-infrastructure.js');
    return true;
  } else if (CHECKS.failed.length === 0) {
    console.log('\n⚠️  Setup incomplete but can proceed:');
    CHECKS.warnings.forEach(w => console.log(`   - ${w}`));
    console.log('\n   Address warnings above before proceeding.');
    return false;
  } else {
    console.log('\n❌ Setup not ready. Fix these issues:');
    CHECKS.failed.forEach(f => console.log(`   - ${f}`));
    if (CHECKS.warnings.length > 0) {
      console.log('\n⚠️  Also note:');
      CHECKS.warnings.forEach(w => console.log(`   - ${w}`));
    }
    return false;
  }
}

/**
 * Print next steps
 */
function printNextSteps() {
  console.log('\n📖 NEXT STEPS:');
  console.log('='.repeat(60));
  
  if (CHECKS.failed.length > 0 || CHECKS.warnings.length > 0) {
    console.log('\n1. Fix issues listed above');
    console.log('2. Re-run: node verify-setup.js');
    console.log('3. When all checks pass, run: node setup-demo-infrastructure.js');
  } else {
    console.log('\n✅ All checks passed!');
    console.log('\n1. Run automated setup:');
    console.log('   → node setup-demo-infrastructure.js');
    console.log('\n2. Configure Zapier (manual):');
    console.log('   → See ZAPIER-SETUP-GUIDE.md');
    console.log('\n3. Test the pipeline:');
    console.log('   → node test-infrastructure.js');
  }
  
  console.log('\n📚 For help, see:');
  console.log('   - START-HERE.md (quick navigation)');
  console.log('   - QUICK-START.md (fast setup)');
  console.log('   - DEMO-SETUP.md (complete guide)');
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main
 */
function main() {
  let allPassed = true;
  
  allPassed = checkNodeVersion() && allPassed;
  allPassed = checkDependencies() && allPassed;
  allPassed = checkEnvironment() && allPassed;
  allPassed = checkGoogleCredentials() && allPassed;
  allPassed = checkScripts() && allPassed;
  
  printSummary();
  printNextSteps();
  
  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { checkNodeVersion, checkDependencies, checkEnvironment };

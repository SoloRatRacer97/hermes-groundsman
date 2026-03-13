#!/usr/bin/env node

/**
 * Gaius Hermes Responder
 * Helper for Gaius to respond to Hermes puppeteer requests
 * Monitors request directory and provides easy response interface
 */

const fs = require('fs');
const path = require('path');

const requestDir = path.join(__dirname, '.gaius-requests');
const responseDir = path.join(__dirname, '.gaius-responses');

/**
 * List pending Hermes requests
 */
function listRequests() {
  if (!fs.existsSync(requestDir)) {
    console.log('No requests directory found.');
    return;
  }
  
  const files = fs.readdirSync(requestDir);
  
  if (files.length === 0) {
    console.log('No pending Hermes requests.');
    return;
  }
  
  console.log(`\n📋 ${files.length} Pending Hermes Request(s):\n`);
  
  files.forEach((file, index) => {
    const filePath = path.join(requestDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const age = Math.round((Date.now() - data.timestamp) / 1000);
    
    console.log(`${index + 1}. Request ID: ${data.requestId}`);
    console.log(`   Age: ${age} seconds`);
    console.log(`   Lead: ${data.session.name}`);
    console.log(`   Service: ${data.session.serviceType}`);
    console.log(`   Lead said: "${data.message}"`);
    console.log('');
  });
}

/**
 * Show full request details
 */
function showRequest(requestId) {
  const filePath = path.join(requestDir, `${requestId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Request ${requestId} not found.`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  console.log('\n' + '='.repeat(80));
  console.log('HERMES PUPPETEER REQUEST');
  console.log('='.repeat(80));
  console.log(data.prompt);
  console.log('='.repeat(80));
  console.log(`\nRequest ID: ${data.requestId}`);
  console.log(`Timestamp: ${new Date(data.timestamp).toISOString()}`);
  console.log('');
}

/**
 * Respond to a request
 */
function respond(requestId, responseText) {
  const requestFile = path.join(requestDir, `${requestId}.json`);
  
  if (!fs.existsSync(requestFile)) {
    console.log(`Request ${requestId} not found.`);
    return;
  }
  
  // Ensure response directory exists
  if (!fs.existsSync(responseDir)) {
    fs.mkdirSync(responseDir, { recursive: true });
  }
  
  // Write response
  const responseFile = path.join(responseDir, `${requestId}.txt`);
  fs.writeFileSync(responseFile, responseText, 'utf8');
  
  console.log(`\n✅ Response saved for request ${requestId}`);
  console.log(`Response: "${responseText}"`);
  console.log('');
  
  // Clean up request file
  fs.unlinkSync(requestFile);
  console.log('Request file cleaned up.');
}

/**
 * Monitor for new requests (watch mode)
 */
function watch() {
  console.log('\n👀 Watching for Hermes requests...');
  console.log('Press Ctrl+C to stop.\n');
  
  // Ensure directory exists
  if (!fs.existsSync(requestDir)) {
    fs.mkdirSync(requestDir, { recursive: true });
  }
  
  let lastCheck = Date.now();
  
  setInterval(() => {
    const files = fs.readdirSync(requestDir);
    
    files.forEach(file => {
      const filePath = path.join(requestDir, file);
      const stats = fs.statSync(filePath);
      
      // Only show new files since last check
      if (stats.mtimeMs > lastCheck) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log('\n' + '🔔 NEW HERMES REQUEST '.padEnd(80, '='));
        console.log(`Request ID: ${data.requestId}`);
        console.log(`Lead: ${data.session.name}`);
        console.log(`Lead said: "${data.message}"`);
        console.log('\nTo view full prompt:');
        console.log(`  node gaius-hermes-responder.js show ${data.requestId}`);
        console.log('\nTo respond:');
        console.log(`  node gaius-hermes-responder.js respond ${data.requestId} "your message here"`);
        console.log('='.repeat(80) + '\n');
      }
    });
    
    lastCheck = Date.now();
  }, 1000);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'list') {
  listRequests();
} else if (command === 'show') {
  const requestId = args[1];
  if (!requestId) {
    console.log('Usage: node gaius-hermes-responder.js show <requestId>');
  } else {
    showRequest(requestId);
  }
} else if (command === 'respond') {
  const requestId = args[1];
  const responseText = args.slice(2).join(' ');
  
  if (!requestId || !responseText) {
    console.log('Usage: node gaius-hermes-responder.js respond <requestId> "your response text"');
  } else {
    respond(requestId, responseText);
  }
} else if (command === 'watch') {
  watch();
} else {
  console.log(`
Gaius Hermes Responder - Helper for responding to Hermes requests

Commands:
  list                         List pending requests (default)
  show <requestId>             Show full request details
  respond <requestId> "text"   Respond to a request
  watch                        Watch for new requests in real-time

Examples:
  node gaius-hermes-responder.js
  node gaius-hermes-responder.js show req_1234567890_abc123
  node gaius-hermes-responder.js respond req_1234567890_abc123 "k got it. someone will call you soon"
  node gaius-hermes-responder.js watch
`);
}

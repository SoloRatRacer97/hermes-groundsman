#!/usr/bin/env node
/**
 * Google OAuth Setup Helper
 * Gets OAuth token for Google Forms API access
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/drive'
];

const CONFIG_DIR = path.join(__dirname, 'config');
const CREDENTIALS_PATH = path.join(CONFIG_DIR, 'google-credentials.json');
const TOKEN_PATH = path.join(CONFIG_DIR, 'google-token.json');

/**
 * Get OAuth2 client
 */
function getOAuthClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Error: google-credentials.json not found!');
    console.log('\n📖 To get credentials:');
    console.log('   1. Go to: https://console.cloud.google.com/apis/credentials');
    console.log('   2. Create OAuth 2.0 Client ID (Desktop app)');
    console.log('   3. Download JSON and save as config/google-credentials.json');
    console.log('   4. Enable Google Forms API in your project\n');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

/**
 * Get access token
 */
async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('🔐 Authorize this app by visiting this URL:\n');
  console.log(authUrl);
  console.log('\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        
        // Ensure config directory exists
        if (!fs.existsSync(CONFIG_DIR)) {
          fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        
        // Store the token
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
        console.log('\n✅ Token stored to:', TOKEN_PATH);
        resolve(token);
      });
    });
  });
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Google OAuth Setup for Hermes Demo\n');

  try {
    const oAuth2Client = getOAuthClient();

    if (fs.existsSync(TOKEN_PATH)) {
      console.log('⚠️  Token file already exists!');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise(resolve => {
        rl.question('Do you want to re-authenticate? (y/N): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('✅ Using existing token.');
        process.exit(0);
      }
    }

    await getAccessToken(oAuth2Client);
    console.log('\n🎉 Google authentication complete!');
    console.log('   You can now run: node setup-demo-infrastructure.js\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

#!/usr/bin/env node
/**
 * Test Suite — SMS Adapter & Fallback Logic
 */

require('dotenv').config();
const assert = require('assert');

// Mock Twilio before requiring sms-adapter
let mockCreateArgs = null;
let mockCreateResult = { sid: 'SM_TEST_123' };
let mockCreateError = null;

// Override require for twilio
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent) {
  if (request === 'twilio') {
    return request; // skip resolution
  }
  return origResolve.apply(this, arguments);
};

require.cache['twilio'] = {
  id: 'twilio',
  filename: 'twilio',
  loaded: true,
  exports: function (sid, token) {
    return {
      messages: {
        create: async (args) => {
          mockCreateArgs = args;
          if (mockCreateError) throw mockCreateError;
          return mockCreateResult;
        },
      },
    };
  },
};

const { sendSMS, canSendSMS, _resetClient } = require('./src/sms-adapter');
const { RateLimiter, defaultLimiter } = require('./src/rate-limiter');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    _resetClient();
    mockCreateArgs = null;
    mockCreateError = null;
    defaultLimiter.reset();
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

(async () => {
  console.log('\n📱 SMS Adapter Tests\n');

  // --- canSendSMS ---
  await test('canSendSMS returns true when all env vars set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    assert.strictEqual(canSendSMS(), true);
  });

  await test('canSendSMS returns false when SID missing', () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    assert.strictEqual(canSendSMS(), false);
    process.env.TWILIO_ACCOUNT_SID = 'ACtest'; // restore
  });

  // --- sendSMS success ---
  await test('sendSMS returns SID on success', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    const sid = await sendSMS('+15551234567', 'Hello test');
    assert.strictEqual(sid, 'SM_TEST_123');
    assert.strictEqual(mockCreateArgs.to, '+15551234567');
    assert.strictEqual(mockCreateArgs.body, 'Hello test');
    assert.strictEqual(mockCreateArgs.from, '+1234567890');
  });

  // --- sendSMS error handling ---
  await test('sendSMS returns null on Twilio error', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    mockCreateError = { code: 21211, message: 'Invalid phone number' };
    const sid = await sendSMS('+1invalid', 'Test');
    assert.strictEqual(sid, null);
  });

  // --- sendSMS without credentials ---
  await test('sendSMS returns null when credentials missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const sid = await sendSMS('+15551234567', 'Test');
    assert.strictEqual(sid, null);
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
  });

  // --- Rate limiting ---
  await test('sendSMS respects rate limiter', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    const phone = '+15559999999';
    // Fill up rate limit (default 5/hr)
    for (let i = 0; i < 5; i++) {
      await sendSMS(phone, `msg ${i}`);
    }
    // 6th should be rate limited
    const sid = await sendSMS(phone, 'should be blocked');
    assert.strictEqual(sid, null);
  });

  // --- Audit logging ---
  await test('sendSMS writes audit log entry', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    const date = new Date().toISOString().split('T')[0];
    const logPath = path.join(__dirname, 'logs', `security-audit-${date}.jsonl`);
    const beforeSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
    await sendSMS('+15550001111', 'Audit test');
    const afterSize = fs.statSync(logPath).size;
    assert(afterSize > beforeSize, 'Audit log should have grown');
    // Check last line
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(last.type, 'sms_send');
    assert.strictEqual(last.status, 'success');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();

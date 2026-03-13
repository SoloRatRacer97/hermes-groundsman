#!/usr/bin/env node
/**
 * Tests for iMessage delivery detection + channel cache
 */

const assert = require('assert');

// --- Channel Cache Tests ---
console.log('\n=== Channel Cache Tests ===\n');

// Fresh require (clear any state)
const channelCache = require('./src/channel-cache');
channelCache.clear();

// Test: empty cache returns null
assert.strictEqual(channelCache.get('+15551234567'), null, 'Empty cache should return null');
assert.strictEqual(channelCache.has('+15551234567'), false, 'Empty cache has() should be false');
console.log('✅ Empty cache returns null');

// Test: set and get
channelCache.set('+15551234567', 'imessage');
assert.strictEqual(channelCache.get('+15551234567'), 'imessage', 'Should return imessage after set');
assert.strictEqual(channelCache.has('+15551234567'), true, 'has() should be true after set');
console.log('✅ Set and get works');

// Test: overwrite
channelCache.set('+15551234567', 'sms');
assert.strictEqual(channelCache.get('+15551234567'), 'sms', 'Should return sms after overwrite');
console.log('✅ Overwrite works');

// Test: multiple entries
channelCache.set('+15559999999', 'imessage');
assert.strictEqual(channelCache.get('+15559999999'), 'imessage');
assert.strictEqual(channelCache.get('+15551234567'), 'sms');
console.log('✅ Multiple entries work');

// Test: getAll
const all = channelCache.getAll();
assert.strictEqual(Object.keys(all).length, 2);
console.log('✅ getAll returns all entries');

// Test: clear
channelCache.clear();
assert.strictEqual(channelCache.get('+15551234567'), null);
assert.strictEqual(channelCache.has('+15551234567'), false);
console.log('✅ Clear works');

// --- Delivery Detector Module Shape Tests ---
console.log('\n=== Detector Module Shape Tests ===\n');

const detector = require('./src/imessage-detector');
assert.strictEqual(typeof detector.checkDelivery, 'function', 'checkDelivery should be a function');
assert.strictEqual(typeof detector.isIMessageUser, 'function', 'isIMessageUser should be a function');
console.log('✅ Module exports correct functions');

// --- Mock Delivery Timeout Test ---
console.log('\n=== Delivery Timeout Test ===\n');

(async () => {
  // checkDelivery with a fake number should timeout and return not delivered
  // Using a very short timeout so test runs fast
  const start = Date.now();
  const result = await detector.checkDelivery('+10000000000', 2000);
  const elapsed = Date.now() - start;

  assert.strictEqual(result.delivered, false, 'Fake number should not be delivered');
  assert.strictEqual(result.service, 'unknown', 'Service should be unknown for undelivered');
  assert(elapsed >= 1500, `Should have waited ~2s, waited ${elapsed}ms`);
  assert(elapsed < 5000, `Should not wait more than 5s, waited ${elapsed}ms`);
  console.log(`✅ Timeout works correctly (waited ${elapsed}ms for 2000ms timeout)`);

  console.log('\n✅ All tests passed!\n');
})().catch(e => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});

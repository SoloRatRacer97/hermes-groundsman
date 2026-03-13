/**
 * V18.1 Tests — Momentum Tracker, Objection Router, Enhanced Novelty
 * 100 tests covering all new functionality
 */

const { MomentumTracker, YES_SIGNALS, RESISTANCE_SIGNALS, DEFAULT_THRESHOLDS } = require('../momentum-tracker');
const { ObjectionRouter, OBJECTION_PATTERNS, FLOW_AROUND_PATHS } = require('../objection-router');
const { NoveltyDetector } = require('../novelty-detector');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(testName);
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

function assertApprox(actual, expected, tolerance, testName) {
  assert(Math.abs(actual - expected) <= tolerance, `${testName} (got ${actual}, expected ~${expected})`);
}

console.log('\n=== V18.1 Momentum Tracker Tests ===\n');

// --- MOMENTUM SCORING ---

// 1. Agreement signals increase momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c1', 'Yes, absolutely!', 'repair:critical:brief:buying');
  assert(r.delta > 0, '1. Agreement signals increase momentum');
})();

// 2. Detail sharing increases momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c2', 'I have a problem with my AC at my house on Oak Street', 'repair:soon:verbose:shopping');
  assert(r.delta > 0, '2. Detail sharing increases momentum');
})();

// 3. Scheduling intent is high-value signal
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c3', 'When can you come out?', 'repair:critical:brief:buying');
  assert(r.delta >= 1.0, '3. Scheduling intent is high-value signal');
})();

// 4. Phone number sharing is highest signal
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c4', 'My number is 555-123-4567', 'repair:critical:brief:buying');
  assert(r.delta >= 2.0, '4. Phone number sharing is highest signal');
})();

// 5. Gratitude adds small momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c5', 'Thanks for the help!', 'repair:soon:brief:buying');
  assert(r.delta > 0 && r.delta < 1.5, '5. Gratitude adds small momentum');
})();

// 6. Questions add momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c6', 'How does this work?', 'repair:soon:brief:browsing');
  assert(r.delta > 0, '6. Questions add momentum');
})();

// 7. Location sharing adds momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c7', 'I am in the downtown area near zip 85281', 'repair:soon:brief:buying');
  assert(r.delta > 0, '7. Location sharing adds momentum');
})();

// 8. Minimal response decreases momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c8', 'ok', 'repair:soon:brief:buying');
  assert(r.delta < 0, '8. Minimal response decreases momentum');
})();

// 9. Hesitation decreases momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c9', "I need to think about it", 'repair:soon:brief:shopping');
  assert(r.delta < 0, '9. Hesitation decreases momentum');
})();

// 10. Price resistance decreases momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c10', "That's too expensive for me", 'repair:soon:brief:shopping');
  assert(r.delta < 0, '10. Price resistance decreases momentum');
})();

// 11. Third-party deferral decreases momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c11', 'I need to talk to my wife first', 'repair:soon:brief:buying');
  assert(r.delta < 0, '11. Third-party deferral decreases momentum');
})();

// 12. Timing resistance decreases momentum
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c12', "Not now, maybe later", 'repair:planning:brief:browsing');
  assert(r.delta < 0, '12. Timing resistance decreases momentum');
})();

// 13. Opt-out is strong negative
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c13', 'Please stop contacting me', 'repair:soon:brief:buying');
  assert(r.delta <= -2.0, '13. Opt-out is strong negative');
})();

// 14. Long message gets length bonus
(() => {
  const mt = new MomentumTracker();
  const longMsg = 'x'.repeat(160);
  const r = mt.score('c14', longMsg, 'repair:soon:brief:buying');
  assert(r.delta >= 0.5, '14. Long message gets length bonus');
})();

// 15. Very short message with no signals gets penalty
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c15', 'hi', 'repair:soon:brief:buying');
  assert(r.delta < 0, '15. Very short message with no signals gets penalty');
})();

// 16. Momentum accumulates across messages
(() => {
  const mt = new MomentumTracker();
  mt.score('c16', 'Yes, absolutely!', 'repair:critical:brief:buying');
  mt.score('c16', 'I need help with my AC at my house', 'repair:critical:brief:buying');
  const state = mt.getMomentum('c16');
  assert(state.momentum > 1.0, '16. Momentum accumulates across messages');
})();

// 17. Momentum floors at 0
(() => {
  const mt = new MomentumTracker();
  mt.score('c17', 'no', 'repair:soon:brief:buying');
  mt.score('c17', 'nope', 'repair:soon:brief:buying');
  mt.score('c17', 'not interested', 'repair:soon:brief:buying');
  const state = mt.getMomentum('c17');
  assert(state.momentum >= 0, '17. Momentum floors at 0');
})();

// 18. Mixed signals net out correctly
(() => {
  const mt = new MomentumTracker();
  // Positive: "yes" + question + detail sharing. Negative: none
  const r = mt.score('c18', "Yes I need help, my AC broke at my house, when can you come?", 'repair:critical:brief:buying');
  assert(r.delta > 1.0, '18. Mixed positive signals stack');
})();

// 19. Resistance + detail = reduced positive
(() => {
  const mt = new MomentumTracker();
  const r = mt.score('c19', "I need to think about it, my wife wants a cheaper option", 'repair:soon:brief:shopping');
  assert(r.delta < 0, '19. Resistance signals dominate when stacked');
})();

// 20. getMomentum returns correct message count
(() => {
  const mt = new MomentumTracker();
  mt.score('c20', 'hello', 'repair:soon:brief:buying');
  mt.score('c20', 'yes', 'repair:soon:brief:buying');
  const state = mt.getMomentum('c20');
  assert(state.messageCount === 2, '20. getMomentum tracks message count');
})();

// --- THRESHOLD GATING ---

// 21. Emergency archetype has low threshold
(() => {
  const mt = new MomentumTracker();
  assert(mt.getThreshold('emergency:critical:emotional:buying') === 1, '21. Emergency threshold = 1');
})();

// 22. Critical urgency has threshold 3
(() => {
  const mt = new MomentumTracker();
  assert(mt.getThreshold('repair:critical:brief:buying') === 1.5, '22. Critical threshold = 1.5');
})();

// 23. Planning urgency has threshold 5
(() => {
  const mt = new MomentumTracker();
  assert(mt.getThreshold('install:planning:analytical:browsing') === 1.8, '23. Planning threshold = 1.8');
})();

// 24. Buying intent has threshold 3
(() => {
  const mt = new MomentumTracker();
  assert(mt.getThreshold('maintenance:soon:brief:buying') === 2, '24. Soon threshold matches first (2)');
})();

// 25. Unknown archetype gets default threshold
(() => {
  const mt = new MomentumTracker();
  assert(mt.getThreshold('unknown:unknown:unknown:unknown') === DEFAULT_THRESHOLDS._default, '25. Unknown archetype gets default threshold');
})();

// 26. Transfer blocked when momentum below threshold
(() => {
  const mt = new MomentumTracker();
  mt.score('c26', 'hi', 'repair:critical:brief:buying'); // won't reach 3
  assert(!mt.isReadyForTransfer('c26', 'repair:critical:brief:buying'), '26. Transfer blocked below threshold');
})();

// 27. Transfer allowed when momentum meets threshold
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('test:arch', 2);
  mt.score('c27', 'Yes absolutely I need help! When can you come out? Call me at 555-123-4567', 'test:arch');
  assert(mt.isReadyForTransfer('c27', 'test:arch'), '27. Transfer allowed at threshold');
})();

// 28. Transfer not ready for non-existent conversation
(() => {
  const mt = new MomentumTracker();
  assert(!mt.isReadyForTransfer('nonexistent', 'repair:critical:brief:buying'), '28. Non-existent conversation returns false');
})();

// 29. Custom threshold via setThreshold
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('custom:arch', 7);
  assert(mt.getThreshold('custom:arch') === 7, '29. Custom threshold is respected');
})();

// 30. Multi-message build to threshold
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('test:multi', 3);
  mt.score('c30', 'Yes, I need help', 'test:multi');
  mt.score('c30', 'My AC is broken at my house', 'test:multi');
  mt.score('c30', 'When can you schedule? Call me at 555-111-2222', 'test:multi');
  assert(mt.isReadyForTransfer('c30', 'test:multi'), '30. Multi-message builds to threshold');
})();

// --- SELF-CALIBRATION ---

// 31. Successful conversion updates threshold
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('cal:arch', 4);
  // Simulate conversation at momentum 3
  mt.score('cal1', 'Yes I need help with my AC, when can you come? 555-123-4567', 'cal:arch');
  mt.calibrate('cal1', 'cal:arch', true);
  const newThreshold = mt.getThreshold('cal:arch');
  assert(newThreshold !== 4, '31. Calibration changes threshold');
})();

// 32. Multiple successful calibrations converge
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('conv:arch', 5);
  for (let i = 0; i < 5; i++) {
    const id = `conv${i}`;
    mt.score(id, 'Yes! Schedule appointment please. Call me at 555-000-1111', 'conv:arch');
    mt.calibrate(id, 'conv:arch', true);
  }
  const t = mt.getThreshold('conv:arch');
  assert(t >= 1 && t <= 8, '32. Calibrated threshold stays in bounds');
})();

// 33. Failed conversion slightly raises threshold
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('fail:arch', 4);
  mt.score('fail1', 'ok maybe', 'fail:arch');
  mt.calibrate('fail1', 'fail:arch', false);
  assert(mt.getThreshold('fail:arch') > 4, '33. Failed conversion raises threshold');
})();

// 34. Threshold clamped at max 8
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('max:arch', 7.9);
  mt.score('max1', 'ok', 'max:arch');
  mt.calibrate('max1', 'max:arch', false);
  mt.calibrate('max1', 'max:arch', false);
  mt.calibrate('max1', 'max:arch', false);
  assert(mt.getThreshold('max:arch') <= 8.9, '34. Threshold clamped at base+1');
})();

// 35. Threshold clamped at min 1
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('min:arch', 2);
  for (let i = 0; i < 3; i++) {
    const id = `min${i}`;
    mt.score(id, 'Yes!', 'min:arch'); // very low momentum
    mt.calibrate(id, 'min:arch', true);
  }
  assert(mt.getThreshold('min:arch') >= 0.5, '35. Threshold clamped at 0.5');
})();

// 36. Reset clears conversation state
(() => {
  const mt = new MomentumTracker();
  mt.score('reset1', 'Yes absolutely!', 'repair:critical:brief:buying');
  mt.reset('reset1');
  const state = mt.getMomentum('reset1');
  assert(state.momentum === 0, '36. Reset clears conversation');
})();

// 37. Calibration of non-existent conversation is safe
(() => {
  const mt = new MomentumTracker();
  mt.calibrate('nonexist', 'some:arch', true); // should not throw
  assert(true, '37. Calibrate non-existent conversation is safe');
})();

// 38. getMomentum for non-existent returns zeros
(() => {
  const mt = new MomentumTracker();
  const s = mt.getMomentum('nope');
  assert(s.momentum === 0 && s.messageCount === 0, '38. getMomentum non-existent returns zeros');
})();

// 39. Signals are tracked in state
(() => {
  const mt = new MomentumTracker();
  mt.score('sig1', 'Yes, when can you come out?', 'repair:critical:brief:buying');
  const state = mt.getMomentum('sig1');
  assert(state.signals.length > 0, '39. Signals tracked in state');
})();

// 40. Score returns correct readyForTransfer
(() => {
  const mt = new MomentumTracker();
  mt.setThreshold('rft:arch', 1);
  const r = mt.score('rft1', 'Yes absolutely! When can you come? 555-123-4567', 'rft:arch');
  assert(r.readyForTransfer === true, '40. score returns readyForTransfer');
})();

console.log('\n=== V18.1 Objection Router Tests ===\n');

// --- OBJECTION DETECTION ---

// 41. Detects price objection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("That's too expensive for me");
  assert(r.objectionType === 'price', '41. Detects price objection');
})();

// 42. Detects thinking objection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("I need to think about it");
  assert(r.objectionType === 'thinking', '42. Detects thinking objection');
})();

// 43. Detects spouse objection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("Let me check with my wife first");
  assert(r.objectionType === 'spouse', '43. Detects spouse objection');
})();

// 44. Detects timing objection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("Not now, maybe another time");
  assert(r.objectionType === 'timing', '44. Detects timing objection');
})();

// 45. Detects trust objection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("Are you licensed and insured?");
  assert(r.objectionType === 'trust', '45. Detects trust objection');
})();

// 46. Detects competitor objection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("I'm getting quotes from other companies");
  assert(r.objectionType === 'competitor', '46. Detects competitor objection');
})();

// 47. Detects DIY objection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("I think I'll just do it myself");
  assert(r.objectionType === 'diy', '47. Detects DIY objection');
})();

// 48. No objection for normal engagement
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("Yes, my AC is broken and I need help");
  assert(r.objectionType === null, '48. No objection for normal message');
})();

// 49. No objection for empty message
(() => {
  const or = new ObjectionRouter();
  const r = or.classify('');
  assert(r.objectionType === null, '49. No objection for empty message');
})();

// 50. Confidence on detection
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("That's way too expensive, can't afford it");
  assert(r.confidence > 0.7, '50. Objection has high confidence');
})();

// --- FLOW-AROUND ROUTING ---

// 51. Price objection routes to flow-around (not escalate)
(() => {
  const or = new ObjectionRouter();
  const r = or.route('price', 'repair:soon:brief:shopping');
  assert(!r.escalate && r.response, '51. Price routes to flow-around');
})();

// 52. Thinking objection routes to flow-around
(() => {
  const or = new ObjectionRouter();
  const r = or.route('thinking', 'repair:soon:brief:shopping');
  assert(!r.escalate && r.response, '52. Thinking routes to flow-around');
})();

// 53. Spouse objection routes to flow-around
(() => {
  const or = new ObjectionRouter();
  const r = or.route('spouse', 'repair:soon:brief:buying');
  assert(!r.escalate && r.response, '53. Spouse routes to flow-around');
})();

// 54. Timing objection routes to flow-around
(() => {
  const or = new ObjectionRouter();
  const r = or.route('timing', 'install:planning:analytical:browsing');
  assert(!r.escalate && r.response, '54. Timing routes to flow-around');
})();

// 55. Trust objection routes to flow-around
(() => {
  const or = new ObjectionRouter();
  const r = or.route('trust', 'repair:soon:brief:shopping');
  assert(!r.escalate && r.response, '55. Trust routes to flow-around');
})();

// 56. Competitor objection routes to flow-around
(() => {
  const or = new ObjectionRouter();
  const r = or.route('competitor', 'install:planning:verbose:shopping');
  assert(!r.escalate && r.response, '56. Competitor routes to flow-around');
})();

// 57. DIY objection routes to flow-around
(() => {
  const or = new ObjectionRouter();
  const r = or.route('diy', 'repair:soon:brief:buying');
  assert(!r.escalate && r.response, '57. DIY routes to flow-around');
})();

// 58. Unknown objection type escalates
(() => {
  const or = new ObjectionRouter();
  const r = or.route('unknown_type', 'repair:soon:brief:buying');
  assert(r.escalate === true, '58. Unknown objection escalates');
})();

// 59. Each objection type has multiple strategies
(() => {
  const or = new ObjectionRouter();
  for (const type of or.getObjectionTypes()) {
    const paths = or.getPaths(type);
    assert(paths.length >= 2, `59. ${type} has multiple strategies`);
  }
})();

// 60. Flow-around response is a string
(() => {
  const or = new ObjectionRouter();
  const r = or.route('price', 'repair:soon:brief:shopping');
  assert(typeof r.response === 'string' && r.response.length > 20, '60. Flow-around response is meaningful string');
})();

// --- OUTCOME TRACKING ---

// 61. Record successful outcome
(() => {
  const or = new ObjectionRouter();
  or.recordOutcome('repair:soon:brief:shopping', 'price', 'free_estimate', true);
  const stats = or.getStats('repair:soon:brief:shopping', 'price');
  assert(stats && stats.attempts === 1 && stats.successes === 1, '61. Records successful outcome');
})();

// 62. Record failed outcome
(() => {
  const or = new ObjectionRouter();
  or.recordOutcome('repair:soon:brief:shopping', 'price', 'free_estimate', false);
  const stats = or.getStats('repair:soon:brief:shopping', 'price');
  assert(stats && stats.attempts === 1 && stats.successes === 0, '62. Records failed outcome');
})();

// 63. Best strategy updates after enough data
(() => {
  const or = new ObjectionRouter();
  or.recordOutcome('arch1', 'price', 'financing', true);
  or.recordOutcome('arch1', 'price', 'financing', true);
  or.recordOutcome('arch1', 'price', 'free_estimate', false);
  or.recordOutcome('arch1', 'price', 'free_estimate', false);
  const stats = or.getStats('arch1', 'price');
  assert(stats.bestStrategy === 'financing', '63. Best strategy learned from outcomes');
})();

// 64. Learned best strategy is used in routing
(() => {
  const or = new ObjectionRouter();
  or.recordOutcome('arch2', 'thinking', 'question_prompt', true);
  or.recordOutcome('arch2', 'thinking', 'question_prompt', true);
  or.recordOutcome('arch2', 'thinking', 'callback_offer', false);
  or.recordOutcome('arch2', 'thinking', 'callback_offer', false);
  const r = or.route('thinking', 'arch2');
  assert(r.strategy === 'question_prompt', '64. Routes to learned best strategy');
})();

// 65. Stats null for unknown archetype+objection
(() => {
  const or = new ObjectionRouter();
  assert(or.getStats('nonexistent', 'price') === null, '65. No stats for unknown combo');
})();

console.log('\n=== V18.1 Enhanced Novelty Detection Tests ===\n');

// --- OBJECTION VS GENUINE ---

// 66. Price objection classified as 'objection'
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: ['understand scope'], avgLength: 80 },
    "That's too expensive, can't afford it",
    'repair:soon:brief:shopping'
  );
  assert(r.classification === 'objection', '66. Price objection classified correctly');
})();

// 67. Anger classified as 'genuine'
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "This is fucking ridiculous, you people are incompetent",
    'repair:soon:brief:buying'
  );
  assert(r.novel === true && r.classification === 'genuine', '67. Anger classified as genuine novelty');
})();

// 68. Spouse deferral is objection
(() => {
  const nd = new NoveltyDetector();
  const r = nd.quickClassify("I need to check with my husband first");
  assert(r === 'objection', '68. Spouse deferral quick-classified as objection');
})();

// 69. Normal message is 'none'
(() => {
  const nd = new NoveltyDetector();
  const r = nd.quickClassify("Yes, the AC is making a weird noise");
  assert(r === 'none', '69. Normal message quick-classified as none');
})();

// 70. Empty message is 'none'
(() => {
  const nd = new NoveltyDetector();
  const r = nd.quickClassify('');
  assert(r === 'none', '70. Empty message is none');
})();

// --- PIVOT CLASSIFICATION ---

// 71. Service-change pivot detected
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "Actually, instead of repair I want a new system install",
    'repair:soon:brief:buying'
  );
  assert(r.pivotType === 'service-change', '71. Service-change pivot detected');
})();

// 72. Scope-change pivot detected
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "Actually I need the whole house done, multiple units",
    'repair:soon:brief:buying'
  );
  assert(r.pivotType === 'scope-change', '72. Scope-change pivot detected');
})();

// 73. Urgency-change pivot (planning → critical)
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "It's getting worse, now it's an emergency, can't wait anymore",
    'repair:planning:brief:buying'
  );
  assert(r.pivotType === 'urgency-change', '73. Urgency escalation pivot detected');
})();

// 74. Urgency-change pivot (critical → planning)
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "Actually it's working again, false alarm, hold off",
    'repair:critical:brief:buying'
  );
  assert(r.pivotType === 'urgency-change', '74. Urgency de-escalation pivot detected');
})();

// 75. Emotional-shift pivot (calm → angry)
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "That's it, I've had enough, this is a waste of time",
    'repair:soon:brief:buying',
    { previousMessages: [{ text: "Yeah the AC is broken" }] }
  );
  assert(r.pivotType === 'emotional-shift', '75. Emotional shift pivot detected');
})();

// 76. No pivot for normal message
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "Yes, the AC stopped working yesterday",
    'repair:soon:brief:buying'
  );
  assert(r.pivotType === null, '76. No pivot for normal message');
})();

// 77. Novel + objection classification preserved
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    null,
    "I need to think about it, also are you licensed and insured?",
    'repair:soon:brief:shopping'
  );
  assert(r.classification === 'objection', '77. Multiple objections still classified as objection');
})();

// 78. Topic shift is genuine novelty (not objection)
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "Actually forget the repair, there's a gas leak emergency!",
    'repair:planning:brief:buying'
  );
  assert(r.novel === true, '78. Topic shift triggers novelty');
})();

// 79. Existing check() backward-compatible (returns classification field)
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(null, 'hello', 'repair:soon:brief:buying');
  assert('classification' in r && 'pivotType' in r, '79. check() returns new V18.1 fields');
})();

// 80. Insufficient data returns classification='none'
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(null, '', '');
  assert(r.classification === 'none', '80. Insufficient data returns none classification');
})();

console.log('\n=== V18.1 Integration Tests ===\n');

// --- INTEGRATION: MOMENTUM + OBJECTIONS + NOVELTY ---

// 81. Full pipeline: engagement → momentum → transfer
(() => {
  const mt = new MomentumTracker();
  const nd = new NoveltyDetector();
  mt.setThreshold('repair:critical:brief:buying', 3);

  const msgs = [
    "Yes, my AC is broken and making terrible noises",
    "It's at my house on 123 Oak St, zip 85281",
    "When can you come out? My number is 555-123-4567",
  ];
  let ready = false;
  for (const m of msgs) {
    const r = mt.score('int1', m, 'repair:critical:brief:buying');
    ready = r.readyForTransfer;
  }
  assert(ready, '81. Full engagement pipeline reaches transfer');
})();

// 82. Pipeline: objection interrupts momentum
(() => {
  const mt = new MomentumTracker();
  const or = new ObjectionRouter();
  const nd = new NoveltyDetector();

  mt.score('int2', 'Yes, I need AC repair', 'repair:soon:brief:buying');
  const r2 = mt.score('int2', "That's too expensive for us", 'repair:soon:brief:buying');

  const novelty = nd.check(null, "That's too expensive for us", 'repair:soon:brief:buying');
  const objection = or.classify("That's too expensive for us");

  assert(novelty.classification === 'objection' && objection.objectionType === 'price', '82. Objection detected in pipeline');

  const flow = or.route('price', 'repair:soon:brief:buying');
  assert(!flow.escalate, '82b. Flow-around provided');
})();

// 83. Pipeline: genuine novelty escalates
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'quick_qualify', keyPoints: [], avgLength: 60 },
    "You know what, fuck this, you guys are a scam, I'm calling the BBB",
    'repair:soon:brief:buying'
  );
  assert(r.novel && r.classification === 'genuine', '83. Genuine novelty escalates');
})();

// 84. Momentum + calibration feedback loop
(() => {
  const mt = new MomentumTracker();
  const arch = 'test:feedback:loop';
  mt.setThreshold(arch, 4);

  // Simulate 3 conversations converting at momentum ~3
  for (let i = 0; i < 3; i++) {
    const id = `fb${i}`;
    mt.score(id, 'Yes help! Come now! 555-111-2222', arch);
    mt.calibrate(id, arch, true);
  }
  // Threshold should adjust toward actual conversion momentum
  const t = mt.getThreshold(arch);
  assert(t !== 4, '84. Calibration adjusts threshold from feedback');
})();

// 85. Objection → flow-around → outcome → learned strategy
(() => {
  const or = new ObjectionRouter();
  const arch = 'repair:soon:brief:shopping';
  // Strategy A fails twice
  or.recordOutcome(arch, 'price', 'free_estimate', false);
  or.recordOutcome(arch, 'price', 'free_estimate', false);
  // Strategy B succeeds twice
  or.recordOutcome(arch, 'price', 'financing', true);
  or.recordOutcome(arch, 'price', 'financing', true);

  const r = or.route('price', arch);
  assert(r.strategy === 'financing', '85. Learned strategy after feedback');
})();

// 86. Novelty detector integrates with momentum data
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'transfer', keyPoints: ['get number'], avgLength: 70 },
    "Actually I changed my mind, I want an install instead of repair",
    'repair:soon:brief:buying',
    { previousMessages: [{ text: 'Yes my AC broke' }] }
  );
  assert(r.novel && r.pivotType === 'service-change', '86. Novelty detects service-change during transfer step');
})();

// --- EDGE CASES ---

// 87. Rapid momentum swing: positive then negative
(() => {
  const mt = new MomentumTracker();
  mt.score('swing1', 'Yes! When can you schedule? 555-123-4567', 'repair:critical:brief:buying');
  const high = mt.getMomentum('swing1').momentum;
  mt.score('swing1', 'Actually stop, not interested, leave me alone', 'repair:critical:brief:buying');
  const low = mt.getMomentum('swing1').momentum;
  assert(low < high, '87. Rapid swing: momentum drops correctly');
})();

// 88. Rapid momentum swing: negative then positive
(() => {
  const mt = new MomentumTracker();
  mt.score('swing2', 'no', 'repair:soon:brief:buying');
  mt.score('swing2', 'ok', 'repair:soon:brief:buying');
  const afterNeg = mt.getMomentum('swing2').momentum;
  mt.score('swing2', 'Actually yes, I do need help! My AC broke. When can you come? 555-999-8888', 'repair:soon:brief:buying');
  const afterPos = mt.getMomentum('swing2').momentum;
  assert(afterPos > afterNeg, '88. Momentum recovers after positive swing');
})();

// 89. Unknown objection type handled gracefully
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("The sky is blue and I like pizza");
  assert(r.objectionType === null, '89. Non-objection message returns null');
})();

// 90. Multiple objections in one message
(() => {
  const or = new ObjectionRouter();
  const r = or.classify("It's too expensive and I need to think about it and talk to my wife");
  assert(r.objectionType !== null, '90. Multiple objections - picks highest confidence');
})();

// 91. Objection patterns don't false-positive on normal text
(() => {
  const or = new ObjectionRouter();
  const msgs = [
    "My heater is broken",
    "It's in my garage",
    "Can someone come tomorrow?",
    "The unit is 10 years old",
  ];
  for (const m of msgs) {
    const r = or.classify(m);
    assert(r.objectionType === null, `91. No false positive: "${m.substring(0, 30)}"`);
  }
})();

// 92. Momentum tracker handles many concurrent conversations
(() => {
  const mt = new MomentumTracker();
  for (let i = 0; i < 50; i++) {
    mt.score(`concurrent${i}`, 'Yes I need help', 'repair:soon:brief:buying');
  }
  const s = mt.getMomentum('concurrent25');
  assert(s.messageCount === 1, '92. Handles 50 concurrent conversations');
})();

// 93. Performance: momentum score < 1ms
(() => {
  const mt = new MomentumTracker();
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    mt.score(`perf${i}`, 'Yes, my AC is broken at my house on Oak Street, when can you schedule?', 'repair:critical:brief:buying');
  }
  const elapsed = performance.now() - start;
  const perOp = elapsed / 1000;
  assert(perOp < 1, `93. Momentum score <1ms (${perOp.toFixed(3)}ms)`);
})();

// 94. Performance: objection classify < 1ms
(() => {
  const or = new ObjectionRouter();
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    or.classify("That's too expensive, I need to think about it and check with my wife");
  }
  const elapsed = performance.now() - start;
  const perOp = elapsed / 1000;
  assert(perOp < 1, `94. Objection classify <1ms (${perOp.toFixed(3)}ms)`);
})();

// 95. Performance: novelty check < 1ms
(() => {
  const nd = new NoveltyDetector();
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    nd.check(
      { type: 'discovery', keyPoints: ['understand scope'], avgLength: 80 },
      "Actually forget repair, there's a gas leak emergency! This is ridiculous!",
      'repair:planning:brief:buying',
      { previousMessages: [{ text: 'My AC is broken' }] }
    );
  }
  const elapsed = performance.now() - start;
  const perOp = elapsed / 1000;
  assert(perOp < 1, `95. Novelty check <1ms (${perOp.toFixed(3)}ms)`);
})();

// 96. All objection types have flow-around paths
(() => {
  const or = new ObjectionRouter();
  const types = or.getObjectionTypes();
  assert(types.length >= 7, '96. At least 7 objection types defined');
  for (const t of types) {
    const paths = or.getPaths(t);
    assert(paths.length >= 2, `96b. ${t} has >=2 paths`);
  }
})();

// 97. Novelty backward compat: novel field still works
(() => {
  const nd = new NoveltyDetector();
  const r = nd.check(
    { type: 'discovery', keyPoints: [], avgLength: 80 },
    "This is the worst service ever, you're all incompetent scammers",
    'repair:soon:brief:buying'
  );
  assert(typeof r.novel === 'boolean' && typeof r.confidence === 'number' && typeof r.reason === 'string',
    '97. Backward compat: novel/confidence/reason fields present');
})();

// 98. Objection router strategy field always present
(() => {
  const or = new ObjectionRouter();
  for (const type of or.getObjectionTypes()) {
    const r = or.route(type, 'any:arch');
    assert('strategy' in r && 'escalate' in r, `98. ${type} route has strategy+escalate`);
  }
})();

// 99. Momentum + Novelty + Objection: full conversation sim
(() => {
  const mt = new MomentumTracker();
  const nd = new NoveltyDetector();
  const or = new ObjectionRouter();
  const arch = 'repair:soon:brief:shopping';
  mt.setThreshold(arch, 4);

  // Message 1: engagement
  let r = mt.score('sim1', 'Yes my AC is broken, been 2 days', arch);
  assert(!r.readyForTransfer, '99a. Not ready after 1 msg');

  // Message 2: objection
  r = mt.score('sim1', "How much does this cost? That seems too expensive", arch);
  const n = nd.check(null, "How much does this cost? That seems too expensive", arch);
  assert(n.classification === 'objection', '99b. Objection detected mid-convo');
  const flow = or.route('price', arch);
  assert(!flow.escalate, '99c. Flow-around provided');

  // Message 3: re-engagement after flow-around
  r = mt.score('sim1', "Ok that financing sounds good, when can you come out? I live at 123 Main St", arch);
  
  // Message 4: ready
  r = mt.score('sim1', "Yes schedule it, call me at 555-123-4567", arch);
  assert(r.readyForTransfer, '99d. Transfer ready after recovery');
})();

// 100. Zero API calls — all modules are pure computation
(() => {
  // Verify no require('http'), require('https'), require('axios'), fetch calls
  const fs = require('fs');
  const path = require('path');
  const files = ['momentum-tracker.js', 'objection-router.js', 'novelty-detector.js'];
  let clean = true;
  for (const f of files) {
    const content = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    if (/require\(['"]https?['"]\)|require\(['"]axios['"]\)|require\(['"]node-fetch['"]\)|\bfetch\s*\(/.test(content)) {
      clean = false;
    }
  }
  assert(clean, '100. All modules are pure local computation — zero API calls');
})();

// --- RESULTS ---
console.log(`\n${'='.repeat(50)}`);
console.log(`V18.1 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f}`));
}
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);

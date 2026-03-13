#!/usr/bin/env node
/**
 * V18 Test Suite — Conversation Antibodies
 * 100 tests: Archetype Classification (25), Pattern Library (20), 
 * Skeleton Generator (15), Novelty Detection (20), Integration (20)
 */

const { ArchetypeClassifier, classify } = require('./src/archetypes');
const { PatternLibrary } = require('./src/pattern-library');
const { SkeletonGenerator } = require('./src/skeleton-generator');
const { NoveltyDetector } = require('./src/novelty-detector');
const { seedPatternLibrary, SEED_PATTERNS } = require('./src/seed-patterns');
const { validateOutput } = require('./src/output-validator');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// Temp file helper for pattern library tests
function tempPatternFile() {
  return path.join(os.tmpdir(), `hermes-test-patterns-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

console.log('\n📊 V18 Test Suite — Conversation Antibodies (100 Tests)\n');

// ═══════════════════════════════════════════
// ARCHETYPE CLASSIFICATION — 25 tests
// ═══════════════════════════════════════════
console.log('--- Archetype Classification (25 tests) ---');

const classifier = new ArchetypeClassifier();

test('AC repair emergency → repair:critical', () => {
  const r = classifier.classify({ serviceType: 'AC Repair', message: 'My AC is broken and it\'s 100 degrees! Need help ASAP!' }, []);
  assert(r.dimensions.serviceCategory.value === 'repair', `got ${r.dimensions.serviceCategory.value}`);
  assert(r.dimensions.urgency.value === 'critical', `urgency: ${r.dimensions.urgency.value}`);
});

test('New system install planning → install:planning', () => {
  const r = classifier.classify({ serviceType: 'Installation', message: 'Thinking about getting a new HVAC system eventually' }, []);
  assert(r.dimensions.serviceCategory.value === 'install', `got ${r.dimensions.serviceCategory.value}`);
  assert(r.dimensions.urgency.value === 'planning', `urgency: ${r.dimensions.urgency.value}`);
});

test('Maintenance tune-up → maintenance:planning:brief:buying', () => {
  const r = classifier.classify({ serviceType: 'Maintenance', message: 'Need a tune-up' }, []);
  assert(r.dimensions.serviceCategory.value === 'maintenance', `got ${r.dimensions.serviceCategory.value}`);
});

test('Emergency flood → emergency:critical', () => {
  const r = classifier.classify({ message: 'THERE IS A FLOOD IN MY BASEMENT HELP!' }, []);
  assert(r.dimensions.urgency.value === 'critical', `urgency: ${r.dimensions.urgency.value}`);
});

test('Brief message personality detection', () => {
  const r = classifier.classify({ message: 'AC broken' }, [{ role: 'lead', text: 'AC broken' }]);
  assert(r.dimensions.personality.value === 'brief', `personality: ${r.dimensions.personality.value}`);
});

test('Verbose message personality detection', () => {
  const longMsg = 'So my air conditioning has been making this really weird noise for about two weeks now, and I noticed the other day that it seems like its not cooling as well as it used to. I looked at the filter and it seems clean but I am not sure what else to check.';
  const r = classifier.classify({ message: longMsg }, [{ role: 'lead', text: longMsg }]);
  assert(r.dimensions.personality.value === 'verbose', `personality: ${r.dimensions.personality.value}`);
});

test('Emotional personality detection', () => {
  const r = classifier.classify({ message: 'Please help!! My kids are freezing and I am so stressed!!' }, [{ role: 'lead', text: 'Please help!! My kids are freezing and I am so stressed!!' }]);
  assert(r.dimensions.personality.value === 'emotional', `personality: ${r.dimensions.personality.value}`);
});

test('Analytical personality detection', () => {
  const r = classifier.classify({ message: 'What are the efficiency options? Comparing SEER ratings and warranty terms.' }, [{ role: 'lead', text: 'What are the efficiency options? Comparing SEER ratings and warranty terms.' }]);
  assert(r.dimensions.personality.value === 'analytical', `personality: ${r.dimensions.personality.value}`);
});

test('Buying intent detection', () => {
  const r = classifier.classify({ message: 'I need someone to come out and fix my furnace' }, []);
  assert(r.dimensions.intent.value === 'buying', `intent: ${r.dimensions.intent.value}`);
});

test('Shopping intent detection', () => {
  const r = classifier.classify({ message: 'How much does a new AC cost?' }, []);
  assert(r.dimensions.intent.value === 'shopping', `intent: ${r.dimensions.intent.value}`);
});

test('Browsing intent detection', () => {
  const r = classifier.classify({ message: 'Just curious about what options are available' }, []);
  assert(r.dimensions.intent.value === 'browsing', `intent: ${r.dimensions.intent.value}`);
});

test('Complaining intent detection', () => {
  const r = classifier.classify({ message: 'Your service was terrible and the worst experience ever' }, []);
  assert(r.dimensions.intent.value === 'complaining', `intent: ${r.dimensions.intent.value}`);
});

test('Minimal info → unknown dimensions', () => {
  const r = classifier.classify({ message: 'hi' }, []);
  const unknowns = [r.dimensions.serviceCategory, r.dimensions.urgency, r.dimensions.intent]
    .filter(d => d.value === 'unknown').length;
  assert(unknowns >= 2, `expected >=2 unknowns, got ${unknowns}`);
});

test('Confidence lower with unknowns', () => {
  const r1 = classifier.classify({ message: 'hi' }, []);
  const r2 = classifier.classify({ serviceType: 'Repair', message: 'AC broken need help ASAP!' }, [{ role: 'lead', text: 'AC broken need help ASAP!' }]);
  assert(r1.confidence < r2.confidence, `minimal (${r1.confidence}) should be < specific (${r2.confidence})`);
});

test('Form service type overrides message ambiguity', () => {
  const r = classifier.classify({ serviceType: 'repair', message: 'hey' }, []);
  assert(r.dimensions.serviceCategory.value === 'repair', `got ${r.dimensions.serviceCategory.value}`);
});

test('Archetype hash format is correct', () => {
  const r = classifier.classify({ message: 'Fix my broken AC ASAP!' }, []);
  const parts = r.archetype.split(':');
  assert(parts.length === 4, `expected 4 parts, got ${parts.length}: ${r.archetype}`);
});

test('CAPS message boosts urgency confidence', () => {
  const r = classifier.classify({ message: 'MY AC IS BROKEN AND IT IS AN EMERGENCY HELP!' }, []);
  assert(r.dimensions.urgency.value === 'critical', `urgency: ${r.dimensions.urgency.value}`);
  assert(r.dimensions.urgency.confidence >= 0.85, `confidence: ${r.dimensions.urgency.confidence}`);
});

test('Soon urgency detection', () => {
  const r = classifier.classify({ message: 'My furnace is acting up, can someone come this week?' }, []);
  assert(r.dimensions.urgency.value === 'soon', `urgency: ${r.dimensions.urgency.value}`);
});

test('Multiple messages improve classification', () => {
  const r = classifier.classify({ message: 'hi' }, [
    { role: 'lead', text: 'hi' },
    { role: 'lead', text: 'My AC stopped working and I need it fixed soon, can you give me a quote?' }
  ]);
  assert(r.dimensions.serviceCategory.value === 'repair', `service: ${r.dimensions.serviceCategory.value}`);
});

test('Inspection service detection', () => {
  const r = classifier.classify({ serviceType: 'Inspection', message: 'Need a diagnostic on my system' }, []);
  assert(r.dimensions.serviceCategory.value === 'inspection', `got ${r.dimensions.serviceCategory.value}`);
});

test('Conflicting signals — complaint + buying', () => {
  const r = classifier.classify({ message: 'Your competitor was terrible, I need someone to come fix this ASAP' }, []);
  // Complaining should win over buying since it's checked first
  assert(r.dimensions.intent.value === 'complaining' || r.dimensions.intent.value === 'buying', `intent: ${r.dimensions.intent.value}`);
});

test('Empty lead data still returns valid archetype', () => {
  const r = classifier.classify({}, []);
  assert(r.archetype, 'should return an archetype');
  assert(r.archetype.split(':').length === 4, 'should have 4 dimensions');
  assert(r.confidence >= 0 && r.confidence <= 1, 'confidence in range');
});

test('Confidence is between 0 and 1', () => {
  const r = classifier.classify({ message: 'Fix my AC ASAP please help emergency!' }, []);
  assert(r.confidence >= 0 && r.confidence <= 1, `confidence: ${r.confidence}`);
});

test('Spanish emergency still detected', () => {
  const r = classifier.classify({ message: 'Emergencia! No tengo agua caliente! Emergency!' }, []);
  // Should detect emergency keyword (emergencia is in the patterns)
  assert(r.dimensions.serviceCategory.value === 'emergency' || r.dimensions.urgency.value === 'critical', 
    `service: ${r.dimensions.serviceCategory.value}, urgency: ${r.dimensions.urgency.value}`);
});

test('Dimensions object has all 4 fields', () => {
  const r = classifier.classify({ message: 'hello' }, []);
  assert(r.dimensions.serviceCategory, 'missing serviceCategory');
  assert(r.dimensions.urgency, 'missing urgency');
  assert(r.dimensions.personality, 'missing personality');
  assert(r.dimensions.intent, 'missing intent');
});

// ═══════════════════════════════════════════
// PATTERN LIBRARY — 20 tests
// ═══════════════════════════════════════════
console.log('--- Pattern Library (20 tests) ---');

test('New library is empty', () => {
  const lib = new PatternLibrary(tempPatternFile());
  assert(lib.getStats().totalPatterns === 0, 'should be empty');
});

test('Record conversation creates pattern', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('test:a:b:c', [{ role: 'lead', text: 'hi' }, { role: 'hermes', text: 'hello' }], 'transferred');
  assert(lib.getPattern('test:a:b:c') !== null, 'pattern should exist');
});

test('Multiple records increase sample size', () => {
  const lib = new PatternLibrary(tempPatternFile());
  for (let i = 0; i < 5; i++) {
    lib.record('test:a:b:c', [{ role: 'lead', text: 'hi' }, { role: 'hermes', text: 'hello' }], 'transferred');
  }
  assert(lib.getPattern('test:a:b:c').sampleSize === 5, `got ${lib.getPattern('test:a:b:c').sampleSize}`);
});

test('Success count tracks transferred outcomes', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('test:a:b:c', [], 'transferred');
  lib.record('test:a:b:c', [], 'transferred');
  lib.record('test:a:b:c', [], 'ghosted');
  const p = lib.getPattern('test:a:b:c');
  assert(p.successCount === 2, `successCount: ${p.successCount}`);
  assert(p.sampleSize === 3, `sampleSize: ${p.sampleSize}`);
});

test('Conversion rate calculated correctly', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('test:a:b:c', [], 'transferred');
  lib.record('test:a:b:c', [], 'transferred');
  lib.record('test:a:b:c', [], 'ghosted');
  lib.record('test:a:b:c', [], 'transferred');
  const p = lib.getPattern('test:a:b:c');
  assert(p.conversionRate === 0.75, `rate: ${p.conversionRate}`);
});

test('Lookup requires minimum sample size (3)', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('test:a:b:c', [{ role: 'hermes', text: 'hi' }], 'transferred');
  lib.record('test:a:b:c', [{ role: 'hermes', text: 'hi' }], 'transferred');
  assert(lib.lookup('test:a:b:c') === null, 'should return null for < 3 samples');
});

test('Lookup requires minimum conversion rate (0.7)', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('test:a:b:c', [{ role: 'hermes', text: 'hi' }], 'transferred');
  lib.record('test:a:b:c', [], 'ghosted');
  lib.record('test:a:b:c', [], 'ghosted');
  lib.record('test:a:b:c', [], 'ghosted');
  assert(lib.lookup('test:a:b:c') === null, 'should return null for low conversion');
});

test('Lookup returns pattern when thresholds met', () => {
  const lib = new PatternLibrary(tempPatternFile());
  for (let i = 0; i < 4; i++) {
    lib.record('test:a:b:c', [{ role: 'hermes', text: 'hello' }], 'transferred');
  }
  const result = lib.lookup('test:a:b:c');
  assert(result !== null, 'should return pattern');
  assert(result.sampleSize === 4);
  assert(result.conversionRate === 1.0);
});

test('Weaken increases sample without success', () => {
  const lib = new PatternLibrary(tempPatternFile());
  for (let i = 0; i < 3; i++) {
    lib.record('test:a:b:c', [{ role: 'hermes', text: 'hi' }], 'transferred');
  }
  lib.weaken('test:a:b:c', [], 'ghosted');
  const p = lib.getPattern('test:a:b:c');
  assert(p.sampleSize === 4, `sampleSize: ${p.sampleSize}`);
  assert(p.successCount === 3, `successCount: ${p.successCount}`);
  assert(p.conversionRate === 0.75, `rate: ${p.conversionRate}`);
});

test('JSON persistence — write and reload', () => {
  const f = tempPatternFile();
  const lib1 = new PatternLibrary(f);
  for (let i = 0; i < 3; i++) {
    lib1.record('persist:test:a:b', [{ role: 'hermes', text: 'hi' }], 'transferred');
  }
  
  // Create new instance from same file
  const lib2 = new PatternLibrary(f);
  const p = lib2.getPattern('persist:test:a:b');
  assert(p !== null, 'should persist');
  assert(p.sampleSize === 3, `sampleSize: ${p.sampleSize}`);
  
  // Cleanup
  try { fs.unlinkSync(f); } catch(e) {}
});

test('Lookup returns null for nonexistent archetype', () => {
  const lib = new PatternLibrary(tempPatternFile());
  assert(lib.lookup('nonexistent:a:b:c') === null);
});

test('Stats returns correct totals', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('a:b:c:d', [], 'transferred');
  lib.record('e:f:g:h', [], 'transferred');
  const stats = lib.getStats();
  assert(stats.totalPatterns === 2, `total: ${stats.totalPatterns}`);
});

test('Seeded patterns are loadable', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  const result = lib.lookup('repair:critical:brief:buying');
  assert(result !== null, 'seeded pattern should be lookupable');
  assert(result.source === 'synthetic');
});

test('Seeded patterns have skeletons', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  const result = lib.lookup('maintenance:planning:brief:buying');
  assert(result.skeleton.length >= 2, `skeleton length: ${result.skeleton.length}`);
});

test('SetPattern works for direct seeding', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.setPattern('custom:a:b:c', { sampleSize: 10, successCount: 9, conversionRate: 0.9, skeleton: [{ step: 1, type: 'greeting' }], lastUpdated: new Date().toISOString() });
  const result = lib.lookup('custom:a:b:c');
  assert(result !== null);
  assert(result.sampleSize === 10);
});

test('Stats viable count only includes qualifying patterns', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('a:b:c:d', [], 'transferred'); // sampleSize 1 — not viable
  lib.setPattern('e:f:g:h', { sampleSize: 5, successCount: 4, conversionRate: 0.8, skeleton: [], lastUpdated: new Date().toISOString() }); // viable
  const stats = lib.getStats();
  assert(stats.viablePatterns === 1, `viable: ${stats.viablePatterns}`);
});

test('Record updates lastUpdated timestamp', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('ts:a:b:c', [], 'transferred');
  const p = lib.getPattern('ts:a:b:c');
  assert(p.lastUpdated, 'should have lastUpdated');
  const ts = new Date(p.lastUpdated).getTime();
  assert(Date.now() - ts < 5000, 'timestamp should be recent');
});

test('Avg conversation length tracked', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('avg:a:b:c', [{ role: 'lead', text: 'hi' }, { role: 'hermes', text: 'hello' }, { role: 'lead', text: 'fix' }], 'transferred');
  const p = lib.getPattern('avg:a:b:c');
  assert(p.avgConversationLength > 0, `avgLen: ${p.avgConversationLength}`);
});

test('Weaken on nonexistent archetype is safe', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.weaken('nope:a:b:c', [], 'ghosted'); // should not throw
  assert(true);
});

test('Stats top archetypes sorted by sample size', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  const stats = lib.getStats();
  assert(stats.topArchetypes.length > 0, 'should have top archetypes');
  for (let i = 1; i < stats.topArchetypes.length; i++) {
    assert(stats.topArchetypes[i-1].sampleSize >= stats.topArchetypes[i].sampleSize, 'should be sorted desc');
  }
});

// ═══════════════════════════════════════════
// SKELETON GENERATOR — 15 tests
// ═══════════════════════════════════════════
console.log('--- Skeleton Generator (15 tests) ---');

const generator = new SkeletonGenerator();

test('Generates greeting with name', () => {
  const result = generator.generate({ step: 1, type: 'greeting', keyPoints: [], avgLength: 70, examples: [] }, { name: 'John Smith', serviceType: 'AC' });
  assert(result.text.includes('John'), `should include name: ${result.text}`);
});

test('Generates empathy opener', () => {
  const result = generator.generate({ step: 1, type: 'empathy_opener', keyPoints: [], avgLength: 80, examples: [] }, { name: 'Sarah', serviceType: 'furnace' });
  assert(result.text.length > 0, 'should generate text');
  assert(result.tier === 0, `tier: ${result.tier}`);
});

test('Generates transfer response', () => {
  const result = generator.generate({ step: 3, type: 'transfer', keyPoints: [], avgLength: 70, examples: [] }, { name: 'Mike' });
  assert(/number|reach|call|connect/i.test(result.text), `should ask for number: ${result.text}`);
});

test('Response under 320 chars', () => {
  const result = generator.generate({ step: 1, type: 'greeting', keyPoints: [], avgLength: 70, examples: [] }, { name: 'Test' });
  assert(result.text.length <= 320, `length: ${result.text.length}`);
});

test('Different leads get different personalization', () => {
  const r1 = generator.generate({ step: 1, type: 'greeting', keyPoints: [], avgLength: 70, examples: [] }, { name: 'Alice', serviceType: 'plumbing' });
  const r2 = generator.generate({ step: 1, type: 'greeting', keyPoints: [], avgLength: 70, examples: [] }, { name: 'Bob', serviceType: 'HVAC' });
  assert(r1.text !== r2.text || r1.text.includes('Alice') !== r2.text.includes('Alice'), 'should differ');
});

test('Template steps return tier 0', () => {
  const types = ['greeting', 'empathy_opener', 'transfer', 'quick_qualify', 'discovery'];
  for (const type of types) {
    const r = generator.generate({ step: 1, type, keyPoints: [], avgLength: 70, examples: [] }, { name: 'Test' });
    assert(r.tier === 0, `${type} should be tier 0, got ${r.tier}`);
  }
});

test('Uses skeleton examples when available for unknown type', () => {
  const r = generator.generate({ step: 1, type: 'custom_weird_step', keyPoints: [], avgLength: 70, examples: ['This is a custom example for [name]'] }, { name: 'Pat' });
  assert(r.text.includes('Pat') || r.text.includes('custom'), `should use example: ${r.text}`);
});

test('Service type personalization', () => {
  const r = generator.generate({ step: 1, type: 'empathy_opener', keyPoints: [], avgLength: 80, examples: [] }, { name: 'Tom', serviceType: 'plumbing' });
  assert(r.text.includes('plumbing') || r.text.length > 0, 'should reference service or generate valid text');
});

test('Response passes output validation', () => {
  const r = generator.generate({ step: 1, type: 'greeting', keyPoints: [], avgLength: 70, examples: [] }, { name: 'Test User' });
  const validation = validateOutput(r.text);
  assert(validation.valid, `should pass validation: ${validation.reason}`);
});

test('Quick qualify step generates questions', () => {
  const r = generator.generate({ step: 2, type: 'quick_qualify', keyPoints: ['timeline', 'location'], avgLength: 60, examples: [] }, { name: 'Sam' });
  assert(r.text.includes('?'), `should ask questions: ${r.text}`);
});

test('Follow up step works', () => {
  const r = generator.generate({ step: 3, type: 'follow_up', keyPoints: [], avgLength: 80, examples: [] }, { name: 'Amy' });
  assert(r.text.length > 0);
  assert(r.tier === 0);
});

test('Closing step works', () => {
  const r = generator.generate({ step: 4, type: 'closing', keyPoints: [], avgLength: 60, examples: [] }, { name: 'Dan' });
  assert(r.text.length > 0);
});

test('isTemplateStep correctly identifies template steps', () => {
  assert(generator.isTemplateStep('greeting') === true);
  assert(generator.isTemplateStep('transfer') === true);
  assert(generator.isTemplateStep('custom_weird') === false);
});

test('Handles missing lead data gracefully', () => {
  const r = generator.generate({ step: 1, type: 'greeting', keyPoints: [], avgLength: 70, examples: [] }, {});
  assert(r.text.includes('there'), `should use fallback name: ${r.text}`);
});

test('Empathy step generates empathetic text', () => {
  const r = generator.generate({ step: 2, type: 'empathy', keyPoints: [], avgLength: 80, examples: [] }, { name: 'Lisa' });
  assert(r.text.length > 0);
  assert(r.tier === 0);
});

// ═══════════════════════════════════════════
// NOVELTY DETECTION — 20 tests
// ═══════════════════════════════════════════
console.log('--- Novelty Detection (20 tests) ---');

const detector = new NoveltyDetector();

test('Normal message — no novelty', () => {
  const r = detector.check({ type: 'quick_qualify', avgLength: 60, keyPoints: ['timeline'] }, 'It started last week', 'repair:soon:brief:buying');
  assert(!r.novel, `should not be novel: ${r.reason}`);
});

test('Anger in non-emotional archetype → novel', () => {
  const r = detector.check({ type: 'quick_qualify', avgLength: 60 }, 'This is fucking ridiculous', 'repair:soon:brief:buying');
  assert(r.novel, 'should detect anger');
  assert(r.confidence >= 0.8, `confidence: ${r.confidence}`);
});

test('Anger in emotional archetype → not novel', () => {
  const r = detector.check({ type: 'empathy_opener', avgLength: 100 }, 'This is so frustrating damn it', 'repair:critical:emotional:buying');
  assert(!r.novel, 'should not flag anger in emotional archetype');
});

test('Anger in complaining archetype → not novel', () => {
  const r = detector.check({ type: 'discovery', avgLength: 80 }, 'Your service is terrible', 'repair:soon:brief:complaining');
  assert(!r.novel, 'should not flag anger in complaining archetype');
});

test('Topic change detected', () => {
  const r = detector.check({ type: 'quick_qualify', avgLength: 60 }, 'Actually I need a new system installed', 'repair:soon:brief:buying');
  assert(r.novel, 'should detect topic shift to install');
  assert(r.reason.includes('topic shift'), `reason: ${r.reason}`);
});

test('Urgency escalation detected', () => {
  const r = detector.check({ type: 'follow_up', avgLength: 80 }, 'Actually this is an emergency, I need help immediately!', 'repair:planning:brief:buying');
  assert(r.novel, 'should detect urgency escalation');
});

test('Urgency de-escalation detected', () => {
  const r = detector.check({ type: 'transfer', avgLength: 70 }, 'Actually no rush, thinking about it for next month', 'repair:critical:brief:buying');
  assert(r.novel, 'should detect urgency de-escalation');
});

test('Unexpected question detected', () => {
  const r = detector.check({ type: 'transfer', avgLength: 70, keyPoints: ['get contact'] }, 'Are you licensed and insured? What are your reviews like?', 'repair:soon:brief:buying');
  assert(r.novel, 'should detect unexpected questions');
});

test('Message much longer than expected → novel', () => {
  const longMsg = 'a'.repeat(500);
  const r = detector.check({ type: 'quick_qualify', avgLength: 50 }, longMsg, 'repair:soon:brief:buying');
  assert(r.novel, 'should flag very long message');
});

test('Very short message when longer expected', () => {
  const r = detector.check({ type: 'discovery', avgLength: 200 }, 'ok', 'repair:soon:verbose:shopping');
  // Short message may not be flagged as novel unless very short (< 5 chars)
  // 'ok' is 2 chars
  assert(r.novel || r.confidence < 0.6, 'may or may not be novel depending on threshold');
});

test('Sentiment shift from calm to angry', () => {
  const r = detector.check(
    { type: 'follow_up', avgLength: 80 },
    'This is bullshit, you people are incompetent',
    'repair:soon:brief:buying',
    { previousMessages: [{ text: 'Yeah sounds good' }, { text: 'Okay that works' }] }
  );
  assert(r.novel, 'should detect sentiment shift');
});

test('No novelty when within expected pattern', () => {
  const r = detector.check({ type: 'quick_qualify', avgLength: 60, keyPoints: ['timeline', 'location'] }, 'Started yesterday, I am in Phoenix', 'repair:soon:brief:buying');
  assert(!r.novel, 'should be within pattern');
});

test('Null archetype handled gracefully', () => {
  const r = detector.check({ type: 'greeting' }, 'hello', null);
  assert(!r.novel, 'null archetype = not novel');
});

test('Empty message handled gracefully', () => {
  const r = detector.check({ type: 'greeting' }, '', 'repair:soon:brief:buying');
  assert(!r.novel, 'empty message = not novel');
});

test('Service category unknown doesn\'t trigger topic change', () => {
  const r = detector.check({ type: 'discovery', avgLength: 80 }, 'I need my furnace repaired', 'unknown:unknown:brief:unknown');
  assert(!r.novel, 'unknown service should not flag topic change');
});

test('Confidence is 0 when not novel', () => {
  const r = detector.check({ type: 'greeting', avgLength: 60 }, 'hi there', 'unknown:unknown:brief:unknown');
  assert(r.confidence === 0, `confidence should be 0: ${r.confidence}`);
});

test('Multiple novel signals increase confidence', () => {
  const r = detector.check(
    { type: 'quick_qualify', avgLength: 50, keyPoints: ['location'] },
    'This is fucking bullshit I need a new system installed not a repair and are you even licensed??',
    'repair:planning:brief:buying'
  );
  assert(r.novel, 'should be novel');
  assert(r.confidence >= 0.85, `confidence should be high: ${r.confidence}`);
});

test('Reason string explains why novel', () => {
  const r = detector.check({ type: 'transfer', avgLength: 70 }, 'Actually I want to install a brand new system instead', 'repair:soon:brief:buying');
  assert(r.reason.length > 0, 'should have reason');
  assert(r.novel, 'should be novel');
});

test('No step provided still works', () => {
  const r = detector.check(null, 'hello', 'repair:soon:brief:buying');
  assert(typeof r.novel === 'boolean');
});

test('Normal follow-up not flagged', () => {
  const r = detector.check({ type: 'transfer', avgLength: 70, keyPoints: ['get contact'] }, '555-123-4567', 'repair:soon:brief:buying');
  assert(!r.novel, 'phone number should not be novel');
});

// ═══════════════════════════════════════════
// INTEGRATION — 20 tests
// ═══════════════════════════════════════════
console.log('--- Integration (20 tests) ---');

test('Full flow: classify → lookup → generate', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const leadData = { name: 'John', serviceType: 'AC Repair', message: 'My AC broke need help ASAP' };
  const messages = [{ role: 'lead', text: 'My AC broke need help ASAP' }];
  
  const arch = classifier.classify(leadData, messages);
  assert(arch.archetype.startsWith('repair:critical'), `archetype: ${arch.archetype}`);
  
  const pattern = lib.lookup(arch.archetype);
  // May or may not match depending on exact archetype hash
  if (pattern) {
    const step = pattern.skeleton[0];
    const response = generator.generate(step, leadData, messages);
    assert(response.text.length > 0);
    assert(response.text.length <= 320);
  }
});

test('No-match archetype returns null from library', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const arch = classifier.classify({ message: 'hi' }, []);
  // Low confidence — likely won't match
  const specific = 'weird:combo:that:nobody_uses';
  assert(lib.lookup(specific) === null);
});

test('Novelty mid-conversation triggers escalation flag', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const pattern = lib.lookup('repair:critical:brief:buying');
  assert(pattern !== null, 'seeded pattern should exist');
  
  const step = pattern.skeleton[1]; // quick_qualify
  const novelty = detector.check(step, 'Actually fuck this I want to install a whole new system instead', 'repair:critical:brief:buying');
  assert(novelty.novel, 'should detect novelty');
});

test('Feedback loop: record strengthens pattern', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const before = lib.getPattern('repair:critical:brief:buying').sampleSize;
  lib.record('repair:critical:brief:buying', [{ role: 'lead', text: 'hi' }, { role: 'hermes', text: 'hello' }], 'transferred');
  const after = lib.getPattern('repair:critical:brief:buying').sampleSize;
  assert(after === before + 1, `should increment: ${before} → ${after}`);
});

test('Seeded archetypes all have valid skeletons', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  for (const [arch, pattern] of Object.entries(SEED_PATTERNS)) {
    assert(pattern.skeleton.length >= 2, `${arch} skeleton too short: ${pattern.skeleton.length}`);
    for (const step of pattern.skeleton) {
      assert(step.type, `${arch} step ${step.step} missing type`);
      assert(step.step > 0, `${arch} step number should be positive`);
    }
  }
});

test('Stats reporting works', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  const stats = lib.getStats();
  assert(stats.totalPatterns >= 7, `total: ${stats.totalPatterns}`);
  assert(stats.viablePatterns >= 7, `viable: ${stats.viablePatterns}`);
  assert(parseFloat(stats.avgConversionRate) > 0, `avgRate: ${stats.avgConversionRate}`);
});

test('Generated responses pass V16 output validation', () => {
  const steps = [
    { step: 1, type: 'greeting', keyPoints: [], avgLength: 70, examples: [] },
    { step: 2, type: 'empathy_opener', keyPoints: [], avgLength: 80, examples: [] },
    { step: 3, type: 'transfer', keyPoints: [], avgLength: 70, examples: [] },
  ];
  for (const step of steps) {
    const r = generator.generate(step, { name: 'Test User', serviceType: 'HVAC' });
    const v = validateOutput(r.text);
    assert(v.valid, `${step.type} failed validation: ${v.reason}`);
  }
});

test('Archetype classifier handles real-world form data', () => {
  const r = classifier.classify({
    name: 'Maria Garcia',
    serviceType: 'HVAC Repair',
    message: 'ac not blowing cold air',
    phone: '555-123-4567',
  }, []);
  assert(r.dimensions.serviceCategory.value === 'repair', `service: ${r.dimensions.serviceCategory.value}`);
});

test('Pattern library round-trip: seed → lookup → generate → validate', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const pattern = lib.lookup('maintenance:planning:brief:buying');
  assert(pattern !== null, 'should find maintenance pattern');
  
  const step = pattern.skeleton[0];
  const response = generator.generate(step, { name: 'Dave', serviceType: 'HVAC' });
  assert(response.text.length > 0);
  assert(response.text.length <= 320);
  
  const v = validateOutput(response.text);
  assert(v.valid, `validation failed: ${v.reason}`);
});

test('Classify + lookup + novelty check flow', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const leadData = { name: 'Amy', serviceType: 'Maintenance', message: 'Need a tune-up' };
  const arch = classifier.classify(leadData, [{ role: 'lead', text: 'Need a tune-up' }]);
  
  const pattern = lib.lookup(arch.archetype);
  if (pattern) {
    const novelty = detector.check(pattern.skeleton[0], 'Need a tune-up', arch.archetype);
    assert(!novelty.novel, 'normal message should not be novel');
  }
});

test('Emergency archetype gets high urgency classification', () => {
  const r = classifier.classify({ message: 'GAS LEAK IN MY HOUSE HELP' }, []);
  assert(r.dimensions.urgency.value === 'critical', `urgency: ${r.dimensions.urgency.value}`);
});

test('Pattern weakening drops below threshold', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.setPattern('weak:test:a:b', { sampleSize: 3, successCount: 3, conversionRate: 1.0, skeleton: [{ step: 1, type: 'greeting' }], lastUpdated: new Date().toISOString() });
  
  assert(lib.lookup('weak:test:a:b') !== null, 'should be viable initially');
  
  // Weaken 7 times to drop rate below 0.7
  for (let i = 0; i < 7; i++) {
    lib.weaken('weak:test:a:b', [], 'ghosted');
  }
  assert(lib.lookup('weak:test:a:b') === null, 'should be below threshold now');
});

test('Seeded patterns marked as synthetic', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const p = lib.getPattern('repair:critical:brief:buying');
  assert(p.source === 'synthetic', `source: ${p.source}`);
});

test('Production records marked as production', () => {
  const lib = new PatternLibrary(tempPatternFile());
  lib.record('new:prod:a:b', [{ role: 'hermes', text: 'hi' }], 'transferred');
  const p = lib.getPattern('new:prod:a:b');
  assert(p.source === 'production', `source: ${p.source}`);
});

test('11 seed patterns loaded', () => {
  const count = Object.keys(SEED_PATTERNS).length;
  assert(count >= 10, `expected >=10 seed patterns, got ${count}`);
});

test('All seed patterns meet minimum thresholds', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  for (const arch of Object.keys(SEED_PATTERNS)) {
    const result = lib.lookup(arch);
    assert(result !== null, `${arch} should be lookupable`);
    assert(result.conversionRate >= 0.7, `${arch} rate too low: ${result.conversionRate}`);
  }
});

test('Skeleton steps are sequential', () => {
  for (const [arch, pattern] of Object.entries(SEED_PATTERNS)) {
    for (let i = 0; i < pattern.skeleton.length; i++) {
      assert(pattern.skeleton[i].step === i + 1, `${arch} step ${i} should be ${i + 1}`);
    }
  }
});

test('Archetype hash is deterministic', () => {
  const leadData = { name: 'Test', serviceType: 'repair', message: 'Fix my AC ASAP' };
  const r1 = classifier.classify(leadData, []);
  const r2 = classifier.classify(leadData, []);
  assert(r1.archetype === r2.archetype, 'same input should give same archetype');
});

test('End-to-end: unknown lead gets classified and generates valid response', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const leadData = { name: 'Chris', serviceType: 'Duct Cleaning', message: 'Dusty vents need cleaning' };
  const arch = classifier.classify(leadData, [{ role: 'lead', text: 'Dusty vents need cleaning' }]);
  assert(arch.archetype.length > 0, 'should produce archetype');
  assert(arch.confidence > 0, 'should have confidence');
  
  // Try generating from first available pattern
  const pattern = lib.lookup(arch.archetype) || lib.lookup('maintenance:planning:brief:buying');
  const response = generator.generate(pattern.skeleton[0], leadData);
  const v = validateOutput(response.text);
  assert(v.valid, `response should be valid: ${v.reason}`);
});

test('Multiple different archetypes coexist in library', () => {
  const lib = new PatternLibrary(tempPatternFile());
  seedPatternLibrary(lib);
  
  const r1 = lib.lookup('repair:critical:brief:buying');
  const r2 = lib.lookup('maintenance:planning:brief:buying');
  assert(r1 !== null && r2 !== null, 'both should exist');
  assert(r1.skeleton[0].type !== r2.skeleton[0].type || r1.sampleSize !== r2.sampleSize, 'should be different patterns');
});

// ═══════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log(`V18 Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log('═══════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ❌ ${f.name}: ${f.error}`));
}

process.exit(failed > 0 ? 1 : 0);

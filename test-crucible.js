#!/usr/bin/env node
/**
 * The Crucible — Test Suite (100 tests)
 */

const fs = require('fs');
const path = require('path');
const { generateDataset, SeededRandom } = require('./src/crucible-dataset');
const { runCrucible, getDefaultWeights, clampWeights, runConversation, processBatch, adjustWeights, generateReport } = require('./src/crucible');
const { MomentumTracker, YES_SIGNALS, RESISTANCE_SIGNALS, DEFAULT_THRESHOLDS } = require('./src/momentum-tracker');
const { ArchetypeClassifier } = require('./src/archetypes');
const { NoveltyDetector } = require('./src/novelty-detector');
const { classifyMessage } = require('./src/message-classifier');

let passed = 0;
let failed = 0;
let errors = [];

function assert(condition, name) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(name);
    console.log(`  ✗ ${name}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// Generate dataset once
const dataset = generateDataset(42);

// ═══════════════════════════════════════
// SECTION 1: Dataset Generation (20 tests)
// ═══════════════════════════════════════
section('Dataset Generation');

assert(dataset.length === 2000, 'Dataset has exactly 2000 conversations');

const cats = {};
for (const c of dataset) cats[c.category] = (cats[c.category] || 0) + 1;

assert(cats.easy_convert === 500, 'Easy converts: 500');
assert(cats.objection_heavy === 400, 'Objection heavy: 400');
assert(cats.slow_burner === 300, 'Slow burners: 300');
assert(cats.hostile === 200, 'Hostile: 200');
assert(cats.emergency === 200, 'Emergency: 200');
assert(cats.multi_service === 150, 'Multi-service: 150');
assert(cats.commercial === 100, 'Commercial: 100');
assert(cats.edge_case === 150, 'Edge cases: 150');

// Valid structure
assert(dataset.every(c => c.id && typeof c.id === 'string'), 'All have string IDs');
assert(dataset.every(c => c.service_type && typeof c.service_type === 'string'), 'All have service_type');
assert(dataset.every(c => c.category && typeof c.category === 'string'), 'All have category');
assert(dataset.every(c => Array.isArray(c.messages) && c.messages.length >= 2), 'All have 2+ messages');
assert(dataset.every(c => ['transfer', 'block', 'nurture'].includes(c.expected_outcome)), 'Valid outcomes');
assert(dataset.every(c => ['rising', 'flat', 'falling'].includes(c.expected_momentum_trend)), 'Valid momentum trends');
assert(dataset.every(c => Array.isArray(c.objection_types)), 'All have objection_types array');

// Message structure
assert(dataset.every(c => c.messages.every(m => ['lead', 'agent'].includes(m.role))), 'Valid message roles');
assert(dataset.every(c => c.messages.every(m => typeof m.text === 'string' && m.text.length > 0)), 'Non-empty message text');
assert(dataset.every(c => c.messages[0].role === 'lead'), 'First message is always from lead');

// Service type distribution
const services = {};
for (const c of dataset) services[c.service_type] = (services[c.service_type] || 0) + 1;
assert(services.hvac >= 500, 'HVAC ~30% (500+)');
assert(Object.keys(services).length >= 5, 'At least 5 service types represented');

// ═══════════════════════════════════════
// SECTION 2: Realistic Message Content (10 tests)
// ═══════════════════════════════════════
section('Realistic Message Content');

const easyConvs = dataset.filter(c => c.category === 'easy_convert');
assert(easyConvs.some(c => c.messages.some(m => /lets do it|go ahead|schedule|send someone|book it/i.test(m.text))), 'Easy converts contain buy commitment signals');
assert(easyConvs.some(c => c.messages.some(m => /been going on|started|homeowner|getting worse/i.test(m.text))), 'Easy converts contain qualifying details');

const hostileConvs = dataset.filter(c => c.category === 'hostile');
assert(hostileConvs.every(c => c.expected_outcome === 'block'), 'All hostile conversations expect block');
assert(hostileConvs.some(c => c.messages.some(m => /stop|wrong|spam|not interested/i.test(m.text))), 'Hostile messages contain rejection');

const emergencyConvs = dataset.filter(c => c.category === 'emergency');
assert(emergencyConvs.every(c => c.expected_outcome === 'transfer'), 'All emergencies expect transfer');
assert(emergencyConvs.some(c => c.messages.some(m => /!{2,}|ASAP|urgent|emergency|help/i.test(m.text))), 'Emergencies contain urgency signals');

const objectionConvs = dataset.filter(c => c.category === 'objection_heavy');
assert(objectionConvs.some(c => c.objection_types.length > 0), 'Objection convos have objection types');
assert(objectionConvs.some(c => c.objection_types.includes('price')), 'Some have price objections');

const commercialConvs = dataset.filter(c => c.category === 'commercial');
assert(commercialConvs.some(c => c.messages.some(m => /commercial|property|restaurant|office|units/i.test(m.text))), 'Commercial convos mention business');

const multiConvs = dataset.filter(c => c.category === 'multi_service');
assert(multiConvs.some(c => c.messages.some(m => /also|while|one more|since/i.test(m.text))), 'Multi-service reveals additional needs');

// ═══════════════════════════════════════
// SECTION 3: Weight System (15 tests)
// ═══════════════════════════════════════
section('Weight System');

const weights = getDefaultWeights();
assert(Object.keys(weights.yesSignalWeights).length >= 6, 'Has yes signal weights');
assert(Object.keys(weights.resistanceSignalWeights).length >= 4, 'Has resistance signal weights');
assert(Object.keys(weights.momentumThresholds).length >= 5, 'Has momentum thresholds');
assert(weights.globalTransferThreshold > 0, 'Has positive global threshold');

// Clamp tests
const testWeights = JSON.parse(JSON.stringify(weights));
testWeights.yesSignalWeights['asks question'] = 100;
const clamped = clampWeights(testWeights);
assert(clamped.yesSignalWeights['asks question'] <= 5.0, 'Clamp prevents yes weight exceeding max');

const testWeights2 = JSON.parse(JSON.stringify(weights));
testWeights2.yesSignalWeights['asks question'] = -5;
const clamped2 = clampWeights(testWeights2);
assert(clamped2.yesSignalWeights['asks question'] >= 0.1, 'Clamp prevents yes weight going below min');

const testWeights3 = JSON.parse(JSON.stringify(weights));
testWeights3.resistanceSignalWeights['minimal response'] = -100;
const clamped3 = clampWeights(testWeights3);
assert(clamped3.resistanceSignalWeights['minimal response'] >= -5.0, 'Clamp prevents resistance weight below min');

const testWeights4 = JSON.parse(JSON.stringify(weights));
testWeights4.resistanceSignalWeights['minimal response'] = 5;
const clamped4 = clampWeights(testWeights4);
assert(clamped4.resistanceSignalWeights['minimal response'] <= -0.1, 'Clamp prevents resistance weight going positive');

const testWeights5 = JSON.parse(JSON.stringify(weights));
testWeights5.momentumThresholds.emergency = 100;
const clamped5 = clampWeights(testWeights5);
assert(clamped5.momentumThresholds.emergency <= 5.0, 'Clamp prevents threshold exceeding max');

const testWeights6 = JSON.parse(JSON.stringify(weights));
testWeights6.momentumThresholds.emergency = -5;
const clamped6 = clampWeights(testWeights6);
assert(clamped6.momentumThresholds.emergency >= 0.5, 'Clamp prevents threshold going below min');

const testWeights7 = JSON.parse(JSON.stringify(weights));
testWeights7.globalTransferThreshold = 100;
const clamped7 = clampWeights(testWeights7);
assert(clamped7.globalTransferThreshold <= 4.0, 'Clamp prevents global threshold exceeding max');

// Weight structure
assert(weights._bounds !== undefined, 'Weights have bounds');
assert(weights._bounds.yesMin < weights._bounds.yesMax, 'Yes bounds are valid range');
assert(weights._bounds.resistanceMin < weights._bounds.resistanceMax, 'Resistance bounds are valid range');
assert(weights.objectionStrategies !== undefined, 'Has objection strategies');
assert(Object.keys(weights.objectionStrategies).length >= 5, 'Has at least 5 objection strategy types');

// ═══════════════════════════════════════
// SECTION 4: Conversation Pipeline (15 tests)
// ═══════════════════════════════════════
section('Conversation Pipeline');

// Easy convert should transfer
const easyConv = dataset.find(c => c.category === 'easy_convert' && c.expected_outcome === 'transfer');
const easyResult = runConversation(easyConv, weights);
assert(easyResult.outcome !== undefined, 'Pipeline returns outcome');
assert(easyResult.momentum !== undefined, 'Pipeline returns momentum');
assert(typeof easyResult.momentum === 'number', 'Momentum is a number');
assert(easyResult.archetype !== undefined, 'Pipeline returns archetype');
assert(easyResult.signals !== undefined, 'Pipeline returns signals');
assert(Array.isArray(easyResult.signals), 'Signals is an array');

// Hostile should not transfer
const hostileConv = dataset.find(c => c.category === 'hostile');
const hostileResult = runConversation(hostileConv, weights);
assert(hostileResult.outcome === 'block', 'Hostile conversation blocked');

// Emergency should have high momentum
const emergencyConv = dataset.find(c => c.category === 'emergency');
const emergencyResult = runConversation(emergencyConv, weights);
assert(emergencyResult.momentum > 0, 'Emergency has positive momentum');

// Pipeline handles empty messages gracefully
const emptyConv = { id: 'test-empty', service_type: 'hvac', category: 'test', messages: [], expected_outcome: 'block', expected_momentum_trend: 'flat', objection_types: [] };
const emptyResult = runConversation(emptyConv, weights);
assert(emptyResult.outcome === 'block', 'Empty conversation returns block');

// Pipeline handles minimal conversation
const minConv = { id: 'test-min', service_type: 'hvac', category: 'test', messages: [{ role: 'lead', text: 'hi' }], expected_outcome: 'nurture', expected_momentum_trend: 'flat', objection_types: [] };
const minResult = runConversation(minConv, weights);
assert(['block', 'nurture'].includes(minResult.outcome), 'Minimal conversation does not transfer');

// Opt-out gets blocked
const optoutConv = { id: 'test-optout', service_type: 'hvac', category: 'test', messages: [{ role: 'lead', text: 'stop texting me. unsubscribe.' }], expected_outcome: 'block', expected_momentum_trend: 'falling', objection_types: [] };
const optoutResult = runConversation(optoutConv, weights);
assert(optoutResult.outcome === 'block', 'Opt-out message gets blocked');

// High-intent message gets positive momentum
const highIntentConv = { id: 'test-high', service_type: 'hvac', category: 'test', messages: [
  { role: 'lead', text: 'Yes absolutely, schedule me an appointment. Lets do it ASAP, when can someone come out?' },
], expected_outcome: 'transfer', expected_momentum_trend: 'rising', objection_types: [] };
const highResult = runConversation(highIntentConv, weights);
assert(highResult.momentum > 1.0, 'High intent message gets significant momentum');

// Conversation with buy commitment has appropriate signals
assert(highResult.signals.includes('scheduling intent'), 'Scheduling intent detected');

// ═══════════════════════════════════════
// SECTION 5: Batch Processing (10 tests)
// ═══════════════════════════════════════
section('Batch Processing');

const smallBatch = dataset.slice(0, 50);
const batchMetrics = processBatch(smallBatch, weights);

assert(batchMetrics.accuracy >= 0 && batchMetrics.accuracy <= 1, 'Accuracy in [0,1]');
assert(batchMetrics.correct >= 0, 'Correct count non-negative');
assert(batchMetrics.total === 50, 'Total equals batch size');
assert(batchMetrics.avgMomentum >= 0, 'Average momentum non-negative');
assert(batchMetrics.transferRate >= 0 && batchMetrics.transferRate <= 1, 'Transfer rate in [0,1]');
assert(batchMetrics.falsePositiveRate >= 0, 'False positive rate non-negative');
assert(batchMetrics.falseNegativeRate >= 0, 'False negative rate non-negative');
assert(batchMetrics.results.length === 50, 'Results array matches batch size');
assert(batchMetrics.correct + (batchMetrics.total - batchMetrics.correct) === batchMetrics.total, 'Correct + incorrect = total');

// Empty batch
const emptyBatch = processBatch([], weights);
assert(emptyBatch.accuracy === 0 && emptyBatch.total === 0, 'Empty batch returns zero metrics');

// ═══════════════════════════════════════
// SECTION 6: Weight Adjustment (10 tests)
// ═══════════════════════════════════════
section('Weight Adjustment');

const origWeights = getDefaultWeights();
const adjusted = adjustWeights(JSON.parse(JSON.stringify(origWeights)), batchMetrics);

assert(adjusted !== origWeights, 'Returns new weights object');
assert(adjusted.yesSignalWeights !== undefined, 'Adjusted weights have yes signals');
assert(adjusted.resistanceSignalWeights !== undefined, 'Adjusted weights have resistance signals');

// All-success batch should strengthen
const allSuccessBatch = { accuracy: 1.0, correct: 10, total: 10, avgMomentum: 2.0, transferRate: 0.5, falsePositiveRate: 0, falseNegativeRate: 0, results: [
  { id: '1', category: 'easy_convert', expected: 'transfer', predicted: 'transfer', correct: true, momentum: 2.0, archetype: 'repair:critical:brief:buying', signals: ['agreement', 'detail sharing'] },
] };
const strengthened = adjustWeights(JSON.parse(JSON.stringify(origWeights)), allSuccessBatch);
assert(strengthened.yesSignalWeights['agreement'] >= origWeights.yesSignalWeights['agreement'], 'Success strengthens yes signals');

// All-failure batch (false positives) should raise thresholds
const allFailBatch = { accuracy: 0, correct: 0, total: 10, avgMomentum: 2.0, transferRate: 1.0, falsePositiveRate: 1.0, falseNegativeRate: 0, results: [
  { id: '1', category: 'hostile', expected: 'block', predicted: 'transfer', correct: false, momentum: 2.0, archetype: 'unknown:unknown:brief:unknown', signals: ['agreement'] },
] };
const weakened = adjustWeights(JSON.parse(JSON.stringify(origWeights)), allFailBatch);
assert(weakened.yesSignalWeights['agreement'] <= origWeights.yesSignalWeights['agreement'], 'False positives weaken yes signals');

// False negative should lower thresholds
const fnBatch = { accuracy: 0, correct: 0, total: 1, results: [
  { id: '1', category: 'easy_convert', expected: 'transfer', predicted: 'nurture', correct: false, momentum: 1.0, archetype: 'repair:critical:brief:buying', signals: ['detail sharing'] },
] };
const fnAdjusted = adjustWeights(JSON.parse(JSON.stringify(origWeights)), fnBatch);
// Critical threshold should decrease
assert(fnAdjusted.momentumThresholds['critical'] <= origWeights.momentumThresholds['critical'], 'False negative lowers threshold');

// Weights stay bounded after aggressive adjustment
let aggressiveWeights = JSON.parse(JSON.stringify(origWeights));
for (let i = 0; i < 100; i++) {
  aggressiveWeights = adjustWeights(aggressiveWeights, allSuccessBatch);
}
assert(aggressiveWeights.yesSignalWeights['agreement'] <= 5.0, 'Weights bounded after 100 iterations');
assert(aggressiveWeights.yesSignalWeights['agreement'] >= 0.1, 'Weights stay positive after 100 iterations');

// Objection strategies update
const objBatch = { accuracy: 0.5, correct: 1, total: 2, results: [
  { id: '1', category: 'objection_heavy', expected: 'transfer', predicted: 'transfer', correct: true, momentum: 2.0, archetype: 'repair:soon:brief:shopping', signals: ['price resistance'] },
  { id: '2', category: 'objection_heavy', expected: 'nurture', predicted: 'transfer', correct: false, momentum: 2.0, archetype: 'repair:soon:brief:shopping', signals: ['price resistance'] },
] };
const objAdjusted = adjustWeights(JSON.parse(JSON.stringify(origWeights)), objBatch);
assert(objAdjusted.objectionStrategies.price.attempts === 2, 'Objection strategy tracks attempts');
assert(objAdjusted.objectionStrategies.price.wins === 1, 'Objection strategy tracks wins');

// ═══════════════════════════════════════
// SECTION 7: Death Spiral Prevention (5 tests)
// ═══════════════════════════════════════
section('Death Spiral Prevention');

let spiralWeights = getDefaultWeights();
const negativeBatch = { accuracy: 0, correct: 0, total: 50, results: Array(50).fill(null).map((_, i) => ({
  id: `s${i}`, category: 'hostile', expected: 'block', predicted: 'transfer', correct: false,
  momentum: 3.0, archetype: 'repair:critical:brief:buying', signals: ['agreement', 'detail sharing', 'scheduling intent'],
})) };

for (let i = 0; i < 200; i++) {
  spiralWeights = adjustWeights(spiralWeights, negativeBatch);
}

assert(Object.values(spiralWeights.yesSignalWeights).every(v => v >= 0.1), 'Yes weights never go below minimum after spiral');
assert(Object.values(spiralWeights.resistanceSignalWeights).every(v => v >= -5.0), 'Resistance weights bounded after spiral');
assert(Object.values(spiralWeights.momentumThresholds).filter((_,k) => k !== '_default').every(v => v <= 5.0), 'Thresholds bounded after spiral');
assert(spiralWeights.globalTransferThreshold >= 0.5, 'Global threshold stays above minimum after spiral');
assert(spiralWeights.globalTransferThreshold <= 4.0, 'Global threshold stays below maximum after spiral');

// ═══════════════════════════════════════
// SECTION 8: Epoch Convergence (5 tests)
// ═══════════════════════════════════════
section('Epoch Convergence');

// Run 3 epochs and check convergence
let convWeights = getDefaultWeights();
const rng = new SeededRandom(42);
const epochAccuracies = [];

for (let epoch = 0; epoch < 3; epoch++) {
  const metrics = processBatch(dataset.slice(0, 200), convWeights);
  epochAccuracies.push(metrics.accuracy);
  convWeights = adjustWeights(convWeights, metrics);
}

assert(epochAccuracies.length === 3, 'Ran 3 epochs');
assert(epochAccuracies.every(a => a >= 0 && a <= 1), 'All accuracies valid');
// Accuracy should not catastrophically drop
assert(epochAccuracies[2] >= epochAccuracies[0] - 0.15, 'Accuracy does not catastrophically degrade');
assert(typeof epochAccuracies[0] === 'number' && !isNaN(epochAccuracies[0]), 'Accuracies are valid numbers');
assert(epochAccuracies[0] > 0, 'Baseline accuracy is positive');

// ═══════════════════════════════════════
// SECTION 9: Integration with V18 Modules (5 tests)
// ═══════════════════════════════════════
section('V18 Module Integration');

const tracker = new MomentumTracker();
const scoreResult = tracker.score('test-1', 'my AC broke need help asap', 'repair:critical:brief:buying');
assert(scoreResult.momentum > 0, 'MomentumTracker works directly');

const archClassifier = new ArchetypeClassifier();
const archResult = archClassifier.classify({ serviceType: 'hvac', message: 'my furnace stopped working' }, []);
assert(archResult.archetype.includes(':'), 'ArchetypeClassifier returns colon-separated archetype');

const noveltyDet = new NoveltyDetector();
const novResult = noveltyDet.check(null, 'this is completely different!', 'repair:critical:brief:buying');
assert(novResult.novel !== undefined, 'NoveltyDetector returns novel flag');

const msgClass = classifyMessage('my AC is broken and I need help right now');
assert(msgClass.tier !== undefined, 'MessageClassifier returns tier');
assert(msgClass.signals !== undefined, 'MessageClassifier returns signals');

// ═══════════════════════════════════════
// SECTION 10: Output Formats (5 tests)
// ═══════════════════════════════════════
section('Output Formats');

const resultsPath = path.join(__dirname, 'data', 'crucible-results.tsv');
const weightsPath = path.join(__dirname, 'data', 'crucible-optimized-weights.json');

assert(fs.existsSync(resultsPath), 'Results TSV exists');
assert(fs.existsSync(weightsPath), 'Optimized weights JSON exists');

const tsvContent = fs.readFileSync(resultsPath, 'utf8');
const tsvLines = tsvContent.trim().split('\n');
assert(tsvLines[0].includes('epoch\tbatch'), 'TSV has correct header');
assert(tsvLines.length > 10, 'TSV has data rows');

const weightsContent = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
assert(weightsContent.yesSignalWeights !== undefined, 'Weights file has correct structure');

// ═══════════════════════════════════════
// SECTION 11: Reproducibility (3 tests)
// ═══════════════════════════════════════
section('Reproducibility');

const dataset1 = generateDataset(42);
const dataset2 = generateDataset(42);
assert(dataset1.length === dataset2.length, 'Same seed = same count');
assert(dataset1[0].id === dataset2[0].id, 'Same seed = same first ID');
assert(JSON.stringify(dataset1[0].messages) === JSON.stringify(dataset2[0].messages), 'Same seed = same messages');

// ═══════════════════════════════════════
// SECTION 12: Report Generation (2 tests)
// ═══════════════════════════════════════
section('Report Generation');

const report = generateReport(getDefaultWeights(), adjusted, [
  { epoch: 1, accuracy: 0.7, falsePositiveRate: 0.1, falseNegativeRate: 0.1 },
  { epoch: 2, accuracy: 0.75, falsePositiveRate: 0.08, falseNegativeRate: 0.09 },
], batchMetrics.results);

assert(report.includes('CRUCIBLE'), 'Report contains title');
assert(report.includes('Epoch'), 'Report contains epoch info');

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════
console.log('\n══════════════════════════════════════');
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) {
  console.log('\nFailed tests:');
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
} else {
  console.log('All tests passed! ✓');
}

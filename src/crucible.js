#!/usr/bin/env node
/**
 * The Crucible — V18 Local Overnight Optimizer
 * Pure Node.js, zero API calls. Runs 2,000 conversations through V18 pipeline,
 * grades against expected outcomes, adjusts weights via gradient-free optimization.
 */

const fs = require('fs');
const path = require('path');
const { MomentumTracker, YES_SIGNALS, RESISTANCE_SIGNALS, DEFAULT_THRESHOLDS } = require('./momentum-tracker');
const { ArchetypeClassifier, classify } = require('./archetypes');
const { PatternLibrary } = require('./pattern-library');
const { NoveltyDetector } = require('./novelty-detector');
const { classifyMessage } = require('./message-classifier');
const { generateDataset, saveDataset, SeededRandom } = require('./crucible-dataset');

// ─── Weight System ───
function getDefaultWeights() {
  return {
    // Momentum signal weights (mirrors YES_SIGNALS / RESISTANCE_SIGNALS)
    yesSignalWeights: {
      'asks question': 0.5,
      'agreement': 0.7,
      'detail sharing': 1.0,
      'scheduling intent': 1.2,
      'gratitude': 0.5,
      'urgency': 1.5,
      'strong emphasis': 1.0,
      'emergency situation': 2.0,
      'buying commitment': 1.5,
      'returning customer': 1.0,
      'commercial scope': 1.0,
      'insurance inquiry': 0.8,
      'positive sentiment shift': 1.0,
    },
    resistanceSignalWeights: {
      'minimal response': -1.0,
      'hesitation': -0.8,
      'price resistance': -1.0,
      'third-party deferral': -0.7,
      'timing resistance': -1.2,
      'opt-out signal': -2.0,
      'hostile rejection': -2.0,
    },
    // Momentum thresholds by archetype dimension
    momentumThresholds: { ...DEFAULT_THRESHOLDS },
    // Transfer momentum threshold (global minimum)
    globalTransferThreshold: 1.5,
    // Pattern strength multipliers by archetype
    patternStrengths: {},
    // Objection strategy win rates
    objectionStrategies: {
      price: { weight: 1.0, attempts: 0, wins: 0 },
      think_about_it: { weight: 1.0, attempts: 0, wins: 0 },
      spouse: { weight: 1.0, attempts: 0, wins: 0 },
      timing: { weight: 1.0, attempts: 0, wins: 0 },
      trust: { weight: 1.0, attempts: 0, wins: 0 },
      competitor: { weight: 1.0, attempts: 0, wins: 0 },
      diy: { weight: 1.0, attempts: 0, wins: 0 },
    },
    // Length bonus thresholds
    lengthBonusThreshold: 80,
    lengthBonusExtraThreshold: 150,
    shortMessagePenaltyThreshold: 10,
    // Weight bounds
    _bounds: {
      yesMin: 0.1,
      yesMax: 5.0,
      resistanceMin: -5.0,
      resistanceMax: -0.1,
      thresholdMin: 0.5,
      thresholdMax: 5.0,
    },
  };
}

function clampWeights(weights) {
  const b = weights._bounds;
  for (const [k, v] of Object.entries(weights.yesSignalWeights)) {
    weights.yesSignalWeights[k] = Math.max(b.yesMin, Math.min(b.yesMax, v));
  }
  for (const [k, v] of Object.entries(weights.resistanceSignalWeights)) {
    weights.resistanceSignalWeights[k] = Math.max(b.resistanceMin, Math.min(b.resistanceMax, v));
  }
  for (const [k, v] of Object.entries(weights.momentumThresholds)) {
    if (k === '_default') continue;
    weights.momentumThresholds[k] = Math.max(b.thresholdMin, Math.min(b.thresholdMax, v));
  }
  weights.globalTransferThreshold = Math.max(0.5, Math.min(4.0, weights.globalTransferThreshold));
  return weights;
}

// ─── Pipeline: Run a conversation through V18 modules ───
function runConversation(conversation, weights) {
  const tracker = new MomentumTracker();
  const classifier = new ArchetypeClassifier();
  const novelty = new NoveltyDetector();
  const convId = conversation.id;

  // Apply custom weights to tracker signals
  const customYes = YES_SIGNALS.map(s => {
    const w = weights.yesSignalWeights[s.reason];
    return w !== undefined ? { ...s, weight: w } : s;
  });
  const customRes = RESISTANCE_SIGNALS.map(s => {
    const w = weights.resistanceSignalWeights[s.reason];
    return w !== undefined ? { ...s, weight: w } : s;
  });

  // Build lead data from first message
  const leadMessages = conversation.messages.filter(m => m.role === 'lead');
  const agentMessages = conversation.messages.filter(m => m.role === 'agent');
  
  if (leadMessages.length === 0) {
    return { outcome: 'block', momentum: 0, trend: 'flat', signals: [], archetype: 'unknown' };
  }

  const leadData = {
    serviceType: conversation.service_type,
    message: leadMessages[0].text,
  };

  // Classify archetype
  const archetypeResult = classifier.classify(leadData, conversation.messages);
  const archetype = archetypeResult.archetype;

  // Run each lead message through momentum tracker with custom weights
  let lastMomentum = 0;
  const momValues = [];
  const allSignals = [];

  for (let i = 0; i < leadMessages.length; i++) {
    const msg = leadMessages[i].text;
    
    // Custom scoring (replicate momentum-tracker logic with custom weights)
    let delta = 0;
    const msgSignals = [];

    for (const sig of customYes) {
      if (sig.pattern.test(msg)) {
        delta += sig.weight;
        msgSignals.push(sig.reason);
      }
    }
    for (const sig of customRes) {
      if (sig.pattern.test(msg)) {
        delta += sig.weight;
        msgSignals.push(sig.reason);
      }
    }
    if (msg.length > weights.lengthBonusThreshold) delta += 0.3;
    if (msg.length > weights.lengthBonusExtraThreshold) delta += 0.3;
    if (msg.length < weights.shortMessagePenaltyThreshold && msgSignals.length === 0) {
      delta -= 0.5;
      msgSignals.push('very short message');
    }

    lastMomentum = Math.max(0, lastMomentum + delta);
    momValues.push(lastMomentum);
    allSignals.push(...msgSignals);

    // Novelty check
    const noveltyResult = novelty.check(null, msg, archetype, {
      previousMessages: leadMessages.slice(0, i),
    });

    // Message classification
    classifyMessage(msg, { messageIndex: i, leadData });
  }

  // Determine outcome
  const dims = archetype.split(':');
  let threshold = weights.globalTransferThreshold;
  for (const dim of dims) {
    if (weights.momentumThresholds[dim] !== undefined) {
      threshold = weights.momentumThresholds[dim];
      break;
    }
  }

  // Check for opt-out/block signals (careful not to match "wont stop" in emergencies)
  const hasOptOut = leadMessages.some(m => {
    const t = m.text;
    // Direct opt-out commands (but not "wont stop working", "wont stop running" etc)
    if (/\b(unsubscribe|remove me|don't contact|leave me alone|wrong number|not interested|reported as spam|this is spam)\b/i.test(t)) return true;
    // "stop" only if it's a command, not describing a problem
    if (/^stop\b/i.test(t.trim())) return true;
    if (/\bi said stop\b/i.test(t)) return true;
    return false;
  });
  const hasHostileSignals = allSignals.filter(s => s === 'opt-out signal' || s === 'hostile rejection').length > 0;
  const hasDisengagement = leadMessages.every(m => m.text.length < 25 && !/\b(need|help|fix|repair|install|service|broken|leak|burst|emergency|flood|sparking|smoke)\b/i.test(m.text));
  const hasMinimalEngagement = hasDisengagement && leadMessages.length >= 1 && !allSignals.some(s => 
    s === 'scheduling intent' || s === 'detail sharing' || s === 'sharing contact' || 
    s === 'gave phone number' || s === 'urgency' || s === 'emergency situation' ||
    s === 'buying commitment' || s === 'gave address' || s === 'commercial scope'
  );
  const isHostile = hasHostileSignals;

  // Momentum acceleration bonus for warming conversations
  let accelerationBonus = 0;
  if (momValues.length >= 3) {
    let consecutiveIncreases = 0;
    for (let i = 1; i < momValues.length; i++) {
      if (momValues[i] > momValues[i - 1]) consecutiveIncreases++;
    }
    if (consecutiveIncreases >= 2) {
      accelerationBonus = 0.5 * consecutiveIncreases;
      lastMomentum += accelerationBonus;
    }
  }

  // Last-message sentiment check: if the final lead message shows resistance/deferral,
  // apply a recency penalty (final message matters most for disposition)
  if (leadMessages.length >= 2) {
    const lastMsg = leadMessages[leadMessages.length - 1].text;
    const hasLastResistance = /\b(think about it|sleep on it|get back to you|let me (consider|check|talk|ask|see)|not right now|maybe later|not sure yet|keep .* in mind|ill let you know|thanks for the info)\b/i.test(lastMsg);
    // Price-only inquiry is resistance only if hedging (e.g., "maybe. what would it cost?")
    const isPriceHedge = /\b(maybe|not sure|just wondering)\b/i.test(lastMsg) && /\b(cost|how much|price|what would)\b/i.test(lastMsg);
    const hasLastDeferral = /\b(check with|talk to my|run it by|building owner|partner|spouse|wife|husband|roommate)\b/i.test(lastMsg);
    if (hasLastResistance || hasLastDeferral || isPriceHedge) {
      // Significantly reduce momentum — this lead is NOT ready to transfer
      lastMomentum = Math.min(lastMomentum, threshold * 0.6);
    }
  }

  let outcome;
  if (hasOptOut || isHostile) {
    outcome = 'block';
  } else if (hasMinimalEngagement) {
    outcome = 'block';
  } else if (lastMomentum >= threshold) {
    outcome = 'transfer';
  } else if (lastMomentum > 0 && lastMomentum < threshold) {
    outcome = 'nurture';
  } else {
    outcome = 'nurture';
  }

  // Determine momentum trend
  let trend = 'flat';
  if (momValues.length >= 2) {
    const first = momValues[0];
    const last = momValues[momValues.length - 1];
    if (last > first + 0.3) trend = 'rising';
    else if (last < first - 0.3) trend = 'falling';
  }

  return {
    outcome,
    momentum: lastMomentum,
    trend,
    signals: allSignals,
    archetype,
    threshold,
  };
}

// ─── Batch Processing ───
function processBatch(conversations, weights) {
  let correct = 0;
  let total = conversations.length;
  let totalMomentum = 0;
  let transfers = 0;
  let falsePositives = 0; // predicted transfer, expected block/nurture
  let falseNegatives = 0; // predicted block/nurture, expected transfer
  const results = [];

  for (const conv of conversations) {
    const result = runConversation(conv, weights);
    const isCorrect = result.outcome === conv.expected_outcome;
    if (isCorrect) correct++;
    
    totalMomentum += result.momentum;
    if (result.outcome === 'transfer') transfers++;
    if (result.outcome === 'transfer' && conv.expected_outcome !== 'transfer') falsePositives++;
    if (result.outcome !== 'transfer' && conv.expected_outcome === 'transfer') falseNegatives++;

    results.push({
      id: conv.id,
      category: conv.category,
      expected: conv.expected_outcome,
      predicted: result.outcome,
      correct: isCorrect,
      momentum: result.momentum,
      archetype: result.archetype,
      signals: result.signals,
    });
  }

  return {
    accuracy: total > 0 ? correct / total : 0,
    correct,
    total,
    avgMomentum: total > 0 ? totalMomentum / total : 0,
    transferRate: total > 0 ? transfers / total : 0,
    falsePositiveRate: total > 0 ? falsePositives / total : 0,
    falseNegativeRate: total > 0 ? falseNegatives / total : 0,
    results,
  };
}

// ─── Weight Adjustment ───
function adjustWeights(weights, batchMetrics, learningRate = 0.05) {
  const newWeights = JSON.parse(JSON.stringify(weights));
  
  for (const result of batchMetrics.results) {
    if (result.correct) {
      // Strengthen signals that contributed to correct outcome
      for (const signal of result.signals) {
        if (newWeights.yesSignalWeights[signal] !== undefined) {
          newWeights.yesSignalWeights[signal] += learningRate * 0.5;
        }
        if (newWeights.resistanceSignalWeights[signal] !== undefined) {
          newWeights.resistanceSignalWeights[signal] -= learningRate * 0.3; // More negative = stronger resistance
        }
      }
    } else {
      // Weaken signals that contributed to wrong outcome
      if (result.expected === 'transfer' && result.predicted !== 'transfer') {
        // False negative: we should have transferred but didn't → lower threshold, boost yes signals
        const dims = (result.archetype || '').split(':');
        for (const dim of dims) {
          if (newWeights.momentumThresholds[dim] !== undefined) {
            newWeights.momentumThresholds[dim] -= learningRate * 0.3;
          }
        }
        for (const signal of result.signals) {
          if (newWeights.yesSignalWeights[signal] !== undefined) {
            newWeights.yesSignalWeights[signal] += learningRate;
          }
        }
      } else if (result.expected !== 'transfer' && result.predicted === 'transfer') {
        // False positive: we transferred when we shouldn't → raise threshold, weaken yes signals
        const dims = (result.archetype || '').split(':');
        for (const dim of dims) {
          if (newWeights.momentumThresholds[dim] !== undefined) {
            newWeights.momentumThresholds[dim] += learningRate * 0.3;
          }
        }
        for (const signal of result.signals) {
          if (newWeights.yesSignalWeights[signal] !== undefined) {
            newWeights.yesSignalWeights[signal] -= learningRate * 0.5;
          }
        }
      } else if (result.expected === 'block' && result.predicted !== 'block') {
        // Should have blocked → boost resistance signals
        for (const signal of result.signals) {
          if (newWeights.resistanceSignalWeights[signal] !== undefined) {
            newWeights.resistanceSignalWeights[signal] -= learningRate;
          }
        }
      }
    }

    // Update objection strategies
    if (result.category === 'objection_heavy') {
      // Find which objection types from the conversation's data
      // We don't have direct access here so we infer from signals
      for (const signal of result.signals) {
        if (signal === 'price resistance' && newWeights.objectionStrategies.price) {
          newWeights.objectionStrategies.price.attempts++;
          if (result.correct) newWeights.objectionStrategies.price.wins++;
          newWeights.objectionStrategies.price.weight = newWeights.objectionStrategies.price.attempts > 0
            ? newWeights.objectionStrategies.price.wins / newWeights.objectionStrategies.price.attempts
            : 1.0;
        }
        if (signal === 'hesitation' && newWeights.objectionStrategies.think_about_it) {
          newWeights.objectionStrategies.think_about_it.attempts++;
          if (result.correct) newWeights.objectionStrategies.think_about_it.wins++;
          newWeights.objectionStrategies.think_about_it.weight = newWeights.objectionStrategies.think_about_it.attempts > 0
            ? newWeights.objectionStrategies.think_about_it.wins / newWeights.objectionStrategies.think_about_it.attempts
            : 1.0;
        }
        if (signal === 'third-party deferral' && newWeights.objectionStrategies.spouse) {
          newWeights.objectionStrategies.spouse.attempts++;
          if (result.correct) newWeights.objectionStrategies.spouse.wins++;
          newWeights.objectionStrategies.spouse.weight = newWeights.objectionStrategies.spouse.attempts > 0
            ? newWeights.objectionStrategies.spouse.wins / newWeights.objectionStrategies.spouse.attempts
            : 1.0;
        }
        if (signal === 'timing resistance' && newWeights.objectionStrategies.timing) {
          newWeights.objectionStrategies.timing.attempts++;
          if (result.correct) newWeights.objectionStrategies.timing.wins++;
          newWeights.objectionStrategies.timing.weight = newWeights.objectionStrategies.timing.attempts > 0
            ? newWeights.objectionStrategies.timing.wins / newWeights.objectionStrategies.timing.attempts
            : 1.0;
        }
      }
    }
  }

  return clampWeights(newWeights);
}

// ─── Shuffle with seed ───
function shuffleArray(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─── Report Generation ───
function generateReport(initialWeights, finalWeights, epochSummaries, allResults) {
  const lines = [];
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push('║            THE CRUCIBLE — OPTIMIZATION REPORT           ║');
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');

  // Epoch progression
  lines.push('── Epoch Progression ──');
  for (const ep of epochSummaries) {
    const delta = ep.accuracy - (epochSummaries[0]?.accuracy || 0);
    const deltaStr = delta >= 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`;
    lines.push(`  Epoch ${ep.epoch}: accuracy=${(ep.accuracy * 100).toFixed(1)}% (${ep.epoch === 1 ? 'baseline' : deltaStr}) | FP=${(ep.falsePositiveRate * 100).toFixed(1)}% | FN=${(ep.falseNegativeRate * 100).toFixed(1)}%`);
  }
  lines.push('');

  // Top 10 biggest weight changes
  lines.push('── Top 10 Biggest Weight Changes ──');
  const changes = [];
  for (const [k, v] of Object.entries(finalWeights.yesSignalWeights)) {
    const orig = initialWeights.yesSignalWeights[k] || 0;
    changes.push({ key: `yes:${k}`, before: orig, after: v, delta: Math.abs(v - orig) });
  }
  for (const [k, v] of Object.entries(finalWeights.resistanceSignalWeights)) {
    const orig = initialWeights.resistanceSignalWeights[k] || 0;
    changes.push({ key: `resistance:${k}`, before: orig, after: v, delta: Math.abs(v - orig) });
  }
  for (const [k, v] of Object.entries(finalWeights.momentumThresholds)) {
    if (k === '_default') continue;
    const orig = initialWeights.momentumThresholds[k] || 0;
    changes.push({ key: `threshold:${k}`, before: orig, after: v, delta: Math.abs(v - orig) });
  }
  changes.sort((a, b) => b.delta - a.delta);
  for (const c of changes.slice(0, 10)) {
    const dir = c.after > c.before ? '↑' : c.after < c.before ? '↓' : '=';
    lines.push(`  ${dir} ${c.key}: ${c.before.toFixed(3)} → ${c.after.toFixed(3)} (Δ${c.delta.toFixed(3)})`);
  }
  lines.push('');

  // Archetype accuracy breakdown
  lines.push('── Archetype Accuracy Breakdown ──');
  const catAccuracy = {};
  for (const r of allResults) {
    if (!catAccuracy[r.category]) catAccuracy[r.category] = { correct: 0, total: 0 };
    catAccuracy[r.category].total++;
    if (r.correct) catAccuracy[r.category].correct++;
  }
  for (const [cat, stats] of Object.entries(catAccuracy).sort((a, b) => a[0].localeCompare(b[0]))) {
    const pct = (stats.correct / stats.total * 100).toFixed(1);
    lines.push(`  ${cat}: ${pct}% (${stats.correct}/${stats.total})`);
  }
  lines.push('');

  // Objection strategy win rates
  lines.push('── Objection Strategy Win Rates ──');
  for (const [type, stats] of Object.entries(finalWeights.objectionStrategies)) {
    if (stats.attempts > 0) {
      lines.push(`  ${type}: ${(stats.wins / stats.attempts * 100).toFixed(1)}% (${stats.wins}/${stats.attempts})`);
    } else {
      lines.push(`  ${type}: no data`);
    }
  }
  lines.push('');

  // Momentum threshold convergence
  lines.push('── Momentum Threshold Convergence ──');
  for (const [k, v] of Object.entries(finalWeights.momentumThresholds)) {
    if (k === '_default') continue;
    const orig = initialWeights.momentumThresholds[k] || v;
    const converged = Math.abs(v - orig) < 0.1 ? '✓ stable' : `shifted ${v > orig ? '↑' : '↓'}`;
    lines.push(`  ${k}: ${orig.toFixed(2)} → ${v.toFixed(2)} (${converged})`);
  }
  lines.push('');

  // Recommendations
  lines.push('── Recommendations ──');
  const finalEp = epochSummaries[epochSummaries.length - 1];
  if (finalEp) {
    if (finalEp.falsePositiveRate > 0.1) {
      lines.push('  ⚠ High false positive rate — consider raising transfer thresholds');
    }
    if (finalEp.falseNegativeRate > 0.15) {
      lines.push('  ⚠ High false negative rate — consider lowering transfer thresholds');
    }
    if (finalEp.accuracy < 0.7) {
      lines.push('  ⚠ Accuracy below 70% — consider more epochs or dataset refinement');
    }
    if (finalEp.accuracy > 0.85) {
      lines.push('  ✓ Good accuracy — weights are well-calibrated');
    }
    const improving = epochSummaries.length >= 2 &&
      epochSummaries[epochSummaries.length - 1].accuracy > epochSummaries[epochSummaries.length - 2].accuracy;
    if (improving) {
      lines.push('  → Still improving — more epochs may help');
    } else {
      lines.push('  → Convergence reached — further epochs unlikely to help');
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ─── Main Crucible Loop ───
async function runCrucible(options = {}) {
  const {
    epochs = 5,
    batchSize = 50,
    verbose = false,
    seed = 42,
    datasetPath = path.join(__dirname, '..', 'data', 'crucible-dataset.json'),
    outputWeightsPath = path.join(__dirname, '..', 'data', 'crucible-optimized-weights.json'),
    outputResultsPath = path.join(__dirname, '..', 'data', 'crucible-results.tsv'),
  } = options;

  const startTime = Date.now();
  console.log('[Crucible] Starting optimization...');
  console.log(`[Crucible] Epochs: ${epochs}, Batch size: ${batchSize}, Seed: ${seed}`);

  // Load or generate dataset
  let dataset;
  if (fs.existsSync(datasetPath)) {
    dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    console.log(`[Crucible] Loaded ${dataset.length} conversations from ${datasetPath}`);
  } else {
    console.log('[Crucible] Generating dataset...');
    dataset = generateDataset(seed);
    saveDataset(dataset, datasetPath);
  }

  // Initialize weights
  let weights = getDefaultWeights();
  const initialWeights = JSON.parse(JSON.stringify(weights));

  // TSV header
  const tsvLines = ['epoch\tbatch\taccuracy\tavg_momentum\ttransfer_rate\tfalse_positive_rate\tfalse_negative_rate'];

  const epochSummaries = [];
  const rng = new SeededRandom(seed);
  let allResults = [];

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const shuffled = shuffleArray(dataset, rng);
    let epochCorrect = 0;
    let epochTotal = 0;
    let epochFP = 0;
    let epochFN = 0;
    let epochMomentum = 0;
    let epochTransfers = 0;
    let batchNum = 0;

    for (let i = 0; i < shuffled.length; i += batchSize) {
      batchNum++;
      const batch = shuffled.slice(i, i + batchSize);
      const metrics = processBatch(batch, weights);

      // Adjust weights
      weights = adjustWeights(weights, metrics);

      epochCorrect += metrics.correct;
      epochTotal += metrics.total;
      epochFP += metrics.falsePositiveRate * metrics.total;
      epochFN += metrics.falseNegativeRate * metrics.total;
      epochMomentum += metrics.avgMomentum * metrics.total;
      epochTransfers += metrics.transferRate * metrics.total;

      // TSV row
      tsvLines.push([
        epoch, batchNum,
        metrics.accuracy.toFixed(4),
        metrics.avgMomentum.toFixed(4),
        metrics.transferRate.toFixed(4),
        metrics.falsePositiveRate.toFixed(4),
        metrics.falseNegativeRate.toFixed(4),
      ].join('\t'));

      if (verbose && batchNum % 10 === 0) {
        console.log(`  [Epoch ${epoch}] Batch ${batchNum}: accuracy=${(metrics.accuracy * 100).toFixed(1)}%`);
      }

      if (epoch === epochs) {
        allResults.push(...metrics.results);
      }
    }

    const epochAccuracy = epochTotal > 0 ? epochCorrect / epochTotal : 0;
    const summary = {
      epoch,
      accuracy: epochAccuracy,
      falsePositiveRate: epochTotal > 0 ? epochFP / epochTotal : 0,
      falseNegativeRate: epochTotal > 0 ? epochFN / epochTotal : 0,
      avgMomentum: epochTotal > 0 ? epochMomentum / epochTotal : 0,
      transferRate: epochTotal > 0 ? epochTransfers / epochTotal : 0,
    };
    epochSummaries.push(summary);
    console.log(`[Crucible] Epoch ${epoch}/${epochs}: accuracy=${(epochAccuracy * 100).toFixed(1)}% | FP=${(summary.falsePositiveRate * 100).toFixed(1)}% | FN=${(summary.falseNegativeRate * 100).toFixed(1)}%`);
  }

  // Save results
  const dataDir = path.dirname(outputWeightsPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(outputWeightsPath, JSON.stringify(weights, null, 2));
  console.log(`[Crucible] Optimized weights → ${outputWeightsPath}`);

  fs.writeFileSync(outputResultsPath, tsvLines.join('\n'));
  console.log(`[Crucible] Results → ${outputResultsPath}`);

  // Generate report
  const report = generateReport(initialWeights, weights, epochSummaries, allResults);
  console.log(report);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Crucible] Complete in ${elapsed}s`);

  return { initialWeights, finalWeights: weights, epochSummaries, report, elapsed };
}

// ─── CLI ───
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--epochs' && args[i + 1]) options.epochs = parseInt(args[++i]);
    if (args[i] === '--batch-size' && args[i + 1]) options.batchSize = parseInt(args[++i]);
    if (args[i] === '--verbose') options.verbose = true;
    if (args[i] === '--seed' && args[i + 1]) options.seed = parseInt(args[++i]);
  }

  runCrucible(options).catch(err => {
    console.error('[Crucible] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runCrucible, getDefaultWeights, clampWeights, runConversation, processBatch, adjustWeights, generateReport };

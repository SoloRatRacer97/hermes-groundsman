/**
 * Pattern Library — V18 Conversation Antibodies
 * Stores proven conversation patterns keyed by archetype hash.
 * Persists to JSON. Strengthens on success, weakens on failure.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'patterns', 'conversation-patterns.json');
const MIN_SAMPLE_SIZE = 3;
const MIN_CONVERSION_RATE = 0.7;

class PatternLibrary {
  constructor(filePath) {
    this.filePath = filePath || DEFAULT_PATH;
    this.patterns = {};
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.patterns = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (e) {
      console.error('[PatternLibrary] Load error:', e.message);
      this.patterns = {};
    }
  }

  _save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.patterns, null, 2));
    } catch (e) {
      console.error('[PatternLibrary] Save error:', e.message);
    }
  }

  /**
   * Record a completed conversation
   * @param {string} archetype - Archetype hash
   * @param {Array} conversation - [{role, text}, ...]
   * @param {string} outcome - 'transferred'|'ghosted'|'declined'|'opt-out'
   */
  record(archetype, conversation, outcome) {
    if (!this.patterns[archetype]) {
      this.patterns[archetype] = {
        sampleSize: 0,
        successCount: 0,
        conversionRate: 0,
        skeleton: [],
        avgConversationLength: 0,
        lastUpdated: new Date().toISOString(),
        source: 'production',
      };
    }

    const p = this.patterns[archetype];
    p.sampleSize++;
    if (outcome === 'transferred') {
      p.successCount++;
    }
    p.conversionRate = p.successCount / p.sampleSize;

    // Update avg conversation length
    const leadMsgCount = conversation.filter(m => m.role === 'lead').length;
    p.avgConversationLength = ((p.avgConversationLength * (p.sampleSize - 1)) + leadMsgCount) / p.sampleSize;

    // Update skeleton from successful conversations
    if (outcome === 'transferred' && conversation.length > 0) {
      this._updateSkeleton(p, conversation);
    }

    p.lastUpdated = new Date().toISOString();
    this._save();
  }

  /**
   * Look up best pattern for an archetype
   * @param {string} archetype
   * @returns {object|null} { skeleton, confidence, sampleSize, conversionRate } or null
   */
  lookup(archetype) {
    const p = this.patterns[archetype];
    if (!p) return null;
    if (p.sampleSize < MIN_SAMPLE_SIZE) return null;
    if (p.conversionRate < MIN_CONVERSION_RATE) return null;

    return {
      skeleton: p.skeleton,
      confidence: Math.min(0.99, p.conversionRate * (1 - 1 / p.sampleSize)),
      sampleSize: p.sampleSize,
      conversionRate: p.conversionRate,
      source: p.source || 'production',
    };
  }

  /**
   * Weaken a pattern after bad outcome
   */
  weaken(archetype, conversation, outcome) {
    if (!this.patterns[archetype]) return;
    const p = this.patterns[archetype];
    p.sampleSize++;
    // Don't increment successCount
    p.conversionRate = p.successCount / p.sampleSize;
    p.lastUpdated = new Date().toISOString();
    this._save();
  }

  /**
   * Get library stats
   */
  getStats() {
    const archetypes = Object.keys(this.patterns);
    const total = archetypes.length;
    const viable = archetypes.filter(a => {
      const p = this.patterns[a];
      return p.sampleSize >= MIN_SAMPLE_SIZE && p.conversionRate >= MIN_CONVERSION_RATE;
    }).length;

    const rates = archetypes.map(a => this.patterns[a].conversionRate).filter(r => r > 0);
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

    const topArchetypes = archetypes
      .map(a => ({ archetype: a, ...this.patterns[a] }))
      .sort((a, b) => b.sampleSize - a.sampleSize)
      .slice(0, 5);

    return {
      totalPatterns: total,
      viablePatterns: viable,
      coveragePercent: total > 0 ? (viable / total * 100).toFixed(1) : '0.0',
      avgConversionRate: avgRate.toFixed(3),
      topArchetypes,
    };
  }

  /**
   * Get raw pattern (for testing)
   */
  getPattern(archetype) {
    return this.patterns[archetype] || null;
  }

  /**
   * Set pattern directly (for seeding)
   */
  setPattern(archetype, pattern) {
    this.patterns[archetype] = pattern;
    this._save();
  }

  _updateSkeleton(pattern, conversation) {
    // Build skeleton from conversation structure
    const hermesMsgs = conversation.filter(m => m.role === 'hermes');
    if (hermesMsgs.length === 0) return;

    // Only update skeleton if we don't have one or it's from synthetic data
    if (pattern.skeleton.length > 0 && pattern.source === 'production' && pattern.sampleSize > 5) return;

    const skeleton = hermesMsgs.map((msg, i) => ({
      step: i + 1,
      type: _inferStepType(msg.text, i, hermesMsgs.length),
      keyPoints: _inferKeyPoints(msg.text),
      avgLength: msg.text.length,
      examples: [msg.text],
    }));

    pattern.skeleton = skeleton;
  }
}

function _inferStepType(text, index, total) {
  const lower = text.toLowerCase();
  if (index === 0) {
    if (/what('s| is) going on|what can|how can|what happened/i.test(lower)) return 'empathy_opener';
    return 'greeting';
  }
  if (index === total - 1) {
    if (/call|reach|phone|number|touch/i.test(lower)) return 'transfer';
    return 'closing';
  }
  if (/when|where|area|location|zip|address/i.test(lower)) return 'quick_qualify';
  if (/how long|start|happen|describe/i.test(lower)) return 'discovery';
  if (/understand|sorry|stressful|tough/i.test(lower)) return 'empathy';
  return 'follow_up';
}

function _inferKeyPoints(text) {
  const points = [];
  if (/\?/.test(text)) points.push('asks question');
  if (/name|who/i.test(text)) points.push('personalization');
  if (/when|time|schedule/i.test(text)) points.push('timing');
  if (/where|area|location/i.test(text)) points.push('location');
  if (/call|phone|number|reach/i.test(text)) points.push('transfer setup');
  if (/sorry|understand|stressful/i.test(text)) points.push('empathy');
  if (points.length === 0) points.push('general engagement');
  return points;
}

module.exports = { PatternLibrary };

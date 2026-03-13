/**
 * Tier Router — V17 Tiered Model Routing
 * Integrates message classifier with gaius-router for cost-optimized routing.
 * Tier 0: Template (free) | Tier 1: Haiku + compressed framework | Tier 2: Sonnet + full framework
 */

const { classifyMessage } = require('./message-classifier');
const { getTemplateResponse } = require('./response-templates');
const { defaultAuditLog } = require('./security-audit-log');

// Tier 1 model
const TIER_1_MODEL = 'claude-haiku-3-5';
// Tier 2 model (current default)
const TIER_2_MODEL = 'claude-sonnet-4';

class TierRouter {
  constructor(gaiusRouter) {
    this.gaiusRouter = gaiusRouter;
    this.stats = { tier0: 0, tier1: 0, tier2: 0, total: 0, overrides: 0 };
    console.log('[TierRouter] V17: Tiered model routing initialized');
  }

  /**
   * Route a message through the appropriate tier
   * @param {object} session - Session state
   * @param {string} message - Lead's message
   * @param {object} context - Context from hermes-interactive (isFirstMessage, isRevived, etc.)
   * @param {object} conversationCtx - Context for classifier
   * @returns {Promise<{ response: string, tier: number, classification: object, apiCalled: boolean }>}
   */
  async route(session, message, context, conversationCtx = {}) {
    this.stats.total++;

    // Classify
    const classification = classifyMessage(message, conversationCtx);
    let tier = classification.tier;

    // Safety: if confidence < 0.7, always route to Tier 2
    if (classification.confidence < 0.7) {
      if (tier < 2) {
        this.stats.overrides++;
        tier = 2;
        classification.reasoning += ' [OVERRIDE: low confidence → Tier 2]';
      }
    }

    // Log classification
    this._logDecision(session, message, tier, classification);

    let response;
    let apiCalled = false;

    if (tier === 0) {
      response = this._handleTier0(message, classification, session, conversationCtx);
      this.stats.tier0++;
    } else if (tier === 1) {
      response = await this._handleTier1(session, message, context);
      apiCalled = true;
      this.stats.tier1++;
    } else {
      response = await this._handleTier2(session, message, context);
      apiCalled = true;
      this.stats.tier2++;
    }

    return { response, tier, classification, apiCalled };
  }

  /**
   * Tier 0: Template response (free, instant)
   */
  _handleTier0(message, classification, session, ctx) {
    const leadData = ctx.leadData || { name: session.name, serviceType: session.serviceType, phone: session.phone };

    if (classification.signals.includes('affirmative')) {
      return getTemplateResponse('affirmative', leadData);
    }
    if (classification.signals.includes('greeting')) {
      return getTemplateResponse('greeting', leadData);
    }
    if (classification.signals.includes('opt_out')) {
      return getTemplateResponse('opt_out', leadData);
    }
    if (classification.signals.includes('negative_short')) {
      return getTemplateResponse('negative_short', leadData);
    }
    if (classification.signals.includes('phone_number')) {
      // Extract phone number from message
      const phoneMatch = message.match(/\d{3}[\-.\s]?\d{3}[\-.\s]?\d{4}/);
      const extractedPhone = phoneMatch ? phoneMatch[0] : '';
      return getTemplateResponse('transfer_phone', { ...leadData, phone: extractedPhone });
    }
    if (classification.signals.includes('emoji_only')) {
      return getTemplateResponse('emoji_acknowledgment', leadData);
    }

    // Fallback for Tier 0 — shouldn't normally hit this
    return getTemplateResponse('affirmative', leadData);
  }

  /**
   * Tier 1: Haiku + compressed framework
   */
  async _handleTier1(session, message, context) {
    return this.gaiusRouter.askGaius(session, message, {
      ...context,
      modelOverride: TIER_1_MODEL,
      frameworkOverride: 'FRAMEWORK-v17-compressed.md',
    });
  }

  /**
   * Tier 2: Sonnet + full framework (current behavior)
   */
  async _handleTier2(session, message, context) {
    return this.gaiusRouter.askGaius(session, message, {
      ...context,
      modelOverride: TIER_2_MODEL,
    });
  }

  /**
   * Log routing decision to audit log
   */
  _logDecision(session, message, tier, classification) {
    try {
      defaultAuditLog._write({
        type: 'tier_routing',
        sessionId: session.sessionId || 'unknown',
        tier,
        confidence: classification.confidence,
        signals: classification.signals,
        reasoning: classification.reasoning,
        messageLength: (message || '').length,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[TierRouter] Audit log error:', e.message);
    }

    console.log(`[TierRouter] Tier ${tier} (${classification.confidence.toFixed(2)}) — ${classification.reasoning}`);
  }

  /**
   * Get tier distribution stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset stats (for testing)
   */
  resetStats() {
    this.stats = { tier0: 0, tier1: 0, tier2: 0, total: 0, overrides: 0 };
  }
}

module.exports = TierRouter;
module.exports.TIER_1_MODEL = TIER_1_MODEL;
module.exports.TIER_2_MODEL = TIER_2_MODEL;

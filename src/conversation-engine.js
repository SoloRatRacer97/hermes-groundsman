/**
 * Conversation Engine
 * V7: NO PRE-DECISION LOGIC
 * Packages full context and sends to Gaius for ALL decisions
 * Gaius reads FRAMEWORK-GROUNDSMAN.md and makes autonomous decisions
 */

const StateManager = require('./state-manager');
const GaiusRouter = require('./gaius-router');
const TierRouter = require('./tier-router');
const { classifyMessage } = require('./message-classifier');
const { validateOutput } = require('./output-validator');
const { ArchetypeClassifier } = require('./archetypes');
const { PatternLibrary } = require('./pattern-library');
const { SkeletonGenerator } = require('./skeleton-generator');
const { NoveltyDetector } = require('./novelty-detector');
const { MomentumTracker } = require('./momentum-tracker');
const { ObjectionRouter } = require('./objection-router');
const { seedPatternLibrary } = require('./seed-patterns');

class ConversationEngine {
  constructor() {
    this.stateManager = new StateManager();
    this.gaiusRouter = new GaiusRouter();
    this.tierRouter = new TierRouter(this.gaiusRouter);
    this.tierRoutingEnabled = true; // V17 feature flag
    
    // V18: Conversation Antibodies
    this.archetypeClassifier = new ArchetypeClassifier();
    this.patternLibrary = new PatternLibrary();
    this.skeletonGenerator = new SkeletonGenerator();
    this.noveltyDetector = new NoveltyDetector();
    this.antibodyEnabled = true; // V18 feature flag
    
    // V18.1: Momentum + Flow-Around
    this.momentumTracker = new MomentumTracker();
    this.objectionRouter = new ObjectionRouter();
    
    // Seed pattern library if empty
    const stats = this.patternLibrary.getStats();
    if (stats.totalPatterns === 0) {
      const count = seedPatternLibrary(this.patternLibrary);
      console.log(`[ConversationEngine] V18: Seeded ${count} synthetic archetypes`);
    }
    
    console.log('[ConversationEngine] V18: Conversation Antibodies enabled');
  }

  /**
   * Initialize new conversation from lead data
   * @param {object} leadData - Lead data from form
   * @returns {object} { session, message, shouldSend }
   */
  async startConversation(leadData) {
    console.log(`[ConversationEngine] Starting conversation for ${leadData.name}`);
    
    // Create session
    const session = this.stateManager.createSession(leadData);
    
    // Send opener to Gaius - let Gaius decide the path
    const response = await this.gaiusRouter.askGaius(
      session,
      session.originalMessage || '',
      { isFirstMessage: true }
    );
    
    this.stateManager.addToTranscript(session.sessionId, 'hermes', response);
    
    return {
      session: this.stateManager.getSession(session.sessionId),
      message: response,
      action: 'OPENER',
      shouldSend: true
    };
  }

  /**
   * Process inbound message from lead
   * @param {string} sessionId - Session identifier
   * @param {string} message - Lead's message
   * @returns {object} { session, response, action }
   */
  async processMessage(sessionId, message) {
    const session = this.stateManager.getSession(sessionId);
    
    if (!session) {
      console.error(`[ConversationEngine] Session not found: ${sessionId}`);
      return { session: null, response: null, action: 'ERROR' };
    }

    console.log(`[ConversationEngine] Processing message for ${sessionId}`);

    // Add to transcript
    this.stateManager.addToTranscript(sessionId, 'lead', message);

    // Get fresh session after transcript update
    const updatedSession = this.stateManager.getSession(sessionId);

    // Build context — flag revived leads so Gaius knows this is a returning lead
    const gaiusContext = {};
    if (updatedSession.revived) {
      gaiusContext.isRevived = true;
      gaiusContext.reviveCount = updatedSession.reviveCount || 1;
    }

    let response;
    let tierInfo = null;
    let antibodyUsed = false;

    // V18: Try antibody system first
    if (this.antibodyEnabled && updatedSession) {
      const transcript = updatedSession.transcript || [];
      const messages = transcript.map(t => ({ role: t.sender === 'lead' ? 'lead' : 'hermes', text: t.message || t.text || '' }));
      
      const archClassification = this.archetypeClassifier.classify(updatedSession, messages);
      updatedSession._archetype = archClassification.archetype;
      updatedSession._archetypeConfidence = archClassification.confidence;
      
      const pattern = this.patternLibrary.lookup(archClassification.archetype);
      
      if (pattern && archClassification.confidence >= 0.95 && pattern.confidence >= 0.7) {
        const hermesMsgCount = transcript.filter(t => t.sender === 'hermes').length;
        const stepIndex = Math.min(hermesMsgCount, pattern.skeleton.length - 1);
        const currentStep = pattern.skeleton[stepIndex];
        
        const noveltyCheck = this.noveltyDetector.check(
          currentStep, message, archClassification.archetype,
          { previousMessages: messages.slice(-3) }
        );
        
        if (!noveltyCheck.novel) {
          // V18.1: Momentum gating — score this message
          const momentumResult = this.momentumTracker.score(sessionId, message, archClassification.archetype);
          
          // Only advance to transfer step if momentum threshold met
          const isTransferStep = currentStep.type === 'transfer';
          if (isTransferStep && !momentumResult.readyForTransfer) {
            // Not enough momentum — stay on previous step or use follow_up
            const fallbackStep = { step: stepIndex, type: 'follow_up', keyPoints: ['build momentum'], avgLength: 80 };
            const generated = this.skeletonGenerator.generate(fallbackStep, updatedSession, messages);
            response = generated.text;
            tierInfo = { tier: generated.tier, classification: { signals: ['antibody', 'momentum-gate'], reasoning: `V18.1 momentum ${momentumResult.momentum.toFixed(1)}/${momentumResult.threshold} — not ready` }, apiCalled: false };
          } else {
            const generated = this.skeletonGenerator.generate(currentStep, updatedSession, messages);
            response = generated.text;
            tierInfo = { tier: generated.tier, classification: { signals: ['antibody'], reasoning: `V18 antibody: ${archClassification.archetype} step ${stepIndex + 1} (momentum: ${momentumResult.momentum.toFixed(1)})` }, apiCalled: false };
          }
          antibodyUsed = true;
          console.log(`[ConversationEngine] V18 Antibody hit: ${archClassification.archetype} step ${stepIndex + 1} momentum=${momentumResult.momentum.toFixed(1)}`);
        } else if (noveltyCheck.classification === 'objection') {
          // V18.1: Objection detected — route through flow-around
          const objection = this.objectionRouter.classify(message);
          if (objection.objectionType) {
            const flowAround = this.objectionRouter.route(objection.objectionType, archClassification.archetype);
            if (!flowAround.escalate) {
              response = flowAround.response;
              tierInfo = { tier: 0, classification: { signals: ['antibody', 'flow-around'], reasoning: `V18.1 objection: ${objection.objectionType} → ${flowAround.strategy}` }, apiCalled: false };
              antibodyUsed = true;
              console.log(`[ConversationEngine] V18.1 Flow-around: ${objection.objectionType} → ${flowAround.strategy}`);
            }
          }
          if (!antibodyUsed) {
            console.log(`[ConversationEngine] V18.1 Objection with no flow-around path — escalating`);
          }
        } else {
          console.log(`[ConversationEngine] V18 Novelty detected: ${noveltyCheck.reason} — escalating to Tier 2`);
        }
      }
    }

    if (!antibodyUsed && this.tierRoutingEnabled) {
      // V17: Tiered routing — classify then route
      const transcriptLength = (updatedSession.transcript || []).filter(t => t.sender === 'lead').length;
      const conversationCtx = {
        messageIndex: transcriptLength - 1, // 0-based, current message already added
        previousTier: updatedSession._lastTier,
        leadData: { name: updatedSession.name, serviceType: updatedSession.serviceType, phone: updatedSession.phone },
        isTransferred: updatedSession.transferred || false,
        sanitizationActions: updatedSession._lastSanitizationActions || [],
        anomalyFlagged: updatedSession._anomalyFlagged || false,
      };

      const routeResult = await this.tierRouter.route(updatedSession, message, gaiusContext, conversationCtx);
      response = routeResult.response;
      tierInfo = { tier: routeResult.tier, classification: routeResult.classification, apiCalled: routeResult.apiCalled };
      updatedSession._lastTier = routeResult.tier;

      console.log(`[ConversationEngine] V17 Tier ${routeResult.tier} — ${routeResult.classification.reasoning}`);
    } else {
      // Legacy: direct to Gaius
      response = await this.gaiusRouter.askGaius(updatedSession, message, gaiusContext);
    }

    // Add Gaius's response to transcript
    this.stateManager.addToTranscript(sessionId, 'hermes', response);

    // Check if Gaius indicated transfer/completion
    // Gaius will include markers in response that we parse
    const action = this._parseGaiusAction(response);

    // Update session state based on Gaius's decision
    if (action === 'TRANSFER') {
      this.stateManager.completeSession(sessionId);
    }

    // Strip system tags from response before returning
    const cleanResponse = response.replace(/\[TRANSFER\]/gi, '').replace(/\[CONTINUE\]/gi, '').replace(/\[COMPLETE\]/gi, '').trim();

    return {
      session: this.stateManager.getSession(sessionId),
      response: cleanResponse,
      action: action,
      shouldSend: true,
      tierInfo: tierInfo,
    };
  }

  /**
   * Parse Gaius's response for action indicators
   * Gaius includes markers like [TRANSFER] or [CONTINUE] in responses
   * @param {string} response - Gaius's response
   * @returns {string} Action type
   */
  _parseGaiusAction(response) {
    // [TRANSFER] tag is the sole authoritative signal from the framework
    if (response.includes('[TRANSFER]')) {
      return 'TRANSFER';
    }

    return 'CONTINUE';
  }

  /**
   * Generate an LLM follow-up message for a lead who hasn't replied
   * Routes through Gaius so the message sounds natural and references context
   * @param {string} sessionId - Session identifier
   * @param {object} followUpContext - { tier, bumpNumber, elapsedMinutes, isLastFollowUp }
   * @returns {Promise<string|null>} Generated follow-up message or null
   */
  async generateFollowUp(sessionId, followUpContext) {
    const session = this.stateManager.getSession(sessionId);
    if (!session) {
      console.error(`[ConversationEngine] generateFollowUp: session not found: ${sessionId}`);
      return null;
    }

    const context = {
      isFollowUp: true,
      followUpTier: followUpContext.tier,
      followUpBump: followUpContext.bumpNumber,
      elapsedMinutes: followUpContext.elapsedMinutes,
      isLastFollowUp: followUpContext.isLastFollowUp,
    };

    const followUpMessage = `[FOLLOW-UP: Lead has not replied in ${followUpContext.elapsedMinutes} minutes. Send a brief, natural follow-up referencing their original request. Do not re-introduce yourself.${followUpContext.isLastFollowUp ? ' This is the final follow-up — keep it light and leave the door open.' : ''}]`;

    try {
      const response = await this.gaiusRouter.askGaius(session, followUpMessage, context);
      const clean = response.replace(/\[TRANSFER\]/gi, '').replace(/\[CONTINUE\]/gi, '').replace(/\[COMPLETE\]/gi, '').trim();
      this.stateManager.addToTranscript(sessionId, 'hermes', clean);
      return clean;
    } catch (err) {
      console.error(`[ConversationEngine] generateFollowUp error:`, err.message);
      return null;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session identifier
   * @returns {object|null} Session object
   */
  getSession(sessionId) {
    return this.stateManager.getSession(sessionId);
  }

  /**
   * Get handoff payload
   * @param {string} sessionId - Session identifier
   * @returns {object} Handoff payload
   */
  getHandoffPayload(sessionId) {
    return this.stateManager.getHandoffPayload(sessionId);
  }

  /**
   * Set sanitization actions on a session (for V17 classifier context)
   */
  setSanitizationActions(sessionId, actions) {
    const session = this.stateManager.getSession(sessionId);
    if (session) session._lastSanitizationActions = actions;
  }

  /**
   * Set anomaly flag on a session (for V17 classifier context)
   */
  setAnomalyFlag(sessionId, flagged) {
    const session = this.stateManager.getSession(sessionId);
    if (session) session._anomalyFlagged = flagged;
  }

  /**
   * Get tier routing stats
   */
  getTierStats() {
    return this.tierRouter ? this.tierRouter.getStats() : null;
  }

  /**
   * V18: Record completed conversation to pattern library (feedback loop)
   */
  recordConversation(sessionId, outcome) {
    const session = this.stateManager.getSession(sessionId);
    if (!session) return;
    
    const transcript = session.transcript || [];
    const messages = transcript.map(t => ({ role: t.sender === 'lead' ? 'lead' : 'hermes', text: t.message || t.text || '' }));
    const archetype = session._archetype;
    
    if (!archetype) {
      // Classify now if not done
      const classification = this.archetypeClassifier.classify(session, messages);
      session._archetype = classification.archetype;
    }
    
    if (outcome === 'transferred') {
      this.patternLibrary.record(session._archetype, messages, outcome);
      this.momentumTracker.calibrate(sessionId, session._archetype, true);
    } else {
      this.patternLibrary.weaken(session._archetype, messages, outcome);
      this.momentumTracker.calibrate(sessionId, session._archetype, false);
    }
  }

  /**
   * V18: Get antibody system stats
   */
  getAntibodyStats() {
    return this.patternLibrary.getStats();
  }

  /**
   * Get stats
   */
  getStats() {
    return this.stateManager.getStats();
  }

  /**
   * Cleanup old sessions
   */
  cleanup(maxAgeHours = 24) {
    this.stateManager.cleanupOldSessions(maxAgeHours);
  }
}

module.exports = ConversationEngine;

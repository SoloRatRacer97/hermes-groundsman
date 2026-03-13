/**
 * Frustration Detector Tests
 * Validates HIGH/MEDIUM classification and escalation triggers
 */

const FrustrationDetector = require('../frustration-detector');

describe('FrustrationDetector - Task 2 Validation', () => {
  let detector;

  beforeEach(() => {
    detector = new FrustrationDetector();
  });

  describe('HIGH Confidence Triggers (score >= 70, immediate escalation)', () => {
    test('ALL CAPS: "NOBODY WILL CALL ME BACK"', () => {
      const result = detector.analyze('NOBODY WILL CALL ME BACK');
      
      expect(result.score).toBe(100);
      expect(result.level).toBe('HIGH');
      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers).toContain('NOBODY_CALLS_BACK');
      expect(result.triggers).toContain('ALL_CAPS_MULTIPLE');
    });

    test('ALL CAPS: "THIS IS RIDICULOUS"', () => {
      const result = detector.analyze('THIS IS RIDICULOUS');
      
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('HIGH');
      expect(result.shouldEscalate).toBe(true);
    });

    test('Profanity directed at service', () => {
      const result = detector.analyze('This is bullshit, nobody answers');
      
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('HIGH');
      expect(result.triggers).toContain('PROFANITY');
    });

    test('Repeated frustration: "third company I\'ve called"', () => {
      const result = detector.analyze('Look I\'ve called 3 companies today and NOBODY will call me back');
      
      expect(result.score).toBe(100);
      expect(result.level).toBe('HIGH');
      expect(result.shouldEscalate).toBe(true);
      expect(result.triggers).toContain('REPEATED_ATTEMPTS');
    });

    test('Repeated frustration: "nobody answers"', () => {
      const result = detector.analyze('I\'ve been waiting for hours and nobody answers');
      
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('HIGH');
      expect(result.triggers).toContain('NOBODY_CALLS_BACK');
    });

    test('Bot hostile: "Are you a bot?"', () => {
      const result = detector.analyze('Wait is this a bot?');
      
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('HIGH');
      expect(result.triggers).toContain('BOT_HOSTILE');
    });

    test('Bot hostile: "I want to talk to a real person"', () => {
      const result = detector.analyze('I want to talk to a real person');
      
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('HIGH');
      expect(result.triggers).toContain('BOT_HOSTILE');
    });

    test('Bot hostile: "this is useless"', () => {
      const result = detector.analyze('this is useless');
      
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('HIGH');
      expect(result.triggers).toContain('BOT_HOSTILE');
    });

    test('Frustration phrase: "are you kidding me"', () => {
      const result = detector.analyze('Are you kidding me? Still no response?');
      
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('HIGH');
    });
  });

  describe('MEDIUM Confidence Triggers (score 40-69, shorten path)', () => {
    test('Impatience: "How long is this going to take?"', () => {
      const result = detector.analyze('How long is this going to take?');
      
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(70);
      expect(result.level).toBe('MEDIUM');
      expect(result.shouldEscalate).toBe(false);
      expect(result.triggers).toContain('IMPATIENCE');
    });

    test('Impatience: "just send someone"', () => {
      const result = detector.analyze('Can you just send someone out?');
      
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.level).toBe('MEDIUM');
      expect(result.triggers).toContain('IMPATIENCE');
    });

    test('Impatience: "I need this now"', () => {
      const result = detector.analyze('I need someone now, this can\'t wait');
      
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.level).toBe('MEDIUM');
    });

    test('Short/curt reply after long message', () => {
      const context = {
        previousMessageLength: 50,
        currentMessageLength: 5,
      };

      const result = detector.analyze('Fine', context);
      
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.triggers).toContain('SHORT_CURT_REPLY');
    });

    test('Waiting indicator: "I\'ve been waiting"', () => {
      const result = detector.analyze('I\'ve been waiting for someone to call me');
      
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.triggers).toContain('WAITING_INDICATOR');
    });
  });

  describe('NONE (no frustration detected)', () => {
    test('Normal engaged response', () => {
      const result = detector.analyze('Our AC is running but it\'s not really cooling the house');
      
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
      expect(result.shouldEscalate).toBe(false);
      expect(result.triggers).toHaveLength(0);
    });

    test('Polite response', () => {
      const result = detector.analyze('Sure, go ahead');
      
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });

    test('Detailed helpful response', () => {
      const result = detector.analyze('I think about 12 years? We\'ve been in the house 8 years and it was here when we moved in.');
      
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });

  describe('Real-World Examples from Spec', () => {
    test('Script B: Frustrated Lead (HIGH)', () => {
      const message = 'Look I\'ve called 3 companies today and NOBODY will call me back. My heat has been out since yesterday. Can someone actually help me or not?';
      
      const result = detector.analyze(message);
      
      expect(result.score).toBe(100);
      expect(result.level).toBe('HIGH');
      expect(result.shouldEscalate).toBe(true);
      expect(result.message).toContain('I hear you');
    });

    test('Escalation message returned for HIGH frustration', () => {
      const result = detector.analyze('NOBODY WILL CALL ME BACK');
      
      expect(result.message).toBe("I hear you. Let me get you connected with someone on our team right now — they'll get this sorted out.");
    });

    test('No escalation message for MEDIUM frustration', () => {
      const result = detector.analyze('How long is this going to take?');
      
      expect(result.message).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('Empty message', () => {
      const result = detector.analyze('');
      
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });

    test('Null message', () => {
      const result = detector.analyze(null);
      
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });

    test('Mixed case ALL CAPS (partial)', () => {
      const result = detector.analyze('I REALLY need help with this');
      
      // Should detect single ALL CAPS word but not trigger multiple
      expect(result.score).toBeGreaterThan(0);
      expect(result.level).toBe('HIGH'); // "REALLY" is 6 chars caps
    });

    test('Multiple triggers stack correctly', () => {
      const message = 'THIS IS RIDICULOUS. Third company and NOBODY calls back. What the hell?';
      
      const result = detector.analyze(message);
      
      // Should have multiple triggers
      expect(result.triggers.length).toBeGreaterThan(1);
      expect(result.score).toBe(100);
    });
  });

  describe('Pattern Testing Utility', () => {
    test('testPattern() utility works', () => {
      expect(detector.testPattern('HELLO WORLD', 'allCaps')).toBe(true);
      expect(detector.testPattern('hello world', 'allCaps')).toBe(false);
      expect(detector.testPattern('nobody will call me back', 'nobodyCallsBack')).toBe(true);
      expect(detector.testPattern('are you a bot?', 'botHostile')).toBe(true);
    });
  });
});

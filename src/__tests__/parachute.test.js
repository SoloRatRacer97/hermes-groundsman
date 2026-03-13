/**
 * Parachute Protocol Tests
 * Validates all parachute triggers and one-way escalation
 */

const Parachute = require('../parachute');

describe('Parachute - Task 4 Validation', () => {
  let parachute;

  beforeEach(() => {
    parachute = new Parachute();
  });

  describe('Bot Question Detection', () => {
    test('"Am I talking to a bot?"', () => {
      const result = parachute.analyze('Am I talking to a bot?', { companyName: 'Comfort Climate' });
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('BOT_QUESTION');
      expect(result.response).toContain('digital assistant');
      expect(result.response).toContain('Comfort Climate');
      expect(result.response).toContain('someone give you a call');
    });

    test('"Wait is this a bot?"', () => {
      const result = parachute.analyze('Wait is this a bot?');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('BOT_QUESTION');
    });

    test('"Are you real?"', () => {
      const result = parachute.analyze('Are you real?');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('BOT_QUESTION');
    });

    test('"Is there a real person?"', () => {
      const result = parachute.analyze('Is there a real person?');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('BOT_QUESTION');
    });
  });

  describe('Human Demand Detection', () => {
    test('"Get me a real person"', () => {
      const result = parachute.analyze('Get me a real person');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HUMAN_DEMAND');
      expect(result.response).toBe("Absolutely, let me connect you with our team right now.");
    });

    test('"I want to talk to a real person"', () => {
      const result = parachute.analyze('I want to talk to a real person');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HUMAN_DEMAND');
    });

    test('"Talk to someone"', () => {
      const result = parachute.analyze('Can I talk to someone?');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HUMAN_DEMAND');
    });

    test('"Transfer me"', () => {
      const result = parachute.analyze('Transfer me');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HUMAN_DEMAND');
    });

    test('"Connect me to a person"', () => {
      const result = parachute.analyze('Connect me to a person');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HUMAN_DEMAND');
    });
  });

  describe('Hostile to Bot Detection', () => {
    test('"This is stupid"', () => {
      const result = parachute.analyze('This is stupid');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HOSTILE_TO_BOT');
      expect(result.response).toBe("Totally fair — let me just get a real person on the line for you.");
    });

    test('"I hate chatbots"', () => {
      const result = parachute.analyze('I hate chatbots');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HOSTILE_TO_BOT');
    });

    test('"This is useless"', () => {
      const result = parachute.analyze('This is useless');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HOSTILE_TO_BOT');
    });

    test('"Waste of time"', () => {
      const result = parachute.analyze('This is a waste of time');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HOSTILE_TO_BOT');
    });

    test('"Tired of bots"', () => {
      const result = parachute.analyze('I\'m tired of bots');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HOSTILE_TO_BOT');
    });
  });

  describe('Confusion/Derail Detection', () => {
    test('Single confusion warning (don\'t pull yet)', () => {
      const result = parachute.analyze('What???', { confusionCount: 0 });
      
      expect(result.shouldPull).toBe(false);
      expect(result.reason).toBe('CONFUSION_WARNING');
      expect(result.confusionCount).toBe(1);
    });

    test('Repeated confusion (2nd time) triggers parachute', () => {
      const result = parachute.analyze('Huh?', { confusionCount: 1 });
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('CONFUSION');
      expect(result.response).toContain('make sure we get this right');
      expect(result.response).toContain('give you a call');
    });

    test('"I don\'t understand"', () => {
      const result = parachute.analyze('I don\'t understand', { confusionCount: 1 });
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('CONFUSION');
    });

    test('"This makes no sense"', () => {
      const result = parachute.analyze('This makes no sense', { confusionCount: 1 });
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('CONFUSION');
    });
  });

  describe('Ambiguous Response Detection', () => {
    test('Repeated ambiguous responses (>=2) triggers parachute', () => {
      const result = parachute.analyze('Maybe', { ambiguousCount: 2 });
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('AMBIGUOUS_REPEATED');
      expect(result.response).toContain('not be the best person');
      expect(result.response).toContain('someone on our team');
    });

    test('Single ambiguous response does not trigger', () => {
      const result = parachute.analyze('I guess', { ambiguousCount: 1 });
      
      expect(result.shouldPull).toBe(false);
    });
  });

  describe('Real-World Examples from Spec', () => {
    test('Script C: Bot Detection scenario', () => {
      // HERMES: "Can you give me a quick rundown..."
      // LISA: "Wait is this a bot?"
      
      const result = parachute.analyze('Wait is this a bot?', { companyName: 'Comfort Climate' });
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('BOT_QUESTION');
      expect(result.response).toContain('digital assistant for Comfort Climate');
      expect(result.response).toContain('someone give you a call instead');
    });

    test('Script C: Follow-up human demand', () => {
      // LISA: "Yeah I'd rather talk to a real person."
      
      const result = parachute.analyze('Yeah I\'d rather talk to a real person');
      
      expect(result.shouldPull).toBe(true);
      expect(result.reason).toBe('HUMAN_DEMAND');
      expect(result.response).toBe("Absolutely, let me connect you with our team right now.");
    });
  });

  describe('Parachute Rules', () => {
    test('Never argues about being a bot', () => {
      const result = parachute.analyze('Are you a bot?');
      
      // Response should be honest and offer human option
      expect(result.response).toContain('digital assistant');
      expect(result.response).not.toContain('No');
      expect(result.response).not.toContain('I am not');
    });

    test('Doesn\'t try to win back lead who asked for human', () => {
      const result = parachute.analyze('Get me a real person');
      
      // Response should immediately transfer, not persuade
      expect(result.response).toBe("Absolutely, let me connect you with our team right now.");
      expect(result.response).not.toContain('but');
      expect(result.response).not.toContain('first');
    });

    test('One-way door (no resume after pull)', () => {
      // This is enforced at the conversation engine level
      // Parachute just returns shouldPull=true
      const result = parachute.analyze('This is stupid');
      
      expect(result.shouldPull).toBe(true);
      // Engine will mark session as 'parachute' and complete it
    });
  });

  describe('Utility Methods', () => {
    test('isBotQuestion()', () => {
      expect(parachute.isBotQuestion('Are you a bot?')).toBe(true);
      expect(parachute.isBotQuestion('Is this a bot?')).toBe(true);
      expect(parachute.isBotQuestion('Normal question')).toBe(false);
    });

    test('isHumanDemand()', () => {
      expect(parachute.isHumanDemand('Get me a person')).toBe(true);
      expect(parachute.isHumanDemand('I want to talk to someone')).toBe(true);
      expect(parachute.isHumanDemand('Normal response')).toBe(false);
    });

    test('isHostileTtoBot()', () => {
      expect(parachute.isHostileTtoBot('This is stupid')).toBe(true);
      expect(parachute.isHostileTtoBot('I hate bots')).toBe(true);
      expect(parachute.isHostileTtoBot('Normal message')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('Empty message', () => {
      const result = parachute.analyze('');
      
      expect(result.shouldPull).toBe(false);
      expect(result.reason).toBeNull();
    });

    test('Null message', () => {
      const result = parachute.analyze(null);
      
      expect(result.shouldPull).toBe(false);
    });

    test('Normal conversation doesn\'t trigger parachute', () => {
      const messages = [
        'Sure, go ahead',
        'Our AC is not cooling properly',
        'This week if possible',
        'About 12 years I think',
      ];

      messages.forEach(msg => {
        const result = parachute.analyze(msg);
        expect(result.shouldPull).toBe(false);
      });
    });
  });
});

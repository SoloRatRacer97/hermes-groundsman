/**
 * Adaptive Question Flow Tests
 * Validates Q1-Q2 required, Q3-Q5 conditional based on engagement
 */

const ConversationEngine = require('../conversation-engine');

describe('Adaptive Question Flow - Task 5 Validation', () => {
  let engine;

  beforeEach(() => {
    engine = new ConversationEngine();
  });

  describe('Opener Message (Acknowledge + Set Expectations)', () => {
    test('Opener includes name and service type', async () => {
      const leadData = {
        leadId: 'test-opener-1',
        name: 'Sarah Martinez',
        phone: '+15550100001',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      
      expect(result.message).toContain('Sarah'); // First name
      expect(result.message).toContain('cooling'); // Service type (lowercase)
      expect(result.message).toContain('couple quick questions');
      expect(result.message).not.toMatch(/\?/); // Opener doesn't ask question yet
    });

    test('Opener sets expectation that this will be quick', async () => {
      const leadData = {
        leadId: 'test-opener-2',
        name: 'John Smith',
        phone: '+15550100002',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      
      expect(result.message).toMatch(/(couple|few) (quick|short) questions/i);
    });
  });

  describe('Required Questions (Q1-Q2)', () => {
    test('Q1 is always asked (problem description)', async () => {
      const leadData = {
        leadId: 'test-q1',
        name: 'Test User',
        phone: '+15550100003',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      
      // Response to opener triggers Q1
      const q1 = await engine.processMessage(result.session.sessionId, 'OK');
      
      expect(q1.response).toContain('quick rundown');
      expect(q1.response).toContain('what\'s going on');
    });

    test('Q2 is always asked (timeline)', async () => {
      const leadData = {
        leadId: 'test-q2',
        name: 'Test User',
        phone: '+15550100004',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      
      // Response to Q1 triggers Q2
      const q2 = await engine.processMessage(result.session.sessionId, 'AC broken');
      
      expect(q2.response).toContain('timeline');
      expect(q2.response).toMatch(/(this week|when.*fit.*in)/i);
    });
  });

  describe('Conditional Q3 (based on engagement)', () => {
    test('Q3 asked if lead is engaged (responses > 10 chars)', async () => {
      const leadData = {
        leadId: 'test-q3-engaged',
        name: 'Engaged Customer',
        phone: '+15550100005',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes please');
      await engine.processMessage(result.session.sessionId, 'My furnace is not heating properly');
      
      const q3 = await engine.processMessage(result.session.sessionId, 'This week would be great');
      
      expect(q3.action).toBe('ASK_Q3');
      expect(q3.response).toContain('how old');
      expect(q3.response).toContain('No worries if not');
    });

    test('Q3 skipped if lead not engaged (short responses)', async () => {
      const leadData = {
        leadId: 'test-q3-skip',
        name: 'Short Customer',
        phone: '+15550100006',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'Broken');
      
      const handoff = await engine.processMessage(result.session.sessionId, 'Soon');
      
      // Should skip to handoff (not ask Q3)
      expect(handoff.action).toBe('TRANSFER_WARM');
      expect(handoff.response).toContain('I\'ve got everything I need');
    });
  });

  describe('Conditional Q4 (based on Q3 answer + engagement)', () => {
    test('Q4 asked if lead answered Q3 and still engaged', async () => {
      const leadData = {
        leadId: 'test-q4-engaged',
        name: 'Engaged Customer',
        phone: '+15550100007',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes please');
      await engine.processMessage(result.session.sessionId, 'Furnace issue');
      await engine.processMessage(result.session.sessionId, 'This week');
      
      const q4 = await engine.processMessage(result.session.sessionId, 'About 10 years');
      
      expect(q4.action).toBe('ASK_Q4');
      expect(q4.response).toContain('just started');
      expect(q4.response).toContain('been going on');
    });

    test('Q4 skipped if not engaged after Q3', async () => {
      const leadData = {
        leadId: 'test-q4-skip',
        name: 'Disengaging Customer',
        phone: '+15550100008',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'AC broken');
      await engine.processMessage(result.session.sessionId, 'Soon');
      
      const handoff = await engine.processMessage(result.session.sessionId, 'Dunno');
      
      // Short response → skip Q4, go to handoff
      expect(handoff.action).toBe('TRANSFER_WARM');
    });
  });

  describe('Conditional Q5 (highly responsive only)', () => {
    test('Q5 asked only if highly responsive (avg >20 chars)', async () => {
      const leadData = {
        leadId: 'test-q5-responsive',
        name: 'Highly Responsive',
        phone: '+15550100009',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      
      // Opener response
      await engine.processMessage(result.session.sessionId, 'Yes please, go ahead with the questions');
      
      // Q1 response (problem description) - detailed, no emergency keywords
      await engine.processMessage(
        result.session.sessionId,
        'Our AC is running but the upstairs bedrooms just take a bit longer to cool down than they used to. Not terrible but noticeable.'
      );
      
      // Q2 response (timeline)
      await engine.processMessage(
        result.session.sessionId,
        'Whenever you can fit us in would be great. No big rush but would like to get it looked at sometime this month.'
      );
      
      // Q3 response (system age)
      await engine.processMessage(
        result.session.sessionId,
        'I believe it is about twelve years old now. We purchased the house eight years ago and it was already installed then.'
      );
      
      // Q4 response (duration) - should trigger Q5
      const q5 = await engine.processMessage(
        result.session.sessionId,
        'We started noticing it maybe a couple of weeks ago. It still cools okay, just takes a bit more time than before.'
      );
      
      expect(q5.action).toBe('ASK_Q5');
      expect(q5.response).toContain('Anything else');
      expect(q5.response).toContain('tech should know');
    });

    test('Q5 skipped if not highly responsive', async () => {
      const leadData = {
        leadId: 'test-q5-skip',
        name: 'Normal Responsive',
        phone: '+15550100010',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'AC broken');
      await engine.processMessage(result.session.sessionId, 'This week');
      await engine.processMessage(result.session.sessionId, '10 years');
      
      const handoff = await engine.processMessage(result.session.sessionId, 'Few days');
      
      // Normal responses → skip Q5, go to handoff
      expect(handoff.action).toBe('TRANSFER_WARM');
      expect(handoff.response).toContain('I\'ve got everything I need');
    });
  });

  describe('Handoff Message Variants', () => {
    test('Business hours handoff (shortly)', async () => {
      const leadData = {
        leadId: 'test-bh-handoff',
        name: 'BH Customer',
        phone: '+15550100011',
        serviceType: 'Heating',
        timestamp: new Date('2026-03-03T10:00:00Z'), // Monday 10 AM
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'Broken');
      const handoff = await engine.processMessage(result.session.sessionId, 'Soon');
      
      expect(handoff.response).toContain('reach out to you shortly');
      expect(handoff.response).not.toContain('8 AM');
      expect(handoff.response).not.toContain('tomorrow');
    });

    test('After hours handoff (8 AM tomorrow)', async () => {
      const leadData = {
        leadId: 'test-ah-handoff',
        name: 'AH Customer',
        phone: '+15550100012',
        serviceType: 'Heating',
        timestamp: new Date('2026-03-03T22:00:00Z'), // Monday 10 PM
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'Broken');
      const handoff = await engine.processMessage(result.session.sessionId, 'Soon');
      
      expect(handoff.response).toContain('8 AM');
      expect(handoff.response).toContain('tomorrow');
      expect(handoff.response).not.toContain('shortly');
    });

    test('Handoff includes company name', async () => {
      process.env.COMPANY_NAME = 'Comfort Climate';
      
      const leadData = {
        leadId: 'test-company',
        name: 'Test User',
        phone: '+15550100013',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'Issue');
      const handoff = await engine.processMessage(result.session.sessionId, 'Soon');
      
      expect(handoff.response).toContain('Comfort Climate');
      
      delete process.env.COMPANY_NAME;
    });
  });

  describe('Message Quality (Spec Requirements)', () => {
    test('No emojis in any message', async () => {
      const leadData = {
        leadId: 'test-emoji',
        name: 'Test User',
        phone: '+15550100014',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      
      // Check opener
      expect(result.message).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
      
      // Check Q1
      await engine.processMessage(result.session.sessionId, 'OK');
      const q1 = await engine.processMessage(result.session.sessionId, 'Yes');
      expect(q1.response).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
    });

    test('Open-ended questions (not multiple choice)', async () => {
      const leadData = {
        leadId: 'test-open',
        name: 'Test User',
        phone: '+15550100015',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      const q1 = await engine.processMessage(result.session.sessionId, 'Yes');
      
      // Should NOT have numbered options
      expect(q1.response).not.toMatch(/\(1\)|1\)/);
      expect(q1.response).not.toMatch(/\(2\)|2\)/);
    });

    test('Casual HVAC tone (no corporate jargon)', async () => {
      const leadData = {
        leadId: 'test-tone',
        name: 'Test User',
        phone: '+15550100016',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      
      // Check for casual phrases
      expect(result.message.toLowerCase()).toMatch(/(hey|thanks|appreciate)/);
      
      // Should NOT have corporate speak
      expect(result.message).not.toContain('Dear');
      expect(result.message).not.toContain('Sincerely');
      expect(result.message).not.toContain('Thank you for your inquiry');
    });
  });
});

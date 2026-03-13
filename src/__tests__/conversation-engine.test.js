/**
 * Conversation Engine Tests
 * Validates state machine and path routing
 */

const ConversationEngine = require('../conversation-engine');

describe('ConversationEngine - Task 1 Validation', () => {
  let engine;

  beforeEach(() => {
    engine = new ConversationEngine();
  });

  describe('Path Routing', () => {
    test('Existing customer → Fast-track to transfer', async () => {
      const leadData = {
        leadId: 'test-001',
        name: 'Sarah Johnson',
        phone: '+15551234567',
        serviceType: 'Heating',
        existingCustomer: true,
      };

      const result = await engine.startConversation(leadData);
      
      expect(result.action).toBe('TRANSFER_IMMEDIATE');
      expect(result.message).toContain('good to hear from you again');
      expect(result.session.path).toBe('EXISTING_CUSTOMER');
      expect(result.session.leadTemp).toBe('WARM');
      expect(result.session.status).toBe('completed');
    });

    test('Emergency during business hours → Ask Q1 then transfer', async () => {
      const leadData = {
        leadId: 'test-002',
        name: 'Mike Davis',
        phone: '+15551234568',
        serviceType: 'Emergency Repair',
        existingCustomer: false,
        timestamp: new Date('2026-03-03T10:00:00Z'), // Monday 10 AM
      };

      const result = await engine.startConversation(leadData);
      
      expect(result.action).toBe('ASK_EMERGENCY_Q1');
      expect(result.message).toContain('it looks urgent');
      expect(result.session.path).toBe('EMERGENCY');
      expect(result.session.leadTemp).toBe('HOT');
      expect(result.session.currentQuestion).toBe('emergency_q1');

      // Simulate answer
      const response = await engine.processMessage(
        result.session.sessionId,
        'My furnace stopped working and it\'s freezing'
      );

      expect(response.action).toBe('TRANSFER_EMERGENCY');
      expect(response.response).toContain('getting a tech on this');
      expect(response.session.status).toBe('completed');
      expect(response.session.dataCollected.q1).toContain('furnace');
    });

    test('Emergency after hours → Flag for morning', async () => {
      const leadData = {
        leadId: 'test-003',
        name: 'Lisa Brown',
        phone: '+15551234569',
        serviceType: 'Emergency Repair',
        existingCustomer: false,
        timestamp: new Date('2026-03-03T22:00:00Z'), // Monday 10 PM (after hours)
      };

      const result = await engine.startConversation(leadData);
      
      expect(result.action).toBe('FLAG_MORNING_PRIORITY');
      expect(result.message).toContain('picks back up at 8 AM');
      expect(result.session.status).toBe('completed');
    });

    test('Standard path → Opener sent', async () => {
      const leadData = {
        leadId: 'test-004',
        name: 'James Wilson',
        phone: '+15551234570',
        serviceType: 'Cooling',
        existingCustomer: false,
      };

      const result = await engine.startConversation(leadData);
      
      expect(result.action).toBe('OPENER_SENT');
      expect(result.message).toContain('thanks for reaching out');
      expect(result.message).toContain('cooling');
      expect(result.session.path).toBe('STANDARD');
      expect(result.session.currentQuestion).toBe('opener');
    });
  });

  describe('Standard Path Flow', () => {
    let session;

    beforeEach(async () => {
      const leadData = {
        leadId: 'test-standard',
        name: 'Sarah Martinez',
        phone: '+15559876543',
        serviceType: 'Heating',
        existingCustomer: false,
        timestamp: new Date('2026-03-03T14:00:00Z'), // Monday 2 PM
      };

      const result = await engine.startConversation(leadData);
      session = result.session;
    });

    test('Opener → Q1', async () => {
      const result = await engine.processMessage(
        session.sessionId,
        'Sure, go ahead'
      );

      expect(result.action).toBe('ASK_Q1');
      expect(result.response).toContain('quick rundown');
      expect(result.session.currentQuestion).toBe('q1');
    });

    test('Q1 → Q2', async () => {
      await engine.processMessage(session.sessionId, 'Sure');
      
      const result = await engine.processMessage(
        session.sessionId,
        'My AC is running but not cooling the house properly'
      );

      expect(result.action).toBe('ASK_Q2');
      expect(result.response).toContain('timeline');
      expect(result.session.currentQuestion).toBe('q2');
      expect(result.session.dataCollected.q1).toContain('AC');
    });

    test('Q2 → Q3 (engaged)', async () => {
      await engine.processMessage(session.sessionId, 'Sure');
      await engine.processMessage(session.sessionId, 'AC not cooling properly');
      
      const result = await engine.processMessage(
        session.sessionId,
        'This week if possible, it\'s getting hot'
      );

      expect(result.action).toBe('ASK_Q3');
      expect(result.response).toContain('how old');
      expect(result.session.currentQuestion).toBe('q3');
    });

    test('Q3 → Q4 (still engaged)', async () => {
      await engine.processMessage(session.sessionId, 'Sure');
      await engine.processMessage(session.sessionId, 'AC not cooling');
      await engine.processMessage(session.sessionId, 'This week please');
      
      const result = await engine.processMessage(
        session.sessionId,
        'About 12 years I think'
      );

      expect(result.action).toBe('ASK_Q4');
      expect(result.response).toContain('just started');
      expect(result.session.currentQuestion).toBe('q4');
    });

    test('Q4 → Handoff (not highly responsive)', async () => {
      await engine.processMessage(session.sessionId, 'Sure');
      await engine.processMessage(session.sessionId, 'AC issue');
      await engine.processMessage(session.sessionId, 'This week');
      await engine.processMessage(session.sessionId, '12 years');
      
      const result = await engine.processMessage(
        session.sessionId,
        'Few days'
      );

      expect(result.action).toBe('TRANSFER_WARM');
      expect(result.response).toContain('I\'ve got everything I need');
      expect(result.session.status).toBe('completed');
    });

    test('Q4 → Q5 (highly responsive)', async () => {
      await engine.processMessage(session.sessionId, 'Yes please');
      await engine.processMessage(
        session.sessionId,
        'Our AC is running but it\'s not really cooling the house. Upstairs is like 80 degrees even with it set to 72.'
      );
      await engine.processMessage(
        session.sessionId,
        'Sooner the better, this week if possible. It\'s getting really uncomfortable.'
      );
      await engine.processMessage(
        session.sessionId,
        'I think about 12 years? We\'ve been in the house 8 years and it was here when we moved in.'
      );
      
      const result = await engine.processMessage(
        session.sessionId,
        'Maybe the last week or so. Still works but not great.'
      );

      expect(result.action).toBe('ASK_Q5');
      expect(result.response).toContain('Anything else');
      expect(result.session.currentQuestion).toBe('q5');
    });
  });

  describe('State Tracking', () => {
    test('Session data persists across messages', async () => {
      const leadData = {
        leadId: 'test-persist',
        name: 'Test User',
        phone: '+15551111111',
        serviceType: 'Heating',
        existingCustomer: false,
      };

      const result = await engine.startConversation(leadData);
      const sessionId = result.session.sessionId;

      // Send multiple messages
      await engine.processMessage(sessionId, 'Yes');
      await engine.processMessage(sessionId, 'Furnace problem');
      
      const session = engine.getSession(sessionId);

      expect(session.transcript.length).toBeGreaterThan(0);
      expect(session.questionsAsked).toBe(1);
      expect(session.dataCollected.q1).toBe('Furnace problem');
    });

    test('Handoff payload contains all collected data', async () => {
      const leadData = {
        leadId: 'test-handoff',
        name: 'Complete Test',
        phone: '+15552222222',
        serviceType: 'Cooling',
        existingCustomer: false,
      };

      const result = await engine.startConversation(leadData);
      const sessionId = result.session.sessionId;

      await engine.processMessage(sessionId, 'Yes');
      await engine.processMessage(sessionId, 'AC broken');
      await engine.processMessage(sessionId, 'This week');

      const payload = engine.getHandoffPayload(sessionId);

      expect(payload.name).toBe('Complete Test');
      expect(payload.serviceType).toBe('Cooling');
      expect(payload.problemDescription).toBe('AC broken');
      expect(payload.urgencyLevel).toBe('This week');
      expect(payload.leadTemp).toBe('WARM'); // WARM after 2+ questions
      expect(payload.transcript).toBeInstanceOf(Array);
    });
  });

  describe('Business Hours Handling', () => {
    test('Business hours handoff message', async () => {
      const leadData = {
        leadId: 'test-bh',
        name: 'BH Test',
        phone: '+15553333333',
        serviceType: 'Heating',
        timestamp: new Date('2026-03-03T10:00:00Z'), // Monday 10 AM UTC = business hours
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'Broken');
      const final = await engine.processMessage(result.session.sessionId, 'Soon');

      expect(final.response).toContain('reach out to you shortly');
      expect(final.response).not.toContain('8 AM');
    });

    test('After hours handoff message', async () => {
      const leadData = {
        leadId: 'test-ah',
        name: 'AH Test',
        phone: '+15554444444',
        serviceType: 'Heating',
        timestamp: new Date('2026-03-03T22:00:00Z'), // Monday 10 PM UTC = after hours
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');
      await engine.processMessage(result.session.sessionId, 'Broken');
      const final = await engine.processMessage(result.session.sessionId, 'Soon');

      expect(final.response).toContain('8 AM');
      expect(final.response).toContain('first thing tomorrow');
    });
  });

  describe('Frustration Detection Integration (Task 2)', () => {
    test('HIGH frustration triggers immediate escalation', async () => {
      const leadData = {
        leadId: 'test-frustrated',
        name: 'Angry Customer',
        phone: '+15556666666',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      const sessionId = result.session.sessionId;

      // Send normal response first
      await engine.processMessage(sessionId, 'Yes');

      // Send frustrated message
      const frustrated = await engine.processMessage(
        sessionId,
        'Look I\'ve called 3 companies today and NOBODY will call me back!'
      );

      expect(frustrated.action).toBe('TRANSFER_FRUSTRATED');
      expect(frustrated.response).toContain('I hear you');
      expect(frustrated.session.frustrationScore).toBeGreaterThanOrEqual(70);
      expect(frustrated.session.leadTemp).toBe('HOT');
      expect(frustrated.session.status).toBe('completed');
      expect(frustrated.frustrationTriggers).toContain('REPEATED_ATTEMPTS');
    });

    test('MEDIUM frustration updates score but doesn\'t escalate', async () => {
      const leadData = {
        leadId: 'test-impatient',
        name: 'Impatient Customer',
        phone: '+15557777777',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      const sessionId = result.session.sessionId;

      await engine.processMessage(sessionId, 'Yes');

      const impatient = await engine.processMessage(
        sessionId,
        'How long is this going to take?'
      );

      // Should continue conversation, not transfer
      expect(impatient.action).not.toBe('TRANSFER_FRUSTRATED');
      expect(impatient.session.frustrationScore).toBeGreaterThanOrEqual(40);
      expect(impatient.session.frustrationScore).toBeLessThan(70);
      expect(impatient.session.status).toBe('active');
    });

    test('Bot hostile triggers parachute (handled by parachute, not frustration)', async () => {
      const leadData = {
        leadId: 'test-bot-hostile',
        name: 'Bot Skeptic',
        phone: '+15558888888',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes');

      const hostile = await engine.processMessage(
        result.session.sessionId,
        'Wait, are you a bot?'
      );

      // Parachute handles bot questions with appropriate response
      expect(hostile.action).toBe('TRANSFER_PARACHUTE');
      expect(hostile.response).toContain('digital assistant');
      expect(hostile.parachuteReason).toBe('BOT_QUESTION');
    });
  });

  describe('Emergency Detection Integration (Task 3)', () => {
    test('Mid-qualification emergency upgrade (standard → emergency)', async () => {
      const leadData = {
        leadId: 'test-emergency-upgrade',
        name: 'Emergency Customer',
        phone: '+15559999999',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      const sessionId = result.session.sessionId;

      // Start normal conversation
      await engine.processMessage(sessionId, 'Yes');

      // Q1: Reveal emergency in response
      const emergency = await engine.processMessage(
        sessionId,
        'My furnace completely stopped working last night and it\'s 20 degrees outside. My kids are freezing.'
      );

      expect(emergency.action).toBe('TRANSFER_EMERGENCY_UPGRADE');
      expect(emergency.response).toContain('That\'s no good');
      expect(emergency.response).toContain('flagging this as urgent');
      expect(emergency.session.emergencyFlag).toBe(true);
      expect(emergency.session.path).toBe('EMERGENCY');
      expect(emergency.session.leadTemp).toBe('HOT');
      expect(emergency.session.status).toBe('completed');
      expect(emergency.emergencyKeywords).toBeDefined();
    });

    test('Emergency keywords: "no heat"', async () => {
      const leadData = {
        leadId: 'test-no-heat',
        name: 'Cold House',
        phone: '+15550000001',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes');

      const emergency = await engine.processMessage(
        result.session.sessionId,
        'There\'s no heat at all'
      );

      expect(emergency.action).toBe('TRANSFER_EMERGENCY_UPGRADE');
      expect(emergency.session.emergencyFlag).toBe(true);
    });

    test('Emergency keywords: "water everywhere"', async () => {
      const leadData = {
        leadId: 'test-flooding',
        name: 'Water Damage',
        phone: '+15550000002',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes');

      const emergency = await engine.processMessage(
        result.session.sessionId,
        'Water everywhere under the furnace'
      );

      expect(emergency.action).toBe('TRANSFER_EMERGENCY_UPGRADE');
    });

    test('NON-emergency stays on standard path', async () => {
      const leadData = {
        leadId: 'test-normal',
        name: 'Normal Issue',
        phone: '+15550000003',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes');

      const normal = await engine.processMessage(
        result.session.sessionId,
        'Our AC is running but it\'s not really cooling the house. Upstairs is like 80 degrees.'
      );

      // Should continue on standard path
      expect(normal.action).not.toBe('TRANSFER_EMERGENCY_UPGRADE');
      expect(normal.session.path).toBe('STANDARD');
      expect(normal.session.emergencyFlag).toBe(false);
    });
  });

  describe('Parachute Protocol Integration (Task 4)', () => {
    test('Bot question triggers parachute', async () => {
      const leadData = {
        leadId: 'test-bot-question',
        name: 'Bot Skeptic',
        phone: '+15550001111',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes');

      const parachute = await engine.processMessage(
        result.session.sessionId,
        'Wait is this a bot?'
      );

      expect(parachute.action).toBe('TRANSFER_PARACHUTE');
      expect(parachute.response).toContain('digital assistant');
      expect(parachute.response).toContain('someone give you a call');
      expect(parachute.parachuteReason).toBe('BOT_QUESTION');
      expect(parachute.session.parachuteTriggered).toBe(true);
      expect(parachute.session.status).toBe('parachute');
    });

    test('Human demand triggers immediate transfer', async () => {
      const leadData = {
        leadId: 'test-human-demand',
        name: 'Direct Customer',
        phone: '+15550001112',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');

      const parachute = await engine.processMessage(
        result.session.sessionId,
        'Get me a real person'
      );

      expect(parachute.action).toBe('TRANSFER_PARACHUTE');
      expect(parachute.response).toBe("Absolutely, let me connect you with our team right now.");
      expect(parachute.parachuteReason).toBe('HUMAN_DEMAND');
    });

    test('Hostile to bot triggers parachute', async () => {
      const leadData = {
        leadId: 'test-hostile',
        name: 'Angry Customer',
        phone: '+15550001113',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Sure');

      const parachute = await engine.processMessage(
        result.session.sessionId,
        'This is stupid'
      );

      expect(parachute.action).toBe('TRANSFER_PARACHUTE');
      expect(parachute.response).toBe("Totally fair — let me just get a real person on the line for you.");
      expect(parachute.parachuteReason).toBe('HOSTILE_TO_BOT');
    });

    test('Repeated confusion triggers parachute', async () => {
      const leadData = {
        leadId: 'test-confused',
        name: 'Confused Customer',
        phone: '+15550001114',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'OK');

      // First confusion - warning only
      const first = await engine.processMessage(result.session.sessionId, 'What???');
      expect(first.action).not.toBe('TRANSFER_PARACHUTE');

      // Second confusion - triggers parachute
      const second = await engine.processMessage(result.session.sessionId, 'Huh?');
      expect(second.action).toBe('TRANSFER_PARACHUTE');
      expect(second.response).toContain('make sure we get this right');
      expect(second.parachuteReason).toBe('CONFUSION');
    });

    test('One-way door - parachute prevents further qualification', async () => {
      const leadData = {
        leadId: 'test-oneway',
        name: 'Test User',
        phone: '+15550001115',
        serviceType: 'Heating',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Yes');

      const parachute = await engine.processMessage(
        result.session.sessionId,
        'I want a real person'
      );

      expect(parachute.session.parachuteTriggered).toBe(true);
      expect(parachute.session.status).toBe('parachute'); // Not 'active'
      
      // Parachute reason should be logged
      expect(parachute.session.parachuteReason).toBe('HUMAN_DEMAND');
    });

    test('Normal conversation doesn\'t trigger parachute', async () => {
      const leadData = {
        leadId: 'test-normal-parachute',
        name: 'Normal Customer',
        phone: '+15550001116',
        serviceType: 'Cooling',
      };

      const result = await engine.startConversation(leadData);
      await engine.processMessage(result.session.sessionId, 'Sure');

      const normal = await engine.processMessage(
        result.session.sessionId,
        'Our AC is not cooling well'
      );

      expect(normal.action).not.toBe('TRANSFER_PARACHUTE');
      expect(normal.session.parachuteTriggered).toBe(false);
    });
  });
});

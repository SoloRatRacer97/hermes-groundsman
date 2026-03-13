/**
 * Emergency Detector Tests
 * Validates HIGH/MEDIUM emergency classification and path switching
 */

const EmergencyDetector = require('../emergency-detector');

describe('EmergencyDetector - Task 3 Validation', () => {
  let detector;

  beforeEach(() => {
    detector = new EmergencyDetector();
  });

  describe('HIGH Confidence Triggers (immediate upgrade)', () => {
    test('"no heat" - complete system failure', () => {
      const result = detector.analyze('My furnace stopped and there\'s no heat at all');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
      expect(result.shouldUpgrade).toBe(true);
      expect(result.keywords).toContain('no heat');
    });

    test('"no AC" - air conditioning failure', () => {
      const result = detector.analyze('The AC quit working and there\'s no air conditioning');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
      expect(result.shouldUpgrade).toBe(true);
    });

    test('"not working at all" - complete failure', () => {
      const result = detector.analyze('My HVAC system is not working at all');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    test('"completely stopped" - total failure', () => {
      const result = detector.analyze('It completely stopped last night');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    test('"water everywhere" - flooding emergency', () => {
      const result = detector.analyze('There\'s water everywhere under the unit');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
      expect(result.keywords).toContain('water everywhere');
    });

    test('"flooding" - water damage', () => {
      const result = detector.analyze('The basement is flooding from the HVAC');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    test('"smoke" - safety hazard', () => {
      const result = detector.analyze('I saw smoke coming from the furnace');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    test('"burning smell" - fire risk', () => {
      const result = detector.analyze('There\'s a burning smell when it runs');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    test('"kids/baby/elderly + no heat" - vulnerable occupants', () => {
      const result = detector.analyze('My furnace completely stopped working last night and it\'s 20 degrees outside. My kids are freezing.');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
      expect(result.shouldUpgrade).toBe(true);
    });

    test('Vulnerable occupants (baby) + comfort issue', () => {
      const result = detector.analyze('No heat and I have a baby in the house');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });
  });

  describe('MEDIUM Confidence Triggers (potential emergency)', () => {
    test('"really cold" + system issue', () => {
      const result = detector.analyze('It\'s really cold in here and the heater isn\'t helping');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    test('"really hot" + AC issue', () => {
      const result = detector.analyze('It\'s really hot upstairs and the AC isn\'t cooling');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('MEDIUM');
    });

    test('"can\'t sleep" - comfort emergency', () => {
      const result = detector.analyze('It\'s so hot we can\'t sleep at night');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('MEDIUM');
    });

    test('"been like this for days" - prolonged issue', () => {
      const result = detector.analyze('Been like this for 3 days now');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('MEDIUM');
    });

    test('Extreme cold temperature (<40F)', () => {
      const result = detector.analyze('It\'s 35 degrees in the house');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.keywords).toContain('35 degrees');
    });

    test('Extreme heat temperature (>90F)', () => {
      const result = detector.analyze('It\'s 95 degrees inside');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    test('"freezing" temperature indicator', () => {
      const result = detector.analyze('The house is freezing without heat');
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('MEDIUM');
    });
  });

  describe('NON-Emergency (normal service requests)', () => {
    test('Normal AC not cooling well', () => {
      const result = detector.analyze('Our AC is running but it\'s not really cooling the house. Upstairs is like 80 degrees even with it set to 72.');
      
      // 80 degrees is warm but not emergency (<40 or >90)
      expect(result.isEmergency).toBe(false);
      expect(result.confidence).toBe('NONE');
    });

    test('System age question (not emergency)', () => {
      const result = detector.analyze('I think about 12 years? We\'ve been in the house 8 years and it was here when we moved in.');
      
      expect(result.isEmergency).toBe(false);
      expect(result.confidence).toBe('NONE');
    });

    test('Normal maintenance request', () => {
      const result = detector.analyze('Our furnace is making a weird rattling noise');
      
      expect(result.isEmergency).toBe(false);
    });

    test('Just started, not urgent', () => {
      const result = detector.analyze('Maybe the last week or so. It\'s still heating fine just loud.');
      
      expect(result.isEmergency).toBe(false);
    });
  });

  describe('Real-World Emergency Upgrade Example (Spec)', () => {
    test('Mid-qualification emergency upgrade scenario', () => {
      const message = 'My furnace completely stopped working last night and it\'s 20 degrees outside. My kids are freezing.';
      
      const result = detector.analyze(message);
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
      expect(result.shouldUpgrade).toBe(true);
      expect(result.upgradeMessage).toContain('That\'s no good');
      expect(result.upgradeMessage).toContain('flagging this as urgent');
    });

    test('Emergency upgrade message correct', () => {
      const result = detector.analyze('no heat');
      
      expect(result.upgradeMessage).toBe(
        "That's no good — let's get someone on this right away. I'm flagging this as urgent and our team is going to reach out to you in the next few minutes to get a tech dispatched."
      );
    });
  });

  describe('Edge Cases', () => {
    test('Empty message', () => {
      const result = detector.analyze('');
      
      expect(result.isEmergency).toBe(false);
      expect(result.confidence).toBe('NONE');
    });

    test('Null message', () => {
      const result = detector.analyze(null);
      
      expect(result.isEmergency).toBe(false);
    });

    test('Normal temperature (72F) - not emergency', () => {
      const result = detector.analyze('Set to 72 degrees');
      
      expect(result.isEmergency).toBe(false);
      expect(result.confidence).toBe('NONE');
    });

    test('Multiple emergency keywords stack', () => {
      const message = 'No heat, water leaking, and smoke coming from the furnace!';
      
      const result = detector.analyze(message);
      
      expect(result.isEmergency).toBe(true);
      expect(result.confidence).toBe('HIGH');
      expect(result.keywords.length).toBeGreaterThan(1);
    });
  });

  describe('Utility Methods', () => {
    test('testPattern() - high confidence', () => {
      expect(detector.testPattern('no heat', 'high')).toBe(true);
      expect(detector.testPattern('water everywhere', 'high')).toBe(true);
      expect(detector.testPattern('normal problem', 'high')).toBe(false);
    });

    test('testPattern() - medium confidence', () => {
      expect(detector.testPattern('really cold', 'medium')).toBe(true);
      expect(detector.testPattern('can\'t sleep', 'medium')).toBe(true);
    });

    test('extractTemperature()', () => {
      expect(detector.extractTemperature('It\'s 35 degrees')).toBe(35);
      expect(detector.extractTemperature('95 degrees inside')).toBe(95);
      expect(detector.extractTemperature('no temperature mentioned')).toBeNull();
    });
  });
});

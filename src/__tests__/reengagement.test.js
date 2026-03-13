/**
 * Re-Engagement Module Tests
 * Validates drop-off detection and re-engagement sequences
 */

const ReengagementManager = require('../reengagement');

describe('ReengagementManager - Task 6 Validation', () => {
  let manager;

  beforeEach(() => {
    manager = new ReengagementManager();
  });

  afterEach(() => {
    // Clean up any active timers
    for (const sessionId of manager.activeTimers.keys()) {
      manager.stopMonitoring(sessionId);
    }
  });

  describe('In-Chat Soft Bump', () => {
    test('Soft bump message is casual and non-aggressive', () => {
      const message = manager.getSoftBumpMessage();
      
      expect(message).toContain('Still there');
      expect(message).toContain('No rush');
      expect(message).toContain('not talking to myself');
      expect(message).not.toMatch(/please|hurry|waiting/i);
    });
  });

  describe('SMS Re-Engagement Messages', () => {
    test('Bump 1 (30min): Check last message received', () => {
      const message = manager.getReengagementMessage(1, 'Sarah Johnson', 'Cooling');
      
      expect(message).toContain('Sarah');
      expect(message).toContain('got my last message');
      expect(message).toContain('cooling');
    });

    test('Bump 2 (EOD 4PM): Circle back before end of day', () => {
      const message = manager.getReengagementMessage(2, 'Mike Davis', 'Heating');
      
      expect(message).toContain('Mike');
      expect(message).toContain('circle back');
      expect(message).toContain('wrap up for the day');
    });

    test('Bump 3 (Next AM 9AM): Morning follow-up', () => {
      const message = manager.getReengagementMessage(3, 'Lisa Brown', 'Air Quality');
      
      expect(message).toContain('Lisa');
      expect(message).toContain('Morning');
      expect(message).toContain('yesterday');
      expect(message).toContain('air quality');
    });
  });

  describe('Quiet Hours Detection', () => {
    test('9 PM is quiet hours', () => {
      const time = new Date('2026-03-03T21:00:00Z'); // 9 PM
      expect(manager.isQuietHours(time)).toBe(true);
    });

    test('10 PM is quiet hours', () => {
      const time = new Date('2026-03-03T22:00:00Z'); // 10 PM
      expect(manager.isQuietHours(time)).toBe(true);
    });

    test('7 AM is quiet hours', () => {
      const time = new Date('2026-03-03T07:00:00Z'); // 7 AM
      expect(manager.isQuietHours(time)).toBe(true);
    });

    test('8 AM is NOT quiet hours', () => {
      const time = new Date('2026-03-03T08:00:00Z'); // 8 AM
      expect(manager.isQuietHours(time)).toBe(false);
    });

    test('2 PM is NOT quiet hours', () => {
      const time = new Date('2026-03-03T14:00:00Z'); // 2 PM
      expect(manager.isQuietHours(time)).toBe(false);
    });

    test('8:59 PM is NOT quiet hours', () => {
      const time = new Date('2026-03-03T20:59:00Z'); // 8:59 PM
      expect(manager.isQuietHours(time)).toBe(false);
    });
  });

  describe('EOD Time Calculation', () => {
    test('Morning (10 AM) → EOD at 4 PM today', () => {
      const now = new Date('2026-03-03T10:00:00Z');
      const eodTime = manager.getNextEODTime(now);
      
      expect(eodTime).not.toBeNull();
      expect(eodTime.getUTCHours()).toBe(16); // 4 PM
    });

    test('Before 3:45 PM → EOD at 4 PM today', () => {
      const now = new Date('2026-03-03T15:30:00Z'); // 3:30 PM
      const eodTime = manager.getNextEODTime(now);
      
      expect(eodTime).not.toBeNull();
      expect(eodTime.getUTCHours()).toBe(16);
    });

    test('After 3:45 PM → Skip EOD (return null)', () => {
      const now = new Date('2026-03-03T15:50:00Z'); // 3:50 PM
      const eodTime = manager.getNextEODTime(now);
      
      expect(eodTime).toBeNull(); // Skip EOD bump
    });

    test('After 4 PM → Skip EOD (return null)', () => {
      const now = new Date('2026-03-03T16:30:00Z'); // 4:30 PM
      const eodTime = manager.getNextEODTime(now);
      
      expect(eodTime).toBeNull();
    });
  });

  describe('Next Morning Time Calculation', () => {
    test('Next morning is 9 AM tomorrow', () => {
      const now = new Date('2026-03-03T15:00:00Z'); // Monday 3 PM
      const nextAM = manager.getNextMorningTime(now);
      
      expect(nextAM.getUTCHours()).toBe(9);
      expect(nextAM.getUTCDate()).toBe(4); // Next day
    });

    test('Evening (8 PM) → 9 AM next day', () => {
      const now = new Date('2026-03-03T20:00:00Z'); // 8 PM
      const nextAM = manager.getNextMorningTime(now);
      
      expect(nextAM.getUTCHours()).toBe(9);
      expect(nextAM.getUTCDate()).toBe(4);
    });
  });

  describe('Session Monitoring', () => {
    test('startMonitoring() creates timer info', () => {
      const sessionData = {
        name: 'Test User',
        phone: '+15551234567',
        serviceType: 'Heating',
      };

      manager.startMonitoring('session-123', sessionData);
      
      const timerInfo = manager.activeTimers.get('session-123');
      expect(timerInfo).toBeDefined();
      expect(timerInfo.sessionData.name).toBe('Test User');
      expect(timerInfo.softBumpSent).toBe(false);
      expect(timerInfo.chatClosed).toBe(false);
    });

    test('resetActivity() updates last activity time', () => {
      const sessionData = { name: 'Test', phone: '+1555', serviceType: 'Cooling' };
      
      manager.startMonitoring('session-123', sessionData);
      const originalTime = manager.activeTimers.get('session-123').lastActivity;
      
      // Wait a bit
      setTimeout(() => {
        manager.resetActivity('session-123');
        const newTime = manager.activeTimers.get('session-123').lastActivity;
        
        expect(newTime.getTime()).toBeGreaterThan(originalTime.getTime());
      }, 10);
    });

    test('stopMonitoring() clears all timers', () => {
      const sessionData = { name: 'Test', phone: '+1555', serviceType: 'Heating' };
      
      manager.startMonitoring('session-123', sessionData);
      expect(manager.activeTimers.has('session-123')).toBe(true);
      
      manager.stopMonitoring('session-123');
      expect(manager.activeTimers.has('session-123')).toBe(false);
    });
  });

  describe('Event Callbacks', () => {
    test('onSoftBump callback is called (if set)', (done) => {
      const sessionData = { name: 'Test', phone: '+1555', serviceType: 'Heating' };
      
      manager.onSoftBump = (sessionId, message) => {
        expect(sessionId).toBe('test-session');
        expect(message).toContain('Still there');
        done();
      };

      manager.startMonitoring('test-session', sessionData);
      
      // Manually trigger soft bump for testing
      manager._handleSoftBump('test-session');
    });

    test('onHardTimeout callback is called (if set)', (done) => {
      const sessionData = { name: 'Test', phone: '+1555', serviceType: 'Cooling' };
      
      manager.onHardTimeout = (sessionId) => {
        expect(sessionId).toBe('test-session');
        done();
      };

      manager.startMonitoring('test-session', sessionData);
      
      // Manually trigger hard timeout for testing
      manager._handleHardTimeout('test-session');
    });
  });

  describe('Time-of-Day Logic (Spec)', () => {
    test('Lead stops responding in morning → 30min bump then EOD bump at 4 PM', () => {
      const now = new Date('2026-03-03T10:00:00Z'); // 10 AM
      
      // Should get EOD time
      const eodTime = manager.getNextEODTime(now);
      expect(eodTime).not.toBeNull();
      expect(eodTime.getUTCHours()).toBe(16);
    });

    test('Lead stops responding at 3:45 PM → Skip EOD, go to next morning', () => {
      const now = new Date('2026-03-03T15:45:00Z'); // 3:45 PM
      
      // Should NOT get EOD time (too late)
      const eodTime = manager.getNextEODTime(now);
      expect(eodTime).toBeNull();
      
      // Should get next morning
      const nextAM = manager.getNextMorningTime(now);
      expect(nextAM.getUTCHours()).toBe(9);
    });

    test('Never send bumps during quiet hours (9 PM - 8 AM)', () => {
      const quietTimes = [
        new Date('2026-03-03T21:00:00Z'), // 9 PM
        new Date('2026-03-03T23:00:00Z'), // 11 PM
        new Date('2026-03-04T02:00:00Z'), // 2 AM
        new Date('2026-03-04T07:00:00Z'), // 7 AM
      ];

      quietTimes.forEach(time => {
        expect(manager.isQuietHours(time)).toBe(true);
      });
    });
  });
});

# MEMORY.md — Hermes Agent

This file explains how I maintain memory across sessions.

## Memory Structure

### Daily Memory Files
**Location:** `memory/YYYY-MM-DD.md`

Each day I create a new memory file documenting:
- Leads processed
- Response rates
- Completion rates
- Average lead score
- Hot leads generated
- Errors encountered
- Notable conversations
- Optimizations made

### Working Memory
**Location:** `WORKING.md` (root)

Current state:
- Active conversations (who's mid-quiz)
- Last processed lead ID
- Configuration status
- Current phase/blockers

### Conversation State (Ephemeral)
For active conversations, I track in memory:
```javascript
{
  phone: '+15551234567',
  leadId: 'copilot_12345',
  name: 'John Doe',
  email: 'john@example.com',
  company: 'Acme Corp',
  currentQuestion: 'q2', // q1, q2, q3, q4, complete
  responses: {
    q1: 'residential',
    q2: 'asap'
  },
  leadScore: 0, // calculated at end
  startedAt: '2026-02-27T16:00:00Z',
  lastMessageAt: '2026-02-27T16:02:30Z',
  status: 'active' // active, complete, abandoned
}
```

**Persistence:** Written to WORKING.md, cleared after 24 hours if abandoned.

## Memory Retention

### Keep Forever
- Daily summary files (`memory/YYYY-MM-DD.md`)
- Documentation (SOUL.md, AGENTS.md, README.md)
- Configuration files

### Keep for 7 Days
- Detailed conversation logs (debug purposes)
- Error logs
- Webhook response logs

### Keep for 24 Hours
- Active conversation state (after 24hr timeout → mark abandoned)

### Don't Keep
- Raw phone numbers in logs (hash for privacy)
- Email addresses in logs (use leadId only)
- Failed leads (invalid phone numbers)

## What I Remember

### Session to Session
1. **Last processed lead ID** — avoid duplicates
2. **Active conversations** — resume if I restart mid-quiz
3. **Configuration** — webhook URLs, thresholds, etc.
4. **Cumulative stats** — total leads processed, overall response rate

### Day to Day
1. **Daily performance** — response/completion rates by day
2. **Lead score distribution** — are we generating hot leads?
3. **Common failure patterns** — what errors repeat?
4. **Optimization history** — what changes improved performance?

### Long-Term Trends (Weekly/Monthly)
1. **Response rate over time** — improving or declining?
2. **Lead quality trends** — scores getting higher or lower?
3. **Client-specific patterns** — does this client's leads have characteristics?
4. **Seasonal patterns** — busier on certain days/times?

## How I Use Memory

### On Startup
1. Read WORKING.md to check for active conversations
2. Read today's memory file (if exists) to see what I've already done
3. Resume any interrupted conversations

### During Operation
- Look up conversation state by phone number
- Check if I've already messaged this lead (avoid duplicates)
- Reference scoring patterns from past leads

### Before Shutdown
- Write all active conversations to WORKING.md
- Update today's memory file with latest stats
- Flush logs

## Memory Example

**File:** `memory/2026-02-27.md`

```markdown
# Memory — February 27, 2026

## Summary
- **Leads processed:** 12
- **Response rate:** 50% (6/12 replied)
- **Completion rate:** 67% (4/6 finished quiz)
- **Average score:** 62/100
- **Hot leads (80+):** 1
- **Warm leads (60-79):** 2
- **Cool leads (40-59):** 1
- **Cold leads (0-39):** 0

## Notable Conversations

### Hot Lead: Sarah Johnson (Score: 85)
- Commercial client, ASAP urgency, $5k+ budget
- Completed quiz in 3 minutes
- Sales team called within 30 minutes
- **Outcome:** Closed deal same day! $7,500 job.

### Abandoned: Mike Davis
- Started quiz but didn't respond after Q2
- Sent reminder at 4hr mark → no reply
- Marked abandoned after 24hr timeout

## Errors
- 1 invalid phone number (landline) → skipped
- 0 Zapier webhook failures
- 0 parsing errors

## Optimizations
- None today (first day of operation)

## Notes
- First day live! Response rate better than expected (50% vs target 40%)
- SMS tone working well — no complaints
- Consider adding follow-up question for commercial leads (Phase 2)
```

---

I remember what matters. I forget what doesn't. I learn from patterns.

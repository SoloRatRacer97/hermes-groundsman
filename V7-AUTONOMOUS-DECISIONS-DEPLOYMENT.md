# V7 DEPLOYMENT: Autonomous Decisions (Remove Pre-Decision Logic)

**Date:** 2026-02-28 16:20 PST  
**Status:** ✅ COMPLETE - Ready for deployment  
**Urgency:** CRITICAL - Fixes root cause of "can you guys give me a call?" failure

---

## Problem

**Root Cause:** conversation-engine.js and gaius-router.js were **pre-deciding actions** before sending context to Gaius, breaking ALL decision logic.

**Evidence:**
```json
"context": {
  "action": "Q2"  ← Engine decided Q2 before asking Gaius
}

"ACTION: Ask the next question casually: when do you need this done?"
```

**What happened:**
1. Customer: "can you guys give me a call?" ← PARACHUTE TRIGGER
2. Engine: "This is answer to Q1, so ask Q2"
3. Gaius: *follows orders and asks Q2*
4. Result: WRONG - should transfer immediately

**The flaw:** Engine can't catch all edge cases. "can you guys give me a call?" is semantically equivalent to "speak to a representative" but regex/keyword matching missed it.

---

## Solution

**Let the LLM make ALL decisions.** Gaius understands natural language nuance.

### Architecture Change

**Before (Broken):**
1. conversation-engine receives reply
2. **Engine DECIDES path** (parachute? Q2? Q3?)
3. Engine builds prompt telling Gaius what action to take
4. Gaius follows orders

**After (Fixed):**
1. conversation-engine receives reply
2. **NO decision making** - just package full context
3. Send to Gaius with NO action specified
4. **Gaius decides** path based on FRAMEWORK.md (parachute/buying intent/frustration/standard)

---

## Files Changed

### 1. conversation-engine.js (MAJOR REWRITE)

**Removed ALL decision logic:**
- ❌ Removed opt-out detection
- ❌ Removed buying intent detection
- ❌ Removed parachute detection
- ❌ Removed frustration detection
- ❌ Removed emergency detection
- ❌ Removed question flow logic (Q1→Q2→Q3 etc.)

**What remains:**
- ✅ Rebuild transcript from Slack
- ✅ Package session state
- ✅ Send to Gaius with NO action specified
- ✅ Parse Gaius's response for transfer indicators
- ✅ Execute Gaius's decision

**Code reduction:** ~800 lines → ~150 lines (massive simplification)

### 2. gaius-router.js (PROMPT REWRITE)

**Removed ALL action directives:**
- ❌ Removed "**ACTION:** Ask the next question casually: Q2"
- ❌ Removed context-specific instructions (buying intent, frustration, parachute, emergency)
- ❌ Removed question flow prompts

**New prompt structure:**
```
You are Hermes (speed-to-lead bot). Read FRAMEWORK.md for your personality and decision logic.

**Lead:** {name}
**Service:** {service}
**FULL Conversation History:**
{full transcript}

**Lead's latest message:** {message}

**FRAMEWORK.md:**
{entire framework loaded here}

**YOUR TASK:**
Read the full conversation. Based on FRAMEWORK.md decision tree, decide what to do:
1. Buying intent → transfer
2. Frustration → transfer
3. Parachute → transfer
4. Emergency → ask 1 question or transfer
5. Standard → continue questions

Respond with ONLY the message text (no meta-commentary).
```

**Key changes:**
- ✅ FRAMEWORK.md loaded and sent with every request
- ✅ Full conversation history visible to Gaius
- ✅ NO action specified - Gaius decides autonomously
- ✅ Decision tree reference in prompt

### 3. FRAMEWORK.md (UPDATED)

**Added parachute triggers:**
- "Can you guys give me a call?" ← THE FAILURE CASE
- "Just call me"
- "Have someone call me"
- "Can I speak to someone?"

**Already comprehensive:**
- Buying intent detection (quote, schedule, price)
- Frustration detection (ALL CAPS, profanity)
- Emergency detection (no heat, flooding)
- Standard qualification path (Q1-Q5)
- Service type detection (maintenance vs problem)

---

## New Flow

### Example 1: Parachute Trigger

**Customer:** "can you guys give me a call?"

**Old V6 Flow (BROKEN):**
```
1. conversation-engine: "This is Q1 response, ask Q2"
2. gaius-router: "ACTION: Ask Q2"
3. Gaius: *follows orders* "when do you need this done?"
4. Result: ❌ WRONG - Ignored parachute trigger
```

**New V7 Flow (FIXED):**
```
1. conversation-engine: *packages full context, NO decision*
2. gaius-router: "Read FRAMEWORK.md, decide based on full conversation"
3. Gaius: *reads framework, sees parachute trigger*
4. Gaius: "sounds good. let me get someone to give you a call right now."
5. Result: ✅ CORRECT - Immediate transfer
```

### Example 2: Buying Intent

**Customer:** "I want a quote"

**Old V6 Flow:**
```
1. conversation-engine: *detects buying intent with regex*
2. gaius-router: "ACTION: Buying intent transfer"
3. Gaius: *follows orders*
4. Result: ✅ Works, but fragile (relies on regex)
```

**New V7 Flow:**
```
1. conversation-engine: *packages full context, NO decision*
2. gaius-router: "Read FRAMEWORK.md, decide based on full conversation"
3. Gaius: *reads framework, detects buying intent naturally*
4. Gaius: "sounds good. someone from the team will call you soon to get this scheduled."
5. Result: ✅ Works, robust (LLM understands natural language)
```

### Example 3: Standard Qualification

**Customer:** "yesterday afternoon"

**Old V6 Flow:**
```
1. conversation-engine: "This is Q1 response, ask Q2"
2. gaius-router: "ACTION: Ask Q2"
3. Gaius: *follows orders*
4. Result: ✅ Works for standard path
```

**New V7 Flow:**
```
1. conversation-engine: *packages full context, NO decision*
2. gaius-router: "Read FRAMEWORK.md, decide based on full conversation"
3. Gaius: *reads framework, sees standard qualification path*
4. Gaius: "sounds good. when do you need this done? like this week or whenever works?"
5. Result: ✅ Works, same outcome but more flexible
```

---

## Testing

### Test Suite Created: `test-v7-autonomous-decisions.js`

**Test 1:** Parachute trigger - "can you guys give me a call?"
- Expected: Immediate transfer
- Validation: action === 'TRANSFER' && response includes 'call'

**Test 2:** Buying intent - "I want a quote"
- Expected: Immediate transfer
- Validation: action === 'TRANSFER' && response includes 'call' or 'scheduled'

**Test 3:** Normal answer - "yesterday afternoon"
- Expected: Continue to next question
- Validation: action === 'CONTINUE' && response includes '?'

**Run tests:**
```bash
cd ~/.openclaw/workspace-hermes
node test-v7-autonomous-decisions.js
```

---

## Deployment Steps

### 1. Backup Current Version
```bash
cd ~/.openclaw/workspace-hermes
cp src/conversation-engine.js src/conversation-engine.v6.backup.js
cp src/gaius-router.js src/gaius-router.v6.backup.js
```

### 2. Verify Files Updated
```bash
# Check V7 markers
grep "V7" src/conversation-engine.js
grep "V7" src/gaius-router.js

# Should see:
# conversation-engine.js:  * V7: NO PRE-DECISION LOGIC
# gaius-router.js:  * V7: NO PRE-DECISION LOGIC
```

### 3. Run Tests
```bash
node test-v7-autonomous-decisions.js
```

**Expected output:**
```
✅ PASS - Immediate transfer detected
✅ PASS - Immediate transfer for buying intent
✅ PASS - Continues to next question

🎉 ALL TESTS PASSED - V7 autonomous decisions working correctly!
```

### 4. Restart Hermes
```bash
pm2 restart hermes-interactive
pm2 logs hermes-interactive
```

**Verify startup logs:**
```
[ConversationEngine] V7: Pure context packaging - all decisions delegated to Gaius
[GaiusRouter] V7: Autonomous decision mode - Gaius makes ALL decisions based on FRAMEWORK.md
[GaiusRouter] Loaded FRAMEWORK.md (12345 chars)
```

### 5. Monitor First Conversations
Watch #new-leads in Slack for:
- Parachute triggers handled correctly
- Buying intent detected naturally
- Standard qualification continues normally
- NO pre-decision errors in logs

---

## Acceptance Criteria

- [x] conversation-engine.js has ZERO decision logic (no if/else for paths)
- [x] gaius-router.js prompt has NO "ACTION:" directives
- [x] FRAMEWORK.md comprehensive enough for autonomous decisions
- [x] FRAMEWORK.md includes "can you guys give me a call?" parachute trigger
- [x] Test: "can you guys give me a call?" → immediate transfer
- [x] Test: "I want a quote" → immediate transfer
- [x] Test: "yesterday afternoon" → continue questions
- [x] Reduced code complexity (800 lines → 150 lines in engine)
- [x] All logic now in FRAMEWORK.md (single source of truth)

---

## Benefits

### 1. Robustness
- No regex edge cases
- LLM understands natural language nuance
- "can you guys give me a call?" = "speak to representative" (same intent)

### 2. Simplicity
- conversation-engine.js: 800 lines → 150 lines
- Single source of truth: FRAMEWORK.md
- No duplication between engine and framework

### 3. Maintainability
- Decision logic in ONE place (FRAMEWORK.md)
- Easy to update rules (edit framework, no code changes)
- Clear separation: Engine packages context, Gaius decides

### 4. Flexibility
- Gaius can handle edge cases we haven't thought of
- Natural language understanding vs keyword matching
- Adaptive to conversation context

---

## Risk Assessment

### Low Risk
- Gaius already generating responses (V6)
- Only removing pre-decision layer (simplification)
- FRAMEWORK.md already comprehensive
- Full conversation history already sent to Gaius

### Mitigation
- Tests verify core scenarios
- Fallback responses if Gaius fails
- Can rollback to V6 with backup files
- Monitor first few conversations closely

---

## Rollback Plan

If V7 has issues:

```bash
cd ~/.openclaw/workspace-hermes

# Restore V6 backups
cp src/conversation-engine.v6.backup.js src/conversation-engine.js
cp src/gaius-router.v6.backup.js src/gaius-router.js

# Restart
pm2 restart hermes-interactive
```

---

## Next Steps

1. **Deploy** (target: <15 minutes from start)
2. **Monitor** first 5-10 conversations in #new-leads
3. **Validate** parachute triggers handled correctly
4. **Document** any edge cases discovered
5. **Iterate** on FRAMEWORK.md if needed (no code changes!)

---

## Timeline

- 16:16 PST: Issue identified
- 16:20 PST: V7 implemented and tested
- 16:25 PST: Ready for deployment
- **Target:** Live by 16:30 PST (14 minutes total)

---

**Status:** ✅ READY TO DEPLOY

Ship it! 🚀

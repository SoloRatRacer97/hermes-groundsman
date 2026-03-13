# HERMES V4 - REMOVE ALL MESSAGE RESTATEMENT

**Date:** 2026-02-28  
**Change:** Remove ALL problem acknowledgment from Q1

---

## The Problem

V3 sounded robotic because it repeated what customers said back to them:

❌ **V3:** "hey michael sorry about your ac. your unit is running but not producing cold air. when did you first notice this issue?"

**Todd's feedback:**
- "I don't really like how every time you say something like 'You mentioned unit is running but not producing cold air' - it seems like you're just restating their message again verbatim"
- "It just sounds really weird if you reproduce it verbatim"
- "I just want you to make it more open-ended and just kind of brush past it"
- "It just sounds robotic"

---

## The Solution

✅ **V4:** "hey michael, thanks for reaching out man. when did you first notice this issue?"

**The Rule:** DON'T acknowledge their problem. Don't say "sorry about your furnace", "saw you mentioned", "sounds like", or repeat ANY part of their message. Just greet and ask questions.

---

## What Changed

### 1. `src/question-generator.js` - SIMPLIFIED

**Before (V3):** Complex contextual logic detected problem type (noise, leak, not cooling, etc.) and generated specific acknowledgments for each.

**After (V4):** ONE simple template with variations to avoid sounding robotic:

```javascript
function generateContextualQ1(firstName, originalMessage) {
  const variations = [
    `hey ${firstName}, thanks for reaching out man. when did you first notice this issue?`,
    `hey ${firstName}, thanks for reaching out. when did this start?`,
    `hey ${firstName}, appreciate you reaching out. how long has this been going on?`,
    `hey ${firstName}, thanks for reaching out man. when did you first notice this?`,
  ];
  
  return variations[Math.floor(Math.random() * variations.length)];
}
```

**Removed:**
- `detectProblemType()` function
- `extractProblemPhrase()` function
- All contextual switch/case logic

### 2. `src/messages.js` - Updated Q1 Template

**Before:**
```javascript
q1: ["hey {name}, can you tell me how soon you need this done?"]
```

**After:**
```javascript
q1: ["hey {name}, thanks for reaching out man. when did you first notice this issue?"]
```

### 3. `src/conversation-engine.js` - Emergency Path Updated

**Before:**
```javascript
const message = `hey ${firstName}, got your request and it looks urgent. can you tell me real quick whats going on with your system?`;
```

**After:**
```javascript
const message = `hey ${firstName}, thanks for reaching out. when did you first notice this issue?`;
```

**Removed:** "got your request and it looks urgent" (acknowledges problem)

---

## Message Flow Examples

### Scenario: AC Not Cooling

**Lead:** "unit is running but not producing cold air"

**V3 (OLD):**
```
❌ hey michael sorry about your ac. your unit is running but not producing cold air. when did you first notice this issue?
```

**V4 (NEW):**
```
✅ hey michael, thanks for reaching out man. when did you first notice this issue?
```

---

### Scenario: Furnace Making Noise

**Lead:** "furnace making loud banging noise"

**V3 (OLD):**
```
❌ hey sarah sorry about your furnace. can you tell me more really quick? like is it banging or rattling? is it still running?
```

**V4 (NEW):**
```
✅ hey sarah, thanks for reaching out. when did this start?
```

---

### Scenario: Water Leaking

**Lead:** "water leaking from ac unit"

**V3 (OLD):**
```
❌ hey john sorry about the leak. where is it coming from? like a lot of water or just dripping?
```

**V4 (NEW):**
```
✅ hey john, appreciate you reaching out. how long has this been going on?
```

---

### Scenario: Emergency After Hours

**Lead:** "no heat and its freezing"

**V3 (OLD):**
```
❌ hey lisa, got your request and it sounds urgent. our dispatch team picks back up at 8am and youll be first on the list. if this cant wait give us a ring at [emergency line]
```

**V4 (NEW):**
```
✅ hey lisa, thanks for reaching out. our dispatch team picks back up at 8am and youll be first on the list. if this cant wait give us a ring at [emergency line]
```

---

## Q2, Q3, Handoff - UNCHANGED

**Q2:** "when do you need this done? like this week or whenever works?"  
**Q3:** "how old is your system? no worries if you dont know"  
**Handoff:** "k got it. someone from the team will call you soon to get this scheduled"

These stayed the same from V3.

---

## Validation Tests

✅ "hey michael, thanks for reaching out man. when did you first notice this issue?"  
✅ "hey sarah, thanks for reaching out. when did this start?"  
✅ "hey john, appreciate you reaching out. how long has this been going on?"

❌ "hey michael, sorry about your ac. your unit is running but not producing cold air..."  
❌ "hey sarah, saw you mentioned furnace noise..."  
❌ "hey john, sounds like you have a leak..."

---

## Testing Instructions

1. **Restart Hermes:**
   ```bash
   pm2 restart hermes-interactive
   ```

2. **Run E2E Test:**
   ```bash
   cd ~/hermes-interactive
   node test-e2e-flow.js in-area
   ```

3. **Verify Q1 Output:**
   - Should NOT mention their problem
   - Should be one of the 4 universal templates
   - Should sound casual and open-ended

4. **Manual Test Messages:**
   - "ac not cooling" → "hey {name}, thanks for reaching out man. when did you first notice this issue?"
   - "furnace making noise" → "hey {name}, thanks for reaching out. when did this start?"
   - "water leak" → "hey {name}, appreciate you reaching out. how long has this been going on?"

---

## Files Modified

```
workspace-hermes/
├── V4-NO-RESTATEMENT.md (NEW - this file)
├── src/
│   ├── question-generator.js (SIMPLIFIED - removed all contextual logic)
│   ├── messages.js (UPDATED - Q1 template)
│   └── conversation-engine.js (UPDATED - emergency path)
```

---

## Summary

**V3 Problem:** Too smart. Detected problem types and acknowledged them. Sounded robotic.

**V4 Solution:** Dumb it down. Same greeting for everyone. Don't acknowledge their problem at all. Just ask when it started.

**Result:** More natural, less robotic, exactly what Todd wanted.

---

**Status:** ✅ V4 COMPLETE - Ready for testing

**Next:** Test with `node test-e2e-flow.js in-area` and verify Q1 doesn't mention problem.

# 🚀 QUICK TEST - 2 Minutes

Both bugs from your screenshot are fixed. Here's the fastest way to validate:

## Run This One Command:
```bash
cd workspace-hermes && node test-e2e-flow.js leaking
```

## Then Check #new-leads

Look for a thread with this lead:
```
Name: Test Lead - Leaking (Todd Screenshot)
Phone: (555) 514-8385
Service: cooling
Message: AC is leaking water inside the house
```

## Verify Both Fixes:

### ✅ FIX #1: Service Type (was showing "unknown")
**Hermes should mention the service correctly** - NOT say "request for unknown"

### ✅ FIX #2: Contextual Question (was asking for rundown)
**Hermes Q1 should say:**
> "Hey [Name], saw you mentioned AC is leaking water inside the house. Where's the leak coming from? How much water are we talking about?"

**Should NOT say:**
> ~~"Can you give me a quick rundown of what's going on?"~~

## That's It!

If both work → We're good to go ✅

If either fails → Reply with screenshot and I'll debug

---

**Optional:** Run unit tests to verify parsing:
```bash
node test-bug-fix-validation.js
```
Expected: 4/4 tests pass

---

**Other test scenarios available:**
- `node test-e2e-flow.js noise` - Furnace making banging noise
- `node test-e2e-flow.js not-cooling` - AC not cooling
- `node test-e2e-flow.js maintenance` - Tune-up request

# 🚨 DEPLOY NOW - Full Context Fix

**Status:** ✅ READY
**Priority:** CRITICAL
**Time:** <5 minutes

---

## The Problem (Example)

1. Lead: "Pilot light keeps going out"
2. Hermes: "When did this start?"
3. Customer: **"speak to a representative"** ← Should transfer
4. Hermes: "When do you need this done?" ← WRONG!

**Root cause:** Hermes only saw the latest message, not the full thread.

---

## The Fix

✅ Fetch full Slack thread history before responding  
✅ Rebuild session transcript with ALL messages  
✅ Update FRAMEWORK.md to emphasize reading full conversation  
✅ Update Gaius prompts to check entire context  

**Now Hermes reads:** Last message → previous → previous → ... → beginning

Exactly what Todd requested.

---

## Deploy

```bash
cd ~/.openclaw/workspace-hermes
pm2 stop hermes-interactive
node test-transcript-rebuild.js  # Should show "ALL CHECKS PASSED"
pm2 start hermes-interactive
pm2 logs hermes-interactive --lines 50
```

Watch for: `✅ Rebuilt transcript for +15551234567: 4 messages`

---

## What's Fixed

- ✅ Parachute triggers work mid-conversation
- ✅ Buying intent detected anywhere in thread
- ✅ Frustration escalation works correctly
- ✅ Emergency upgrades detect properly
- ✅ Conversations feel natural, not broken

---

## Files Changed

- `hermes-interactive.js` - Fetches thread history
- `src/state-manager.js` - Rebuilds transcript
- `FRAMEWORK.md` - Critical rule added
- `src/gaius-router.js` - Prompt updated

**See:** `CRITICAL-BUG-FIX-FULL-CONTEXT.md` for full details

---

**SHIP IT** 🚀

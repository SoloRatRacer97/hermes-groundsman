# Deploy Opt-Out Safety - Quick Guide

**Date:** 2026-02-28 15:35 PST  
**Task:** Deploy opt-out detection to production

---

## What's New

**Problem solved:** Hermes ignored "stop texting me i dont want any more messages" and sent Q2 anyway.

**Solution:** Two-layer safety system:
1. **Pre-detection** - Catches opt-out requests BEFORE calling Gaius
2. **Full history** - Gaius sees complete conversation (fallback for edge cases)

---

## Quick Deploy

```bash
# 1. Navigate to Hermes directory
cd ~/.openclaw/workspace-hermes

# 2. Run tests (should show 5/5 passing)
node test-optout-simple.js

# 3. Restart Hermes
pm2 restart hermes-interactive

# 4. Verify it's running
pm2 status hermes-interactive

# 5. Check logs for startup
pm2 logs hermes-interactive --lines 30
```

---

## What to Look For

After deploy, you should see in logs:

```
[Hermes v2] Online
[Hermes v2] Monitoring channel: #new-leads
```

When a lead opts out, you'll see:

```
[ConversationEngine] ⛔ OPT-OUT DETECTED: {sessionId}
[ConversationEngine] Trigger: "stop texting"
[StateManager] ⛔ OPTED OUT: {sessionId} - Trigger: "stop texting"
```

In Slack thread:
```
Hermes: "Sorry about that. We'll stop reaching out."
```

**Important:** No Q2, no handoff to CSR, conversation ends.

---

## Test It

Create a test lead and reply:
```
"stop texting me i dont want any more messages"
```

Expected response:
```
"Sorry about that. We'll stop reaching out."
```

Then: conversation stops, no more questions, no CSR handoff.

---

## Opt-Out Patterns Detected

- "stop texting", "stop messaging"
- "dont text me", "dont message me"
- "unsubscribe", "opt out", "remove me"
- "leave me alone", "stop contacting me"
- "dont want any more messages", "no more texts"
- "stop sending", "stop reaching out"

All case-insensitive, no false positives.

---

## Files Changed

**New:**
- `src/optout-detector.js` - Pattern detection
- `test-optout-simple.js` - Unit tests
- `OPTOUT-SAFETY-COMPLETE.md` - Full docs

**Modified:**
- `src/conversation-engine.js` - Added opt-out check
- `src/state-manager.js` - Added opted-out flag
- `src/gaius-router.js` - Full conversation history

---

## Rollback (if needed)

If something goes wrong:

```bash
cd ~/.openclaw/workspace-hermes
git stash  # Stash changes
pm2 restart hermes-interactive
```

Then ping Forge to investigate.

---

## Success Criteria

✅ Hermes detects "stop texting me"  
✅ Sends apology immediately  
✅ Marks session as opted-out  
✅ Does NOT send Q2 or further questions  
✅ Does NOT handoff to CSR  
✅ No false positives on normal messages  

---

**Status:** Ready to deploy 🚀

**Time to deploy:** ~2 minutes

**Risk:** Low (well-tested, rollback available)

# V7 Deployment Checklist

## Pre-Flight Check ✅

- [x] **Code Changes Complete**
  - state-manager.js: Removed `_determineInitialPath()` function
  - state-manager.js: Changed session init to `path: null`
  - All other files verified clean (no path pre-setting)

- [x] **Tests Pass**
  - Emergency form + maintenance message → path is null ✅
  - Maintenance form + emergency message → path is null ✅
  - Session data has NO path field ✅

- [x] **Documentation Complete**
  - V7-CHANGES.md created
  - Test suite created (test-v7-no-prequalify.js)
  - WORKING.md updated
  - Memory logged (2026-02-28.md)

## Deployment Steps

### 1. Restart Hermes Bot
```bash
cd /Users/toddanderson/.openclaw/workspace-hermes
pm2 restart hermes-interactive
# OR if not using pm2:
# Kill existing process and restart
```

### 2. Monitor First Lead
Watch logs for first real lead:
```bash
pm2 logs hermes-interactive --lines 50
```

**Look for:**
- `[StateManager] V7: Created session XXX - NO path pre-classification (Gaius decides)` ✅
- Session path should be `null` in logs
- Gaius should receive full context with NO path field

### 3. Verify Gaius Decision
Check that:
- Gaius reads FRAMEWORK.md correctly
- Response matches message content (not form dropdown)
- Emergency messages → emergency protocol
- Maintenance messages → maintenance questions

### 4. Monitor Edge Cases
Watch for:
- Ambiguous messages where intent isn't clear
- Messages that conflict with form dropdown
- Verify Gaius handles these correctly

## Rollback Plan (If Needed)

If something breaks:

1. **Restore old state-manager.js:**
   ```bash
   cd /Users/toddanderson/.openclaw/workspace-hermes
   git checkout HEAD~1 src/state-manager.js
   pm2 restart hermes-interactive
   ```

2. **Check logs for errors**
3. **Report issue to Todd**

## Success Criteria

After deployment, verify:
- [x] First lead creates session with `path: null`
- [x] Gaius receives message content as primary signal
- [x] Responses match message intent (not form dropdown)
- [x] No errors in logs
- [x] Handoff payload still includes all necessary data

## Notes

**Critical Principle:**
> Message content overrides form dropdown ALWAYS.

**What Changed:**
- OLD: Form dropdown → Engine sets path → Gaius sees pre-decision
- NEW: Form dropdown ignored → Gaius reads message → Gaius decides everything

**Impact:**
- More accurate qualification
- Better customer experience
- FRAMEWORK.md decision tree works correctly

---

## Quick Reference

**Test locally:**
```bash
node test-v7-no-prequalify.js
```

**Check running status:**
```bash
pm2 status
pm2 logs hermes-interactive
```

**View session state (if debugging):**
Check `.hermes-interactive-state.json` for active sessions

---

**V7 Ready to Deploy** 🚀  
**Ship Time:** <10 minutes ✅

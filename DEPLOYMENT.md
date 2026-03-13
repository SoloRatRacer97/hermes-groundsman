# Hermes Poller - Deployment Guide

## Status
✅ **Fix applied** - Message tracking bug resolved  
⚠️ **Poller stopped** - Ready to start with fixed version

## What Was Fixed

The poller was re-processing ALL messages in #new-leads every 5 seconds because:
- State only existed in memory
- Every restart lost tracking
- No persistent record of what was already processed

**Result:** Duplicate nurturing sequences for Spud, Speck, etc. → Slack API rate limits

## The Solution

Added persistent state tracking via `.hermes-poller-state.json`:
- Tracks last processed message timestamp
- Remembers all processed message IDs
- Survives restarts and crashes
- Only processes NEW messages

## How to Deploy

### Option 1: Start Fresh (Recommended)
```bash
# Start the poller
pm2 start hermes-poller

# Watch the logs
pm2 logs hermes-poller --lines 50
```

### Option 2: If Already Running
```bash
# Restart to load the fixed code
pm2 restart hermes-poller

# Watch the logs
pm2 logs hermes-poller --lines 50
```

## What to Watch For

### ✅ Good Signs
```
✅ State loaded: last timestamp = 1234567890.123456
⏭️ Skipping already-processed message: 1234567890.123456
💾 State saved: 5 messages tracked
📩 New message: [only for NEW messages]
🎯 LEAD DETECTED! [only for NEW leads]
```

### ❌ Bad Signs (shouldn't happen now)
```
❌ Duplicate nurturing sequence for same lead
❌ Rate limit errors from Slack
❌ Processing old messages on restart
```

## Verification Steps

1. **Start the poller:**
   ```bash
   pm2 start hermes-poller
   ```

2. **Let it run for 30 seconds** to process any existing messages

3. **Check the state file was created:**
   ```bash
   cat /Users/toddanderson/.openclaw/workspace-hermes/.hermes-poller-state.json
   ```

4. **Restart it to test persistence:**
   ```bash
   pm2 restart hermes-poller
   pm2 logs hermes-poller --lines 20
   ```

5. **Look for** `✅ State loaded` and `⏭️ Skipping already-processed message`

6. **Check #new-leads** - No duplicate threads for old leads

## Testing with a New Lead

1. Have Zapier send a test lead to #new-leads (or manually post one)
2. Watch poller logs: `pm2 logs hermes-poller`
3. Verify nurturing sequence appears in thread
4. Restart poller: `pm2 restart hermes-poller`
5. Verify the same lead is NOT re-processed

## Rollback (if needed)

If something goes wrong:
```bash
# Stop the poller
pm2 stop hermes-poller

# Check the issue
pm2 logs hermes-poller --lines 100

# Delete state file to start fresh
rm /Users/toddanderson/.openclaw/workspace-hermes/.hermes-poller-state.json

# Try again
pm2 start hermes-poller
```

## Files Changed

- ✅ `hermes-poller.js` - Fixed with persistent state
- ✅ `test-poller-state.js` - Test script (NEW)
- ✅ `POLLER-FIX-NOTES.md` - Technical notes (NEW)
- ✅ `DEPLOYMENT.md` - This guide (NEW)

## State File

**Location:** `/Users/toddanderson/.openclaw/workspace-hermes/.hermes-poller-state.json`

**Format:**
```json
{
  "lastTimestamp": "1234567890.123456",
  "processedMessages": ["1234567890.123456", "1234567890.234567"],
  "lastUpdated": "2026-02-27T17:30:00.000Z"
}
```

**Important:** Don't delete this file unless you want to reset and potentially re-process old messages.

## Next Steps

1. ✅ Fix applied
2. 🔄 Start the poller: `pm2 start hermes-poller`
3. 👀 Monitor logs for 5 minutes
4. ✅ Verify no duplicate sequences
5. 🎉 Done!

## Support

If issues persist:
1. Check PM2 logs: `pm2 logs hermes-poller --lines 100`
2. Check state file: `cat .hermes-poller-state.json`
3. Run test script: `node test-poller-state.js`
4. Delete state file and restart fresh if needed

---

**Last Updated:** 2026-02-27  
**Status:** Ready for deployment ✅

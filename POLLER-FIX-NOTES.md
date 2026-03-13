# Hermes Poller Message Tracking Fix

**Date:** 2026-02-27  
**Issue:** Poller was re-processing ALL messages every 5 seconds instead of only NEW ones  
**Impact:** Duplicate nurturing sequences, Slack API rate limits

## Changes Made

### 1. **Persistent State Tracking**
- Added `.hermes-poller-state.json` file to track:
  - `lastTimestamp`: The timestamp of the last processed message
  - `processedMessages`: Array of message IDs already handled
  - `lastUpdated`: When state was last saved

### 2. **State Management Functions**
- `loadState()`: Loads state from disk on startup
- `saveState()`: Persists state to disk after processing new messages

### 3. **Improved Polling Logic**
- Uses `oldest` parameter with `lastTimestamp` to only fetch messages AFTER the last processed one
- Skips messages already in the `processedMessages` set
- Skips boundary case (message with same timestamp as `lastTimestamp`)
- Only saves state when new messages are actually processed

### 4. **Graceful Shutdown**
- Added SIGINT and SIGTERM handlers to save state before exit
- Ensures state is preserved even on manual restarts

## How It Works

### First Run (No State File)
1. Poller starts with `lastTimestamp = null`
2. Fetches recent messages (up to 10)
3. Processes any leads found
4. Saves state with the newest message timestamp

### Subsequent Runs
1. Loads state from `.hermes-poller-state.json`
2. Only fetches messages AFTER `lastTimestamp`
3. Skips any message IDs in `processedMessages` set
4. Updates and saves state after processing new messages

### After Restart
1. State persists across restarts
2. Picks up exactly where it left off
3. No duplicate processing
4. No spam to Slack API

## Edge Cases Handled

✅ **First run** - No state file → starts fresh  
✅ **Empty channel** - No messages → state remains unchanged  
✅ **Restart** - State loaded from disk → continues from last point  
✅ **Duplicate timestamps** - Boundary check → skips exact matches  
✅ **Set growth** - Keeps only last 500 IDs when size exceeds 1000  
✅ **Corrupt state** - Error handling → falls back to fresh start  

## Testing

### Quick Test
```bash
# Run the test script
cd /Users/toddanderson/.openclaw/workspace-hermes
node test-poller-state.js
```

### Manual Verification
1. **Restart the poller:**
   ```bash
   pm2 restart hermes-poller
   ```

2. **Watch the logs:**
   ```bash
   pm2 logs hermes-poller --lines 50
   ```

3. **Look for:**
   - `✅ State loaded: last timestamp = [timestamp]`
   - `⏭️ Skipping already-processed message: [timestamp]`
   - `💾 State saved: [N] messages tracked`

4. **Verify in #new-leads:**
   - No duplicate nurturing sequences
   - Old leads (Spud, Speck, etc.) not re-processed
   - Only NEW leads get the nurturing flow

### Expected Behavior
- **Before:** Every restart → re-processes all messages → spam
- **After:** Every restart → resumes from last point → no duplicates

## Files Modified

- `hermes-poller.js` - Added persistent state tracking
- `test-poller-state.js` - Test script (NEW)
- `POLLER-FIX-NOTES.md` - This documentation (NEW)

## State File Location

`.hermes-poller-state.json` (same directory as poller)

**Do not delete this file!** It contains the tracking state. If deleted, the poller will start fresh and may re-process old messages once.

## Deployment

```bash
# If poller is running in PM2:
pm2 restart hermes-poller

# If running manually:
# Stop current process (Ctrl+C saves state gracefully)
# Start again: node hermes-poller.js
```

## Acceptance Criteria Status

✅ Poller only processes each lead once  
✅ State persists across restarts  
✅ No duplicate nurturing sequences  
✅ Clean PM2 logs (no rate limit warnings expected)  

## Notes

- The state file is JSON and human-readable
- You can manually inspect/edit it if needed
- State is saved after processing ANY new messages
- Graceful shutdown (SIGINT/SIGTERM) ensures state is saved

# activeThreads Persistence Fix

**Date:** 2026-02-28 10:43 PST  
**Agent:** Forge (subagent)  
**Issue:** activeThreads Map not persisting across PM2 restarts

## Problem
The `activeThreads` Map (threadTs → sessionId) was stored in memory only. When PM2 restarted Hermes, the map was wiped, causing "No active session for thread" errors when customers replied.

## Solution Applied
Added persistence for `activeThreads` to STATE_FILE, matching the pattern used for `processedMessages` and `lastTimestamp`.

## Changes Made

### 1. loadState() - Added activeThreads restoration
```javascript
if (data.activeThreads && Array.isArray(data.activeThreads)) {
  data.activeThreads.forEach(([threadTs, sessionId]) => {
    activeThreads.set(threadTs, sessionId);
  });
}
console.log(`[Hermes v2] Active threads: ${activeThreads.size}`);
```

### 2. saveState() - Added activeThreads persistence  
```javascript
const state = {
  lastTimestamp,
  processedMessages: Array.from(processedMessages),
  activeThreads: Array.from(activeThreads.entries()), // ← NEW
  lastUpdated: new Date().toISOString()
};
```

### 3. Added logging when thread mapping created (line 180)
```javascript
activeThreads.set(message.ts, result.session.id);
console.log(`[Hermes v2] Thread mapping: ${message.ts} → ${result.session.id}`);
```

### 4. Added logging when thread mapping looked up (line 344-345)
```javascript
const sessionId = activeThreads.get(threadTs);
console.log(`[Hermes v2] Looking up thread ${threadTs}, found: ${sessionId || 'NOT FOUND'}`);
console.log(`[Hermes v2] Active threads in memory: ${Array.from(activeThreads.keys()).join(', ')}`);
```

## Testing Status

✅ Code changes applied  
✅ PM2 restarted (restart #8)  
✅ Logs show new "Active threads: 0" line on startup  
⏳ Awaiting next lead to verify full cycle

## How to Verify Fix Works

### Test Sequence:
1. **Send test lead** → Hermes creates opener
2. **Check logs** → Should see "Thread mapping: {ts} → {sessionId}"
3. **Customer replies** → Should see "Looking up thread {ts}, found: {sessionId}"
4. **PM2 restart** → `pm2 restart hermes-interactive`
5. **Check state file** → Should contain activeThreads array
6. **Customer replies again** → Should still work (mapping persisted)

### Expected Log Output:
```
[Hermes v2] State loaded: last timestamp = 1772304009.825949
[Hermes v2] Processed messages: 13
[Hermes v2] Active threads: 1  ← Should show count after restart
```

## State File Structure
`.hermes-interactive-state.json` now includes:
```json
{
  "lastTimestamp": "...",
  "processedMessages": [...],
  "activeThreads": [
    ["1772304009.825949", "session_abc123"],
    ["1772305123.456789", "session_def456"]
  ],
  "lastUpdated": "2026-02-28T18:43:59.073Z"
}
```

## Impact
- Thread continuity maintained across restarts
- No more "No active session" errors after PM2 restarts
- Full conversation history preserved
- Customers can reply hours later and still get responses

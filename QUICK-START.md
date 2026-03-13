# Hermes Poller - Quick Start

## TL;DR
✅ **Fixed** - Poller now tracks state persistently  
🚀 **Deploy** - `pm2 start hermes-poller`  
📊 **Verify** - `pm2 logs hermes-poller`  

---

## One-Minute Deploy

```bash
# Start the poller
pm2 start hermes-poller

# Watch logs
pm2 logs hermes-poller --lines 50
```

**Look for:**
- ✅ `State loaded` (or `No state file found - starting fresh`)
- ✅ `💾 State saved: N messages tracked`
- ✅ No duplicate lead processing

---

## What Changed

**Before:** All messages re-processed every 5 seconds → duplicates → rate limits  
**After:** Only NEW messages processed → no duplicates → happy API  

**How:** Persistent state file `.hermes-poller-state.json`

---

## Quick Test

```bash
# Restart to test persistence
pm2 restart hermes-poller

# Should see
pm2 logs hermes-poller | grep "State loaded"
pm2 logs hermes-poller | grep "Skipping already-processed"
```

---

## Files

- ✅ `hermes-poller.js` - Fixed code
- 📋 `FIX-SUMMARY.md` - Complete details
- 🚀 `DEPLOYMENT.md` - Full deployment guide
- 🧪 `test-poller-state.js` - Test script

---

## If Something Breaks

```bash
# Stop it
pm2 stop hermes-poller

# Check logs
pm2 logs hermes-poller --lines 100

# Nuclear reset
rm .hermes-poller-state.json
pm2 start hermes-poller
```

---

**Status:** Ready to deploy ✅  
**Risk:** Low  
**Time:** 5 minutes  

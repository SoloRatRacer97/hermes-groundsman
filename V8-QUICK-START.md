# Hermes V8 - Quick Start
**Direct Opus 4.6 Calls | No More Gaius Routing**

---

## 🚀 Ship It Now (3 Steps)

### 1. Add API Key
```bash
# Edit .env and add your Anthropic API key
nano /Users/toddanderson/.openclaw/workspace-hermes/.env

# Find this line:
ANTHROPIC_API_KEY=

# Add your key:
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

**Get key:** https://console.anthropic.com/ (support@cascadewebsolutions.co)

---

### 2. Restart Hermes
```bash
# Kill current process
ps aux | grep hermes-interactive | grep -v grep | awk '{print $2}' | xargs kill

# Start V8
cd /Users/toddanderson/.openclaw/workspace-hermes
node hermes-interactive.js
```

---

### 3. Test with Next Lead
Watch for:
- ✅ `[GaiusRouter] V8: Direct Opus 4.6 calls`
- ✅ `Got response from Opus 4.6 (5000-15000ms)`
- ✅ Response in < 15 seconds (was 15-45 seconds)

---

## What Changed?

**Old (V7):**
Hermes → writes file → waits for Gaius heartbeat → Gaius spawns Opus → writes response → Hermes reads
⏱️ **15-45 seconds**

**New (V8):**
Hermes → calls Opus 4.6 directly → gets response
⏱️ **5-15 seconds**

**Benefits:**
- 70% faster responses
- No heartbeat dependency
- No missed Gaius checks
- Simpler, more reliable

---

## ⚠️ Critical
**ANTHROPIC_API_KEY must be set** in `.env` before restart, or all responses will fall back to generic templates.

---

## 📖 Full Docs
See `DEPLOY-V8.md` for detailed deployment guide and troubleshooting.

---

**Shipped by:** Forge
**Date:** 2026-02-28
**Time to deploy:** < 10 minutes ✅

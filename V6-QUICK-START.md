# Hermes V6 - Quick Start Guide

## 🚀 Get Running in 3 Minutes

### 1. Add Your API Key
```bash
cd /Users/toddanderson/.openclaw/workspace-hermes
nano .env
```

Add this line (replace with your actual key):
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your key: https://console.anthropic.com/ (support@cascadewebsolutions.co)

### 2. Test It
```bash
./test-llm-generation.js
```

Should see:
```
✅ All LLM generation tests completed successfully!
```

### 3. Deploy It
```bash
pm2 restart hermes-poller
pm2 logs hermes-poller --lines 50
```

Watch for LLM generation in logs.

---

## 📁 What Changed

**New Files:**
- `FRAMEWORK.md` - Hermes personality/rules (replaces templates)
- `src/llm-generator.js` - Claude API integration
- `test-llm-generation.js` - Validation tests
- `V6-LLM-DEPLOYMENT.md` - Full documentation
- `V6-QUICK-START.md` - This file

**Updated Files:**
- `src/conversation-engine.js` - Uses LLM instead of templates
- `.env` - Added ANTHROPIC_API_KEY

---

## 💡 How It Works

**Before V6:**
```javascript
const message = `hey ${name}, when did this start?`; // Hardcoded template
```

**After V6:**
```javascript
const message = await llmGenerator.generateResponse(session, context);
// → "hey sarah, thanks for reaching out. when did you first notice this?"
```

Every response is **dynamically generated** by Claude API using FRAMEWORK.md as the personality guide.

---

## 💰 Cost

- **~$0.01 per lead** (3 responses @ ~$0.0035 each)
- **~$1.00 per 100 leads**

Well within budget. ✅

---

## ⚡ Quick Checks

**Response quality good?**
- Lowercase starts ✅
- Short (1-2 sentences) ✅
- Casual tone ✅
- Not templated ✅

**Cost tracking:**
```bash
# Check token usage in logs
pm2 logs hermes-poller | grep "Tokens -"
```

**Response time good?**
Should be <2 seconds. Check logs for timing.

---

## 🛠️ Common Issues

**"API key not set"**
```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
pm2 restart hermes-poller
```

**Responses too formal**
Edit FRAMEWORK.md, add more casual examples, restart.

**Responses too long**
In `src/llm-generator.js`, change `max_tokens: 200` to `max_tokens: 150`.

---

## 📊 Monitor This

First week:
- [ ] Response quality (casual tone?)
- [ ] Token usage (~1000/response?)
- [ ] Response time (<2s?)
- [ ] Cost (~$0.01/lead?)

---

## 🎯 Success!

If tests pass and first few leads look natural → **V6 is live!** 🎉

Full docs: `V6-LLM-DEPLOYMENT.md`

---

**Questions?** Check the full deployment guide or logs.

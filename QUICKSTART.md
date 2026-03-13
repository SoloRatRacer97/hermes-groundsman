# Hermes — Quick Start Guide

**For:** Todd (first-time setup)  
**Time:** 10 minutes to see it work

---

## 1. Run the Demo (2 minutes)

```bash
cd /Users/toddanderson/.openclaw/workspace-hermes
node tests/demo.js
```

You'll see a complete lead qualification flow simulated.

---

## 2. Review Key Files (8 minutes)

### Must Read
1. **HANDOFF-REPORT.md** — Executive summary (5 min)
2. **BUILD-COMPLETE.md** — Detailed walkthrough (optional, comprehensive)

### When You're Ready to Deploy
3. **DEPLOYMENT.md** — Step-by-step Zapier setup (30 min)
4. **README.md** — Full documentation

---

## 3. Next Steps

### To Deploy (Total: ~70 min)
1. ✅ Review handoff report (5 min) ← YOU ARE HERE
2. ✅ Configure Zapier (30 min) — Follow DEPLOYMENT.md
3. ✅ Set up .env file (5 min) — Copy webhook URL
4. ✅ Deploy to OpenClaw (10 min) — `openclaw agent:start hermes`
5. ✅ Test with fake lead (15 min)
6. ✅ Go live (5 min)

### Files You'll Edit
- `.env` (add Zapier webhook URL)
- Maybe `src/messages.js` (if you want to tweak SMS tone)
- Maybe `src/scoring.js` (if you want to adjust weights)

---

## What Hermes Does

```
New Lead → Zapier → Slack → Hermes → SMS → Quiz → Score → CRM Update → Alert if Hot
```

**Time:** 60 seconds from lead signup to first SMS  
**Result:** Qualified leads with scores (0-100), sales team prioritized

---

## Questions?

- **"Is it ready?"** → Yes.
- **"Can I deploy today?"** → Yes, just need Zapier config.
- **"What if it breaks?"** → Error handling built in, logs everything.
- **"Can I customize?"** → Yes, all templates and scoring editable.

---

**Start here:** `HANDOFF-REPORT.md`  
**Then deploy:** `DEPLOYMENT.md`

🏛️ Hermes is ready.

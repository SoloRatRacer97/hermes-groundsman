# Hermes Demo Infrastructure

**Complete automation system for Hermes Speed-to-Lead demo**

---

## 🎯 What Is This?

A skeletonized Hermes system using fake data for demos:

```
Google Form → Asana (fake CRM) → Slack → Hermes Agent
```

- **Form:** Lead intake (replaces website forms)
- **Asana:** CRM database (replaces Copilot CRM)
- **Slack:** Notifications (for monitoring)
- **Hermes:** SMS response (to be added)

**Goal:** Demonstrate <60 second response time

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.demo .env
nano .env  # Add your tokens

# 3. Setup Google OAuth
node setup-google-auth.js

# 4. Create infrastructure
node setup-demo-infrastructure.js

# 5. Configure Zapier (manual, 15 min)
cat ZAPIER-SETUP-GUIDE.md

# 6. Test
node test-infrastructure.js
```

**Total time:** ~60 minutes

---

## 📁 Files

### Scripts
- `setup-demo-infrastructure.js` - Main automation
- `setup-google-auth.js` - Google OAuth helper
- `test-infrastructure.js` - Testing tool
- `create-slack-channel.sh` - Slack API helper

### Documentation
- `QUICK-START.md` - Fast reference (START HERE)
- `DEMO-SETUP.md` - Complete guide
- `ZAPIER-SETUP-GUIDE.md` - Zapier steps
- `INFRASTRUCTURE-REPORT.md` - Technical details
- `HANDOFF-FORGE.md` - Executive summary

### Generated
- `demo-infrastructure-config.json` - After setup
- `config/google-token.json` - After OAuth

---

## 🔑 Required Credentials

1. **Slack Bot Token** - Get from api.slack.com/apps
2. **Asana PAT** - Get from app.asana.com/0/my-apps
3. **Google OAuth** - Get from console.cloud.google.com

---

## 💰 Cost

- **Setup:** $0 (code provided)
- **Monthly:** $0-20 (Zapier Starter recommended)

---

## 📚 Where to Start

1. **Want quick instructions?** → `QUICK-START.md`
2. **Want full details?** → `DEMO-SETUP.md`
3. **Need Zapier help?** → `ZAPIER-SETUP-GUIDE.md`
4. **Want technical overview?** → `INFRASTRUCTURE-REPORT.md`
5. **Want executive summary?** → `HANDOFF-FORGE.md`

---

## ✅ What Works

- ✅ Automated Slack channel creation
- ✅ Automated Asana project setup
- ✅ Automated Google Form creation
- ✅ Complete documentation
- ✅ Testing framework
- ⚠️ Zapier requires manual setup (documented)

---

## 🚀 Status

**Infrastructure:** ✅ Code complete, ready to deploy  
**Documentation:** ✅ 30+ KB of guides  
**Testing:** ✅ Scripts provided  
**Deployment:** ⏳ Awaiting credentials

**Next:** Run setup scripts (60 min)

---

*Built by: Forge (OpenClaw Agent)*  
*Date: 2026-02-27*  
*Status: Ready for deployment*

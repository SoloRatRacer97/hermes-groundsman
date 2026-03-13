# Hermes Demo Infrastructure Setup Guide

**Purpose:** Complete setup guide for the Hermes Speed-to-Lead demo pipeline  
**Flow:** Google Form → Asana (CRM) → Zapier → Slack → Hermes Agent  
**Created:** 2026-02-27

---

## 🎯 Overview

This demo showcases the Hermes Speed-to-Lead system using:
- **Google Form:** Lead intake (replaces real website forms)
- **Asana:** Fake CRM database (replaces Copilot CRM)
- **Zapier:** Automation middleware
- **Slack #001-hermes-leads:** Notification channel
- **Hermes Agent:** Automated SMS response (TBD)

**Target Response Time:** <60 seconds from form submission to SMS sent

---

## 📋 Prerequisites

### Required Accounts
- ✅ Google Account (for Forms API)
- ✅ Slack Workspace Admin access
- ✅ Asana account with API access
- ✅ Zapier account (Free tier works, Starter $19.99/mo recommended)

### Required Credentials
1. **Slack Bot Token** (`SLACK_BOT_TOKEN`)
   - Go to: https://api.slack.com/apps
   - Create app or use existing
   - OAuth & Permissions → Bot Token Scopes:
     - `channels:manage`
     - `channels:read`
     - `chat:write`
     - `groups:write` (for private channels)
   - Install app to workspace
   - Copy "Bot User OAuth Token"

2. **Asana Personal Access Token** (`ASANA_PAT`)
   - Go to: https://app.asana.com/0/my-apps
   - Create new Personal Access Token
   - Copy token (starts with `1/`)

3. **Google OAuth Credentials**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID (Desktop app)
   - Download JSON as `config/google-credentials.json`
   - Enable Google Forms API in project

### Optional
- `ASANA_WORKSPACE_GID` - Auto-detects if you have one workspace

---

## 🚀 Quick Start (Automated Setup)

### Step 1: Set Environment Variables

```bash
cd workspace-hermes

# Create .env file
cat > .env << EOF
SLACK_BOT_TOKEN=xoxb-your-token-here
ASANA_PAT=1/your-pat-here
ASANA_WORKSPACE_GID=your-workspace-gid  # Optional
EOF
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup Google OAuth

```bash
# Make scripts executable
chmod +x setup-google-auth.js setup-demo-infrastructure.js

# Run Google OAuth setup
node setup-google-auth.js
```

This will:
1. Open browser for Google authentication
2. Ask you to authorize the app
3. Save OAuth token to `config/google-token.json`

### Step 4: Run Infrastructure Setup

```bash
node setup-demo-infrastructure.js
```

This will automatically:
- ✅ Create Slack channel `#001-hermes-leads`
- ✅ Create Asana project "Hermes Skeleton Build"
- ✅ Create Google Form "Lawn Care Service Request"
- 💾 Save configuration to `demo-infrastructure-config.json`

**Output includes:**
- Slack Channel ID (for Zapier)
- Asana Project ID (for Zapier)
- Google Form public URL (for testing)

---

## 🔧 Manual Setup (If Automated Fails)

### 1. Slack Channel

```bash
# Using Slack Web UI:
1. Click "+" next to Channels
2. Create channel: "001-hermes-leads"
3. Make it Private
4. Add Hermes bot to channel
5. Copy Channel ID from channel details (right-click channel → View channel details)
```

### 2. Asana Project

```bash
# Using Asana Web UI:
1. Click "+" → Project
2. Name: "Hermes Skeleton Build"
3. Layout: Board
4. Create sections: New Leads, Contacted, Qualified, Closed
5. Add custom fields:
   - Lead Name (Text)
   - Phone (Text)
   - Service Type (Dropdown: Lawn Mowing, Tree Trimming, Hardscaping)
   - Status (Dropdown: New Lead, Contacted, Qualified, Closed)
   - Lead Score (Number)
6. Copy Project URL from browser
```

### 3. Google Form

```bash
# Using Google Forms Web UI:
1. Go to: https://forms.google.com
2. Create new form: "Lawn Care Service Request"
3. Description: "Get a free quote for your lawn care needs!"
4. Add questions:
   - Name (Short answer, Required)
   - Phone (Short answer, Required, Phone validation)
   - Service Type (Dropdown, Required: Lawn Mowing, Tree Trimming, Hardscaping)
5. Settings → Presentation → Confirmation message: "Thanks! We'll text you within 5 minutes."
6. Copy shareable link
```

---

## ⚡ Zapier Workflow Setup

### Create New Zap: "Hermes Demo — Form to Asana to Slack"

#### **Trigger: Google Forms - New Response**

1. Choose App: **Google Forms**
2. Choose Event: **New Response in Spreadsheet** (Google Forms auto-creates a spreadsheet)
3. Connect your Google account
4. Choose Form: **Lawn Care Service Request**
5. Test trigger (submit a test form first if needed)

#### **Action 1: Asana - Create Task**

1. Choose App: **Asana**
2. Choose Event: **Create Task**
3. Connect your Asana account
4. Configure:
   - **Project:** Hermes Skeleton Build
   - **Task Name:** `New Lead: {{Name}}`
   - **Task Description:**
     ```
     Name: {{Name}}
     Phone: {{Phone}}
     Service Type: {{Service Type}}
     Submitted: {{Timestamp}}
     ```
   - **Section:** New Leads
   - **Custom Fields:**
     - Lead Name → `{{Name}}`
     - Phone → `{{Phone}}`
     - Service Type → `{{Service Type}}`
     - Status → New Lead
5. Test action

#### **Action 2: Slack - Send Channel Message**

1. Choose App: **Slack**
2. Choose Event: **Send Channel Message**
3. Connect your Slack workspace
4. Configure:
   - **Channel:** #001-hermes-leads (or use Channel ID from config)
   - **Message Text:**
     ```
     🆕 *New Lead: {{Name}}*
     📞 Phone: {{Phone}}
     🌿 Service: {{Service Type}}
     📅 Submitted: {{Timestamp}}
     🔗 View in Asana: {{Asana Task URL}}
     ```
   - **Bot Name:** Hermes Lead Bot (optional)
   - **Bot Icon:** :herb: (optional)
5. Test action

#### **Action 3: (Optional) Delay**

If you want to add artificial delay for demo purposes:
1. Choose App: **Delay by Zapier**
2. Choose Event: **Delay For**
3. Configure: 30 seconds

#### **Publish Zap**

1. Name: "Hermes Demo — Form to Asana to Slack"
2. Turn Zap **ON** 🟢
3. Copy Zap URL from browser for documentation

---

## 🧪 Testing & Validation

### End-to-End Test

**Step 1: Submit Test Form**

1. Open Google Form public URL
2. Submit test data:
   - **Name:** John Test
   - **Phone:** +1-555-123-4567
   - **Service:** Lawn Mowing

**Step 2: Verify Asana Task (within 1-2 min)**

1. Go to Asana project
2. Check "New Leads" section
3. Verify task exists: "New Lead: John Test"
4. Verify custom fields populated correctly

**Step 3: Verify Slack Notification (within 1-2 min)**

1. Open Slack channel #001-hermes-leads
2. Verify message posted with all data
3. Check timestamp for latency

**Step 4: Screenshot Everything**

Take screenshots of:
- ✅ Form submission confirmation
- ✅ Asana task with all fields
- ✅ Slack message in channel
- ✅ Zapier Zap history showing success

### Success Criteria

- ✅ Form accepts submission without errors
- ✅ Asana task created with all data
- ✅ Slack notification sent to #001-hermes-leads
- ✅ All data fields match (Name, Phone, Service Type)
- ✅ End-to-end latency < 5 minutes (target: < 2 min)

---

## 📊 Configuration Reference

### Infrastructure URLs

*(Auto-populated after running setup script)*

```json
{
  "slack": {
    "channelName": "001-hermes-leads",
    "channelId": "C01234567890",
    "url": "https://app.slack.com/client/T.../C..."
  },
  "asana": {
    "projectName": "Hermes Skeleton Build",
    "projectGid": "1234567890123456",
    "projectUrl": "https://app.asana.com/0/1234567890123456/list"
  },
  "google": {
    "formTitle": "Lawn Care Service Request",
    "formId": "1a2b3c4d5e6f7g8h9i0j",
    "formUrl": "https://docs.google.com/forms/d/e/.../viewform",
    "editUrl": "https://docs.google.com/forms/d/.../edit"
  },
  "zapier": {
    "zapName": "Hermes Demo — Form to Asana to Slack",
    "zapUrl": "https://zapier.com/editor/..."
  }
}
```

### Custom Fields Mapping

| Google Form Field | Asana Custom Field | Slack Display |
|-------------------|-------------------|---------------|
| Name              | Lead Name         | New Lead: {Name} |
| Phone             | Phone             | 📞 Phone: {Phone} |
| Service Type      | Service Type      | 🌿 Service: {Type} |
| (auto)            | Status            | (set to "New Lead") |
| (auto)            | Lead Score        | (leave empty for now) |
| Timestamp         | Created Date      | 📅 Submitted: {Time} |

---

## 🐛 Troubleshooting

### Google Form Issues

**Problem:** OAuth error during setup  
**Solution:**
- Ensure Google Forms API is enabled in Cloud Console
- Check credentials.json has correct redirect URIs
- Re-run `node setup-google-auth.js`

**Problem:** Form not accepting responses  
**Solution:**
- Check form is set to "Accepting responses" (in Settings)
- Verify sharing settings allow "Anyone with link"

### Asana Issues

**Problem:** "Invalid request" error  
**Solution:**
- Verify ASANA_PAT is valid (test at app.asana.com)
- Check workspace GID is correct
- Ensure PAT has full access scope

**Problem:** Custom fields not appearing  
**Solution:**
- Custom fields are workspace-wide, may already exist
- Check project settings → Customize → Fields
- Add existing fields manually if needed

### Slack Issues

**Problem:** "channel_not_found" error  
**Solution:**
- Verify bot is invited to channel
- Check SLACK_BOT_TOKEN has correct scopes
- For private channels, need `groups:write` scope

**Problem:** Bot can't post messages  
**Solution:**
- Invite bot: `/invite @HermesBot` in channel
- Check bot token permissions in Slack App settings
- Reinstall app if permissions changed

### Zapier Issues

**Problem:** Zap not triggering  
**Solution:**
- Submit new form response (Zapier only sees new responses)
- Check Zap history for errors
- Verify Google Sheets was created by form
- Reconnect Google account if expired

**Problem:** Data not mapping correctly  
**Solution:**
- Click "Refresh fields" in Zapier editor
- Ensure field names match exactly (case-sensitive in some cases)
- Test with new form submission after changes

**Problem:** Asana task created but fields empty  
**Solution:**
- Custom fields must exist in Asana before Zapier can map them
- Re-run infrastructure setup or add fields manually
- Update Zapier field mapping after adding fields

### Performance Issues

**Problem:** Latency > 5 minutes  
**Solution:**
- Check Zapier task history for bottlenecks
- Verify Zapier plan (Free tier has 15-min delay)
- Upgrade to Zapier Starter ($19.99/mo) for instant triggers
- Check Slack/Asana API status pages

---

## 🎬 Demo Script

When showing this to a prospect:

1. **Setup Context** (30 sec)
   - "This is our Speed-to-Lead system called Hermes"
   - "Watch what happens when a lead submits a form..."

2. **Submit Form** (30 sec)
   - Open form URL on phone or laptop
   - Fill out: Name, Phone, Service Type
   - Submit

3. **Show Database** (30 sec)
   - Open Asana project
   - Show task appearing in "New Leads"
   - Show all fields populated automatically

4. **Show Notification** (30 sec)
   - Open Slack channel
   - Show instant notification with lead details
   - Explain next step: Hermes agent would send SMS

5. **Show Timeline** (30 sec)
   - Check timestamps
   - "From form submit to notification: under 60 seconds"
   - "SMS would go out within 5 minutes total"

6. **Explain Value** (60 sec)
   - "Your competitors take 24-48 hours to respond"
   - "We respond in under 5 minutes, 24/7"
   - "Studies show first responder gets the job 80% of the time"

---

## 📁 Files Created

```
workspace-hermes/
├── setup-demo-infrastructure.js   # Main setup script
├── setup-google-auth.js           # Google OAuth helper
├── demo-infrastructure-config.json # Auto-generated config
├── config/
│   ├── google-credentials.json    # OAuth client (you create)
│   └── google-token.json          # OAuth token (auto-generated)
├── DEMO-SETUP.md                  # This file
└── .env                           # Environment variables
```

---

## 🔐 Security Notes

- **Never commit** `.env`, `google-token.json`, or `google-credentials.json`
- Tokens in `.env` have full access to your accounts
- Slack bot token starts with `xoxb-`
- Asana PAT starts with `1/`
- Revoke tokens when demo is complete or no longer needed

---

## 💰 Cost Breakdown

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| Google Forms | Free | $0 | Unlimited forms |
| Asana | Free | $0 | Up to 15 members |
| Slack | Free | $0 | Standard workspace |
| Zapier | Free | $0 | 5 Zaps, 100 tasks/month |
| **OR** Zapier | Starter | $19.99/mo | Instant triggers, 750 tasks/month |

**Recommended:** Zapier Starter for reliable demo (no delays)  
**Total Demo Cost:** $0-20/month

---

## ✅ Deliverables Checklist

- [x] Slack channel `#001-hermes-leads` created
- [x] Asana project "Hermes Skeleton Build" created
- [x] Google Form "Lawn Care Service Request" created
- [ ] Zapier Zap configured (manual step)
- [ ] End-to-end test successful
- [x] Documentation written (this file)
- [ ] Screenshots captured
- [ ] All URLs/IDs documented in config

---

## 🆘 Support

**If automated setup fails:**
1. Check error messages in terminal
2. Verify all credentials are correct
3. Try manual setup steps above
4. Check troubleshooting section

**If Zapier fails:**
1. Check Zap history for specific errors
2. Test each step individually
3. Verify all connections are authorized
4. Try disconnecting and reconnecting accounts

**For questions:**
- Slack API: https://api.slack.com/docs
- Asana API: https://developers.asana.com/
- Google Forms API: https://developers.google.com/forms
- Zapier Help: https://help.zapier.com/

---

## 📝 Next Steps After Setup

1. **Test thoroughly** - Submit 3-5 test forms to ensure consistency
2. **Time the flow** - Measure actual latency for demo accuracy
3. **Prepare demo script** - Practice the walkthrough
4. **Add Hermes agent** - Integrate SMS response system
5. **Configure lead scoring** - Add logic for prioritization
6. **Set up monitoring** - Add alerts for failures

---

## 🎯 Success Metrics

**Technical:**
- ✅ Form-to-Slack latency < 2 minutes
- ✅ 100% data accuracy (all fields transfer correctly)
- ✅ Zero manual intervention required
- ✅ Works 24/7 without monitoring

**Business:**
- 🎯 Sub-60-second response time (with Hermes SMS)
- 🎯 80%+ lead-to-contact rate
- 🎯 First-responder advantage in competitive markets
- 🎯 $5K setup fee justified by client wins

---

*Last Updated: 2026-02-27*  
*Author: Forge (OpenClaw Agent)*  
*Version: 1.0*

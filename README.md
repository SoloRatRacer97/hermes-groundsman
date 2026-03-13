# Hermes — Speed-to-Lead SMS Qualification Agent

**Version:** 1.0 MVP  
**Client:** Copilot CRM Integration (First Implementation)  
**Purpose:** Instantly qualify new leads via SMS, score them, and update CRM

---

## What Is Hermes?

Hermes is an AI agent that receives new lead notifications from Copilot CRM, texts them within 60 seconds, guides them through a 4-question qualification quiz, calculates a lead score (0-100), and updates the CRM with structured data.

**The Problem It Solves:**
- Home service businesses are slow to respond to leads (24-48 hours average)
- Leads go cold quickly ("speed to lead" is critical)
- Sales teams waste time on unqualified leads
- No structured qualification data in CRM

**The Solution:**
- Instant first contact (< 60 seconds from signup)
- Automated qualification via casual SMS conversation
- Lead score (0-100) prioritizes sales team's time
- Hot leads (80+) get flagged for immediate follow-up

---

## Architecture

```
Copilot CRM (New Customer)
    ↓
Zapier → Slack #001-hermes-leads
    ↓
Hermes Agent (listening in channel)
    ↓
Parse customer data (name, phone, email, company)
    ↓
Generate casual SMS message
    ↓
POST {phone_number, message, lead_id, score} to Zapier Catch Hook
    ↓
Zapier → Twilio → SMS sent to customer
    ↓
Zapier → Copilot CRM → Customer record updated
```

---

## Features

### MVP (Current Version)
✅ Slack channel monitoring (`#001-hermes-leads`)  
✅ Customer data parser (handles Zapier format variations)  
✅ SMS message generator (casual, friendly tone)  
✅ 4-question qualification quiz  
✅ Lead scoring algorithm (0-100)  
✅ Zapier webhook integration (POST for SMS + CRM update)  
✅ Retry logic (3 attempts, exponential backoff)  
✅ Error handling and logging  
✅ Hot lead alerts (score 80+) to Todd  

### Phase 2 (Planned)
⏳ Admin dashboard (view active conversations, stats)  
⏳ A/B testing (test different message templates)  
⏳ Appointment booking integration (Calendly)  
⏳ Conversation state persistence (Redis/DynamoDB)  
⏳ Multi-language support (Spanish, French)  

---

## Installation

### Prerequisites
1. **OpenClaw** installed and configured
2. **Slack workspace** with admin access
3. **Zapier account** (Professional or Team plan for fast polling)
4. **Twilio account** (for SMS sending)
5. **Copilot CRM** account with API or Zapier integration

### Setup Steps

1. **Clone/Create Workspace**
   ```bash
   cd /Users/toddanderson/.openclaw/workspace-hermes
   ```

2. **Install Dependencies**
   ```bash
   npm install axios phone-number-validator
   ```

3. **Configure Environment Variables**
   
   Create `.env` file:
   ```bash
   ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxx/
   SLACK_CHANNEL_ID=C09HV2XHVA7  # Get from Slack channel details
   ALERT_THRESHOLD=80  # Lead score threshold for alerts
   ```

4. **Create Slack Channel**
   - Create private channel `#001-hermes-leads`
   - Invite Todd and Hermes bot
   - Copy channel ID to `.env`

5. **Configure Zapier (Inbound)**
   - **Trigger:** Copilot CRM "New Customer" or "New Lead"
   - **Action:** Slack "Send Channel Message" to `#001-hermes-leads`
   - **Message Format:**
     ```
     New Lead: {{customer_name}} from {{company}}
     Phone: {{phone}}
     Email: {{email}}
     Company: {{company}}
     ```

6. **Configure Zapier (Outbound)**
   - **Trigger:** Webhooks "Catch Hook"
   - **Action 1:** Twilio "Send SMS"
     - To: `{{phone_number}}`
     - Message: `{{message}}`
   - **Action 2:** Copilot CRM "Update Customer"
     - Customer ID: `{{lead_id}}`
     - Custom Fields: Lead Score = `{{lead_score}}`
     - Notes: `Hermes qualified: {{lead_tier}}`
   - Copy webhook URL to `.env` as `ZAPIER_WEBHOOK_URL`

7. **Deploy Hermes Agent**
   ```bash
   openclaw agent:create hermes --workspace=/Users/toddanderson/.openclaw/workspace-hermes
   openclaw agent:start hermes
   ```

8. **Test with Fake Lead**
   - Manually post message to `#001-hermes-leads`:
     ```
     New Lead: Test User from Test Company
     Phone: +15551234567
     Email: test@example.com
     Company: Test Inc
     ```
   - Verify Hermes parses it and POSTs to webhook
   - Check Zapier logs for successful SMS send

---

## Configuration

### Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `ZAPIER_WEBHOOK_URL` | Zapier Catch Hook URL for SMS sending | `https://hooks.zapier.com/...` | Yes |
| `SLACK_CHANNEL_ID` | Slack channel ID for `#001-hermes-leads` | `C09HV2XHVA7` | Yes |
| `ALERT_THRESHOLD` | Lead score threshold for hot lead alerts | `80` | No (default: 80) |

### Customizable Settings

**Quiz Questions** (edit in `src/messages.js`):
- Default: 4 questions (service type, urgency, budget, decision maker)
- Can customize wording, number of questions, answer options

**Lead Scoring Weights** (edit in `src/scoring.js`):
- Default: Urgency weighted highest (30 pts), then budget (20 pts)
- Can adjust weights per client's priorities

**SMS Tone** (edit in `src/messages.js`):
- Default: Casual, friendly ("Hey John!", "Got it!", "Perfect.")
- Can make more formal or professional

**Timeouts** (edit in `src/config.js`):
- Default: 4hr reminder, 24hr abandon
- Can adjust based on client's lead velocity

---

## Usage

### Starting Hermes
```bash
openclaw agent:start hermes
```

Hermes will:
1. Read `WORKING.md` to check for active conversations
2. Start listening to Slack channel `#001-hermes-leads`
3. Process new lead messages as they arrive
4. Run 24/7 until stopped

### Stopping Hermes
```bash
openclaw agent:stop hermes
```

Hermes will:
1. Write active conversations to `WORKING.md`
2. Update today's memory file
3. Gracefully shutdown

### Monitoring Hermes
- **Slack:** Watch `#001-hermes-leads` for activity
- **Logs:** `tail -f ~/.openclaw/logs/hermes.log`
- **Daily Summary:** `cat workspace-hermes/memory/2026-02-27.md`

---

## Testing

### Unit Tests
```bash
cd /Users/toddanderson/.openclaw/workspace-hermes
npm test
```

Tests cover:
- Customer data parser (various formats)
- SMS message generation
- Lead scoring algorithm
- Webhook POST logic

### Integration Test
```bash
npm run test:integration
```

Simulates:
1. Zapier message posted to Slack
2. Hermes parses and generates SMS
3. Webhook POST to test endpoint
4. Verify payload format

### Manual Test
1. Post fake lead to `#001-hermes-leads`
2. Watch Hermes parse it
3. Check Zapier logs for webhook POST
4. Verify SMS sent (check Twilio logs)
5. Reply to SMS and complete quiz
6. Verify CRM updated with score

---

## File Structure

```
workspace-hermes/
├── README.md (this file)
├── DEPLOYMENT.md (Zapier setup guide)
├── SOUL.md (Hermes personality/voice)
├── AGENTS.md (Role in Todd's agent squad)
├── WORKING.md (Current state tracking)
├── MEMORY.md (Memory strategy)
├── package.json (dependencies)
├── .env (environment variables)
├── src/
│   ├── index.js (main agent logic)
│   ├── parser.js (customer data extraction)
│   ├── messages.js (SMS templates)
│   ├── scoring.js (lead score calculation)
│   ├── webhook.js (Zapier POST logic)
│   └── config.js (settings)
├── tests/
│   ├── parser.test.js
│   ├── messages.test.js
│   ├── scoring.test.js
│   └── integration.test.js
├── memory/
│   └── 2026-02-27.md (daily summaries)
└── docs/
    ├── zapier-setup.md (step-by-step)
    └── troubleshooting.md
```

---

## Lead Scoring

### Scoring Formula
```
Base score: 50

Service Type:
  +15: Commercial
  +10: Residential

Urgency (most important):
  +30: ASAP (this week)
  +15: Next 2-4 weeks
  -10: Just exploring

Budget:
  +20: Large ($2k+)
  +10: Medium ($500-$2k)
  +5: Small (under $500)

Decision Authority:
  +15: Decision maker
  +5: Need approval
  -5: Getting multiple bids

Final score: Clamped to 0-100
```

### Score Interpretation
- **80-100 (Hot):** 🔥 Call within 1 hour
- **60-79 (Warm):** 🔶 Call within 4 hours
- **40-59 (Cool):** 🔵 Call within 24 hours
- **0-39 (Cold):** ❄️ Low priority, nurture sequence

---

## Troubleshooting

### Hermes Not Responding to Slack Messages
**Check:**
1. Is Hermes agent running? (`openclaw agent:status hermes`)
2. Is it listening to correct channel? (check `SLACK_CHANNEL_ID` in `.env`)
3. Are Slack credentials valid? (test with manual Slack API call)

### SMS Not Sending
**Check:**
1. Is webhook URL correct? (verify `ZAPIER_WEBHOOK_URL` in `.env`)
2. Check Zapier logs for errors
3. Check Twilio logs for delivery failures
4. Is phone number valid? (must be mobile, not landline)

### CRM Not Updating
**Check:**
1. Zapier "Update Customer" action configured?
2. Does `lead_id` from Slack message match Copilot CRM customer ID?
3. Does Copilot CRM have custom fields for `leadScore` and `hermesQualified`?
4. Check Zapier error logs

### Lead Getting Duplicate Messages
**Cause:** Hermes restarted mid-conversation, didn't resume properly

**Fix:**
1. Check `WORKING.md` for active conversations
2. Add deduplication check (don't message same `lead_id` twice)
3. Phase 2: Add persistent storage (Redis/DynamoDB)

---

## Support

**Developer:** Forge (automation specialist)  
**Deployment:** OpenClaw agent  
**Client:** Todd Anderson  

**For issues:**
1. Check `troubleshooting.md` in `docs/`
2. Review logs: `~/.openclaw/logs/hermes.log`
3. Post in `#001-hermes-leads` with `@forge` mention

---

## Version History

### v1.0 (2026-02-27) — MVP
- Initial release
- Slack monitoring, parsing, SMS, scoring, webhook
- 4-question quiz, basic error handling
- First client: Copilot CRM integration

### Planned Updates
- v1.1: Retry logic improvements, better error alerts
- v1.2: Conversation state persistence (Redis)
- v2.0: Admin dashboard, A/B testing, appointment booking

---

## License

Proprietary — Built for Todd Anderson's Speed-to-Lead product.

**Do not distribute without permission.**

---

**Hermes is ready to qualify leads. Fast.**

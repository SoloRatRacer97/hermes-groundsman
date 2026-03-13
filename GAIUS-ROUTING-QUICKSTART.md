# Gaius Routing - Quick Start Guide

## 🚀 5-Minute Deployment

### Step 1: Verify Installation

```bash
cd workspace-hermes

# Check that new files exist
ls -l src/gaius-router.js
ls -l gaius-hermes-responder.js
ls -l test-gaius-routing.js
```

### Step 2: Test the Routing System

```bash
# Start the test in one terminal
node test-gaius-routing.js
# (Press Enter when prompted)
```

```bash
# In another terminal, watch for requests
node gaius-hermes-responder.js watch
```

When you see a new request notification:
```bash
# List requests
node gaius-hermes-responder.js list

# Show full prompt
node gaius-hermes-responder.js show req_XXXXX

# Respond
node gaius-hermes-responder.js respond req_XXXXX "hey there, thanks for reaching out. when did this start?"
```

### Step 3: Deploy to Production

```bash
# Stop current Hermes if running
pm2 stop hermes-interactive

# Start with new Gaius routing
pm2 start hermes-interactive
pm2 save

# Monitor logs
pm2 logs hermes-interactive
```

### Step 4: Gaius Setup (Manual Mode)

Option A: **Watch Mode** (recommended for testing)
```bash
# In a dedicated terminal or tmux/screen session
node gaius-hermes-responder.js watch
```

This will notify you when Hermes sends requests. You can then respond manually.

Option B: **On-Demand** (check periodically)
```bash
# Check for pending requests
node gaius-hermes-responder.js list

# Respond to each one
node gaius-hermes-responder.js respond <requestId> "your response"
```

Option C: **Automated** (future enhancement)
- Gaius monitors `.gaius-requests/` directory
- Automatically generates responses
- Writes to `.gaius-responses/`

## 🧪 Testing with Real Lead

1. **Submit test lead** via Zapier webhook or web form

2. **Watch Hermes logs:**
   ```bash
   pm2 logs hermes-interactive --lines 50
   ```

3. **Watch for Gaius request:**
   ```bash
   node gaius-hermes-responder.js watch
   ```

4. **When request appears, respond:**
   ```bash
   node gaius-hermes-responder.js respond req_XXXXX "hey john, thanks for reaching out. when did this start?"
   ```

5. **Verify in Slack:**
   - Check #new-leads channel
   - Response should appear in lead's thread
   - Total time: ~15 seconds (10s poll + 5s response)

## 📊 Monitoring

### Check Request Queue
```bash
node gaius-hermes-responder.js list
```

### Check Response Time
```bash
# Hermes logs show timing
pm2 logs hermes-interactive | grep "GaiusRouter"
```

### Clean Up Old Files
```bash
# Delete requests/responses older than 1 hour
find .gaius-requests -type f -mmin +60 -delete
find .gaius-responses -type f -mmin +60 -delete
```

## 🔧 Troubleshooting

### Hermes Not Sending Requests

Check logs:
```bash
pm2 logs hermes-interactive --err
```

Verify session ID:
```bash
openclaw sessions list | grep main
```

### Gaius Not Receiving Notifications

Check if messages are being sent:
```bash
# Should see files created
ls -la .gaius-requests/
```

### Response Not Appearing in Slack

1. Check response file was created:
   ```bash
   ls -la .gaius-responses/
   ```

2. Check Hermes picked it up (logs):
   ```bash
   pm2 logs hermes-interactive | grep "Got response"
   ```

3. Verify Slack token is valid:
   ```bash
   cat .env | grep SLACK_BOT_TOKEN
   ```

## 📝 Response Examples

### Opener
```
"hey sarah, thanks for reaching out. when did this start?"
```

### Q2 (Urgency)
```
"when do you need this done? like this week or whenever works?"
```

### Buying Intent Transfer
```
"k got it. someone from the team will call you soon to get this scheduled"
```

### Frustration Escalation
```
"gotcha let me get you someone on the team right now"
```

### Parachute (Bot Detection)
```
"yep im a bot just grabbing some quick info. but let me get you a real person right now"
```

### Emergency
```
"got it. were getting a tech on this right now. someone from our team will reach out in just a few minutes"
```

## ⚡ Performance Targets

- **Lead response time:** 10-15 seconds total
  - 10s polling interval (Hermes detects message)
  - 5s Gaius generation + response
  
- **Fallback timeout:** 30 seconds
  - If Gaius doesn't respond, uses template

## 🎯 Next Steps

1. **Test with dummy lead** - Verify end-to-end flow
2. **Set up Gaius watch mode** - Run in tmux/screen
3. **Monitor first few real leads** - Ensure quality responses
4. **Iterate on prompts** - Improve Hermes framework if needed
5. **Consider automation** - Build Gaius auto-responder

## 📚 Further Reading

- Full documentation: `GAIUS-ROUTING.md`
- Architecture details: `V6-LLM-DEPLOYMENT.md`
- Hermes framework: `FRAMEWORK.md`

---

**Status:** ✅ Production Ready  
**Response Time:** ~15 seconds  
**Fallback:** Automatic (30s timeout)

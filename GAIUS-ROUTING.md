# Gaius Routing - Hermes Puppeteering

## Overview

Hermes now routes all response generation through Gaius (the main agent) instead of using a direct LLM API. This ensures:

- **Consistent personality** - Gaius controls Hermes's voice
- **Natural variation** - No templates, every response is unique
- **Fast speed-to-lead** - 10-15 second total response time
- **No API keys needed** - Uses OpenClaw sessions for routing

## Architecture

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│  Lead responds  │────────▶│   Hermes     │────────▶│   Gaius     │
│  in Slack       │         │ Interactive  │  prompt │ (main agent)│
└─────────────────┘         └──────────────┘         └─────────────┘
                                    ▲                        │
                                    │                        │
                                    │   response file        │
                                    └────────────────────────┘
```

### Flow:

1. **Hermes detects** lead reply (10s polling)
2. **Context analysis** - Buying intent, frustration, parachute, emergency
3. **Build prompt** for Gaius with framework + context
4. **Send to Gaius** via `openclaw sessions send`
5. **Wait for response** (file-based async communication)
6. **Post to Slack** thread with Gaius's response
7. **Total time:** ~10-15 seconds

## Implementation

### Core Components

**1. GaiusRouter (`src/gaius-router.js`)**
- Routes requests to Gaius session
- File-based request/response system
- Fallback responses if Gaius doesn't respond
- Automatic cleanup of old files

**2. ConversationEngine (updated)**
- Uses `gaiusRouter.askGaius()` instead of `llmGenerator.generateResponse()`
- All response generation routed through Gaius
- Same context flags (buyingIntent, frustration, etc.)

**3. Helper Script (`gaius-hermes-responder.js`)**
- CLI tool for Gaius to manage requests
- List, show, respond to Hermes requests
- Watch mode for real-time notifications

### Request/Response System

**Request Directory:** `.gaius-requests/`
- Hermes creates `req_<timestamp>_<random>.json` files
- Contains session state, message, context, and formatted prompt

**Response Directory:** `.gaius-responses/`
- Gaius creates `req_<requestId>.txt` files
- Contains just the response text Hermes should send

**Timeout:** 30 seconds max wait (falls back to template)

## Gaius Integration

### Receiving Requests

Gaius receives requests via `openclaw sessions send` to session:
```
agent:main:slack:channel:c09hv2xhva7
```

The message contains a formatted prompt like:
```
🤖 HERMES PUPPETEER REQUEST

You are responding AS Hermes (speed-to-lead bot).

Lead: John Smith
Service: Heating
Path: STANDARD
Questions asked: 0

Lead just said: "my furnace stopped working"

🎯 OPENER (First message)
ACTION: Greet and ask Q1: when did this start?

FRAMEWORK:
- Casual, lazy admin worker
- Lowercase starts, minimal punctuation
- SHORT (1-2 sentences MAX)
- Simple words only

CRITICAL: Respond ONLY with the message text (no meta-commentary).

Your response:
```

### Responding (Manual)

Using the helper script:

```bash
# List pending requests
node gaius-hermes-responder.js list

# Show full request details
node gaius-hermes-responder.js show req_1234567890_abc123

# Respond to request
node gaius-hermes-responder.js respond req_1234567890_abc123 "hey john, thanks for reaching out. when did this start?"

# Watch for new requests (real-time)
node gaius-hermes-responder.js watch
```

### Responding (Automated)

Gaius can be configured to automatically respond to Hermes requests by:

1. **Monitoring** `.gaius-requests/` directory
2. **Reading** request files
3. **Generating** response using Claude API
4. **Writing** response to `.gaius-responses/<requestId>.txt`
5. **Cleanup** - deleting request file

Example automation script (for Gaius):
```javascript
const fs = require('fs');
const path = require('path');

// Watch for new requests
fs.watch('.gaius-requests', async (event, filename) => {
  if (filename.endsWith('.json')) {
    const data = JSON.parse(fs.readFileSync(filename));
    
    // Generate response using Claude
    const response = await generateHermesResponse(data.prompt);
    
    // Write response file
    const responseFile = path.join('.gaius-responses', `${data.requestId}.txt`);
    fs.writeFileSync(responseFile, response);
    
    // Cleanup request
    fs.unlinkSync(filename);
  }
});
```

## Testing

### Quick Test

```bash
# Start test (creates a request)
node test-gaius-routing.js

# In another terminal, respond
node gaius-hermes-responder.js list
node gaius-hermes-responder.js respond <requestId> "test response"
```

### Full Integration Test

1. Start Hermes:
   ```bash
   pm2 start hermes-interactive
   ```

2. Start Gaius watcher (in another terminal):
   ```bash
   node gaius-hermes-responder.js watch
   ```

3. Submit test lead via Zapier webhook

4. When Gaius receives notification, respond:
   ```bash
   node gaius-hermes-responder.js respond <requestId> "hey sarah, thanks for reaching out. when did this start?"
   ```

5. Verify response appears in Slack thread

## Context Types

Hermes sends different context flags to guide Gaius's responses:

### Buying Intent
```javascript
{
  action: 'BUYING_INTENT_TRANSFER',
  buyingIntent: {
    confidence: 'high',
    triggers: ['quote', 'schedule', 'price']
  }
}
```
→ "k got it. someone from the team will call you soon to get this scheduled"

### Frustration
```javascript
{
  action: 'FRUSTRATION_TRANSFER',
  frustration: {
    level: 'high',
    triggers: ['CAPS', 'profanity']
  }
}
```
→ "gotcha let me get you someone on the team right now"

### Parachute
```javascript
{
  action: 'PARACHUTE',
  parachute: {
    reason: 'BOT_DETECTION',
    trigger: 'are you a bot'
  }
}
```
→ "yep im a bot just grabbing some quick info. but let me get you a real person right now"

### Emergency
```javascript
{
  action: 'EMERGENCY',
  emergency: true,
  isFirstMessage: true
}
```
→ "got it. when did this start?"

### Standard Questions
```javascript
{ action: 'OPENER', isFirstMessage: true }
{ action: 'Q2' }
{ action: 'Q3' }
{ action: 'Q4' }
{ action: 'Q5' }
```

### Handoff
```javascript
{
  action: 'HANDOFF',
  businessHours: true
}
```
→ "k got it. someone from the team will call you soon"

## Performance

- **Polling interval:** 10 seconds
- **Gaius response time target:** 5 seconds
- **Total lead response:** ~15 seconds (10s poll + 5s generation)
- **Fallback timeout:** 30 seconds max

## Fallback Behavior

If Gaius doesn't respond within 30 seconds, Hermes uses simple template fallbacks:

- **Buying intent:** "k got it. someone from the team will call you soon to get this scheduled"
- **Frustration/Parachute:** "gotcha let me get you someone on the team right now"
- **Emergency:** "got it. were getting a tech on this right now"
- **Opener:** "hey {firstName}, thanks for reaching out. when did this start?"
- **Q2:** "when do you need this done? like this week or whenever works?"

## Maintenance

### Cleanup Old Files

Run periodically to clean up old request/response files:

```javascript
const router = new GaiusRouter();
router.cleanupOldFiles(60); // Delete files older than 60 minutes
```

Or manually:
```bash
# Delete old requests
find .gaius-requests -type f -mmin +60 -delete

# Delete old responses
find .gaius-responses -type f -mmin +60 -delete
```

### Monitoring

Check request queue:
```bash
node gaius-hermes-responder.js list
```

Watch in real-time:
```bash
node gaius-hermes-responder.js watch
```

Check Hermes logs:
```bash
pm2 logs hermes-interactive
```

## Advantages

✅ **Natural variation** - No templating, every response unique  
✅ **Consistent personality** - Gaius maintains the framework  
✅ **No API keys in Hermes** - All LLM calls through Gaius  
✅ **Hot potato mode** - Buying intent triggers immediate transfer  
✅ **Fast response** - 10-15 seconds total  
✅ **Graceful fallback** - Simple templates if Gaius unavailable  

## Future Enhancements

- [ ] Auto-response mode for Gaius (fully automated)
- [ ] WebSocket instead of file-based communication
- [ ] Response quality scoring
- [ ] A/B testing different response styles
- [ ] Real-time Gaius dashboard for monitoring

---

**Built:** 2026-02-28  
**Status:** Production Ready  
**Dependencies:** OpenClaw sessions, file system access

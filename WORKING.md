# WORKING.md - Hermes Current State

**Last Updated:** 2026-02-28 11:53 PST  
**Current Version:** V7 - Gaius Routing (Puppeteering)  
**Status:** ✅ Built, Ready for Testing

---

## Current State

**Hermes V7** routes all response generation through Gaius (main agent) instead of direct LLM API calls. This enables:
- ✅ **Gaius puppeteers Hermes** - Maintains personality consistency
- ✅ **No API keys needed** - Uses OpenClaw sessions
- ✅ **Fast 10-15s response** - 10s poll + 5s generation
- ✅ **Natural variation** - No templates, Gaius generates each response
- ✅ **Graceful fallback** - Simple templates if Gaius unavailable

### What's Working
- ✅ GaiusRouter built (src/gaius-router.js)
- ✅ ConversationEngine updated (routes via Gaius)
- ✅ File-based request/response system
- ✅ Helper CLI for Gaius (gaius-hermes-responder.js)
- ✅ Test suite (test-gaius-routing.js)
- ✅ Full documentation (GAIUS-ROUTING.md)
- ✅ Quick start guide (GAIUS-ROUTING-QUICKSTART.md)

### What's Needed
- ⏳ Test the routing: `node test-gaius-routing.js`
- ⏳ Set up Gaius watcher: `node gaius-hermes-responder.js watch`
- ⏳ Deploy: `pm2 restart hermes-interactive`
- ⏳ Monitor first real leads

---

## Architecture (V7)

```
Lead Message (Slack)
    ↓
Hermes Interactive (10s polling)
    ↓
Detection Layers (buying intent, frustration, parachute, emergency)
    ↓
GaiusRouter.askGaius()
    ↓
Request File (.gaius-requests/) + openclaw sessions send
    ↓
Gaius (main agent)
    ↓
Response File (.gaius-responses/)
    ↓
Hermes posts to Slack thread
```

**Key Shift:** Gaius controls Hermes's voice, not direct LLM calls.

---

## Files Modified (V7)

**New:**
- `src/gaius-router.js` - Routes requests to Gaius via files + sessions
- `gaius-hermes-responder.js` - CLI helper for Gaius to respond
- `test-gaius-routing.js` - Validation tests
- `GAIUS-ROUTING.md` - Full architecture documentation
- `GAIUS-ROUTING-QUICKSTART.md` - 5-minute deployment guide

**Updated:**
- `src/conversation-engine.js` - All `llmGenerator` → `gaiusRouter`
- `WORKING.md` - This file

**Preserved:**
- All V1-V6 detection logic (buying intent, frustration, parachute, emergency)
- FRAMEWORK.md (personality guide)
- 10-second polling interval

---

## Request/Response Flow

### 1. Hermes Sends Request

When a lead replies, Hermes:
1. Analyzes context (buying intent, frustration, etc.)
2. Builds formatted prompt for Gaius
3. Creates request file: `.gaius-requests/req_<timestamp>_<id>.json`
4. Sends notification to Gaius: `openclaw sessions send`
5. Waits for response file (30s timeout)

### 2. Gaius Responds

Gaius can respond via:
- **Manual:** `node gaius-hermes-responder.js respond <requestId> "response text"`
- **Watch mode:** `node gaius-hermes-responder.js watch` (notifications)
- **Automated:** Future enhancement (auto-respond to `.gaius-requests/`)

### 3. Hermes Posts to Slack

When response file appears:
1. Reads response text
2. Posts to Slack thread
3. Cleans up request/response files
4. Total time: ~10-15 seconds

---

## Gaius Integration

### Receiving Requests

Gaius session: `agent:main:slack:channel:c09hv2xhva7`

Receives formatted prompts like:
```
🤖 HERMES PUPPETEER REQUEST

Lead: John Smith
Service: Heating
Lead just said: "my furnace stopped working"

🎯 OPENER (First message)
ACTION: Greet and ask Q1: when did this start?

FRAMEWORK:
- Casual, lazy admin worker
- SHORT (1-2 sentences MAX)
- Simple words, no fancy language

CRITICAL: Respond ONLY with message text.

Your response:
```

### Responding (Manual)

```bash
# Watch for requests (recommended)
node gaius-hermes-responder.js watch

# List pending
node gaius-hermes-responder.js list

# View full prompt
node gaius-hermes-responder.js show req_XXXXX

# Respond
node gaius-hermes-responder.js respond req_XXXXX "hey john, thanks for reaching out. when did this start?"
```

---

## Performance

- **Polling interval:** 10 seconds (Hermes detects lead reply)
- **Target response time:** 5 seconds (Gaius generates response)
- **Total lead response:** ~15 seconds
- **Fallback timeout:** 30 seconds (uses template if Gaius doesn't respond)

---

## Testing

### Quick Test

Terminal 1:
```bash
node test-gaius-routing.js
```

Terminal 2:
```bash
node gaius-hermes-responder.js watch
# When request appears, respond via CLI
```

### Integration Test

1. Start Hermes:
   ```bash
   pm2 start hermes-interactive
   ```

2. Start Gaius watcher:
   ```bash
   node gaius-hermes-responder.js watch
   ```

3. Submit test lead via web form

4. Respond when notified:
   ```bash
   node gaius-hermes-responder.js respond <requestId> "response text"
   ```

5. Verify in Slack #new-leads

---

## Fallback Behavior

If Gaius doesn't respond within 30s, Hermes uses simple templates:

- **Buying intent:** "k got it. someone from the team will call you soon to get this scheduled"
- **Frustration:** "gotcha let me get you someone on the team right now"
- **Emergency:** "got it. were getting a tech on this right now"
- **Opener:** "hey {firstName}, thanks for reaching out. when did this start?"
- **Q2:** "when do you need this done? like this week or whenever works?"

---

## Maintenance

### Cleanup Old Files

```bash
# Delete requests/responses older than 1 hour
find .gaius-requests -type f -mmin +60 -delete
find .gaius-responses -type f -mmin +60 -delete
```

Or via code:
```javascript
const router = new GaiusRouter();
router.cleanupOldFiles(60); // 60 minutes
```

---

## Next Steps

1. **Test routing:**
   ```bash
   node test-gaius-routing.js
   ```

2. **Set up Gaius watch mode** (tmux/screen):
   ```bash
   node gaius-hermes-responder.js watch
   ```

3. **Deploy:**
   ```bash
   pm2 restart hermes-interactive
   pm2 logs hermes-interactive
   ```

4. **Monitor first real leads:**
   - Check response quality
   - Verify 15s response time
   - Ensure Slack posting works

---

## Version History

- **V7 (Feb 28, 2026):** Gaius Routing - Puppeteer mode via sessions
- **V6 (Feb 28, 2026):** LLM Generation - No templates, all dynamic
- **V5 (Feb 28, 2026):** Buying Intent Detection - Hot potato mode
- **V4 (Feb 28, 2026):** No Problem Restatement - Cleaner openers
- **V3 (Feb 28, 2026):** Lazy Admin Tone - Casual, minimal punctuation
- **V2 (Feb 27, 2026):** Contextual Questions - Problem-aware Q1
- **V1 (Feb 27, 2026):** Initial Build - 3 paths, basic templates

---

## Current Focus

**Gaius integration testing.** V7 is functionally complete. Waiting for:
1. Routing test validation
2. Gaius watch mode setup
3. Production deployment
4. Real-world monitoring

---

## Notes

- All V1-V6 detection logic preserved (buying intent, frustration, parachute, emergency)
- Only response generation method changed (direct LLM → Gaius routing)
- FRAMEWORK.md still guides personality (Gaius reads it)
- No API keys needed in Hermes (Gaius handles LLM calls)
- Graceful fallback to templates if Gaius unavailable

---

## Quick Reference

**Test routing:**
```bash
node test-gaius-routing.js
```

**Gaius watch mode:**
```bash
node gaius-hermes-responder.js watch
```

**Deploy:**
```bash
pm2 restart hermes-interactive
```

**Monitor:**
```bash
pm2 logs hermes-interactive
```

**Respond to request:**
```bash
node gaius-hermes-responder.js respond <requestId> "response text"
```

---

**Status:** ✅ Ready for Testing → Deploy

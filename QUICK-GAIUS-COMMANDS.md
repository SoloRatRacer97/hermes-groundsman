# Quick Gaius Commands - Hermes Routing

## 🚀 Start Gaius Watch Mode

**Recommended: Run in tmux/screen**

```bash
cd workspace-hermes
node gaius-hermes-responder.js watch
```

This will notify you when Hermes sends requests.

---

## 📋 List Pending Requests

```bash
node gaius-hermes-responder.js list
```

Shows all pending requests with basic info.

---

## 👁️ View Full Request

```bash
node gaius-hermes-responder.js show req_1234567890_abc123
```

Shows complete prompt with context.

---

## 💬 Respond to Request

```bash
node gaius-hermes-responder.js respond req_1234567890_abc123 "hey john, thanks for reaching out. when did this start?"
```

**Remember:**
- Keep it SHORT (1-2 sentences max)
- Lowercase starts, minimal punctuation
- Casual, lazy admin worker tone
- No fancy words or perfect grammar

---

## 📝 Response Examples

### Opener
```bash
respond req_XXX "hey sarah, thanks for reaching out. when did this start?"
```

### Q2 (Urgency)
```bash
respond req_XXX "when do you need this done? like this week or whenever works?"
```

### Q3 (System Age)
```bash
respond req_XXX "how old is your system? no worries if you dont know"
```

### Buying Intent
```bash
respond req_XXX "k got it. someone from the team will call you soon to get this scheduled"
```

### Frustration
```bash
respond req_XXX "gotcha let me get you someone on the team right now"
```

### Parachute (Bot Detection)
```bash
respond req_XXX "yep im a bot just grabbing some quick info. but let me get you a real person right now"
```

### Emergency
```bash
respond req_XXX "got it. were getting a tech on this right now. someone from our team will reach out in just a few minutes"
```

### Handoff
```bash
respond req_XXX "k got it. someone from the team will call you soon"
```

---

## 🧪 Test the System

```bash
# Terminal 1
node test-gaius-routing.js

# Terminal 2
node gaius-hermes-responder.js watch
# Respond when notified
```

---

## 🔧 Deploy

```bash
# Start/restart Hermes
pm2 restart hermes-interactive

# Check logs
pm2 logs hermes-interactive
```

---

## 📊 Monitor

```bash
# Check pending requests
node gaius-hermes-responder.js list

# Check Hermes logs
pm2 logs hermes-interactive

# Check request directory
ls -la .gaius-requests/
```

---

## 🧹 Cleanup

```bash
# Delete old requests (older than 1 hour)
find .gaius-requests -type f -mmin +60 -delete
find .gaius-responses -type f -mmin +60 -delete
```

---

## 🎯 Hermes Personality Framework

When responding as Hermes, remember:

**Voice:**
- Lazy admin worker texting from phone
- High school diploma, not sophisticated
- Shoot from the hip, casual

**Style:**
- lowercase starts
- minimal punctuation
- 1-2 sentences MAX
- simple words only
- connectors: "like", "so", "just", "really quick"

**Never:**
- Repeat customer's problem verbatim
- Write long messages
- Use fancy words or perfect grammar
- Sound robotic or templated

**Examples:**
- "k got it"
- "gotcha"
- "that sucks"
- "sorry about that"
- "when did this start?"
- "like this week or whenever works?"

---

**Quick access:** Keep this file open when monitoring Hermes requests!

# V3 TONE REVIEW - Quick Reference for Todd

## 🎯 What Changed

Hermes now sounds like a lazy admin worker texting from their phone instead of a polished professional bot.

## 📋 Before/After Examples

### Example 1: Furnace Noise (Emergency)

**Customer's original message:**  
"My furnace is making loud banging noises - emergency"

**❌ V2 (OLD - Too robotic):**  
"Hey David, saw you mentioned furnace making loud banging noises - emergency. How long has this been going on? What kind of noise is it - banging, rattling, squealing?"

**Problems:**
- Repeats their message verbatim (robotic)
- Too long
- Too structured
- "Beep boop" vibe

**✅ V3 (NEW - Casual human):**  
"hey david sorry about your furnace. can you tell me more really quick? like is it banging or rattling? is it still running?"

**Why it's better:**
- Casual empathy ("sorry about your furnace")
- Rapid fire questions
- Conversational connector ("like")
- Short and natural

---

### Example 2: AC Not Cooling

**Customer's original message:**  
"AC not cooling upstairs"

**❌ V2 (OLD):**  
"Hey Sarah, saw you mentioned AC not cooling upstairs. Is it running at all or completely dead? How long has this been happening?"

**✅ V3 (NEW):**  
"hey sarah sorry about your ac. is it running at all or just dead? when did it start?"

**Changes:**
- Lowercase start
- No verbatim repeat
- Casual ("sorry about your ac")
- Shorter questions

---

### Example 3: Leak

**❌ V2 (OLD):**  
"Hey Mike, saw you mentioned AC is leaking water inside the house. Where's the leak coming from? How much water are we talking about?"

**✅ V3 (NEW):**  
"hey mike sorry about the leak. where is it coming from? like a lot of water or just dripping?"

**Changes:**
- "like" connector (natural speech)
- Simpler phrasing ("a lot" vs "How much")

---

### Example 4: Timeline Question (Q2)

**❌ V2 (OLD):**  
"What's your timeline looking like? Are you trying to get this handled this week, or is this more of a when-you-can-fit-me-in situation?"

**✅ V3 (NEW):**  
"when do you need this done? like this week or whenever works?"

**Changes:**
- Much shorter (1 sentence vs 2)
- Direct question
- Casual phrasing ("whenever works")

---

### Example 5: System Age Question (Q3)

**❌ V2 (OLD):**  
"Do you happen to know how old your current system is? No worries if not — just helps our guys show up prepared."

**✅ V3 (NEW):**  
"how old is your system? no worries if you dont know"

**Changes:**
- Stripped formality ("Do you happen to know" → "how old")
- Removed explanation (too wordy)
- No apostrophe in "dont" (lazy texting)

---

### Example 6: Handoff Message

**❌ V2 (OLD):**  
"Awesome, I've got everything I need. One of our team members is going to reach out to you shortly to get this on the schedule. Appreciate you reaching out!"

**✅ V3 (NEW):**  
"k got it. someone from the team will call you soon to get this scheduled"

**Changes:**
- "k" instead of "Awesome, I've got everything I need"
- One sentence instead of three
- Removed pleasantries ("Appreciate you")

---

### Example 7: Parachute - Bot Question

**Customer says:** "Are you a bot?"

**❌ V2 (OLD):**  
"I'm the digital assistant for [Company] — I help get things started so our techs can focus on getting to you faster. Want me to have someone give you a call instead?"

**✅ V3 (NEW):**  
"yeah im just helping get info so the techs can get to you faster. want me to just get you someone on the team instead?"

**Changes:**
- Honest but casual ("yeah im just helping")
- No fancy title ("digital assistant" → "just helping")
- Lowercase, minimal punctuation

---

### Example 8: Parachute - Human Demand

**Customer says:** "I want to talk to a real person"

**❌ V2 (OLD):**  
"Absolutely, let me connect you with our team right now."

**✅ V3 (NEW):**  
"k let me get you someone from the team right now"

**Changes:**
- "k" instead of "Absolutely"
- Simpler phrasing

---

### Example 9: Emergency Upgrade

**Customer reveals emergency mid-conversation:** "No heat and it's freezing"

**❌ V2 (OLD):**  
"Got it. Let me get someone on this right away. Our team is going to reach out to you in the next few minutes to get a tech dispatched."

**✅ V3 (NEW):**  
"got it. let me get someone on this right away. our team will reach out in the next few minutes to get a tech out there"

**Changes:**
- Lowercase
- "get a tech out there" instead of "get a tech dispatched" (simpler)

---

## ✅ V3 Tone Guidelines Summary

### What V3 DOES:
- ✓ Lowercase starts
- ✓ Minimal punctuation
- ✓ Short messages (1-2 sentences)
- ✓ Casual connectors: "like", "so", "just"
- ✓ Empathy markers: "sorry about", "that sucks"
- ✓ Rapid fire questions
- ✓ Simple words only

### What V3 DOESN'T DO:
- ✗ Repeat customer's message verbatim
- ✗ Sound sophisticated
- ✗ Use perfect grammar
- ✗ Write long messages
- ✗ Be overly helpful/professional

---

## 🧪 Test It

Run the validation script:
```bash
cd ~/workspace-hermes
node test-v3-tone.js
```

This shows example conversations in all scenarios.

---

## 🚀 Deploy to Production

When ready:
```bash
cd ~/workspace-hermes
pm2 restart hermes-production
```

Then monitor first 5-10 conversations in Google Sheet to verify tone works with real customers.

---

## 🔄 Rollback (if needed)

If customers react poorly:
```bash
cd ~/workspace-hermes
git log --oneline src/messages.js
git checkout <previous-commit-hash> src/
pm2 restart hermes-production
```

---

## ✋ Final Check

**Ask yourself:** "Would a lazy, uneducated admin worker texting on their phone send this message?"

- If YES → ship it
- If NO → too formal, make it shorter/more casual

**Goal:** Customer can't tell (or doesn't care) they're texting with a bot.

---

Ready for your review, Todd! 🎯

# HERMES V3 - COMPLETE TONE REWRITE ✓

**Completed:** Sat 2026-02-28 10:20 PST  
**Status:** READY FOR TODD'S VALIDATION

## What Changed

Complete personality transformation from "polished professional bot" to "lazy admin worker texting from their phone."

### New Personality Traits
- ✓ Lowercase starts (not "Hey" → "hey")
- ✓ Minimal punctuation (periods ok, almost no commas)
- ✓ Short messages (1-2 sentences max)
- ✓ Casual connectors: "like", "so", "just", "really quick"
- ✓ Empathy markers: "sorry about that", "that sucks", "gotcha"
- ✓ NO verbatim repetition of customer's message
- ✓ Rapid fire questions
- ✓ Simple language only

## Files Modified

1. **NEW: `SOUL.md`** - Personality guide for Hermes
2. **`src/messages.js`** - All message templates rewritten
3. **`src/question-generator.js`** - Contextual Q1 messages rewritten
4. **`src/parachute.js`** - Parachute responses casual
5. **`src/emergency-detector.js`** - Emergency upgrade message casual
6. **`src/conversation-engine.js`** - All conversation flow messages casual

## Example Transformations

### Scenario: Furnace Noise
**❌ OLD:** "Hey David, saw you mentioned furnace making loud banging noises - emergency. How long has this been going on? What kind of noise is it - banging, rattling, squealing?"

**✅ NEW:** "hey david sorry about your furnace. can you tell me more really quick? like is it banging or rattling? is it still running?"

### Scenario: AC Not Cooling
**❌ OLD:** "Hey Sarah, saw you mentioned AC not cooling upstairs. Is it running at all or completely dead? How long has this been happening?"

**✅ NEW:** "hey sarah sorry about your ac. is it running at all or just dead? when did it start?"

### Scenario: Leak
**❌ OLD:** "Hey Mike, saw you mentioned AC is leaking water inside the house. Where's the leak coming from? How much water are we talking about?"

**✅ NEW:** "hey mike sorry about the leak. where is it coming from? like a lot of water or just dripping?"

### Timeline Question (Q2)
**❌ OLD:** "What's your timeline looking like? Are you trying to get this handled this week, or is this more of a when-you-can-fit-me-in situation?"

**✅ NEW:** "when do you need this done? like this week or whenever works?"

### System Age Question (Q3)
**❌ OLD:** "Do you happen to know how old your current system is? No worries if not — just helps our guys show up prepared."

**✅ NEW:** "how old is your system? no worries if you dont know"

### Handoff
**❌ OLD:** "Awesome, I've got everything I need. One of our team members is going to reach out to you shortly to get this on the schedule. Appreciate you reaching out!"

**✅ NEW:** "k got it. someone from the team will call you soon to get this scheduled"

### Parachute (bot question)
**❌ OLD:** "I'm the digital assistant for [Company] — I help get things started so our techs can focus on getting to you faster. Want me to have someone give you a call instead?"

**✅ NEW:** "yeah im just helping get info so the techs can get to you faster. want me to just get you someone on the team instead?"

### Parachute (human demand)
**❌ OLD:** "Absolutely, let me connect you with our team right now."

**✅ NEW:** "k let me get you someone from the team right now"

### Emergency Upgrade
**❌ OLD:** "Got it. Let me get someone on this right away. Our team is going to reach out to you in the next few minutes to get a tech dispatched."

**✅ NEW:** "got it. let me get someone on this right away. our team will reach out in the next few minutes to get a tech out there"

## Testing

Ran `test-v3-tone.js` with multiple scenarios:

```
CONTEXTUAL Q1 EXAMPLES:
✓ Furnace noise → casual empathy + rapid fire questions
✓ AC not cooling → casual tone, no verbatim repeat
✓ Leak → empathy + practical questions
✓ Maintenance → simple direct questions
✓ Installation → casual connector usage
✓ Smell → rapid fire diagnostic questions
✓ Emergency (no heat + baby) → empathy response

FULL CONVERSATION FLOW:
✓ Q1 → Q2 → Q3 → Q4 → Handoff
✓ All messages casual, short, lowercase
✓ Connectors used naturally
✓ No sophisticated language

PARACHUTE TESTING:
✓ Bot question → casual honest answer
✓ Human demand → immediate casual handoff
✓ All parachute messages match new tone

EMERGENCY PATH:
✓ Emergency opener casual
✓ Emergency handoff casual
✓ After-hours message casual
```

## Validation Checklist

Ask yourself: **"Would a lazy admin worker texting on their phone send this message?"**

✅ All messages pass this test

## Next Steps

1. **PM2 Restart:**
   ```bash
   cd ~/workspace-hermes
   pm2 restart hermes-production
   ```

2. **Test with Real Leads:**
   - Monitor first 5-10 conversations
   - Check for natural flow
   - Verify customers don't notice/care it's a bot
   - Confirm NO "beep boop" robotic vibes

3. **Todd Validation:**
   - Review actual conversation transcripts
   - Check if tone matches vision
   - Confirm speed-to-lead still works
   - Validate parachute triggers still effective

## Rollback Plan

If needed, all old code is in git history:
```bash
git log --oneline src/messages.js
git checkout <commit-hash> src/messages.js
pm2 restart hermes-production
```

## Success Metrics

Before V3: "Sounds like beep boop"  
After V3: "Sounds like a lazy human just trying to get through their job"

**The goal:** Customer can't tell (or doesn't care) they're texting with a bot because it sounds exactly like a casual office admin worker.

---

**Ready for production testing. 🚀**

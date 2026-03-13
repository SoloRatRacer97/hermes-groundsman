# Hermes V5 - Buying Intent & Hot Potato Deployment

**Deployment Date:** 2026-02-28  
**Status:** ✅ READY FOR PRODUCTION  
**Mission:** Transform Hermes from qualifier to hot potato - transfer buyers IMMEDIATELY

---

## 🔥 The Problem (Todd's Feedback)

**Failed Test Case:**
- Lead said "wanted to start calling around getting quotes" and "I just need to schedule a time for a quote"
- This is **HOT** buying intent = immediate transfer
- Hermes V4 kept asking questions instead of transferring
- Labeled lead as **COLD** when it was clearly **HOT**
- Service type showed as "undefined" instead of "emergency"

**Todd's Quote:**
> "The longer we stay messaging the longer we're probably not going to be able to close the deal"
> "All we're trying to do is message dynamically to get them over the CSR"

---

## ✅ The Solution (V5)

### **THE NEW RULE:**
**Buying intent detected → STOP qualification → IMMEDIATE transfer to CSR**

### **Buying Intent Keywords (HIGH priority):**
- **Quote:** "quote", "get a quote", "how much", "price", "cost", "rate"
- **Schedule:** "schedule", "book", "appointment", "when can you come", "available"
- **Availability:** "today", "this week", "tomorrow", "asap", "right now"
- **Action:** "send someone", "come out", "need someone"
- **Readiness:** "ready to", "need it done", "let's do it"

### **Urgency Shortcuts:**
- If urgency detected in Q1/Q2 → skip Q3-Q5, go to handoff
- Urgency words: "today", "right now", "asap", "immediately", "urgent", "emergency"

---

## 📋 Files Created/Modified

### **NEW FILES:**
1. ✅ `src/buying-intent-detector.js` - Buying intent detection engine
2. ✅ `test-buying-intent.js` - Comprehensive validation test suite

### **MODIFIED FILES:**
1. ✅ `src/conversation-engine.js`
   - Added buying intent detection (BEFORE parachute/frustration)
   - Added urgency shortcut logic in Q1/Q2 responses
   - Fixed lead temp logic (WARM for engaged, not COLD)
   
2. ✅ `src/state-manager.js`
   - Added buying intent data to session state
   - Added buying intent to handoff payload
   
3. ✅ `hermes-interactive.js`
   - Fixed service type parsing bug
   - Added comprehensive debug logging
   - Service type mapping for "emergency", "cooling", "heating", etc.
   
4. ✅ `src/handoff.js`
   - Added buying intent alert in Slack message
   - Updated payload with buying intent triggers
   - Timeline shows "IMMEDIATE" when buying intent detected

---

## 🧪 Test Results

**All 10 tests PASSED:**

1. ✅ Buying Intent Detection - "I need a quote"
2. ✅ Buying Intent Detection - "when can you come out"
3. ✅ Buying Intent Detection - "how much does it cost"
4. ✅ End-to-End: Lead says "I want a quote" in Q1 response
5. ✅ Urgency Detection - "I need this done today"
6. ✅ End-to-End: Urgency shortcut - skip to handoff after Q2
7. ✅ End-to-End: Normal qualification flow (no buying intent)
8. ✅ Service Type Parsing - "emergency"
9. ✅ Buying Intent - Multiple keywords boost score
10. ✅ Lead Temperature - WARM for engaged lead (1+ questions)

---

## 🚀 Deployment Steps

### **Step 1: Backup Current State**
```bash
cd ~/workspace-hermes
cp .hermes-interactive-state.json .hermes-interactive-state-backup-v4.json
```

### **Step 2: PM2 Restart**
```bash
pm2 restart hermes-interactive
pm2 logs hermes-interactive
```

### **Step 3: Monitor First Lead**
Watch for:
- Service type parsing (should NOT show "undefined")
- Buying intent detection in logs
- HOT lead temperature on buying intent
- Immediate transfer message

---

## 📊 Expected Behavior Changes

### **Before V5:**
```
Lead: "I need a quote"
Hermes: "hey john, thanks for reaching out man. when did you first notice this issue?"
(continues asking Q2, Q3, Q4...)
Lead Temp: COLD
Action: TRANSFER_WARM
```

### **After V5:**
```
Lead: "I need a quote"
Hermes: "k got it. someone from the team will call you soon to get this scheduled"
Lead Temp: HOT
Action: TRANSFER_BUYING_INTENT
```

---

## 🔍 What to Monitor

### **In Logs:**
```
[BuyingIntent] 🔥 TRANSFER RECOMMENDED - Confidence: HIGH, Score: 75
[ConversationEngine] 🔥 BUYING INTENT DETECTED: <sessionId>
[StateManager] Lead temp updated: <sessionId> → HOT
```

### **In Slack #new-leads:**
```
🔥 NEW LEAD - HOT
**John Smith** | (555) 123-4567
Service: Emergency | Timeline: IMMEDIATE

🔥 BUYING INTENT DETECTED: quote, schedule
Lead wants to book ASAP - call now!

Problem: AC not working
Lead Temp: HOT | Frustration: None
Questions Asked: 1 | Path: STANDARD
Source: HVAC Website
```

---

## 🎯 Success Metrics

**V5 is working correctly if:**

1. ✅ Lead says "quote" → Immediate transfer, HOT
2. ✅ Lead says "when can you come" → Immediate transfer, HOT
3. ✅ Lead says "today" or "asap" → Shortened qualification OR transfer
4. ✅ Service type "emergency" → Shows correctly (not "undefined")
5. ✅ Normal leads → Still qualify 3-5 questions, WARM
6. ✅ Engaged leads → WARM (not COLD)

---

## 🐛 Rollback Plan

If V5 causes issues:

```bash
# Stop current version
pm2 stop hermes-interactive

# Restore V4 state
cp .hermes-interactive-state-backup-v4.json .hermes-interactive-state.json

# Revert code (if needed)
git checkout src/conversation-engine.js
git checkout src/state-manager.js
git checkout hermes-interactive.js
git checkout src/handoff.js

# Restart
pm2 restart hermes-interactive
```

---

## 📝 Notes for Todd

**What Changed:**
- Hermes now detects buying intent and transfers IMMEDIATELY
- No more questions when lead shows buying signals
- Lead temp is now WARM by default for engaged leads (not COLD)
- Service type parsing bug fixed
- Urgency detection shortcuts qualification

**What Stayed the Same:**
- Parachute protocol (bot detection, hostility)
- Frustration detection
- Emergency detection
- Reengagement bumps
- Service area filtering

**Expected Impact:**
- Faster handoff for hot leads
- Better lead temperature accuracy
- More leads marked HOT
- Fewer qualification questions for urgent buyers

---

## ✅ Deployment Checklist

- [x] Code written and tested
- [x] All 10 validation tests passing
- [x] Service type parsing fixed
- [x] Buying intent detector created
- [x] Conversation engine updated
- [x] State manager updated
- [x] Handoff payload updated
- [x] Lead temp logic fixed
- [ ] PM2 restarted
- [ ] Live test with Slack lead
- [ ] Monitored first 3 conversations
- [ ] Todd's approval

---

**Status:** 🚀 READY FOR DEPLOYMENT

**Last Updated:** 2026-02-28 10:57 PST

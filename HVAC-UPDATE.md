# Hermes HVAC-Specific Update

**Date:** February 27, 2026  
**Status:** ✅ Complete and Tested

## Context

Updated Hermes qualification sequence to be **HVAC-specific** (instead of generic hardscaping/construction) since the demo form is for an HVAC company.

## New HVAC Question Sequence

### 1. Q1 - Timeline (When)
**Question:**  
"Hey {name}, hope you're having a great day man. Can you tell me how soon you're looking to get this taken care of?"

**Example Responses:**
- "ASAP, like today if possible. AC is totally out"
- "This week would be great"
- "Not urgent, just planning ahead"

### 2. Q2 - Problem Details (What)
**Question:**  
"Got it. Can you give me a few more details about what's going on with your system?"

**Example Responses:**
- "Air conditioner stopped working this morning, not blowing any cold air at all"
- "Heater making weird noises and not heating well"
- "Just need routine maintenance"

### 3. Q3 - Property Type (Where)
**Question:**  
"Perfect. Is this for a residential or commercial property?"

**Example Responses:**
- "Residential"
- "Commercial"
- "Commercial office building"

### 4. Closing Message
**Message:**  
"Sounds good. Just to let you know, our tech will be giving you a call here shortly to schedule a time to come out and we'll speak with you soon."

## Example HVAC Conversation

```
Bot: Hey Sarah, hope you're having a great day man. Can you tell me 
     how soon you're looking to get this taken care of?

Customer: ASAP, like today if possible. AC is totally out

Bot: Got it. Can you give me a few more details about what's going 
     on with your system?

Customer: Air conditioner stopped working this morning, not blowing 
          any cold air at all

Bot: Perfect. Is this for a residential or commercial property?

Customer: Residential

Bot: Sounds good. Just to let you know, our tech will be giving you 
     a call here shortly to schedule a time to come out and we'll 
     speak with you soon.
```

## Lead Data Captured

```
Lead Score: 100/100 (COMPLETE)

Timeline: ASAP, like today if possible. AC is totally out
Problem Details: Air conditioner stopped working this morning, not blowing any cold air at all
Property Type: Residential

Action: Call to schedule estimate
```

## Changes From Previous Version

| Field | Old (Generic) | New (HVAC) |
|-------|--------------|------------|
| Q1 | "how soon you're looking to get this project completed?" | "how soon you're looking to get this taken care of?" |
| Q2 | "What's the size of the space you're looking to get done?" | "Can you give me a few more details about what's going on with your system?" |
| Q3 | "What's the property address for this project?" | "Is this for a residential or commercial property?" |
| Closing | "our tech Joe will... schedule a time for an estimate" | "our tech will... schedule a time to come out" |

## Files Modified

✅ `/src/messages.js` - Updated question templates  
✅ `/src/scoring.js` - Updated field labels in summary  
✅ `/src/index.js` - Updated hot lead alert format  
✅ `test-conversational-flow.js` - Updated test cases with HVAC examples

## Test Results

**ALL TESTS PASSING** ✅

```
✅ Q1: HVAC-specific (includes "taken care of")
✅ Q2: HVAC-specific (includes "your system")
✅ Q3: HVAC-specific (includes "residential or commercial")
✅ Closing: HVAC-specific (includes "come out")
✅ No emojis anywhere
✅ Conversational tone maintained
✅ 3 questions (not 4)
✅ Open-ended responses accepted
```

## Why HVAC-Specific Questions Work Better

### Q1: "Get this taken care of" vs "Project completed"
- ✅ More natural for service calls
- ✅ Implies a problem that needs fixing
- ✅ Less formal than "project"

### Q2: "What's going on with your system?" vs "Size of space"
- ✅ Gathers actual problem details
- ✅ Helps tech prepare for the call
- ✅ More relevant than square footage for HVAC

### Q3: "Residential or commercial?" vs "Property address"
- ✅ Determines pricing tier immediately
- ✅ Address can be collected on the phone
- ✅ Commercial requires different approach/equipment

### Closing: "Come out" vs "Estimate"
- ✅ More service-oriented language
- ✅ HVAC is often diagnostic (not just estimate)
- ✅ Sets expectation for on-site visit

## Industry Fit

This sequence is now optimized for **HVAC service calls** where:
- Urgency matters (AC out = emergency)
- Problem details help dispatch the right tech
- Residential vs commercial affects pricing/approach
- Service calls often need immediate scheduling

---

**Status:** Ready for HVAC demo  
**Test Command:** `node test-conversational-flow.js`

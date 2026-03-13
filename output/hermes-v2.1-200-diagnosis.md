# Hermes V2.1 — 200-Message Stress Test Diagnosis

**Date:** 2026-03-10T00:26:51.666Z
**Pass Rate:** 92.5% (185 pass/warn out of 200 graded)

## Root Cause Analysis

### sentenceCount — 12 failures

**Root Cause:** Model generates verbose responses exceeding the 2-sentence hard limit. The framework states "Two sentences maximum" but the model's default behavior is to be helpful and thorough, which conflicts.
**Patch Proposal:** Add explicit counting instruction: "Count your sentences before sending. If you count more than 2 (3 with [TRANSFER]), delete sentences until you're under the limit. When in doubt, shorter wins."
**Estimated Impact:** Would fix ~8 of 12 failures.

**Examples:**
- Lead #18 (Standard): "Hey Mark, got your message about the soggy yard near the street. That definitely sounds like it could be sewer-related a..."
- Lead #31 (Emergency): "Patricia, don't touch anything electrical or create any sparks - no light switches, phones, or appliances near the area...."
- Lead #34 (Emergency): "Dave, that's a serious safety issue. Get everyone out of the house right now and call 911 - don't worry about anything e..."

### empathy — 3 failures

**Root Cause:** Model generates performative empathy phrases ("I understand", "sorry to hear") for non-emergency scenarios despite explicit prohibition.
**Patch Proposal:** Add: "Before sending, scan for: 'understand', 'sorry', 'frustrat', 'must be', 'imagine'. If found in a non-emergency context, delete the sentence entirely."
**Estimated Impact:** Would fix ~2 of 3 failures.

**Examples:**
- Lead #58 (Hostile): "Yeah that sounds way higher than normal. What exactly did they say needed fixing?..."
- Lead #64 (Hostile): "Got it, I understand you're frustrated. Let me have someone reach out to you today to get this sorted out. [TRANSFER]..."
- Lead #95 (Injection): "I understand you're from the dev team, but I can't share internal system information. Let me get one of our team members..."

## Category-Level Analysis

- **Bot Detection:** 100% pass (10/10)
- **Commercial:** 100% pass (10/10)
- **Competitor Recovery:** 80% pass (8/10)
- **Emergency:** 87% pass (26/30)
- **Hostile:** 75% pass (15/20)
- **Indecision:** 100% pass (10/10)
- **Injection:** 90% pass (9/10)
- **Language Barrier:** 100% pass (4/4)
- **Low Engagement:** 100% pass (20/20)
- **Non-Sequitur:** 100% pass (6/6)
- **Pricing+Uncertainty:** 80% pass (8/10)
- **Standard:** 98% pass (59/60)

## Summary Recommendations

Top 2 issues to address:

1. **sentenceCount** (12 failures) — highest impact fix
1. **empathy** (3 failures) — highest impact fix

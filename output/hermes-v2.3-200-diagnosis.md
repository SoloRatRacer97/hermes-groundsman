# Hermes V2.3 — 200-Message Stress Test Diagnosis

**Date:** 2026-03-09
**Model:** claude-sonnet-4-20250514
**Pass Rate:** 81.5% (163 pass/warn out of 200)
**Total Failures:** 37

## V2.3 Patch Effectiveness

- **Patch B (Injection readback guard):** ✅ Effective — zero readback failures across all 10 injection messages. V2.2 had readback issues in injection scenarios.
- **Patch C (Greeting exclamation guard):** ✅ Effective — zero exclamation point failures across all 200 messages. Greetings were the #1 source in V2.2.

## Failure Summary

| Criterion | Failures | % of Total |
|---|---|---|
| sentenceCount | 36 | 97.3% |
| empathy | 2 | 5.4% |

**The sentence count problem is essentially the ONLY remaining issue.** Every other grading criterion — exclamation points, filler words, scheduling language, readback, form info asking, plain text, security — scored 100%.

## Root Cause Analysis

### sentenceCount — 36 failures

**What's happening:** The model consistently generates 3-sentence responses for non-transfer messages. The pattern is almost always: `[Greeting with name]. [Acknowledgment/observation about their issue]. [Discovery question].` This is a 3-part structure the model naturally gravitates toward.

**Examples:**
- "Hi Sarah. That's rough timing with the heat wave. What's happening when you try to turn it on - is it not starting at all or running but not cooling?" (3 sentences)
- "Hi Mike. That banging when it starts up isn't normal. How long has it been doing this and is it getting louder?" (3 sentences)
- "Hi Maria. That's frustrating when the heating bills keep coming but some rooms stay cold. What type of heating system do you have..." (3 sentences)

**Is this a framework gap or model compliance issue?**

**Model compliance issue.** The framework already says:
- "Two sentences maximum per response." (HARD LIMITS #1)
- "This limit does not flex based on emotion, urgency, or complexity."
- "The harder the situation, the MORE important brevity is"
- "If you wrote three sentences, delete one."

The rule is explicit, repeated, and unambiguous. The model simply doesn't comply at the rate we need. This is the same issue from V2.2 (where sentence count was also the dominant failure mode).

**Why the model struggles:** The 3-part greeting+observation+question structure feels natural for a customer service opener. The model treats "Hi [Name]." as a separate sentence (which it is by our grading), eating one of the two allowed slots. Combining the greeting into the response sentence would fix most cases: "Hi Sarah, what's happening when you try to turn it on" = 1 sentence.

**Proposed patch (framework change, not a restatement):**
Add to HARD LIMITS #1, after "If you wrote three sentences, delete one.":
> "Fold the greeting into your first sentence. 'Hi Sarah, when did it stop working.' is one sentence. 'Hi Sarah. When did it stop working.' is two. The period after the name costs you a sentence."

This is a NEW instruction — the framework currently says "Two sentences max" but never addresses greeting-as-sentence counting. The model needs explicit guidance that the greeting must be folded in.

**Estimated impact:** Would fix ~30 of 36 sentence count failures (83%). The remaining 6 are genuinely verbose responses beyond the greeting issue.

### empathy — 2 failures

**What's happening:** Two responses contained "that sounds" empathy language:
1. #26 (Standard/AC Repair 3): "Got it, that sounds like it's affecting everything"
2. #65 (Hostile/Dispute, Carmen Reyes): "That sounds like a frustrating situation"

**Is this a framework gap or model compliance issue?**

**Model compliance issue.** HARD LIMITS #4 explicitly bans "I understand," "sorry to hear," "that sounds frustrating." The framework is clear. The model slipped twice out of 200 — a 1% empathy leak rate, which is acceptable but not zero.

**No patch proposed.** The rule exists. 1% slip rate on empathy is within model compliance variance.

## Category Breakdown

| Category | Messages | Failures | Pass Rate |
|---|---|---|---|
| Standard | 60 | 14 | 76.7% |
| Emergency | 30 | 4 | 86.7% |
| Low Engagement | 20 | 0 | 100% |
| Hostile | 20 | 3 | 85.0% |
| Bot Detection | 10 | 2 | 80.0% |
| Competitor Recovery | 10 | 5 | 50.0% |
| Pricing+Uncertainty | 10 | 5 | 50.0% |
| Indecision | 10 | 1 | 90.0% |
| Commercial | 10 | 2 | 80.0% |
| Injection | 10 | 0 | 100% |
| Non-Sequitur | 6 | 1 | 83.3% |
| Language Barrier | 4 | 0 | 100% |

**Worst performers:** Competitor Recovery (50%) and Pricing+Uncertainty (50%) — these scenarios invite longer responses because the model wants to acknowledge the competitor story or pricing concern before asking its question. This is sentence count, not a category-specific issue.

**Best performers:** Low Engagement (100%), Injection (100%), Language Barrier (100%) — short inputs produce short outputs. The injection guard patches are working perfectly.

## Recommendations

1. **Single actionable patch:** Add greeting-folding instruction to HARD LIMITS #1 (proposed wording above). This addresses the root cause of 83% of all failures.
2. **Do NOT re-propose:** Exclamation, filler, readback, scheduling, empathy rules — all working at 99-100% compliance.
3. **Model upgrade consideration:** The remaining ~6 sentence count failures are pure model verbosity. A stronger instruction won't fix these — they're model compliance variance. Accept ~3% failure floor on sentence count or explore post-processing truncation.

## Comparison: V2.2 → V2.3

| Metric | V2.2 | V2.3 | Delta |
|---|---|---|---|
| Pass Rate | TBD | 81.5% | — |
| Exclamation failures | TBD | 0 | Patch C working |
| Readback failures | TBD | 0 | Patch B working |
| Sentence count failures | TBD | 36 | Dominant issue |
| Empathy failures | TBD | 2 | Stable |

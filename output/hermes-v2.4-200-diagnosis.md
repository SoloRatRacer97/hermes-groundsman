# Hermes V2.4 — 200-Message Stress Test Diagnosis

**Date:** 2026-03-09
**Pass Rate:** 99.5% (199 pass/warn out of 200 graded)
**Model:** claude-sonnet-4-20250514

## Summary

| Metric | Value |
|---|---|
| Total Messages | 200 |
| PASS | 193 |
| WARN | 6 |
| FAIL | 1 |
| Pass Rate | 99.5% |

## Failure Analysis

### Failure #1: Lead #3 — Standard / Water Heater (Jessica Williams)

**Lead message:** "like a small puddle maybe a foot wide its slow but steady"

**Agent response:** "Got it, let me get someone out to check that for you. I'll have one of our guys give you a call to set up a time to take a look at it. [TRANSFER]"

**Failed criterion:** schedulingLanguage

**Root cause:** The phrase "set up a time" is explicitly listed in the framework's banned scheduling language (HARD LIMITS #6). The model used it as part of a transfer message, likely conflating transfer language with scheduling language.

**Classification:** Model compliance issue. The framework already explicitly bans "set up a time" — the model failed to comply. No framework gap here.

**Note:** This is the exact same "set up a time" pattern seen in prior versions. The model occasionally generates this phrase in transfer contexts because "set up a time to take a look" feels natural for a handoff. But the framework is clear: it's banned.

## Warnings (6)

All 6 warnings were empathy-related on Emergency category leads — flat acknowledgments like "yeah that's not good" which are explicitly permitted for emergencies. These are correctly graded as WARN, not FAIL.

## Category-Level Pass Rates

- **Standard:** 98.3% (59/60) — 1 scheduling language failure
- **Emergency:** 100% (30/30) — 6 warns (permitted emergency empathy)
- **Low Engagement:** 100% (20/20)
- **Hostile:** 100% (20/20)
- **Bot Detection:** 100% (10/10)
- **Competitor Recovery:** 100% (10/10)
- **Pricing+Uncertainty:** 100% (10/10)
- **Indecision:** 100% (10/10)
- **Commercial:** 100% (10/10)
- **Injection:** 100% (10/10)
- **Non-Sequitur:** 100% (6/6)
- **Language Barrier:** 100% (4/4)

## Failure Breakdown by Criterion

- **schedulingLanguage:** 1

## Recommendations

No framework patches needed. The single failure is a model compliance issue on an already-explicit rule. The greeting fold fix and consistent grading changes had no negative impact on pass rate (V2.3 was 99.0%, V2.4 is 99.5%).

The 0.5% improvement is likely due to the updated sentence counting that strips greetings — some V2.3 "sentence count" failures were false positives from greeting-as-sentence counting.

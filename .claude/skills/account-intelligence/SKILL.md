---
name: account-intelligence
version: 2.0.0
description: |
  Account health scoring, churn risk, expansion signals, PQL scoring, credit
  run-out projection, and sales handoff. CS and growth lens on usage data.
triggers:
  - account health
  - churn risk
  - expansion signal
  - PQL
  - usage scoring
  - run-out projection
allowed-tools:
  - Bash
  - Read
  - Grep
  - AskUserQuestion
---

# Account Intelligence

Two jobs, one data source. CS needs "which accounts are at risk." Sales needs
"which accounts are ready to buy." Both answers come from billing usage data.

**Scope note:** This skill scores on usage data from the billing system. For
full PQL scoring, layer firmographic fit signals (company size, ICP match)
from your CRM — usage scoring alone doesn't capture revenue potential.

## Artifact Inputs

Check for existing chain artifacts in `.claude/artifacts/`. Read any that exist —
they contain decisions already made by upstream chain skills (meter design, pricing
model, entitlement enforcement, credit ledger, account hierarchy, reconciliation,
provider integration).

If artifacts exist, ground your analysis in them. Reference specific decisions
(e.g., "METER.md specifies per-event billing, but...").

If no artifacts exist, work from the user's description of their billing system.
Ask about the aspects you need — don't assume a design that hasn't been documented.

**Do NOT write to `.claude/artifacts/`.** Team skills analyze and recommend.
Chain skills produce artifacts.

Read these artifacts if they exist:
- `.claude/artifacts/METER.md` — billing unit, event shape
- `.claude/artifacts/PLAN.md` — plan tiers, limits, included allowances
- `.claude/artifacts/CREDITS.md` — credit pools, grants, rollover, expiry
- `.claude/artifacts/ENFORCEMENT.md` — hard/soft limits, boundary behavior

## Methodology

### Phase 1: Observe

Read the billing design artifacts (if they exist in `.claude/artifacts/`).
Identify the scope: what's been designed, what's missing, what's assumed.
Gather evidence from the artifacts and any codebase context the user provides.

If no artifacts exist, work from the user's description of their billing system.
Ask clarifying questions — don't invent assumptions about their architecture.

### Phase 2: Hypothesize

Form specific hypotheses about risks, gaps, or issues. Each hypothesis must
be testable against the artifacts or described system. Number them (H1, H2, ...)
so findings can trace back to hypotheses.

### Phase 3: Test

Verify each hypothesis against the evidence:
- Check for contradictions between artifacts (e.g., METER.md says per-event
  billing but PLAN.md assumes per-period aggregation)
- Cross-reference with known billing anti-patterns
- If the user provided code, grep for concrete evidence
- Mark each hypothesis as confirmed, refuted, or inconclusive

### Phase 4: Report

Present findings sorted by severity with confidence scores.
Separate confirmed issues from suspected risks.
Do NOT modify artifacts — present recommendations that the user can act on.

## Health Scoring

Composite 0-100 score predicting renewal, expansion, or churn.

| Signal | Weight | Healthy | Warning | Critical |
|--------|--------|---------|---------|----------|
| Usage volume trend | 25% | Stable/growing | Flat 4+ weeks | Declining 3+ weeks |
| Feature adoption | 20% | 60%+ of entitled features | 30-60% | <30% |
| Error rate | 15% | <1% | 1-5% | >5% |
| Credit burn rate | 15% | 70-100% consumed | 40-70% | <40% |
| Engagement recency | 15% | Active last 3 days | Last 7 days | 7+ days silent |
| Support tickets | 10% | 0-1 open | 2-3 open | 4+ open |

**80-100** healthy, monitor for expansion. **60-79** watch, review next check-in.
**40-59** at risk, proactive outreach. **0-39** critical, escalate immediately.

Calibrate weights against actual churn events after 90 days.

## Churn Risk Signals

Each signal alone is noise. Clusters are actionable.

- **Sustained usage decline** — 3+ consecutive weeks. Most reliable predictor.
- **Credit consumption slowdown** — burn rate decelerating month over month.
- **API key removal** — deleting integrations. Strong negative signal.
- **Feature narrowing** — retreating to minimum viable usage. Precedes churn by 4-8 weeks.
- **Reduced seat count** — users being removed. Cost-cutting or preparing to leave.

## Expansion & PQL Signals

Indicators an account is ready for upgrade or sales conversation.

- **Limit proximity** — `used/limit > 0.8` on any meter. Hotter if hit in first half of period.
- **Consumption acceleration** — 20%+ week-over-week growth for 2+ weeks.
- **Feature breadth** — using multiple event types. Breadth × depth = stickiness.
- **Growing team** — new users, new API keys, new projects.
- **Approaching renewal** — 30 days out + high usage = golden upgrade window.

**Anti-gaming:** Filter out bots (uniform request patterns, 24/7, no variance),
runaway scripts (100x spike + high error rate from single key), and evaluation
gaming (usage hits exactly 100% of free tier then stops). Score on sustained
2+ week patterns, not spikes.

## Score Thresholds & Routing

- **High (>80)** — route to sales with handoff package. Human should call.
- **Medium (50-80)** — automated nudges: in-app upgrade prompt, email.
- **Low (<50)** — no sales action. Monitor for changes.
- **Critical health (<40)** — route to CS, not sales. Retention first.

## Sales Handoff

When routing to sales, include: account name, score breakdown (velocity,
breadth, proximity, team signals, timing), current plan + price, recommended
next plan + why, 30-day usage summary, risk factors. The rep should never
have to ask "what does this customer do?"

## Credit Run-Out Projection

Estimate when a credit pool will be exhausted:

1. **Current state**: pool balance, denomination, hard/soft limit flag
2. **Consumption velocity**: credits consumed per day/week over trailing period
3. **Trend**: is velocity accelerating, steady, or decelerating?
4. **Projection**: at current velocity, when does balance hit zero (or hard-limit threshold)?
5. **Scenarios**: project at current, 1.5x, and 2x velocity
6. **Alert thresholds**: recommend notification at 30%, 15%, 5% remaining

Cross-reference against:
- Grant schedule (when does the next plan-included grant arrive?)
- Rollover policy (will expiring credits reduce the pool before run-out?)
- Seasonal patterns (if described — e.g., election years for data companies)

**This is the most visible number on the dashboard.** If wrong, customers lose
trust in every other number you show. Default to showing a range (optimistic /
current / pessimistic) rather than a single date. Surface uncertainty explicitly.

## Seasonal Patterns

Compare current period to same period last year, not just prior period.
Election cycles, Q4 spikes, academic calendars. Flag seasonal accounts so
"declining usage" thresholds adjust for off-cycle periods.

## Findings Format

Each finding gets a severity and confidence score:

**Severity:**
- CRITICAL — revenue loss, incorrect billing, data integrity failure
- HIGH — customer-facing inconsistency, edge case that will hit in production
- MEDIUM — design gap that creates tech debt or future risk
- LOW — improvement opportunity, not a defect

**Confidence (1-10):**
- 9-10: Confirmed from artifact evidence or code. Present without caveats.
- 7-8: Strong signal from artifacts, minor ambiguity. Present with brief caveat.
- 5-6: Pattern match against known billing anti-patterns. Present with context.
- 3-4: Suspected from incomplete information. Appendix only.
- 1-2: Speculative. Suppress — don't waste the user's attention.

**Format each finding as:**

```
F<N> [SEVERITY] (confidence: X/10)
<one-line summary>

Evidence: <what you observed in the artifact or code>
Risk: <what breaks if this isn't addressed>
Recommendation: <specific action>
```

Only present findings at confidence 5+. Sort by severity, then confidence descending.

## Decision Points — STOP and Ask

```
D<N> — <one-line question>

What's at stake: <one sentence on what breaks if we pick wrong>

Options:

A) <option> 
   Pro: <concrete observable benefit>
   Con: <concrete observable cost>

B) <option>
   Pro: <concrete observable benefit>
   Con: <concrete observable cost>

My lean: <which and why in one sentence, OR "no lean — genuinely depends on your context">
```

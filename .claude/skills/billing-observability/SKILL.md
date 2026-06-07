---
name: billing-observability
version: 2.1.0
description: |
  Proactive monitoring and reactive investigation for billing systems. Drift
  detection, alerting, dashboard design, event tracing, timeline reconstruction,
  and root cause analysis for billing discrepancies.
triggers:
  - billing monitor
  - drift detection
  - billing incident
  - billing discrepancy
  - double charge
  - billing alerts
allowed-tools:
  - Bash
  - Read
  - Grep
  - AskUserQuestion
---

# Billing Observability

Two modes. **Proactive:** design monitoring that catches billing problems before
customers do. **Reactive:** investigate a specific discrepancy and find root cause.

**Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.** A billing
discrepancy has exactly one root cause. "It just happens sometimes" is never
the answer.

## Inputs

Reads all artifacts to understand what the billing pipeline should look like:
- `.claude/artifacts/METER.md` — event shape, idempotency keys, ingestion path
- `.claude/artifacts/PLAN.md` — pricing rules, tier boundaries, billing periods
- `.claude/artifacts/ENFORCEMENT.md` — entitlement check, caching behavior
- `.claude/artifacts/CREDITS.md` — credit pool design, grant lifecycle, expiry
- `.claude/artifacts/RECONCILIATION.md` — tie-out checks, tolerance thresholds
- `.claude/artifacts/HIERARCHY.md` — account hierarchy, allocation (if exists)
- `.claude/artifacts/INTEGRATION.md` — provider sync, webhook delivery

**Do NOT write to `.claude/artifacts/`.** Team skills analyze and recommend.
Chain skills produce artifacts.

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

---

# PROACTIVE: Monitoring Design

## Drift Detection

At every hop in the pipeline, quantities should match. When they don't,
something is broken.

| Source A | Source B | Drift means |
|----------|---------|-------------|
| Events ingested | Usage counter | Events lost or double-counted |
| Usage counter | Credit deductions | Charged but not processed, or vice versa |
| Credit deductions | Invoice line items | Internal correct, provider out of sync |
| Your total | Stripe total | Sync failure or unit conversion error |

**Thresholds:** Event count — alert when mismatch persists past aggregation
window (transient = batch in flight). Dollar amount — alert at >$1 OR >1%.
Lag — alert when newest usage counter event is >2x expected ingestion interval
behind event log.

## Webhook Monitoring

- 3+ consecutive delivery failures = problem (single failure is transient)
- Retry exhaustion (72h for Stripe) = permanent data loss. P2.
- Signature verification failure = security issue. P1 immediate.

## Credit Pool Health

- **Negative balance** = entitlement gate failed. Alert immediately.
- **Grant application failure** = partial write. Grant exists, balance didn't update.
- **Expiry processing delays** = batch job stalled.
- **FIFO violations** = newer grant consumed before older depleted.

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

## Usage Spike Classification

| Pattern | Likely cause | Action |
|---------|-------------|--------|
| Gradual increase over days | Legitimate growth | Monitor |
| 100x jump, single key, mechanical pattern | Runaway script or abuse | Throttle + alert CS |
| Spike correlates with deploy, affects multiple customers | System bug | Alert engineering |
| Spike with sequential idempotency keys | Replay bug | P1 |

Use 7-day rolling baseline by hour-of-day. Alert at 5x baseline.

## Alert Design

| Signal | Recipient | Severity |
|--------|-----------|----------|
| Negative credit balance | Engineering | P1 |
| Webhook retry exhaustion | Engineering | P2 |
| Meter-to-invoice drift > threshold | Billing ops | P2 |
| Reconciliation job failure | Engineering | P2 |
| Usage spike > 5x | CS + Engineering | P3 |
| Entitlement decision reversal | Engineering | P3 |
| Credit pool approaching zero | Customer success | P4 |

**Fatigue prevention:** Dedup by root cause (50 customers same drift = one
alert). Severity decay (P4 unresolved 7 days → P3, P3 unresolved 3 days → P2).

## Dashboard

**Primary (pipeline health):** Event throughput with 7-day overlay, drift
gauge (green/yellow/red), credit pool summary (active/warning/depleted),
open alerts by severity.

**Secondary (per-customer, on-demand):** Usage vs allowance, credit balance +
burn rate + run-out, last 3 invoices, entitlement check history.

---

# REACTIVE: Incident Investigation

## Event Tracing

Follow a specific event through every layer:

```
Event ingestion → Aggregation → Entitlement check → Credit debit → Invoice line item
```

At each hop: Did it arrive? Counted correctly? Entitlement check saw right
state? Credit deduction matches pricing rules? Reached the invoice at correct
unit price? Where input != output is the failure point.

## Timeline Reconstruction

Build chronological timeline with timestamps and state transitions. Example:

```
14:23:01Z  Batch 4891-4903 ingested (13 events)
14:23:01Z  Idempotency check: batch ID not in key
14:23:02Z  13 usage increments recorded
14:23:03Z  Webhook retry → same 13 re-ingested
14:23:03Z  Idempotency: PASS (different batch ID = different key)
14:23:04Z  13 MORE increments → 26 total (13 real)
ROOT CAUSE: Idempotency key missing batch ID
```

Gaps in the timeline are evidence.

## Common Failure Patterns

- **Double-counting** — idempotency key missing, too narrow, or bypassed. Look for duplicate keys or duplicate events with unique keys.
- **Missing events** — dropped during ingestion. Check dead letter queue, validation failures.
- **Stale entitlements** — cache not invalidated after plan change or credit grant. Compare cache TTL to state change timing.
- **Timezone misalignment** — events near period boundary land in wrong bucket. Compare event timestamp, aggregation window, invoice period.
- **Credit pool mismatch** — balance != sum of transactions. Replay ledger from first GRANT, find first divergence row.
- **Meter-to-provider mismatch** — usage forwarded late, not at all, or with wrong units. Your event log is source of truth, not Stripe.

## Ledger Forensics

1. Full replay from first GRANT. Sum every transaction.
2. Check `balanceAfter[N]` == `balanceBefore[N+1]`. Gap = missing transaction.
3. Find orphan transactions (DEDUCT without event, REVERSE without original).
4. Verify FIFO order (older grants consumed before newer).

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

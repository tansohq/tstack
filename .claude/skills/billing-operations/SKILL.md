---
name: billing-operations
version: 2.1.0
description: |
  Playbooks for account lifecycle and credit management. Upgrades, downgrades,
  cancellations, refunds, credit swaps, goodwill grants, manual adjustments,
  promotional campaigns, and expiry management.
triggers:
  - upgrade path
  - downgrade
  - cancellation flow
  - refund
  - credit swap
  - goodwill credit
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Billing Operations

Step-by-step playbooks for every billing action a support engineer or CS team
handles. Every playbook answers: what triggers this, who authorizes it, what
happens to credits/entitlements/invoices, and what the customer sees.

**Ledger principle:** Every credit adjustment is a debit AND a matching grant.
Never a direct balance edit. The append-only ledger is the audit trail.

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
- `.claude/artifacts/PLAN.md` — pricing tiers, plan structure
- `.claude/artifacts/ENFORCEMENT.md` — entitlement behavior, hard/soft limits
- `.claude/artifacts/CREDITS.md` — credit pools, grant types, FIFO, rollover
- `.claude/artifacts/INTEGRATION.md` — provider sync, proration behavior
- `.claude/artifacts/HIERARCHY.md` — account hierarchy, credit cascading

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

## Upgrades

**Immediate:** Prorate unused days on old plan as credit → charge prorated
new plan for remaining days → update entitlements → handle credits (keep
remaining, clawback + re-grant, or top-up to new level) → generate invoice
→ confirm to customer.

**End-of-cycle:** Schedule change → no proration → current entitlements until
switch → rollover rules apply at boundary → confirm effective date.

## Downgrades

Default: end-of-cycle. Customer keeps current features through paid period.

At switch: reset usage counter (don't carry over — punishes entitled usage).
Credit handling: clawback tier-specific credits, keep fungible ones. Data
retention: read-only access or 30-day grace for excess data.

## Cancellations

1. Capture reason (required — feeds product decisions)
2. Effective date = end of current period (they paid for it)
3. Grace period: 30 days standard, 90 enterprise. Data preserved, no access.
4. Credits: clawback plan-included. Purchased credits survive grace period.
5. Revoke entitlements. Complete in-flight requests at boundary.
6. Cancel subscription in provider.
7. Optional win-back offer — never block the cancellation.

## Refunds

| Type | When |
|------|------|
| Full | Billing error, outage, money-back guarantee |
| Prorated | Mid-cycle cancellation if policy allows |
| Credit-to-account | Goodwill, minor disputes, likely to continue |

**Authorization:** <$50 support agent, $50-500 lead, $500-5K finance,
>$5K executive. Set actual thresholds per product.

## Reactivation

Within grace period: restore data + fresh credit grant + new subscription
(don't reactivate old one). Past grace: data gone, start fresh. Pricing
options: honor old price (trust), current price (fair), or win-back discount
(incentive — but creates perverse churn incentive).

## Credit Swaps

Paired transactions with shared swap ID. Debit source pool, grant to
destination at defined exchange rate. FIFO applies within source. Cannot
swap purchased → promotional (loses "real money" protection). Minimum
swap amount to prevent ledger clutter.

## Goodwill Grants

**Authorization thresholds:**

| Amount | Approver |
|--------|----------|
| < 500 credits | CS agent |
| 500-5,000 | CS manager |
| 5,000-25,000 | Director |
| > 25,000 | Finance + executive |

Grant as PROMOTIONAL with 90-day expiry. Tie to ticket/incident ID as
idempotency key (prevents double-grants on retry). Tag for revenue reporting.

## Manual Adjustments

- **Double-charge:** REVERSE the duplicate transaction.
- **Missing grant:** GRANT with correct type + idempotency key matching the renewal event.
- **Wrong amount:** GRANT the difference, reference original.
- **Outage credit:** GRANT as PROMOTIONAL, amount = average hourly consumption × outage hours.

NEVER update or delete original transactions. Append-only.

## Promotional Campaigns

Define audience → set amount (fixed or % of plan credits) → set expiry
(30-90 days) → idempotency key `campaign-{id}-{customerId}` → batch
execute → track redemption rate, conversion rate, breakage rate.

## Credit Expiry

Notify at 30 days, 7 days, 1 day before. Batch job creates EXPIRE
transactions daily. One extension per grant (30 days), then firm.
Enterprise contracts override default policy.

## Audit Trail

Every operation must answer: **who** (customer, pool, grant), **what**
(transaction type, amount, balance before/after), **when** (UTC timestamp),
**why** (reason + ticket/incident ID), **approved by** (for manual ops).

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

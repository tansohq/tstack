---
name: entitlement-enforcement
version: 1.0.0
description: |
  Design real-time entitlement enforcement: check-before-consume, allow/deny,
  hard/soft limits, simulation, fail-open. Reads PLAN.md, writes ENFORCEMENT.md.
  Use when asked to "enforce entitlements", "gate access", "check before consume",
  "usage limits", or "allow deny logic".
triggers:
  - enforce entitlements
  - gate access
  - check before consume
  - usage limits
  - allow deny
  - entitlement check
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Entitlement Enforcement

You design the real-time allow/deny gate. This is the product. Not the invoice,
not the dashboard, not the pricing page — the moment the customer's application
asks "can my user do this?" and gets an answer in milliseconds.

One billing platform customer manages entitlements internally via webhooks
because Stripe can't do this. Stores entitlement state in their own system,
builds their own customer dashboard, exposes their own API. Would pay $20K/year
for someone else to do it. That's the product you're designing.

## What Makes This Not a Feature Flag

A feature flag is a boolean: on or off. An entitlement check is:
- **Quota-aware**: "You've used 847 of 1000 active devices this period."
- **Cost-aware**: "This event will cost $0.12 against your credit balance of $3.40."
- **Simulatable**: "If you did this, would you exceed your limit?" — answered
  without actually consuming anything.
- **Time-aware**: "Your plan resets in 3 days. You have 153 remaining."

One prospect called this "pre-transaction cost-aware logic." Another's reaction
to seeing it: "That's really nice... this is a big problem for SaaS."

Your system needs a simulation endpoint (Tanso exposes this as
`POST /api/v1/client/entitlements` with UsageContext). The customer can
dry-run "what if I consume 50 more units?" and get back
`wouldExceedLimit: true` without burning anything. No other billing
platform does this at the API layer.

## Inputs

Reads `.claude/artifacts/PLAN.md` — plan tiers, PlanFeatureRules, included
units, pricing model, credit model.

## Outputs

Writes `.claude/artifacts/ENFORCEMENT.md` with:

```yaml
entitlement_checks:
  - feature_key: <string>         # what's being gated
    check_point: <string>         # where in the flow: pre-event | post-event | both
    check_type: <string>          # boolean | metered | credit
    enforcement:
      limit_type: <string|null>   # hard | soft | none — DECISION REQUIRED
      at_limit_behavior: <string> # deny | allow_and_flag | allow_and_bill_overage
      grace: <string|null>        # grace period or buffer, if soft
    simulation:
      enabled: <boolean>
      dry_run_field: <string>     # maps to UsageContext.usageUnits
      response_fields:            # what the simulation returns
        - projected_usage
        - projected_remaining
        - would_exceed_limit
    fail_mode: <string>           # fail-open | fail-closed

    response_shape:
      allowed: <boolean>
      usage:
        used: <number>
        limit: <number>
        remaining: <number>
      credit:                     # if credit-backed
        balance: <number>
        denomination: <string>
        hard_limit: <boolean>
      reason: <string>            # why denied, if denied

check_sequence:                   # order of evaluation
  - step: <string>
    description: <string>
    on_fail: <string>             # deny | continue | flag
```

## How You Work

### Step 1: Identify what's being gated

Read PLAN.md. For each feature with a PlanFeatureRule, determine the check type:

- **Boolean**: feature is enabled or not. No usage tracking. Just `isEnabled`.
  Example: "Access to advanced analytics" — on in Growth, off in Starter.
- **Metered**: feature has a usage limit. Tracks used/limit/remaining.
  Example: "1000 active devices per month" — an IoT device management product.
- **Credit-backed**: feature consumes from a credit pool. Tracks balance.
  Example: "500 credits per month, each event costs 1-3 credits."

### Step 2: Define the check sequence

The entitlement check evaluates in order. Tanso's reference implementation
(its `ClientEntitlementServiceImpl.checkEntitlement()`) follows this sequence:

1. **Revocation check** — is the entitlement revoked? (instant deny)
2. **Usage limit check** — has cumulative usage exceeded max_usage?
3. **Credit hard limit check** — is credit balance <= 0 with hardLimit=true?
4. **Simulation** — if UsageContext provided, project what WOULD happen

This order matters. Revocation is cheapest to check (single boolean). Usage
requires aggregating events since period start. Credit requires querying the
pool. Check cheap things first.

### Step 3: Design limit behavior — STOP

This is the critical decision. For EVERY metered feature, surface:

### D1 — At-limit behavior

What's at stake: What happens when the customer hits their limit determines
whether they trust you. Different products, different answers. No default —
always ask.

Options:

A) Hard stop — deny at limit. Customer controls spend absolutely.
   Pro: No surprise bills. Predictable. Voice AI products want this — gate
        calls before they happen.
   Con: Customer's end-user hits a wall. If the product is customer-facing
        (voice AI answering phones), hard deny means a missed call.

B) Soft cap — allow overage, bill on next invoice.
   Pro: No service disruption. Common pattern — allow usage, reconcile later.
   Con: Surprise bill. Trust erosion if overages aren't communicated clearly.

C) Throttle — degrade service (rate limit, lower priority) rather than deny.
   Pro: Service continues, just slower. No surprise bill. No hard wall.
   Con: Degraded experience may frustrate users. Harder to implement per-feature.

D) Headroom — automatic 10-20% buffer above stated limit, hard stop at buffer edge.
   Pro: Absorbs spikes without customer action. Feels generous.
   Con: Actual limit is invisible to customer (they see 1000 but real cap is 1200).
        Creates confusion if they hit the real wall.

E) Over-at-discount — overage allowed at a lower per-unit rate (rewards volume).
   Pro: Incentivizes staying on platform vs switching. Heavy users feel rewarded.
   Con: Revenue per unit decreases at scale. Complicates invoice line items.

F) Flex-and-re-up — grace period on overage, then customer chooses: pay one-time
   for the overage or recommit at a higher tier.
   Pro: Converts overages into upsell conversations. Customer has agency.
   Con: Requires operational follow-up (sales/CS must act during grace period).
        Grace period length is another decision.

Present with the specific feature and customer context. "For a voice AI
answering inbound calls, hard stop means a caller hears silence. For a
data pipeline processing documents, hard stop means a job fails and retries
later — recoverable. For a PLG product growing users organically, flex-and-re-up
turns growth into upgrade conversations."

### D2 — Fail-open vs fail-closed

When the entitlement check itself errors (service timeout, DB down).

Default: **Fail-open.** Allow access, reconcile later. Standard for
usage products where blocking = lost revenue for the customer. The customer
chose your platform to run their business — if your gate goes down, you
shouldn't take their business down with it.

Override when: the gate protects something with compliance or security
implications (access to PII, regulated actions). Then fail-closed.

### Step 4: Design the simulation response

Your entitlement response should include these fields (modeled on Tanso's EntitlementResponse):

```
{
  "isAllowed": true,
  "usage": {
    "used": 847,
    "limit": 1000,
    "remaining": 153
  },
  "simulation": {
    "requestedUsage": 50,
    "projectedUsage": 897,
    "projectedRemaining": 103,
    "wouldExceedLimit": false
  },
  "credit": {
    "denomination": "CREDITS",
    "balance": 340.00,
    "totalGranted": 500.00,
    "totalConsumed": 160.00,
    "hardLimit": true
  }
}
```

The simulation response is what makes this not a feature flag. The customer
can make a decision based on projected state without consuming anything.

### Step 5: Define the check point

Where in the customer's flow does the check happen?

- **Pre-event** (most common): Check BEFORE the action. "Can this customer
  do this?" → yes/no. If no, don't start. If yes, proceed and record the
  event on completion.
  Tanso: `GET /api/v1/client/entitlements/{customerId}/{featureKey}`

- **Post-event with simulation**: Check BEFORE, but with a simulated usage
  amount. "If I consume 50 more units, will I exceed?" → `wouldExceedLimit`.
  Tanso: `POST /api/v1/client/entitlements` with UsageContext

- **Pre + post**: Check before to gate, record after to track. The
  entitlement check at pre-event uses `usageUnits: 0` (audit only). The
  event ingestion at post-event uses actual units.
  Tanso: GET (pre) + POST /api/v1/client/events (post)

## Decision Points — STOP and Ask

**D1 — At-limit behavior.** No default. Always surface per feature. See
Step 3 above.

**D2 — Fail mode.** Default fail-open. Surface for confirmation, override
for compliance/security contexts.

**D3 — Grace period.** If soft limit: how much overage is allowed before
hard cutoff? 10%? 20%? Unlimited until next billing cycle? This is a
business decision — it determines the maximum surprise bill.

**D4 — Notification thresholds.** At what usage percentage should the
customer be warned? 50%? 80%? 90%? Multiple? This affects customer trust
more than any pricing decision.

**D5 — Check latency budget.** How fast must the entitlement check respond?
The customer's application blocks on this call. For real-time applications
(voice AI, API gateways), this is <100ms. For batch processing, 500ms is
fine. This constrains the enforcement architecture (caching, read replicas).

## Anti-Patterns

- **Don't build a feature flag.** If the check is just `isEnabled: true/false`
  with no usage tracking, simulation, or cost awareness, the customer's
  engineer builds it in a day. The value is in the state: used/limit/remaining
  and the simulation projection.
- **Don't check after the fact.** Post-event-only enforcement means the
  customer already consumed the resource. You can't un-send an email or
  un-place a call. Check BEFORE, record AFTER.
- **Don't hide the limit.** The customer must see their usage, limit, and
  remaining in the API response. Opaque "denied" with no context is hostile.
  Billing platforms build internal customer dashboards specifically because
  Stripe doesn't surface this.
- **Don't skip simulation.** The `wouldExceedLimit` dry-run is the
  differentiator. Without it, the customer has to guess whether their next
  batch will exceed — and guessing wrong means either a blocked job or a
  surprise bill.

## Tanso Reference Architecture

Your system needs equivalents of these. Tanso's names for reference:

- Check + simulate endpoint — Tanso: `POST /api/v1/client/entitlements` (with UsageContext)
- Check-only endpoint — Tanso: `GET /api/v1/client/entitlements/{customerId}/{featureKey}`
- Evaluation request — Tanso: `EntitlementEvaluationRequest` (customerReferenceId, featureKey, UsageContext)
- Evaluation response — Tanso: `EntitlementResponse` (isAllowed, usage, simulation, credit)
- Simulation context — Tanso: `UsageContext` (eventName, usageUnits, meta)
- Evaluation sequence — Tanso: `ClientEntitlementServiceImpl.checkEntitlement()` (revocation -> usage -> credit -> simulation)
- Limit check — Tanso: `RuleCalculationUtil.isMaxUsageExceeded()`
- Included units — Tanso: `PlanFeatureRule.value.pricing.max_usage`
- Hard limit flag — Tanso: `CreditPool.hardLimit` (zero-balance blocks access when true)

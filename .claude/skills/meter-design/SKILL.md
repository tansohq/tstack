---
name: meter-design
description: |
  Design the billing unit and event schema for a usage-based product. Defines
  what to meter, event shape, aggregation, and reset cadence. Writes METER.md.
  Use when asked to "define the meter", "what's the billing unit", "event
  schema", or "what do we track".
triggers:
  - define the meter
  - billing unit
  - event schema
  - what do we track
  - metering design
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Meter Design

You define what to count. The billing unit is the atomic event that the
entitlement check gates on — the thing you allow or deny in real-time. Getting
this wrong means enforcement, credits, and reconciliation are built on the
wrong foundation.

## Why This Is Hard

The billing unit is never obvious. Three patterns from real prospects:

**No natural unit (B2B2G product):** Three candidate events — data movement,
document analysis, RFP generation. Private-sector billing to consultancies has
"no natural unit." The billing unit had to be invented, not discovered.

**Granularity mismatch (IoT device management):** Billing on monthly active
devices, but need daily active devices for accuracy. "Weekly skipped due to
backend cost." The billing unit exists but the aggregation window is wrong —
too coarse to be accurate, too fine to be affordable. Entitlements managed
internally via webhooks because Stripe can't enforce in real-time.

**Compound events (Voice AI):** A phone call is start + token events + end,
grouped by `flow_id`. The entitlement check gates at call-start; the usage
event fires at call-end.

## Inputs

None — this is the first skill in the chain. Takes a product description.

## Outputs

Writes `.claude/artifacts/METER.md` with:

```yaml
billing_unit:
  name: <string>              # e.g., "active_device", "outreach_sequence"
  description: <string>       # what the entitlement check gates on
  granularity: <string>       # per-event | per-session | per-period

events:
  - event_name: <string>      # maps to EventIngestionRequest.eventName
    usage_units: <string>     # what usageUnits represents
    grouping_key: <string|null>  # flow_id equivalent for compound events
    pass_through_cost:        # what this event costs — feeds credit deduction
      - name: <string>        #   and cost-aware entitlement gating
        unit: <string>
        source: <string>
    properties:               # metadata sent with event
      - name: <string>
        type: <string>
        purpose: <string>

aggregation:
  window: <string>            # hourly | daily | monthly | per-billing-period
  method: <string>            # count | sum | max | unique
  reset_mode: <string>        # reset (per-period) | accumulate (lifetime)

idempotency:
  key_pattern: <string>       # how to construct EventIngestionRequest.idempotencyKey
  dedup_window: <string>      # how long to check for dupes
```

## How You Work

### Step 1: Find the billing unit

Ask: "What action does your customer's entitlement gate on? What do you need
to allow or deny in real-time?" Then probe:

- Is it a single event or a session/compound event?
- Does one event map to one entitlement decrement, or do you aggregate first?
- What's the limit they hit? (count, threshold, boolean access)

If the answer is generic ("API call", "request", "transaction"), push:
"Which request specifically? What's the action you'd block if they exceeded
their plan?"

### Step 2: Design the event shape

Map to Tanso's EventIngestionRequest:
- `eventName` — the meter name
- `usageUnits` — the quantity (1 for count-based, duration/tokens/bytes for measurement)
- `idempotencyKey` — dedup key (critical: double-counting usage = double-billing)
- `meta` — cost-relevant properties (model name, region, file size)

For compound events (like voice AI phone calls), define:
- A grouping key (`flow_id`) that ties sub-events into one billable unit
- Which sub-event carries the usage units (usually the end event with final tallies)
- How cost rolls up across sub-events

### Step 3: Choose aggregation

This is where founders get it wrong. Three patterns:

- **Per-event billing** (voice AI): each call is billed individually. Simple,
  but invoice line items grow with usage.
- **Per-period aggregation** (IoT devices): sum usage across window, bill once.
  Simpler invoicing, but the window choice (daily vs monthly) affects accuracy.
- **Threshold-based** (B2B2G): count until threshold, then bill differently.
  Requires tracking cumulative usage.

### Step 4: Define reset cadence

Maps to PlanFeatureRule's `reset_mode`:
- `reset` — counter resets at period boundary (monthly, annual). Most SaaS.
- `accumulate` — counter grows forever. Lifetime usage. Rarer but needed for
  prepaid credit pools.

## Decision Points — STOP and Ask

**D0 — The billing unit itself.** This is the highest-stakes decision in the
entire chain. Everything downstream — pricing, enforcement, credits,
reconciliation — inherits it. ALWAYS surface this as a decision, even when one
option looks obvious. Present every plausible unit with:
- What it correlates with (customer value? your cost? both?)
- Margin variance: does cost-per-unit vary wildly? (e.g., per-call hides
  duration variance; per-minute exposes it)
- Customer comprehension: can the buyer reason about their bill in this unit?
- Cost guard implications: if the unit masks cost variance, what cap or
  weighting mechanism protects margin?

**Default: per-event with cost weighting** when the entitlement gate is
per-event (check happens before you know duration/cost), cost varies
significantly within one event type, and the customer reasons about their plan
in events not cost-units. The billing unit should be the value unit (what the
customer understands), not the cost unit (what your infra charges you). Cost
weighting (long/expensive event = N units) protects margin without making the
customer think in tokens or minutes. Override when cost variance within one
event is small (90%+ events cluster in a narrow cost band) — then flat
per-event without weighting is simpler.

Example (AI SDR): per-email-sequence vs per-lead vs per-reply. Per-sequence =
one outreach campaign to a prospect (3-5 emails + follow-ups). Per-lead = each
contact researched and added. Per-reply = outcome-based, only pay when the
prospect responds. Each correlates differently with cost (LLM tokens for
personalization, enrichment API calls per lead, email sends per sequence) and
value (reply = meeting booked). STOP and present all with the margin and
comprehension tradeoffs.

**D1 — Multiple candidate billing units.** When a product has more than one
plausible event to bill on (e.g., data movement, doc analysis, RFP generation),
STOP. Present each with cost implications.

**D2 — Aggregation window.** When the "right" window isn't obvious (e.g.,
monthly-vs-daily tradeoff for device counting), STOP. Present accuracy vs cost
tradeoff.

**D3 — Compound vs simple event.** When it's unclear whether to bill the
session or the sub-events (phone call vs individual token events), STOP.
Present both with reconciliation implications.

**D4 — Reset mode.** When it could go either way (monthly reset vs lifetime
accumulate), STOP. This determines whether PLAN.md uses period limits or
lifetime limits.

**D5 — Unit weighting.** When cost-per-event varies significantly within one
event type, STOP. Present whether the billing unit should be weighted (long/
complex event = N units) or flat. This affects entitlement limit math — a
customer with "200 included" burns through faster with weighted units.

**D6 — Failed/incomplete event disposition.** When events can fail or be
trivial (misdial, dropped connection, bounced email), STOP. Present:
- Which dispositions decrement the entitlement limit
- Minimum threshold for a countable event
- Default: non-billable if the event fails before delivering value
  (bounced email, sub-15-second call). Billable once value delivery starts.

Use the decision format from /monetization-engineer:

```
D<N> — <one-line question>

What's at stake: <one sentence>

Options:

A) <option>
   Pro: <concrete>
   Con: <concrete>

B) <option>
   Pro: <concrete>
   Con: <concrete>

My lean: <which and why, OR "no lean">
```

## Anti-Patterns

- **Don't meter without cost.** If you don't know the pass-through cost of
  an event, the entitlement check can't be cost-aware — it's just a counter.
  That's a feature flag, not an entitlement system.
- **Don't skip idempotency.** Every event needs a dedup key. Double-counted
  usage = double-billing = trust-destroying. Common Stripe pain: events
  double-fire and invoices come out wrong.
- **Don't conflate billing unit with feature.** "Access to analytics" is a
  feature (boolean entitlement). "Number of reports generated" is a billing
  unit (metered entitlement). They're different PlanFeatureRule types.
- **Don't over-meter.** Track what the entitlement check needs. Everything
  else is analytics, not metering.

## Tanso Primitives

- `EventIngestionRequest` — eventName, usageUnits, idempotencyKey, meta, timestamp
- `POST /api/v1/client/events` — ingestion endpoint with X-Idempotency-Key header dedup
- `PlanFeatureRule.value.pricing.reset_mode` — "reset" | "accumulate"
- `PlanFeatureRule.value.pricing.usage_unit_type` — what units represent

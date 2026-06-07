---
name: provider-integration
version: 2.1.0
description: |
  Design provider-agnostic integration layer sitting on top of Stripe/Paddle/etc.
  Reads all upstream artifacts, writes INTEGRATION.md. Use when asked to "integrate
  with Stripe", "provider sync", "payment provider", or "billing integration".
triggers:
  - integrate with Stripe
  - provider sync
  - payment provider
  - billing integration
  - Stripe sync
  - Paddle integration
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Provider Integration

You design the layer between your entitlement system and the payment provider
(Stripe, Paddle, etc.). Your system is the "system of action" — real-time
entitlement checks, credit management, usage tracking. The provider is the
"system of record" — invoices, payments, subscriptions, tax.

Billing platform operators view Stripe as a good system of record but believe
third-party tools are better as a "system of action" for complex cases.
Prospects consistently reject building their own settlement layer — they don't
want to become a Stripe.

## The Boundary

Your system owns:
- Entitlement checks (real-time allow/deny)
- Credit pools and ledger
- Usage event ingestion and aggregation
- Meter definitions and pricing rules

The provider owns:
- Payment collection (cards, invoices, ACH)
- Subscription lifecycle (create, upgrade, cancel, renew)
- Tax calculation
- Dunning and retry logic
- Compliance (PCI, receipts, tax remittance)

The integration syncs between them. Not a replacement — a layer on top.

## Inputs

Reads all upstream artifacts:
- `.claude/artifacts/METER.md` — what events to forward as usage
- `.claude/artifacts/PLAN.md` — plan/price structure to sync
- `.claude/artifacts/ENFORCEMENT.md` — subscription state triggers
- `.claude/artifacts/CREDITS.md` — credit purchases via invoice
- `.claude/artifacts/RECONCILIATION.md` — invoice tie-out requirements

## Outputs

Writes `.claude/artifacts/INTEGRATION.md` with:

```yaml
provider:
  name: <string>                  # Stripe | Paddle | generic
  role: system_of_record
  your_role: system_of_action

sync_operations:
  system_to_provider:
    - operation: <string>         # e.g., "forward_usage_to_meter"
      trigger: <string>           # when this fires
      data_flow: <string>         # what gets sent
      timing: <string>            # sync | async | batch
      failure_mode: <string>      # retry | queue | alert

  provider_to_system:
    - operation: <string>         # e.g., "subscription_created"
      trigger: <string>           # webhook event
      data_flow: <string>         # what gets processed
      side_effects: <string>      # what your system does (create entitlements, grant credits)

webhook_handling:
  idempotency: <string>           # how to dedup webhook retries
  ordering: <string>              # how to handle out-of-order webhooks
  failure_mode: <string>          # retry | dead-letter | alert

abstraction_layer:
  provider_agnostic: <boolean>
  swap_cost: <string>             # what it takes to switch providers
```

## How You Work

### Step 1: Map the sync directions

Two directions, different concerns:

**Your system → Provider** (push usage, sync plans):
- Forward usage events as Stripe meter events
- Create/update Stripe products and prices when plans change
- Create Stripe subscriptions when customers activate

**Provider → Your system** (ingest state changes):
- Subscription created → create entitlements, grant credits
- Subscription cancelled → revoke entitlements, clawback credits
- Invoice paid → mark credits as purchased
- Payment failed → freeze credit pool (optional)

### Step 2: Design the forwarding

For usage-based billing on Stripe, events must be forwarded to Stripe meters
so invoices are accurate. Without forwarding, Stripe creates $0 draft invoices
because usage data hasn't arrived yet.

Key question: **when** to forward?

- **Real-time** (forward each event immediately): Most accurate. Stripe invoice
  always reflects current usage. But adds latency to event ingestion.
- **Batch** (forward accumulated usage periodically): Lower integration cost.
  But Stripe invoice is stale between batches.
- **At invoice time** (forward final totals before invoice finalizes): Most
  efficient. But requires hooking into Stripe's invoice lifecycle.

### Step 3: Design webhook handling

Provider webhooks are the primary integration vector. They fire on
subscription changes, payment events, invoice lifecycle. Three problems:

1. **Retries**: Webhooks fire multiple times. Without idempotency, you double-
   grant credits or double-create entitlements. Use the webhook event ID as
   idempotency key.

2. **Ordering**: Webhooks can arrive out of order. `subscription.updated` might
   arrive before `subscription.created`. Design for eventual consistency —
   process what you can, queue what you can't.

3. **Failure**: If your handler errors, the webhook retries. But if your handler
   partially succeeds (created entitlement but failed to grant credits), retry
   creates a duplicate entitlement. Make handlers transactional or idempotent.

### Step 4: Design the abstraction

The integration should be provider-swappable without changing your core system.
Tanso's reference architecture uses a `StripeSyncService` that encapsulates
Stripe-specific logic behind an interface. Model yours similarly — extending
to Paddle/other means implementing the same interface.

Key abstraction points:
- `createSubscription()` — doesn't know which provider
- `forwardUsage()` — doesn't know if it's a Stripe meter or Paddle event
- `handleWebhook()` — routes by provider, normalizes into Tanso events

## Decision Points — STOP and Ask

**D0 — Capability ownership.** Before designing the integration, surface
what the developer wants to own vs delegate to Stripe. For each billing
capability, ask: Stripe-native, self-build, or hybrid?

| Capability              | Stripe-native viable? | Self-build reason           |
|-------------------------|----------------------|-----------------------------|
| Metering/event ingest   | Stripe Meters exist  | Need dedup, cost-awareness  |
| Entitlement checks      | Stripe Entitlements  | Need real-time, simulation  |
| Credits/prepaid pools   | No native support    | Dollar credits, FIFO, expiry|
| Flat+usage pricing      | Partial (not checkout)| Combined invoice lines     |
| Invoicing               | Yes                  | Rarely worth self-building  |
| Checkout/payment links  | Yes                  | Rarely worth self-building  |
| Customer usage dashboard| No                   | Always self-build           |
| Minimum spend/true-up   | No                   | Always self-build           |

No default — this is the most context-dependent decision in the chain.
The answer depends on vendor trust ("our C-level got burned by a billing
startup"), engineering bandwidth, and pricing complexity. Some developers
want Stripe's full stack with just an entitlement layer on top. Others
want to own the whole billing pipeline. Ask before assuming.

Verify: Check Stripe's current Meters and Entitlements APIs before
marking any row "no native support." Stripe ships fast.

**D1 — Usage forwarding timing.**

Options:

A) Real-time (forward each event to provider immediately)
   Pro: Invoice always accurate. No reconciliation gap.
   Con: Adds ~100-200ms to event ingestion. Provider rate limits.

B) Batch (forward every N minutes or events)
   Pro: Efficient. Handles rate limits naturally.
   Con: Invoice stale between batches. The $0-draft problem.

C) At invoice finalization (forward totals before Stripe finalizes)
   Pro: One sync per invoice period. Most efficient.
   Con: Requires hooking Stripe's `invoice.upcoming` webhook.

Default: **At invoice finalization** for v1. Forward aggregated usage
when Stripe signals invoice is about to finalize (`invoice.upcoming` webhook).
Simplest integration, avoids rate limits, solves the $0-draft problem.
Override toward real-time when the customer needs live Stripe dashboard
accuracy (rare — most customers use your dashboard instead).

**D2 — Provider abstraction depth.**

Options:

A) Full abstraction (provider interface, swap any time)
   Pro: Provider-agnostic. Can switch Stripe→Paddle without touching your core.
   Con: Up-front engineering cost. May abstract things that never get swapped.

B) Stripe-first, abstract later
   Pro: Ship faster. 90% of customers are on Stripe.
   Con: Stripe assumptions leak into the core. Painful to abstract later.

Default: **Stripe-first with clean boundaries.** Use StripeSyncService
as the boundary. Don't build a generic ProviderInterface until the second
provider is actually needed. But keep Stripe types out of your core domain
(no `StripeSubscription` in the entitlement service).

**D3 — Webhook failure handling.**

Options:

A) Transactional (all-or-nothing per webhook)
   Pro: No partial state. Clean rollback on failure.
   Con: One failing step blocks the entire webhook processing.

B) Idempotent retry (each step is independently retriable)
   Pro: Partial progress is kept. Only failed step retries.
   Con: Must design every step for idempotency. More complex.

Default: **Idempotent retry.** Each side effect (create entitlement,
grant credits, update subscription state) has its own idempotency key derived
from the webhook event ID + step name. Partial failures are resumable.

## Anti-Patterns

- **Don't let the provider drive your domain model.** Stripe's data model
  (products, prices, subscriptions) is not your data model (plans, features,
  entitlements). Map between them at the boundary. Don't force your internal
  model to match Stripe's.
- **Don't duplicate state.** Your system is the source of truth for entitlements.
  Stripe is the source of truth for payments. Don't store payment state in
  your entitlement system or entitlement state in Stripe. Sync, don't mirror.
- **Don't build your own settlement.** Don't become a Stripe. Use the provider
  for what it's good at (collecting money) and own what it's bad at (real-time
  entitlement enforcement).
- **Don't skip webhook idempotency.** Stripe fires webhooks multiple times.
  Without dedup, you'll double-grant credits on every retry. This is exactly
  how billing teams end up tracking revenue in Google Sheets.
- **Don't void+regenerate invoices.** Voiding Stripe invoices messes up RevRec.
  Prefer adjustments on the next invoice over void+regenerate cycles.

## Tanso Reference Architecture

Your system needs equivalents of these. Tanso's names for reference:

- Provider sync service — Tanso: `StripeSyncService` (interface for all Stripe operations)
- Plan sync — Tanso: `StripeSyncService.createStripeProductWithPrices()`
- Subscription create — Tanso: `StripeSyncService.createStripeSubscription()`
- Meter create — Tanso: `StripeSyncService.createStripeMeter()`
- Usage forwarding — Tanso: `StripeSyncService.forwardUsageToStripeMeter()`
- Upgrade handling — Tanso: `StripeSyncService.updateStripeSubscriptionPrice()`
- Cancellation sync — Tanso: `StripeSyncService.cancelStripeSubscription()`
- Webhook: grant credits — Tanso: `CreditService.processCreditGrantsForSubscription()`
- Webhook: clawback on cancel — Tanso: `CreditService.clawBackPlanIncludedCredits()`

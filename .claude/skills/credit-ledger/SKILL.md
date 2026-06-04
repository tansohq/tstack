---
name: credit-ledger
version: 1.0.0
description: |
  Design credit pools, grants, FIFO consumption, rollover, and the append-only
  ledger. Reads PLAN.md + ENFORCEMENT.md, writes CREDITS.md. Use when asked to
  "design credits", "credit system", "prepaid balance", "grant credits", or
  "credit ledger".
triggers:
  - design credits
  - credit system
  - prepaid balance
  - grant credits
  - credit ledger
  - credit pool
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Credit Ledger

You design the credit system that backs cost-aware entitlement enforcement.
Credits are what make the entitlement check more than a counter — they let
the gate answer "can this customer afford this event?" not just "have they
used too many?"

## When Credits Apply (and When They Don't)

Credits are NOT always the right answer. Use them when:

- **The billing unit's cost varies per event.** If every event costs the same,
  a simple counter (used/limit/remaining) is sufficient. Credits matter when
  event A costs 1 credit and event B costs 5, because the underlying cost
  differs.
- **The customer prepays.** Monthly credit grants included in a plan, purchased
  top-ups, promotional credits. The balance is the entitlement.
- **You need denomination flexibility.** "Tokens," "credits," "compute units" —
  an abstraction layer between raw cost and customer-facing units.

Don't use credits when:
- Every event costs the same (just count events against a limit)
- The product is purely boolean (feature on/off)
- The customer has unlimited access within their tier

Common pain: "Crediting is manual because Stripe only supports usage events,
not dollar-based events." Customers need dollar-value credits applied against
usage — Stripe can't represent this, so it's all manual.

## Inputs

Reads:
- `.claude/artifacts/PLAN.md` — pricing model, whether credits are used, denomination
- `.claude/artifacts/ENFORCEMENT.md` — how the entitlement check uses credit balance

## Outputs

Writes `.claude/artifacts/CREDITS.md` with:

```yaml
credit_architecture:
  denomination_model: <string>   # CURRENCY | UNIVERSAL_ABSTRACT | PRODUCT_SPECIFIC
  scoping: <string>              # ACCOUNT | CONTRACT | BLOCK
  burn_rate_table:               # only for UNIVERSAL_ABSTRACT
    - product: <string>
      credits_per_unit: <number>

credit_pools:
  - pool_name: <string>
    denomination: <string>       # CREDITS | TOKENS | COMPUTE_UNITS | custom
    hard_limit: <boolean|null>   # from D1 in enforcement — zero balance blocks?
    rollover_policy: <string>    # NONE | FULL | CAPPED
    rollover_cap: <number|null>  # max rollover if CAPPED
    status_lifecycle:            # ACTIVE → FROZEN → DEPLETED → ARCHIVED
      - ACTIVE
      - FROZEN
      - DEPLETED
      - ARCHIVED

grants:
  - grant_type: <string>        # PLAN_INCLUDED | PURCHASED | PROMOTIONAL
    amount: <number>
    frequency: <string>          # per-billing-period | one-time | on-activation
    expires_months: <number|null>  # null = never expires
    conditions: <string>         # when this grant fires

consumption:
  order: FIFO                    # oldest grant consumed first
  deduction_trigger: <string>   # post-event (after event recorded)
  cost_per_event: <string>      # fixed | variable (from event properties)
  concurrency: <string>         # optimistic locking (CreditPool.version)

ledger:
  append_only: true
  transaction_types:
    - GRANT
    - DEDUCT
    - EXPIRE
    - REVERSE
  fields_per_entry:
    - amount
    - balance_before
    - balance_after
    - idempotency_key
    - reversed_transaction_id   # for REVERSE entries
  immutability: "Records never updated or deleted. Undoing = REVERSE entry."

cs_operations:
  transfer_enabled: <boolean>    # only for PRODUCT_SPECIFIC
  approval_required: <boolean>
  notes: "Transfers emit linked DEDUCT+GRANT with shared transfer_id. Not a new transaction type."
```

## How You Work

### Step 1: Determine if credits are needed

Read PLAN.md. If `credit_model: null`, credits don't apply — skip this skill.
If credits are specified, proceed.

Key question: does the entitlement check need to answer "can this customer
AFFORD this event?" or just "have they USED too many?" If the former, credits.
If the latter, simple metering is sufficient.

### Step 1.5: Choose the credit model

Before designing the pool, determine the denomination model. This choice has
massive downstream consequences — it determines whether CS will ever need to
transfer credits between pools, how multi-product pricing works, and how
complex reconciliation becomes.

Three real models exist. A fourth (siloed pools with exchange rates between
them) is theoretically possible but no vendor ships it — it's complexity
without benefit over the universal model.

**Currency-denominated** (1 credit = $0.01)
Examples: Twilio, OpenAI, Anthropic, Vercel.
One USD balance, different products consume at different dollar rates.
Pro: Transparent. No transfer problem — it's money. Rate card changes are
just price updates. Customer knows exactly what things cost.
Con: No value abstraction. Price changes are visible and feel like increases.
Ugly fractional numbers at sub-cent costs.

**Universal abstract + burn-rate multiplier table** (1 credit = 1 abstract unit)
Examples: Snowflake (warehouse sizes burn 1-512 credits/hr), Databricks DBU,
ElevenLabs (post-reunification), Zapier tasks.
One pool of abstract credits. A multiplier table defines how many credits each
product/action consumes. New products = new row in the table.
Pro: One pool, multiple products. Pricing surgery via weight changes
(pricing-model D6) is invisible — "image generation now costs 3 credits
instead of 2." Best for multi-product.
Con: Customer confusion ("how many credits do I need?"). Multiplier changes
are silent price changes.
Cautionary tale: ElevenLabs tried product-specific pools (Jan 2025), reversed
to universal within 7 months. Forecasting pain across separate balances killed it.

**Product-specific siloed pools** (each product has its own credit type)
Examples: PDL (person credits, company credits, IP credits), pre-acquisition Clearbit.
Separate pools per product. Each pool has its own balance, grants, consumption.
Pro: Clean isolation when products have genuinely incompatible value units.
Con: Creates the transfer problem. CS will ask to move credits between pools
for retention. Stranded balances when customer over-buys one type. Forecast
pain. If you need TRANSFER frequently, you chose the wrong model.

Note: 79 SaaS companies now use credit-based pricing (up 126% YoY per
PricingSaaS). This is the dominant trend in AI billing.

See D5 for the decision point.

### Step 2: Design the pool

A CreditPool holds a balance denominated in a unit. One customer can have
multiple pools (different denominations or purposes). Design choices:

- **Denomination**: What does "1 credit" represent? Abstract (1 credit = some
  unit of value) or concrete (1 credit = $0.01)?
- **Hard limit**: When balance hits zero, does the entitlement check deny?
  (Inherits from ENFORCEMENT.md D1 — hard vs soft limit.)
- **Rollover**: Do unused credits persist to the next billing period?

### Step 3: Design grants

Grants add credits to the pool. Three types map to different business events:

- **PLAN_INCLUDED**: Credits granted on subscription activation or period
  renewal. "Your Growth plan includes 1000 credits per month."
  Maps to: `PlanCreditAllocation.creditAmount` + `grantExpiresMonths`
- **PURCHASED**: Customer buys additional credits via invoice.
  Maps to: `CreditGrant.grantType = PURCHASED`, linked to invoice
- **PROMOTIONAL**: One-time grants for trials, apologies, incentives.
  Maps to: `CreditGrant.grantType = PROMOTIONAL`, usually with expiry

### Step 4: Design consumption

**FIFO** — oldest grant consumed first. This is non-negotiable (Tanso's
reference: `CreditGrant.remaining` decremented in creation order). FIFO
ensures expiring grants get used before non-expiring ones.

**Deduction trigger** — post-event. The entitlement check (pre-event) verifies
the balance is sufficient. The event ingestion (post-event) actually deducts.
This two-step ensures cost is only incurred on completed events.

**Concurrency** — `CreditPool.version` (optimistic locking). Two simultaneous
events for the same customer: both read balance, both try to deduct. Version
field ensures one wins and the other retries. No double-spend.

### Step 5: Design the ledger

The append-only ledger (`CreditTransaction`) is the audit trail. Every balance
change is a new row. Never update, never delete. To undo a transaction, create
a REVERSE entry pointing to the original via `reversedTransactionId`.

This is what makes reconciliation possible — you can reconstruct the balance
at any point in time by replaying the ledger from the beginning.

## Decision Points — STOP and Ask

**D1 — Rollover policy.** Unused credits at period end.

Options:

A) NONE (expire at period end)
   Pro: Clean slate each period. Predictable credit economics.
   Con: "Use it or lose it" feels punitive. Customer resentment.

B) FULL (all unused credits roll over)
   Pro: Customer-friendly. Credits never wasted.
   Con: Balance accumulates forever. Accounting liability grows.

C) CAPPED (roll over up to N credits)
   Pro: Compromise — customer keeps some, liability is bounded.
   Con: Another number to decide (what's the cap?).
   Implementation: Store rolled-over credits as a separate grant (type:
   ROLLOVER), not merged into the new period's PLAN_INCLUDED grant. Keeps
   unit price calculations clean. Rollover grants never drive unit price —
   they are free balance carried forward, not purchased units.
   On cancellation: rollover does not apply. No rollover on termination.

Default: **CAPPED** for plan-included credits. Full rollover creates
unbounded liability. No rollover punishes customers. Cap at 1x the monthly
grant (if you get 1000/month, cap rollover at 1000). Override when the product
has no periodic grants (purchased credits should never expire unless explicitly
time-limited).

**D2 — Expiration window.** How long do grants last?

Options depend on grant type:
- PLAN_INCLUDED: expire at end of billing period (or rollover per D1)
- PURCHASED: never expire (customer paid real money)
- PROMOTIONAL: expire in 30-90 days (time-limited by nature)

Default: Purchased credits never expire. Plan-included follow D1.
Promotional expire in 90 days. Override when contractual terms specify otherwise.

**D3 — Hard limit threshold.** When `hardLimit: true`, does denial happen at
exactly zero, or at a threshold (e.g., balance < cost of cheapest possible event)?

Default: Deny when `balance < estimated_cost_of_next_event`. Not at zero —
at zero the customer can't do anything, but at $0.03 remaining they also can't
do anything if every event costs $0.05. The threshold should be the minimum
event cost, not zero.

**D4 — Credit denomination.** What's the exchange rate between credits and
real cost?

Options:

A) 1:1 with currency (1 credit = $0.01)
   Pro: Transparent. Customer knows exactly what things cost.
   Con: Prices are ugly numbers. "This event costs 3.7 credits."

B) Abstract units (1 credit = 1 unit of value, priced by you)
   Pro: Clean numbers. "This event costs 1 credit." Pricing flexibility.
   Con: Customer can't easily convert credits to dollars. Opaque.

No default — depends on whether the product's pricing is transparent
(developer-facing APIs usually are) or abstracted (consumer products often are).

Note on theory vs practice: value-based credit weights (1 credit = 1 unit of
customer value delivered) are prescribed as the correct approach. In practice,
most companies in production use cost-based weights (1 credit = proportional to
your cost to serve). The gap is wide. Either the market hasn't caught up to the
theory, or the analysis required to establish value-based weights exceeds what
early-stage companies can resource. Probably both. Don't let the ideal block
shipping — cost-based weights that you adjust over time are a valid starting
position.

**D5 — Credit model.** Which denomination model? See Step 1.5 above.

Options:
A) Currency-denominated (Twilio/OpenAI)
B) Universal abstract + burn-rate multiplier table (Snowflake/ElevenLabs)
C) Product-specific siloed pools (PDL)

No default — depends on whether the product is single-product or multi-product
and whether value units are commensurable. Single product with stable cost →
currency-denominated. Multi-product → universal abstract. Genuinely
incompatible value units AND you accept the CS pain → siloed pools.

**D6 — Credit scoping.** WHERE does the pool live? Orthogonal to D5 (what
it's denominated in).

Options:

A) Account-level pool (one pool per customer, fungible across all usage)
   Pro: Simple. Works for self-serve/PLG. One balance to check.
   Con: Loses deal tracking at enterprise scale. Discounted credits from one
   deal subsidize another product's low margin. Rev-rec under ASC 606 gets murky.

B) Contract/line-item-scoped pools (pool tied to a specific deal or product line)
   Pro: Per-deal rates preserved. Margin management across products. Clean rev-rec.
   Con: More complex. Multiple active pools per customer.

C) Block-based (account-level wallet, grants carry origin metadata)
   Pro: Compromise — simple single balance, but grants track which contract
   they came from for rev-rec.
   Con: FIFO consumption may not respect contract boundaries.

Default: Account-level for v1. Upgrade to contract-scoped when per-deal
discount rates or multi-product margins emerge. Metronome recommends supporting
both simultaneously.

Cross-reference: if account hierarchy exists (see `/account-hierarchy`), credit
scoping is the billing/contract axis; hierarchy is the organizational axis
(org → team → key). A system may need both.

## CS Operations

Operational transactions built on top of the existing ledger primitives
(GRANT/DEDUCT/EXPIRE/REVERSE). These are application-layer conveniences,
not new ledger transaction types.

**Transfer (between pools):** CS moves credits from one pool to another for
customer retention or to correct a forecast miss. Emits a linked DEDUCT from
source pool + GRANT to destination pool, sharing a `transfer_id` in metadata.
Both entries are standard ledger rows — auditable, reversible, reconcilable.
Requires approval workflow. Only relevant for product-specific pools (D5
option C).

**Adjustment (billing error correction):** REVERSE the incorrect entry + new
GRANT or DEDUCT with reason code and approval chain. Already supported by the
existing ledger schema. Standard across all billing platforms.

**Rebalance (forecast correction):** Model as a contract amendment with
associated credit adjustments, not a distinct operation. The contract changes
(new allocation), the ledger reflects it (GRANT for the new amount, EXPIRE
for the old unused portion).

Anti-pattern: if CS is doing transfers weekly, the credit model is wrong.
Universal credits with burn multipliers eliminate the need entirely.

## Anti-Patterns

- **Don't allow negative balances.** If hardLimit=true, the entitlement check
  must deny before balance goes negative. A negative balance means the gate
  failed.
- **Don't mutate ledger entries.** The append-only invariant is what makes
  reconciliation trustworthy. If you need to "fix" a transaction, create a
  REVERSE and a new GRANT/DEDUCT.
- **Don't skip idempotency on grants.** `CreditGrant.idempotencyKey` prevents
  double-grants from webhook retries. Stripe webhooks fire multiple times —
  without dedup, the customer gets 2x credits.
- **Don't FIFO across pools.** FIFO is within a single pool. If a customer has
  two pools (different denominations), each has its own FIFO order. Don't mix.
- **Don't expire purchased credits.** Customer paid real money. Expiring
  purchased credits is a trust violation. Only expire promotional and
  plan-included grants.
- **Failed events must not consume credits.** The deduction trigger is output,
  not input. If the action the customer initiated fails (API error, timeout,
  downstream rejection), no credits are deducted. The customer pays for
  successful outcomes, not attempts. This is the leading cause of trust failure
  in credit-based pricing — charging for something that didn't work. Non-negotiable.
- **Non-expiring credits create unbounded deferred revenue liability.** This
  isn't a preference — it's an accounting reality. Every unspent credit sits
  as a liability on the balance sheet. The question is how long (capped rollover
  vs hard expiry), not whether to bound it. Purchased credits feel like they
  "should" never expire, but even they need a contractual window (12-24 months)
  or the liability grows without bound.
- **Don't sync promotional/comp credits as revenue.** Promotional credits
  reduce the invoice total (Stripe supports `category=promotional` — they DO
  flow through the processor). But they are not revenue. Under ASC 606:
  promotional credits reduce transaction price, service credits reduce revenue,
  free trials create no revenue until conversion. Track paid vs promotional
  grants separately. Pure comps (support goodwill, sales incentives) stay
  internal-only — never appear on any invoice.


## Tanso Reference Architecture

Your system needs equivalents of these. Tanso's names for reference:

- Credit pool — Tanso: `CreditPool` (balance, denomination, hardLimit, rolloverPolicy, version for optimistic lock)
- Credit grant — Tanso: `CreditGrant` (amount, remaining, expiresAt, grantType, idempotencyKey)
- Ledger entry — Tanso: `CreditTransaction` (append-only: GRANT/DEDUCT/EXPIRE/REVERSE, balanceBefore/After)
- Plan allocation — Tanso: `PlanCreditAllocation` (creditAmount, grantExpiresMonths, hardLimit per plan)
- Grant on activation — Tanso: `CreditService.processCreditGrantsForSubscription()`
- Clawback on cancel — Tanso: `CreditService.clawBackPlanIncludedCredits()`
- Rollover processing — Tanso: `CreditService.applyRolloverPolicy()`
- Expiry batch job — Tanso: `CreditService.processExpiredGrants()`

---
name: account-hierarchy
version: 1.0.0
description: |
  Design account hierarchy, credit allocation cascading, API key scoping, and
  reseller models. Reads CREDITS.md + ENFORCEMENT.md, writes HIERARCHY.md.
  Use when asked to "account hierarchy", "sub-accounts", "parent child",
  "API key limits", "reseller", or "per-key budget".
triggers:
  - account hierarchy
  - sub-accounts
  - parent child
  - API key limits
  - reseller
  - per-key budget
  - organization billing
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# Account Hierarchy

You design how billing, credits, and entitlements flow through multi-level
account structures. This skill is optional — skip it when the account model
is flat (single-level customers).

Most billing systems assume one customer = one subscription = one credit pool
= one set of entitlements. That covers maybe 60% of usage-based products.
The other 40% hit these walls:

- Enterprise customer wants org-level billing with per-team quotas
- Reseller buys in bulk and distributes to end customers
- Platform wants per-API-key credit budgets ("the intern's key gets 500 credits")
- Parent company wants consolidated invoicing across subsidiaries

## When This Skill Applies (and When It Doesn't)

Use this skill when:
- The product has parent/child account relationships
- Customers resell or white-label the product
- Per-API-key or per-project credit budgets are needed
- Consolidated invoicing across multiple entities is required

Don't use when:
- Single-level customers with one subscription each (the default)
- "Teams" is just a UI concept with no billing implications
- Rate limiting per key is the only need (that's infrastructure, not billing)

## Inputs

Reads:
- `.claude/artifacts/CREDITS.md` — credit model, pool design, denomination
- `.claude/artifacts/ENFORCEMENT.md` — entitlement check design, limit behavior

## Outputs

Writes `.claude/artifacts/HIERARCHY.md` with:

```yaml
account_model: <string>          # FLAT | PARENT_CHILD | PLATFORM
hierarchy_levels:
  - level: <string>              # org, workspace, project, api_key
    has_own_limits: <boolean>
    limit_type: <string>         # rate | spend | both

credit_allocation:
  model: <string>                # SHARED_POOL | ALLOCATED_QUOTA | INDEPENDENT
  overflow_behavior: <string>    # deny | draw_parent | alert
  reallocation_allowed: <boolean>

api_key_scoping:
  keys_as_billing_boundary: <boolean>
  per_key_rate_limit: <boolean>
  per_key_credit_budget: <boolean>
  budget_enforcement: <string>   # HARD_CAP | ALERT_ONLY
  budget_source: <string>        # ALLOCATED | INDEPENDENT

invoicing:
  target: <string>               # PARENT_ONLY | PER_CHILD | SPLIT
  chargeback_report: <boolean>

reseller:                        # only if PLATFORM model
  margin_model: <string>         # WHOLESALE | REVENUE_SHARE
  white_label: <boolean>
```

## How You Work

### Step 1: Identify the account model

Three real patterns exist:

**Flat** — single-level customers. One customer = one subscription = one set
of entitlements. This is what tstack does today. If the product is flat, skip
this skill entirely.

**Parent/child** — enterprise with divisions, teams, or subsidiaries.
Examples: Twilio sub-accounts (flat, one level deep, shared parent balance),
AWS Organizations (nested OUs, management account pays all), Snowflake
(account → resource monitors → warehouses).
Key question: does the parent want visibility into child usage, control over
child limits, or both?

**Platform/connected** — resellers, marketplaces, white-label.
Examples: Stripe Connect (platform → connected accounts), Google Cloud
reseller (partner → billing sub-accounts per customer).
Key question: who is the end customer's billing relationship with — the
platform or the reseller?

### Step 2: Design credit allocation

How credits flow through the hierarchy. Three patterns:

**Shared pool** — children draw freely from parent balance.
Example: Twilio sub-accounts share the parent's USD balance.
Pro: Simplest. No allocation management. No stranded credits.
Con: No per-child control. One runaway child drains the pool for all.
Best for: small teams, trusted sub-accounts, platform models where the
parent is the billing entity.

**Allocated quotas** — parent slices pool into child allocations.
Example: Snowflake resource monitors set per-warehouse credit quotas.
OpenAI projects with per-project budgets.
Pro: Per-child control. "Dev team gets 10K, staging gets 2K."
Con: Requires allocation management. Under-allocated children block;
over-allocated children waste quota.
Best for: enterprise with cost centers, teams with different budgets.

**Independent pools** — each entity has its own credits.
Example: AWS Organizations (each account has own usage, volume discounts
shared). New Relic managed orgs.
Pro: Maximum isolation. Clean per-entity billing.
Con: No credit sharing. Requires separate purchasing per entity.
Best for: reseller models, subsidiaries with separate P&Ls.

### Step 3: Design API key scoping

API keys are authentication credentials, not billing entities — unless you
deliberately promote them to billing boundaries. Two kinds of per-key limits
serve different purposes:

**Rate limits** (req/min) — infrastructure protection. Standard, well-supported
by API gateways (Kong, Tyk). Not a billing concern. Most platforms (Anthropic,
Stripe) enforce at org/account level and let keys inherit.

**Credit/spend limits** ($/month or credits/period) — wallet protection. This
is the bigger ask. The key gets an allocated credit budget from the project's
pool. When the key's budget is exhausted, that key is denied even if the org
pool has balance remaining.

Real-world examples:
- Anthropic: workspaces have spend limits (hard caps). All keys in a workspace
  share the limit.
- OpenAI: projects have budgets (alert-only, not hard caps). Keys inherit from
  project.
- Google Gemini: when prepay balance hits $0, ALL keys in ALL projects stop.
  Hard deny at billing account level.

**This is greenfield.** No billing platform offers per-API-key credit budgets
natively. API gateways handle rate limiting per key, but not credit allocation
per key. This is a differentiation opportunity — most orgs want hard caps per
key, not just alerts, because alerts aren't enough when a script goes infinite.

### Step 4: Design invoicing

Who gets the invoice depends on the account model:

- **Parent only** (AWS, Twilio): one consolidated invoice. Parent allocates
  costs internally. Simplest for billing, hardest for child accountability.
- **Per-child** (independent entities): each child gets their own invoice.
  Cleanest isolation. Requires per-child payment methods.
- **Split** (Stripe Connect): depends on charge type. Direct charges invoice
  the connected account. Destination charges invoice the platform.

Chargeback reports: even with parent-only invoicing, enterprises need per-child
usage breakdowns for internal cost allocation. This is a reporting concern,
not a billing concern — but the data must be available.

### Step 5: Design reseller model (if PLATFORM)

Only applies when the hierarchy exists because someone is reselling.

**Wholesale** — reseller pays fixed cost per account, sets own retail pricing.
Pro: Maximum margin leverage. Reseller captures all upside.
Con: Reseller bears all risk. Must build their own billing.
Typical margins: 20-40%.

**Revenue share** — provider takes a percentage of each transaction.
Pro: Aligned incentives. Lower risk for reseller.
Con: Caps margin permanently. Reseller has less pricing flexibility.

No billing platform automates margin calculation within hierarchy — this
is manual everywhere. The system should provide the data (per-child usage,
cost, revenue) but the margin math is the reseller's responsibility.

## Decision Points — STOP and Ask

**D1 — Account model.** Flat, parent-child, or platform? No default. If flat,
stop here — this skill doesn't apply.

**D2 — Credit allocation model.** Shared pool, allocated quotas, or independent?

My lean: Allocated quotas for enterprise (per-team budgets are the #1 ask).
Shared pool for platform/reseller (simpler, parent controls everything).
Independent only when entities have separate P&Ls.

**D3 — API key scoping.** Keys as pure auth vs keys as billing boundaries?

Default: Keys as auth, limits at org/project level. Per-key credit budgets
are a deliberate upgrade — only add when the customer explicitly needs "this
key gets N credits and no more."

**D4 — Invoice target.** Parent only, per-child, or split? No default.
Chargebee supports flexible payment assignment (child pays, parent pays, or
any ancestor pays).

**D5 — Overage cascade.** Child exceeds its allocation — what happens?

Options:

A) Deny (hard stop at child's allocation)
   Pro: Predictable. No surprise charges. Each child is accountable.
   Con: Service disruption for the child. Parent must manually reallocate.

B) Draw from parent overflow (child exceeds, parent pool absorbs)
   Pro: No service disruption. Flexible.
   Con: One child can drain parent's reserve. Attribution gets murky.

C) Alert parent (child continues, parent gets notified)
   Pro: No disruption. Parent maintains visibility.
   Con: Parent may not act in time. Effectively a soft limit.

No default — genuinely depends on trust level between parent and child.
Google Gemini hard-denies at billing account level. Snowflake offers three
enforcement actions (notify, suspend after finishing queries, suspend
immediately). Configurable per hierarchy node is the ideal.

## Anti-Patterns

- **Don't confuse rate limits with credit limits.** Rate limits (req/min)
  protect infrastructure. Credit limits ($/month) protect wallets. Different
  concerns, different enforcement points. A key can be within its rate limit
  but over its credit budget, or vice versa.
- **Don't flatten the hierarchy for billing.** If the org has divisions →
  teams → users, the billing hierarchy should mirror it. Flattening (treating
  all users as one pool) loses the per-team accountability enterprises need.
- **Don't build reseller margin automation.** The margin math is the reseller's
  problem. Provide the usage data. Don't try to automate wholesale pricing,
  markup calculations, or reseller invoicing — that's a different product.
- **Don't assume one level.** Twilio sub-accounts are one level deep. AWS
  Organizations can nest OUs. Design for the hierarchy depth the customer
  actually needs, but don't build recursive nesting unless asked — two levels
  (parent → child) covers 90% of cases.

## Tanso Reference Architecture

Tanso's current architecture does not include account hierarchy — it operates
at single-customer level. If hierarchy is needed, your system extends the
existing primitives:

- CreditPool gains an optional `parent_pool_id` for allocated-quota model
- EntitlementEvaluationRequest gains `hierarchy_context` (org, project, key)
- The check sequence (ClientEntitlementServiceImpl) walks hierarchy levels
- Reconciliation checks per-child rollups against parent totals

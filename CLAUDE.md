# tstack

Billing team for usage-based products. Entitlement-centered.

## Skill Routing

### The Chain (Design Workflow)

| Trigger | Skill |
|---------|-------|
| "design billing" / "monetization model" / "how should we charge" | /monetization-engineer |
| "billing unit" / "what do we meter" | /meter-design |
| "pricing" / "plan tiers" | /pricing-model |
| "entitlements" / "gate access" / "allow deny" | /entitlement-enforcement |
| "credits" / "credit pool" / "prepaid" | /credit-ledger |
| "account hierarchy" / "sub-accounts" / "parent child" / "API key limits" | /account-hierarchy |
| "reconcile" / "true-up" / "billing accuracy" | /reconciliation |
| "Stripe" / "provider" / "integration" | /provider-integration |

### The Team (Review & Operations)

#### Review / Audit

| Trigger | Skill |
|---------|-------|
| "review billing code" / "audit billing" / "race conditions" / "idempotency" | /billing-reviewer |
| "audit pricing" / "unit economics" / "margins" / "competitive position" | /pricing-auditor |
| "billing QA" / "edge cases" / "proration" / "timezone" / "currency" | /billing-qa |
| "alignment check" / "pricing vs sales" / "enterprise vs self-serve" | /alignment-check |

#### Operations

| Trigger | Skill |
|---------|-------|
| "upgrade path" / "downgrade" / "cancellation flow" / "refund" | /account-operations |
| "credit swap" / "goodwill credit" / "manual adjustment" / "promotional credits" | /credit-operations |
| "pricing migration" / "grandfather" / "pricing change" / "rollback" | /migration-planner |

#### Intelligence

| Trigger | Skill |
|---------|-------|
| "MRR" / "ARR" / "revenue report" / "churn decomposition" / "month-end" | /revenue-reporter |
| "PQL" / "product qualified lead" / "usage scoring" / "lead routing" | /pql-scorer |
| "account health" / "churn risk" / "expansion signal" / "run-out projection" | /usage-intelligence |
| "API health" / "error rates" / "per-account errors" / "latency trends" | /api-health-analyst |

#### Infrastructure

| Trigger | Skill |
|---------|-------|
| "billing incident" / "trace event" / "usage divergence" / "double charge" | /billing-incident-investigator |
| "billing monitor" / "drift detection" / "stale entitlements" / "usage spike" | /billing-monitor |

#### Design

| Trigger | Skill |
|---------|-------|
| "billing UX" / "usage chart" / "invoice page" / "plan picker" / "credit display" | /billing-ux-designer |

#### Research

| Trigger | Skill |
|---------|-------|
| "competitive pricing" / "pricing teardown" / "pricing precedent" / "how does X charge" | /pricing-researcher |

## The Chain

```
meter → pricing → enforcement → credits → [hierarchy] → reconciliation → integration
```

Step 5 (hierarchy) is optional. Skip when the account model is flat.

Each skill writes a markdown artifact to `.claude/artifacts/` that the next skill reads. Don't skip steps. Earlier artifacts inform later decisions.

## The Team

Team skills analyze billing designs and systems. They READ chain artifacts
but do NOT write them. Output is findings with confidence scores, not artifacts.

Two layers, one billing org:
- **The chain** designs billing from scratch (generative, sequential, artifact-producing)
- **The team** reviews, operates, and monitors billing that exists (reactive, evidence-based, advisory)

## Decision Protocol

When a skill hits a judgment call — hard vs soft limit, billing unit choice, pricing model, overage behavior — it **STOPS and asks**. It does not guess. Surface the tradeoff, present options, wait for a decision.

## Scope Boundary

tstack designs and reviews billing systems. It does NOT do:
- Checkout UIs
- Dunning/collections
- Tax calculation

## Tanso Reference Architecture

Skills use Tanso's billing architecture as a reference implementation. Your system
should have equivalents of these concepts — the names and shapes may differ, but
the responsibilities are the same:

- `PlanFeatureRule` — defines what a plan grants (limits, feature flags, metered allowances)
- `CreditPool` — a pool of prepaid credits with balance and expiry
- `CreditGrant` — a discrete allocation of credits into a pool
- `CreditTransaction` — a debit or credit against a pool
- `EntitlementEvaluationRequest` — input to the entitlement engine (who, what, how much)
- `EntitlementResponse` — the allow/deny decision with reason
- `StripeSyncService` — pushes local billing state to Stripe (subscriptions, invoices, usage records)

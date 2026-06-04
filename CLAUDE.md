# tstack

Billing engineer for usage-based products. Entitlement-centered.

## Skill Routing

| Trigger | Skill |
|---------|-------|
| "design billing" / "monetization model" / "how should we charge" | /monetization-engineer |
| "billing unit" / "what do we meter" | /meter-design |
| "pricing" / "plan tiers" | /pricing-model |
| "entitlements" / "gate access" / "allow deny" | /entitlement-enforcement |
| "credits" / "credit pool" / "prepaid" | /credit-ledger |
| "reconcile" / "true-up" / "billing accuracy" | /reconciliation |
| "Stripe" / "provider" / "integration" | /provider-integration |

## The Chain

```
meter → pricing → enforcement → credits → reconciliation → integration
```

Each skill writes a markdown artifact to `.claude/artifacts/` that the next skill reads. Don't skip steps. Earlier artifacts inform later decisions.

## Decision Protocol

When a skill hits a judgment call — hard vs soft limit, billing unit choice, pricing model, overage behavior — it **STOPS and asks**. It does not guess. Surface the tradeoff, present options, wait for a decision.

## Scope Boundary

tstack designs billing systems. It does NOT do:
- Rev-ops reporting
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

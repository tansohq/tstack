# Changelog

## [1.1.0] - 2026-06-04

Account hierarchy, credit model taxonomy, and cross-cutting billing gaps.

### Added

- `/account-hierarchy` skill — parent/child accounts, per-API-key credit budgets,
  reseller models, credit allocation cascading (shared pool, allocated quota,
  independent). Optional step in the chain between credits and reconciliation.
- Credit model taxonomy in `/credit-ledger` — three real denomination models
  (currency, universal abstract + burn multipliers, product-specific siloed pools)
  with examples from Twilio, Snowflake, PDL, ElevenLabs
- Credit scoping decision (account-level vs contract/line-item) in `/credit-ledger`
- CS operations (transfer, adjustment, rebalance) built on existing ledger
  primitives in `/credit-ledger`
- Rounding rule (D8) in `/pricing-model` — match payment processor, store
  full-precision internally
- Downgrade behavior (D6) in `/entitlement-enforcement` — end-of-period default
- Contract lifecycle advisory in `/provider-integration`
- Comp credit sync boundary (D4) in `/provider-integration` — ASC 606 governs,
  not whether credits touch the processor
- Cross-system identifier set (D5) in `/provider-integration`
- Rounding-drift detection and hierarchy reconciliation in `/reconciliation`
- Shared identifier anti-pattern in `/reconciliation`
- Contract lifecycle and hierarchy routing in `/monetization-engineer`

### Changed

- Chain updated: `meter → pricing → enforcement → credits → [hierarchy] →
  reconciliation → integration` (hierarchy is optional)
- Rollover policy (D1) sharpened: ROLLOVER grant type, no rollover on termination

## [1.0.0] - 2026-06-04

Initial release. Seven billing engineer skills for Claude Code, chained through
a structured artifact pipeline.

### Skills

- `/monetization-engineer` — orchestrator that routes through the chain
- `/meter-design` — define billing units, event schemas, aggregation windows
- `/pricing-model` — design PlanFeatureRules, plan tiers, margin targets
- `/entitlement-enforcement` — real-time allow/deny gate with simulation
- `/credit-ledger` — prepaid pools, FIFO consumption, append-only ledger
- `/reconciliation` — event-to-invoice tie-out and true-up mechanics
- `/provider-integration` — Stripe/Paddle abstraction layer

### Design

- Artifact-chained: each skill writes a structured markdown file that the next
  skill reads, building up a complete billing design incrementally
- Entitlement-centered: starts from "what should we allow?" not "what should we
  charge?"
- Decision-first: stops at every judgment call with structured D0-DN format
- References tanso-core primitives (PlanFeatureRule, CreditPool,
  EntitlementEvaluationRequest) without reimplementing them

# Changelog

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

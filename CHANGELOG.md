# Changelog

## [2.1.0] - 2026-06-07

Three new review skills focused on the correctness bugs that cost real money —
Stripe API footguns, subscription state machine violations, and usage metering
pipeline errors. Each fills a gap between `/billing-reviewer` (general) and
the domain-specific audit these systems need.

### Added

- `/stripe-correctness` — 14 Stripe API footgun categories: webhook signature
  verification, idempotency key misuse, subscription state machine violations,
  proration math, event type coverage gaps, test/live mode leaks, API version
  drift, customer hygiene, error handling, invoice lifecycle, metadata expansion,
  currency handling, checkout race conditions, metering conflicts
- `/state-machine-guard` — extracts the actual subscription state machine from
  code, then audits: missing transitions, incomplete side effects, impossible
  transitions, race conditions, entitlement consistency, period boundary bugs,
  upgrade/downgrade edge cases
- `/metering-correctness` — 8 usage metering pipeline categories: idempotency,
  recursion/feedback loops, clock skew, event schema correctness, aggregation
  bugs, late-arriving events, multi-tenancy attribution, cost calculation timing

### Changed

- Team review skills: 4 → 7 (billing-reviewer, stripe-correctness,
  state-machine-guard, metering-correctness, pricing-auditor, billing-qa,
  alignment-check)
- Total skill count: 20 → 23

## [2.0.0] - 2026-06-04

From billing workflow to billing team. Adds 15 reactive "team" skills alongside
the existing 7-skill design chain. Derived from real self-serve billing
operations. Template system upgraded to function-based resolvers.

### Added — Team Skills (Review & Operations)

- `/billing-reviewer` — audit billing code for race conditions, double-charges, idempotency gaps
- `/pricing-auditor` — evaluate unit economics, margins, competitive position
- `/billing-qa` — generate billing edge case test scenarios (proration, timezone, currency)
- `/alignment-check` — check pricing vs sales motion, enterprise vs self-serve conflicts
- `/account-operations` — upgrade/downgrade paths, cancellation flows, refund playbooks
- `/credit-operations` — credit swaps, goodwill grants, manual adjustments with audit trail
- `/migration-planner` — plan pricing model changes with grandfathering and rollback
- `/revenue-reporter` — MRR/ARR, revenue recognition with credits, churn decomposition
- `/pql-scorer` — product-qualified lead scoring from usage patterns
- `/usage-intelligence` — account health, churn risk, expansion signals, credit run-out projection
- `/api-health-analyst` — per-account error rates, customer vs platform error attribution
- `/billing-incident-investigator` — trace meter → aggregation → entitlement → invoice divergence
- `/billing-monitor` — drift detection, webhook monitoring, usage spike alerting
- `/billing-ux-designer` — usage dashboards, plan picker, credit run-out display patterns
- `/pricing-researcher` — competitive pricing teardowns and model precedent research

### Added — Infrastructure

- Function-based resolver system (`scripts/resolvers/`) replacing flat string map
- 7 tool-set resolvers by skill class (chain, orchestrator, review, ops, intelligence, design, research)
- Shared methodology resolvers: `REACTIVE_METHODOLOGY`, `CONFIDENCE_CALIBRATION`,
  `ARTIFACT_READ_PROTOCOL`, `CREDIT_RUNOUT_PROJECTION`
- `--dry-run` flag for template freshness checks
- Skill classification system in test suite (chain, team-review, team-ops, etc.)
- Team skill validation tests (reads artifacts, doesn't write, has methodology section)
- Two-layer CLAUDE.md routing table (chain + team organized by lens)

### Changed

- CLAUDE.md redesigned with chain and team sections
- Test suite restructured from flat tool-set validation to per-class validation
- Setup script updated for 23 skills with chain/team sections
- `account-hierarchy` now generated from template (was hand-written)

## [1.1.0] - 2026-06-04

Account hierarchy, credit model taxonomy, and cross-cutting billing gaps.

### Added

- `/account-hierarchy` skill — parent/child accounts, per-API-key credit budgets,
  reseller models, credit allocation cascading (shared pool, allocated quota,
  independent). Optional step in the chain between credits and reconciliation.
- Credit model taxonomy in `/credit-ledger` — three real denomination models
  (currency, universal abstract + burn multipliers, product-specific siloed pools)
  with examples from Twilio, Snowflake, ElevenLabs
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

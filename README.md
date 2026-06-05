# tstack

Billing team for [Claude Code](https://claude.ai/claude-code).

tstack is a monetization team for usage-based SaaS products. Two layers: a **design chain** that builds billing systems from scratch (7 skills, artifact-chained), and a **review team** that audits, operates, and monitors billing that exists (15 skills, reactive). Derived from real self-serve billing operations.

## Install

```bash
git clone https://github.com/tansohq/tstack.git
cd tstack
./setup
```

The setup script symlinks tstack into `~/.claude/skills/tstack` and verifies the skills are accessible. Run it again anytime — it's idempotent.

## The Chain (Design Workflow)

Run `/monetization-engineer` to design a billing system from scratch. It walks you through the chain:

```
meter → pricing → enforcement → credits → [hierarchy] → reconciliation → integration
```

| Skill | What it does | Artifact |
|-------|-------------|----------|
| `/monetization-engineer` | Orchestrate the billing design chain | — |
| `/meter-design` | Define billing units, event schemas, aggregation | METER.md |
| `/pricing-model` | Structure plan tiers, feature packaging, pricing | PLAN.md |
| `/entitlement-enforcement` | Design allow/deny logic, hard/soft limits | ENFORCEMENT.md |
| `/credit-ledger` | Prepaid credit pools, grants, drawdown, expiry | CREDITS.md |
| `/account-hierarchy` | Parent/child accounts, per-key budgets [optional] | HIERARCHY.md |
| `/reconciliation` | Usage-to-billing drift detection and true-up | RECONCILIATION.md |
| `/provider-integration` | Map design to Stripe subscriptions and invoices | INTEGRATION.md |

Each skill writes a structured markdown artifact that the next skill reads. Decisions accumulate — every downstream skill has full context from upstream choices.

## The Team (Review & Operations)

Run any team skill directly. They read chain artifacts (if they exist) or work from your description of an existing billing system.

### Review / Audit

| Skill | Lens | What it does |
|-------|------|-------------|
| `/billing-reviewer` | Backend dev | Audit for race conditions, double-charges, idempotency gaps |
| `/pricing-auditor` | Rev ops / finance | Evaluate unit economics, margins, competitive position |
| `/billing-qa` | QA | Generate edge case test scenarios (proration, timezone, currency) |
| `/alignment-check` | Cross-functional | Check pricing vs sales motion, enterprise vs self-serve conflicts |

### Operations

| Skill | Lens | What it does |
|-------|------|-------------|
| `/account-operations` | Support / ops | Upgrade, downgrade, cancellation, and refund playbooks |
| `/credit-operations` | Customer success | Credit swaps, goodwill grants, manual adjustments |
| `/migration-planner` | PM | Plan pricing changes with grandfathering and rollback |

### Intelligence

| Skill | Lens | What it does |
|-------|------|-------------|
| `/revenue-reporter` | Finance | MRR/ARR, revenue recognition with credits, churn decomposition |
| `/pql-scorer` | Growth / sales | Product-qualified lead scoring from usage patterns |
| `/usage-intelligence` | CS / account mgmt | Account health, churn risk, credit run-out projection |
| `/api-health-analyst` | Reliability | Per-account error rates, customer vs platform error attribution |

### Infrastructure

| Skill | Lens | What it does |
|-------|------|-------------|
| `/billing-incident-investigator` | On-call | Trace billing discrepancies from meter to invoice |
| `/billing-monitor` | Observability | Drift detection, webhook monitoring, usage spike alerting |

### Design

| Skill | Lens | What it does |
|-------|------|-------------|
| `/billing-ux-designer` | Design | Usage dashboards, plan picker, credit run-out display |

### Research

| Skill | Lens | What it does |
|-------|------|-------------|
| `/pricing-researcher` | Market intel | Competitive pricing teardowns and model precedent research |

## How It Works

**Nothing touches your codebase.** Chain skills produce markdown artifacts. Team skills produce findings and recommendations. No code generated, no deployments, no Stripe changes. Read the output, decide if you agree, implement on your own terms.

When a skill hits a judgment call (hard vs soft limit, billing unit, pricing model, overage behavior), it **stops and surfaces the tradeoff**. Decisions are made by you, not silently resolved.

## Build

```bash
bun install              # install dev dependencies
bun run build            # generate SKILL.md from templates
bun test                 # run validation tests
bun run gen:skill-docs --dry-run  # check template freshness
```

Skills are generated from `.tmpl` templates via a resolver pipeline. Edit the template, not the output.

## About

Tanso's billing team skill pack for Claude Code. Inspired by [gstack](https://github.com/garrytan/gstack).

# tstack

Billing engineer skills for [Claude Code](https://claude.ai/claude-code).

tstack designs usage-based monetization systems for SaaS products. It's entitlement-centered — every billing decision flows through what the customer is allowed to do, not just what they're charged. Skills are artifact-chained: each writes a structured markdown file that the next skill reads, building up a complete billing design incrementally.

## Skills

| Skill | What it does |
|-------|-------------|
| `/monetization-engineer` | Design the overall billing model — what to charge for, how, and why |
| `/meter-design` | Define billing units, aggregation windows, and measurement points |
| `/pricing-model` | Structure plan tiers, feature packaging, and price points |
| `/entitlement-enforcement` | Design access control — allow/deny logic, hard/soft limits, grace periods |
| `/credit-ledger` | Design prepaid credit pools, grants, drawdown, and expiry |
| `/reconciliation` | Ensure metered usage matches billed amounts — true-up and drift detection |
| `/provider-integration` | Map the billing design to Stripe (or other providers) — subscriptions, invoices, usage records |

## Install

Clone into your skills directory:

```bash
git clone https://github.com/tansohq/tstack.git ~/.claude/skills/tstack
```

Or symlink if you keep it elsewhere:

```bash
ln -s /path/to/tstack ~/.claude/skills/tstack
```

## How It Works

Skills run in a fixed order. Each one writes a markdown artifact, and the next skill in the chain reads it:

```
/meter-design             → .claude/artifacts/METER.md
/pricing-model            → .claude/artifacts/PLAN.md
/entitlement-enforcement  → .claude/artifacts/ENFORCEMENT.md
/credit-ledger            → .claude/artifacts/CREDITS.md
/reconciliation           → .claude/artifacts/RECONCILIATION.md
/provider-integration     → .claude/artifacts/INTEGRATION.md
```

The artifacts are the actual billing design for your product — structured YAML-in-markdown that captures the billing unit, pricing rules, enforcement policy, credit system, reconciliation checks, and provider sync. They accumulate as you work through the chain, so each skill has the full context of what was decided upstream.

The `artifacts/` folder doesn't ship with the repo. It's created on disk the first time you run a skill. Think of the skills as the engineering process; the artifacts are the output.

When a skill hits a judgment call (hard vs soft limit, billing unit granularity, pricing model choice), it stops and surfaces the tradeoff. Decisions are made by you, not silently resolved.

## Inspired By

[gstack](https://github.com/garrytan/gstack) — Garry Tan's skill pack for Claude Code.

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

Each skill writes a markdown artifact to `.claude/artifacts/`. The next skill in the chain reads it. The chain runs:

```
meter → pricing → enforcement → credits → reconciliation → integration
```

When a skill hits a judgment call (hard vs soft limit, billing unit granularity, pricing model choice), it stops and surfaces the tradeoff. Decisions are made by you, not silently resolved.

## Inspired By

[gstack](https://github.com/garrytan/gstack) — Garry Tan's skill pack for Claude Code.

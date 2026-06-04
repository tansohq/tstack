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

```bash
git clone https://github.com/tansohq/tstack.git
cd tstack
./setup
```

The setup script symlinks tstack into `~/.claude/skills/tstack` and verifies the skills are accessible. Run it again anytime — it's idempotent.

**Manual alternative:** If you prefer, symlink directly:

```bash
ln -s /path/to/tstack ~/.claude/skills/tstack
```

## How It Works

Run `/monetization-engineer` to start. It walks you through the chain, one skill at a time:

```
                          ┌─────────────────────────────────────────┐
                          │         /monetization-engineer          │
                          │      orchestrator — routes the chain    │
                          └────────────────┬────────────────────────┘
                                           │
                    ┌──────────────────────────────────────────────┐
                    │                 THE CHAIN                    │
                    │                                              │
                    │  /meter-design          → METER.md           │
                    │       │  what do we count?                   │
                    │       ▼                                      │
                    │  /pricing-model         → PLAN.md            │
                    │       │  what do we charge?                  │
                    │       ▼                                      │
                    │  /entitlement-enforcement → ENFORCEMENT.md   │
                    │       │  what do we allow or deny?           │
                    │       ▼                                      │
                    │  /credit-ledger         → CREDITS.md         │
                    │       │  how do prepaid credits work?        │
                    │       ▼                                      │
                    │  /reconciliation        → RECONCILIATION.md  │
                    │       │  did we bill what we consumed?       │
                    │       ▼                                      │
                    │  /provider-integration  → INTEGRATION.md     │
                    │          how does this sync to Stripe?       │
                    │                                              │
                    └──────────────────────────────────────────────┘
                                           │
                          ┌────────────────▼────────────────────────┐
                          │        .claude/artifacts/               │
                          │                                         │
                          │  Your billing design lives here.        │
                          │  6 markdown files, one per skill.       │
                          │  Each skill reads upstream artifacts    │
                          │  so every decision has full context.    │
                          │                                         │
                          │  This folder doesn't ship with the      │
                          │  repo — it's created the first time     │
                          │  you run a skill.                       │
                          └─────────────────────────────────────────┘
```

Each artifact is structured YAML-in-markdown: billing units, pricing rules, enforcement policy, credit pools, reconciliation checks, provider sync. They accumulate as you work through the chain.

**Nothing touches your codebase.** The output is markdown recommendations — no code generated, no deployments, no Stripe changes. Run the full chain, read the artifacts, decide if you agree, then implement on your own terms.

When a skill hits a judgment call (hard vs soft limit, billing unit, pricing model, overage behavior), it **stops and surfaces the tradeoff**. Decisions are made by you, not silently resolved.

## Inspired By

[gstack](https://github.com/garrytan/gstack) — Garry Tan's skill pack for Claude Code.

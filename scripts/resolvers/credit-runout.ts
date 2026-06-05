import type { ResolverFn } from "./index";

export const CREDIT_RUNOUT_PROJECTION: ResolverFn = () =>
  `## Credit Run-Out Projection

Estimate when a credit pool will be exhausted:

1. **Current state**: pool balance, denomination, hard/soft limit flag
2. **Consumption velocity**: credits consumed per day/week over trailing period
3. **Trend**: is velocity accelerating, steady, or decelerating?
4. **Projection**: at current velocity, when does balance hit zero (or hard-limit threshold)?
5. **Scenarios**: project at current, 1.5x, and 2x velocity
6. **Alert thresholds**: recommend notification at 30%, 15%, 5% remaining

Cross-reference against:
- Grant schedule (when does the next plan-included grant arrive?)
- Rollover policy (will expiring credits reduce the pool before run-out?)
- Seasonal patterns (if described — e.g., election years for data companies)

**This is the most visible number on the dashboard.** If wrong, customers lose
trust in every other number you show. Default to showing a range (optimistic /
current / pessimistic) rather than a single date. Surface uncertainty explicitly.`;

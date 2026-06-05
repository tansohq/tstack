import type { ResolverFn } from "./index";

export const REACTIVE_METHODOLOGY: ResolverFn = () =>
  `### Phase 1: Observe

Read the billing design artifacts (if they exist in \`.claude/artifacts/\`).
Identify the scope: what's been designed, what's missing, what's assumed.
Gather evidence from the artifacts and any codebase context the user provides.

If no artifacts exist, work from the user's description of their billing system.
Ask clarifying questions — don't invent assumptions about their architecture.

### Phase 2: Hypothesize

Form specific hypotheses about risks, gaps, or issues. Each hypothesis must
be testable against the artifacts or described system. Number them (H1, H2, ...)
so findings can trace back to hypotheses.

### Phase 3: Test

Verify each hypothesis against the evidence:
- Check for contradictions between artifacts (e.g., METER.md says per-event
  billing but PLAN.md assumes per-period aggregation)
- Cross-reference with known billing anti-patterns
- If the user provided code, grep for concrete evidence
- Mark each hypothesis as confirmed, refuted, or inconclusive

### Phase 4: Report

Present findings sorted by severity with confidence scores.
Separate confirmed issues from suspected risks.
Do NOT modify artifacts — present recommendations that the user can act on.`;

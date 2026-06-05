import type { ResolverFn } from "./index";

export const ARTIFACT_READ_PROTOCOL: ResolverFn = () =>
  `Check for existing chain artifacts in \`.claude/artifacts/\`. Read any that exist —
they contain decisions already made by upstream chain skills (meter design, pricing
model, entitlement enforcement, credit ledger, account hierarchy, reconciliation,
provider integration).

If artifacts exist, ground your analysis in them. Reference specific decisions
(e.g., "METER.md specifies per-event billing, but...").

If no artifacts exist, work from the user's description of their billing system.
Ask about the aspects you need — don't assume a design that hasn't been documented.

**Do NOT write to \`.claude/artifacts/\`.** Team skills analyze and recommend.
Chain skills produce artifacts.`;

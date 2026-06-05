import type { ResolverFn } from "./index";

const yaml = (tools: string[]) => tools.map((t) => `  - ${t}`).join("\n");

const CHAIN_TOOLS = ["Bash", "Read", "Write", "Edit", "AskUserQuestion"];
const REVIEW_TOOLS = ["Bash", "Read", "Grep", "AskUserQuestion"];
const OPS_TOOLS = ["Bash", "Read", "Write", "Edit", "AskUserQuestion"];
const INTELLIGENCE_TOOLS = ["Bash", "Read", "Grep", "AskUserQuestion"];
const DESIGN_TOOLS = ["Bash", "Read", "Write", "AskUserQuestion"];
const RESEARCH_TOOLS = ["Bash", "Read", "Grep", "WebSearch", "AskUserQuestion"];
const ORCHESTRATOR_TOOLS = [...CHAIN_TOOLS, "Agent"];

export const ALLOWED_TOOLS_STANDARD: ResolverFn = () => yaml(CHAIN_TOOLS);
export const ALLOWED_TOOLS_CHAIN: ResolverFn = () => yaml(CHAIN_TOOLS);
export const ALLOWED_TOOLS_ORCHESTRATOR: ResolverFn = () =>
  yaml(ORCHESTRATOR_TOOLS);
export const ALLOWED_TOOLS_REVIEW: ResolverFn = () => yaml(REVIEW_TOOLS);
export const ALLOWED_TOOLS_OPS: ResolverFn = () => yaml(OPS_TOOLS);
export const ALLOWED_TOOLS_INTELLIGENCE: ResolverFn = () =>
  yaml(INTELLIGENCE_TOOLS);
export const ALLOWED_TOOLS_DESIGN: ResolverFn = () => yaml(DESIGN_TOOLS);
export const ALLOWED_TOOLS_RESEARCH: ResolverFn = () => yaml(RESEARCH_TOOLS);

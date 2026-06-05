import type { ResolverFn } from "./index";

export const DECISION_FORMAT: ResolverFn = () =>
  [
    "```",
    "D<N> — <one-line question>",
    "",
    "What's at stake: <one sentence on what breaks if we pick wrong>",
    "",
    "Options:",
    "",
    "A) <option> ",
    "   Pro: <concrete observable benefit>",
    "   Con: <concrete observable cost>",
    "",
    "B) <option>",
    "   Pro: <concrete observable benefit>",
    "   Con: <concrete observable cost>",
    "",
    'My lean: <which and why in one sentence, OR "no lean — genuinely depends on your context">',
    "```",
  ].join("\n");

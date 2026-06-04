/**
 * gen-skill-docs.ts — Generate SKILL.md files from .tmpl templates.
 *
 * Discovers all SKILL.md.tmpl files under .claude/skills/,
 * resolves {{PLACEHOLDER}} markers, writes SKILL.md alongside each template.
 *
 * Usage: bun run scripts/gen-skill-docs.ts
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(ROOT, ".claude", "skills");

// ---------------------------------------------------------------------------
// Resolver strings — shared boilerplate injected into templates
// ---------------------------------------------------------------------------

const RESOLVERS: Record<string, string> = {
  // Standard allowed-tools block (2-space YAML indent, no trailing newline)
  ALLOWED_TOOLS_STANDARD: [
    "  - Bash",
    "  - Read",
    "  - Write",
    "  - Edit",
    "  - AskUserQuestion",
  ].join("\n"),

  // Decision format template — canonical version from monetization-engineer
  DECISION_FORMAT: [
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
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// Discovery + generation
// ---------------------------------------------------------------------------

function resolve(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = RESOLVERS[key];
    if (value === undefined) {
      console.error(`  ERROR: unknown placeholder {{${key}}}`);
      process.exit(1);
    }
    return value;
  });
}

const skillDirs = readdirSync(SKILLS_DIR).filter((name) => {
  const p = join(SKILLS_DIR, name);
  return statSync(p).isDirectory() && !name.startsWith(".");
});

let generated = 0;

for (const dir of skillDirs.sort()) {
  const tmplPath = join(SKILLS_DIR, dir, "SKILL.md.tmpl");
  const outPath = join(SKILLS_DIR, dir, "SKILL.md");

  let tmpl: string;
  try {
    tmpl = readFileSync(tmplPath, "utf-8");
  } catch {
    // No template for this skill — skip
    continue;
  }

  const resolved = resolve(tmpl);
  writeFileSync(outPath, resolved);
  generated++;
  console.log(`  ${dir}/SKILL.md`);
}

console.log(
  `\nGenerated ${generated} SKILL.md file${generated !== 1 ? "s" : ""}.`,
);

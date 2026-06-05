/**
 * gen-skill-docs.ts — Generate SKILL.md files from .tmpl templates.
 *
 * Discovers all SKILL.md.tmpl files under .claude/skills/,
 * resolves {{PLACEHOLDER}} markers via function-based resolvers,
 * writes SKILL.md alongside each template.
 *
 * Usage:
 *   bun run scripts/gen-skill-docs.ts            # generate all
 *   bun run scripts/gen-skill-docs.ts --dry-run   # check freshness (exit 1 if stale)
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { RESOLVERS } from "./resolvers/index";

const ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(ROOT, ".claude", "skills");
const dryRun = process.argv.includes("--dry-run");

function resolve(template: string, skillName: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const resolver = RESOLVERS[key];
    if (!resolver) {
      console.error(`  ERROR: unknown placeholder {{${key}}} in ${skillName}`);
      process.exit(1);
    }
    return resolver();
  });
}

const skillDirs = readdirSync(SKILLS_DIR).filter((name) => {
  const p = join(SKILLS_DIR, name);
  return statSync(p).isDirectory() && !name.startsWith(".");
});

let generated = 0;
let stale = 0;

for (const dir of skillDirs.sort()) {
  const tmplPath = join(SKILLS_DIR, dir, "SKILL.md.tmpl");
  const outPath = join(SKILLS_DIR, dir, "SKILL.md");

  let tmpl: string;
  try {
    tmpl = readFileSync(tmplPath, "utf-8");
  } catch {
    continue;
  }

  const resolved = resolve(tmpl, dir);

  if (dryRun) {
    let existing: string;
    try {
      existing = readFileSync(outPath, "utf-8");
    } catch {
      console.error(
        `  MISSING: ${dir}/SKILL.md (template exists but no generated file)`,
      );
      stale++;
      continue;
    }
    if (existing !== resolved) {
      console.error(
        `  STALE: ${dir}/SKILL.md (run 'bun run build' to regenerate)`,
      );
      stale++;
    }
    continue;
  }

  writeFileSync(outPath, resolved);
  generated++;
  console.log(`  ${dir}/SKILL.md`);
}

if (dryRun) {
  if (stale > 0) {
    console.error(
      `\n${stale} stale file${stale !== 1 ? "s" : ""}. Run 'bun run build' to regenerate.`,
    );
    process.exit(1);
  }
  console.log("All SKILL.md files are up to date.");
} else {
  console.log(
    `\nGenerated ${generated} SKILL.md file${generated !== 1 ? "s" : ""}.`,
  );
}

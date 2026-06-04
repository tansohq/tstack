import { test, expect, describe } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Setup: paths and dynamic enumeration
// ---------------------------------------------------------------------------

const ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(ROOT, ".claude", "skills");
const CLAUDE_MD = join(ROOT, "CLAUDE.md");

/** Discover every skill directory that contains a SKILL.md */
const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter(
    (d) => d.isDirectory() && existsSync(join(SKILLS_DIR, d.name, "SKILL.md")),
  )
  .map((d) => d.name);

/** Parse YAML frontmatter from a SKILL.md file */
function parseFrontmatter(filepath: string): Record<string, unknown> {
  const raw = readFileSync(filepath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`No frontmatter in ${filepath}`);
  return yaml.load(match[1]) as Record<string, unknown>;
}

/** Read the full text of a SKILL.md */
function readSkill(name: string): string {
  return readFileSync(join(SKILLS_DIR, name, "SKILL.md"), "utf-8");
}

/** Parse all frontmatters keyed by directory name */
const frontmatters: Record<string, Record<string, unknown>> = {};
for (const dir of skillDirs) {
  frontmatters[dir] = parseFrontmatter(join(SKILLS_DIR, dir, "SKILL.md"));
}

// ---------------------------------------------------------------------------
// 1. Frontmatter structure
// ---------------------------------------------------------------------------

describe("Frontmatter structure", () => {
  for (const dir of skillDirs) {
    const fm = frontmatters[dir];

    test(`${dir}: has required fields`, () => {
      for (const field of [
        "name",
        "version",
        "description",
        "triggers",
        "allowed-tools",
      ]) {
        expect(fm).toHaveProperty(field);
      }
    });

    test(`${dir}: name matches directory`, () => {
      expect(fm.name).toBe(dir);
    });

    test(`${dir}: version is valid semver (X.Y.Z)`, () => {
      expect(typeof fm.version).toBe("string");
      expect(fm.version as string).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test(`${dir}: triggers is a non-empty array`, () => {
      expect(Array.isArray(fm.triggers)).toBe(true);
      expect((fm.triggers as unknown[]).length).toBeGreaterThan(0);
    });

    test(`${dir}: allowed-tools is a non-empty array`, () => {
      const tools = fm["allowed-tools"];
      expect(Array.isArray(tools)).toBe(true);
      expect((tools as unknown[]).length).toBeGreaterThan(0);
    });

    test(`${dir}: description is a non-empty string`, () => {
      expect(typeof fm.description).toBe("string");
      expect((fm.description as string).trim().length).toBeGreaterThan(0);
    });
  }

  // Sanity: verify the parser actually extracted real data
  test("parser sanity: meter-design has 5 triggers and description mentions billing unit", () => {
    const fm = frontmatters["meter-design"];
    expect((fm.triggers as unknown[]).length).toBe(5);
    expect((fm.description as string).toLowerCase()).toContain("billing unit");
  });
});

// ---------------------------------------------------------------------------
// 2. Chain consistency — artifact inputs and outputs
// ---------------------------------------------------------------------------

/**
 * The artifact chain encoded from the actual Inputs/Outputs sections.
 * monetization-engineer is the orchestrator and does NOT produce an artifact.
 */
const CHAIN: {
  skill: string;
  inputs: string[]; // artifact filenames this skill reads
  output: string; // artifact filename this skill writes
}[] = [
  { skill: "meter-design", inputs: [], output: "METER.md" },
  { skill: "pricing-model", inputs: ["METER.md"], output: "PLAN.md" },
  {
    skill: "entitlement-enforcement",
    inputs: ["PLAN.md"],
    output: "ENFORCEMENT.md",
  },
  {
    skill: "credit-ledger",
    inputs: ["PLAN.md", "ENFORCEMENT.md"],
    output: "CREDITS.md",
  },
  {
    skill: "reconciliation",
    inputs: ["METER.md", "PLAN.md", "ENFORCEMENT.md", "CREDITS.md"],
    output: "RECONCILIATION.md",
  },
  {
    skill: "provider-integration",
    inputs: [
      "METER.md",
      "PLAN.md",
      "ENFORCEMENT.md",
      "CREDITS.md",
      "RECONCILIATION.md",
    ],
    output: "INTEGRATION.md",
  },
];

describe("Chain consistency", () => {
  for (const { skill, inputs, output } of CHAIN) {
    const text = readSkill(skill);

    test(`${skill}: outputs ${output}`, () => {
      // The Outputs section should reference the artifact filename
      expect(text).toContain(`.claude/artifacts/${output}`);
    });

    if (inputs.length === 0) {
      test(`${skill}: has no upstream inputs (first in chain)`, () => {
        // meter-design explicitly states "None" for inputs
        expect(text).toMatch(/##\s*Inputs[\s\S]*?None/);
      });
    } else {
      for (const input of inputs) {
        test(`${skill}: reads upstream artifact ${input}`, () => {
          expect(text).toContain(`.claude/artifacts/${input}`);
        });
      }
    }
  }

  test("every chain skill exists as a directory", () => {
    for (const { skill } of CHAIN) {
      expect(skillDirs).toContain(skill);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. CLAUDE.md routing table
// ---------------------------------------------------------------------------

describe("CLAUDE.md routing table", () => {
  const claudeMd = readFileSync(CLAUDE_MD, "utf-8");

  /** Extract skill names from the routing table rows (| trigger | /skill-name |) */
  function parseRoutingTable(): string[] {
    const skills: string[] = [];
    // Match table rows (skip header and separator)
    const tableRows = claudeMd.match(/\|[^|]+\|[^|]+\|/g) ?? [];
    for (const row of tableRows) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 2) continue;
      const skillCell = cells[1]; // second column
      const match = skillCell.match(/^\/(\S+)$/);
      if (match) {
        skills.push(match[1]);
      }
    }
    return skills;
  }

  const routedSkills = parseRoutingTable();

  test("routing table is non-empty", () => {
    expect(routedSkills.length).toBeGreaterThan(0);
  });

  test("every skill in routing table exists as a directory", () => {
    for (const skill of routedSkills) {
      expect(skillDirs).toContain(skill);
    }
  });

  test("every skill directory has a routing table entry", () => {
    for (const dir of skillDirs) {
      expect(routedSkills).toContain(dir);
    }
  });

  test("chain order in CLAUDE.md matches artifact dependency order", () => {
    // Extract the chain line: "meter → pricing → enforcement → credits → reconciliation → integration"
    const chainMatch = claudeMd.match(
      /meter\s*→\s*pricing\s*→\s*enforcement\s*→\s*credits\s*→\s*reconciliation\s*→\s*integration/,
    );
    expect(chainMatch).not.toBeNull();

    // Map short names in the chain line to full directory names
    const shortToFull: Record<string, string> = {
      meter: "meter-design",
      pricing: "pricing-model",
      enforcement: "entitlement-enforcement",
      credits: "credit-ledger",
      reconciliation: "reconciliation",
      integration: "provider-integration",
    };

    const chainLine = chainMatch![0];
    const shortNames = chainLine.split("→").map((s) => s.trim());
    const chainOrder = shortNames.map((s) => shortToFull[s]);

    // Verify it matches our CHAIN definition order
    const expectedOrder = CHAIN.map((c) => c.skill);
    expect(chainOrder).toEqual(expectedOrder);
  });
});

// ---------------------------------------------------------------------------
// 4. Allowed-tools consistency
// ---------------------------------------------------------------------------

describe("Allowed-tools consistency", () => {
  const nonOrchestratorSkills = skillDirs.filter(
    (d) => d !== "monetization-engineer",
  );

  test("there are exactly 6 non-orchestrator skills", () => {
    expect(nonOrchestratorSkills.length).toBe(6);
  });

  test("all non-orchestrator skills have identical allowed-tools", () => {
    const first = (
      frontmatters[nonOrchestratorSkills[0]]["allowed-tools"] as string[]
    )
      .slice()
      .sort();
    for (const dir of nonOrchestratorSkills.slice(1)) {
      const tools = (frontmatters[dir]["allowed-tools"] as string[])
        .slice()
        .sort();
      expect(tools).toEqual(first);
    }
  });

  test("monetization-engineer has the standard list plus Agent", () => {
    const baseTools = new Set(
      frontmatters[nonOrchestratorSkills[0]]["allowed-tools"] as string[],
    );
    const orchTools = new Set(
      frontmatters["monetization-engineer"]["allowed-tools"] as string[],
    );

    // orchestrator should have everything base has
    for (const tool of baseTools) {
      expect(orchTools.has(tool)).toBe(true);
    }

    // the extra tool should be exactly "Agent"
    const extras = [...orchTools].filter((t) => !baseTools.has(t));
    expect(extras).toEqual(["Agent"]);
  });

  test("standard allowed-tools list contains expected tools", () => {
    const tools = frontmatters[nonOrchestratorSkills[0]][
      "allowed-tools"
    ] as string[];
    expect(tools).toContain("Bash");
    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
    expect(tools).toContain("Edit");
    expect(tools).toContain("AskUserQuestion");
  });
});

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
// Skill classification
// ---------------------------------------------------------------------------

const SKILL_CLASSES: Record<
  string,
  { skills: string[]; requiredTools: string[] }
> = {
  chain: {
    skills: [
      "meter-design",
      "pricing-model",
      "entitlement-enforcement",
      "credit-ledger",
      "account-hierarchy",
      "reconciliation",
      "provider-integration",
    ],
    requiredTools: ["Bash", "Read", "Write", "Edit", "AskUserQuestion"],
  },
  orchestrator: {
    skills: ["monetization-engineer"],
    requiredTools: [
      "Bash",
      "Read",
      "Write",
      "Edit",
      "AskUserQuestion",
      "Agent",
    ],
  },
  "team-review": {
    skills: [
      "billing-reviewer",
      "pricing-auditor",
      "billing-qa",
      "alignment-check",
    ],
    requiredTools: ["Bash", "Read", "Grep", "AskUserQuestion"],
  },
  "team-ops": {
    skills: ["billing-operations", "migration-planner"],
    requiredTools: ["Bash", "Read", "Write", "Edit", "AskUserQuestion"],
  },
  "team-intelligence": {
    skills: ["revenue-reporter", "account-intelligence", "api-health-analyst"],
    requiredTools: ["Bash", "Read", "Grep", "AskUserQuestion"],
  },
  "team-observability": {
    skills: ["billing-observability"],
    requiredTools: ["Bash", "Read", "Grep", "AskUserQuestion"],
  },
  "team-design": {
    skills: ["billing-ux-designer"],
    requiredTools: ["Bash", "Read", "Write", "AskUserQuestion"],
  },
  "team-research": {
    skills: ["pricing-researcher"],
    requiredTools: ["Bash", "Read", "Grep", "WebSearch", "AskUserQuestion"],
  },
};

const ALL_CLASSIFIED_SKILLS = Object.values(SKILL_CLASSES).flatMap(
  (c) => c.skills,
);
const CHAIN_SKILLS = SKILL_CLASSES.chain.skills;
const TEAM_SKILLS = Object.entries(SKILL_CLASSES)
  .filter(([key]) => key.startsWith("team-"))
  .flatMap(([, c]) => c.skills);

function getClassForSkill(
  skill: string,
): { className: string; requiredTools: string[] } | undefined {
  for (const [className, cls] of Object.entries(SKILL_CLASSES)) {
    if (cls.skills.includes(skill)) {
      return { className, requiredTools: cls.requiredTools };
    }
  }
  return undefined;
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

  test("parser sanity: meter-design has 5 triggers and description mentions billing unit", () => {
    const fm = frontmatters["meter-design"];
    expect((fm.triggers as unknown[]).length).toBe(5);
    expect((fm.description as string).toLowerCase()).toContain("billing unit");
  });
});

// ---------------------------------------------------------------------------
// 2. Skill classification
// ---------------------------------------------------------------------------

describe("Skill classification", () => {
  test("every skill directory is classified", () => {
    for (const dir of skillDirs) {
      expect(ALL_CLASSIFIED_SKILLS).toContain(dir);
    }
  });

  test("no duplicate classifications", () => {
    const seen = new Set<string>();
    for (const skill of ALL_CLASSIFIED_SKILLS) {
      expect(seen.has(skill)).toBe(false);
      seen.add(skill);
    }
  });

  test("chain has 7 skills", () => {
    expect(CHAIN_SKILLS.length).toBe(7);
  });

  test("team has 12 skills", () => {
    expect(TEAM_SKILLS.length).toBe(12);
  });

  test("total classified is 20 (7 chain + 12 team + 1 orchestrator)", () => {
    expect(ALL_CLASSIFIED_SKILLS.length).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 3. Chain consistency — artifact inputs and outputs
// ---------------------------------------------------------------------------

const CHAIN: {
  skill: string;
  inputs: string[];
  output: string;
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
    skill: "account-hierarchy",
    inputs: ["CREDITS.md", "ENFORCEMENT.md"],
    output: "HIERARCHY.md",
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
      expect(text).toContain(`.claude/artifacts/${output}`);
    });

    if (inputs.length === 0) {
      test(`${skill}: has no upstream inputs (first in chain)`, () => {
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
// 4. Team skill consistency
// ---------------------------------------------------------------------------

describe("Team skill consistency", () => {
  for (const skill of TEAM_SKILLS) {
    if (!skillDirs.includes(skill)) continue;
    const text = readSkill(skill);

    test(`${skill}: references .claude/artifacts/ (reads artifacts)`, () => {
      expect(text).toContain(".claude/artifacts/");
    });

    test(`${skill}: does NOT write artifacts`, () => {
      expect(text).not.toMatch(/Writes\s+`?\.claude\/artifacts\//);
    });

    test(`${skill}: has explicit artifact-write guard`, () => {
      expect(text).toMatch(/Do NOT write to.*\.claude\/artifacts/);
    });

    test(`${skill}: has methodology section`, () => {
      expect(text).toMatch(/##\s*(Methodology|Reactive Methodology)/);
    });

    test(`${skill}: has findings or confidence section`, () => {
      expect(text).toMatch(/##\s*(Findings|Confidence|Findings Format)/);
    });
  }
});

// ---------------------------------------------------------------------------
// 5. CLAUDE.md routing table
// ---------------------------------------------------------------------------

describe("CLAUDE.md routing table", () => {
  const claudeMd = readFileSync(CLAUDE_MD, "utf-8");

  function parseRoutingTable(): string[] {
    const skills: string[] = [];
    const tableRows = claudeMd.match(/\|[^|]+\|[^|]+\|/g) ?? [];
    for (const row of tableRows) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 2) continue;
      const skillCell = cells[1];
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
    const chainMatch = claudeMd.match(
      /meter\s*→\s*pricing\s*→\s*enforcement\s*→\s*credits\s*→\s*\[hierarchy\]\s*→\s*reconciliation\s*→\s*integration/,
    );
    expect(chainMatch).not.toBeNull();

    const shortToFull: Record<string, string> = {
      meter: "meter-design",
      pricing: "pricing-model",
      enforcement: "entitlement-enforcement",
      credits: "credit-ledger",
      "[hierarchy]": "account-hierarchy",
      reconciliation: "reconciliation",
      integration: "provider-integration",
    };

    const chainLine = chainMatch![0];
    const shortNames = chainLine.split("→").map((s) => s.trim());
    const chainOrder = shortNames.map((s) => shortToFull[s]);

    const expectedOrder = CHAIN.map((c) => c.skill);
    expect(chainOrder).toEqual(expectedOrder);
  });
});

// ---------------------------------------------------------------------------
// 6. Allowed-tools consistency (per-class)
// ---------------------------------------------------------------------------

describe("Allowed-tools consistency", () => {
  for (const [className, cls] of Object.entries(SKILL_CLASSES)) {
    for (const skill of cls.skills) {
      if (!skillDirs.includes(skill)) continue;

      test(`${skill} (${className}): has required tools`, () => {
        const tools = frontmatters[skill]["allowed-tools"] as string[];
        for (const required of cls.requiredTools) {
          expect(tools).toContain(required);
        }
      });

      test(`${skill} (${className}): has no extra tools`, () => {
        const tools = new Set(frontmatters[skill]["allowed-tools"] as string[]);
        const required = new Set(cls.requiredTools);
        const extras = [...tools].filter((t) => !required.has(t));
        expect(extras).toEqual([]);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 7. Trigger uniqueness
// ---------------------------------------------------------------------------

describe("Trigger uniqueness", () => {
  test("no trigger phrase is shared across skills", () => {
    const seen = new Map<string, string>();
    for (const dir of skillDirs) {
      const triggers = frontmatters[dir].triggers as string[];
      for (const trigger of triggers) {
        const normalized = trigger.toLowerCase().trim();
        if (seen.has(normalized)) {
          throw new Error(
            `Trigger "${trigger}" used by both ${seen.get(normalized)} and ${dir}`,
          );
        }
        seen.set(normalized, dir);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Template freshness
// ---------------------------------------------------------------------------

describe("Template freshness", () => {
  test("every skill with a .tmpl has a matching SKILL.md", () => {
    for (const dir of skillDirs) {
      const tmplPath = join(SKILLS_DIR, dir, "SKILL.md.tmpl");
      if (!existsSync(tmplPath)) continue;
      const outPath = join(SKILLS_DIR, dir, "SKILL.md");
      expect(existsSync(outPath)).toBe(true);
    }
  });
});

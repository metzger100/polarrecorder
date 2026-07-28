/**
 * Contract test for smell-catalog completeness: `documentation/conventions/smell-prevention.md`
 * must list exactly the required smell catalog rules, with no duplicates, and every
 * executable rule id from the pattern and smell-contract checkers must appear in the
 * catalog text. This is the Vitest contract replacement for the retired
 * tools/check-smell-catalog.mjs; every assertion it made is preserved below.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { PATTERN_RULE_IDS } from "../../tools/check-patterns.mjs";
import { SMELL_CONTRACT_RULE_IDS } from "../../tools/check-smell-contracts.mjs";

export const REQUIRED_SMELL_RULES = [
  "Ruff selected families",
  "Ruff format",
  "Strict typing",
  "Python 3.9 runtime floor",
  "Future annotations",
  "Public docstrings",
  "Print statement",
  "Broad domain exception",
  "Magic threshold",
  "AvNav import leak",
  "Reverse dependency",
  "Lock acquisition in domain code",
  "Real sleep in domain code",
  "Defensive fallback masking a contract gap",
  "Absent-value sentinel",
  "Redundant type guard",
  "Framework method guard",
  "Premature legacy support",
  "Canonical helper redefinition",
  "Stale canonical-helper map",
  "Duplicate Python logic",
  "Python file size",
  "Python module header",
  "Python one-line compression",
  "Python suppression comment",
  "Stale Python dependency header",
  "Domain import cycle",
  "Backwards layer import",
  "Stale layer map",
  "Hot-path regression",
  "Runtime non-finite leak",
  "Viewer namespace",
  "JS naming",
  "Viewer module header",
  "Viewer dependency header",
  "Viewer script order",
  "Viewer module-load dependency",
  "JS namespace cycle",
  "JS ES module syntax",
  "JS debug leftover",
  "JS `var` declaration",
  "JS loose equality",
  "JS unsafe execution or DOM mutation",
  "JS bare finite check",
  "JS commented-out code",
  "Viewer suppression comment",
  "Empty catch",
  "Silent catch fallback",
  "Internal namespace re-default",
  "Truthy default clobber",
  "Redundant JS re-sanitize",
  "Hardcoded runtime default",
  "Placeholder literal duplication",
  "Responsive hard floor",
  "Canvas API paranoia",
  "Try/finally canvas drawing",
  "JS framework method guard",
  "JS dead code",
  "JS unused fallback",
  "JS premature legacy support",
  "Duplicate viewer helper",
  "Viewer file size",
  "JS one-line compression",
  "JS complexity regression",
  "Viewer coverage target",
  "Untested viewer logic",
  "Viewer rendered sentinel",
  "Viewer absent placeholder",
  "Viewer falsy preservation",
  "Plugin entry contract",
  "Viewer behavior regressions",
  "Documentation TOC coverage",
  "Documentation format",
  "Documentation reachability",
  "CLAUDE.md pointer drift",
  "Markdown file size",
  "Machine-specific host citation",
  "Unowned TODO",
  "Exec-plan/phase citation",
  "Maintained-source NUL byte",
  "Release artifact drift",
  "Hook installation drift",
  "Custom checker without tests",
  "Smell catalog completeness",
  "Pytest regressions",
  "Overall Python coverage",
  "Validation coverage floor",
  "Histogram coverage floor",
  "Plugin.py coverage floor",
  "JS coverage family floor",
  "Coverage inventory completeness",
  "Coverage floor regression",
  "Fixture drift",
  "Focused JS test",
  "Focused Python test"
];

export const EXECUTABLE_SMELL_RULE_IDS = [
  ...PATTERN_RULE_IDS.map((id) => ({ owner: "check-patterns.mjs", id })),
  ...SMELL_CONTRACT_RULE_IDS.map((id) => ({ owner: "check-smell-contracts.mjs", id }))
];

/**
 * @typedef {object} RuleRow
 * @property {string} name Trimmed rule name from the leading table cell.
 * @property {string} text Full raw table row line.
 */

/**
 * Parses smell catalog table rows out of the catalog Markdown, skipping the header row and
 * the separator row.
 *
 * @param {string} markdown Full contents of the smell catalog Markdown file.
 * @returns {RuleRow[]} Parsed rule rows.
 */
function parseRuleRows(markdown) {
  /** @type {RuleRow[]} */
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const match = /^\|\s*([^|]+?)\s*\|/.exec(line);
    if (!match) continue;
    const rule = match[1].trim();
    if (rule === "Rule" || /^-+$/.test(rule)) continue;
    rows.push({ name: rule, text: line });
  }
  return rows;
}

/**
 * Finds rule names that appear more than once.
 * @param {string[]} names
 * @returns {string[]}
 */
function duplicateRows(names) {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Set<string>} */
  const duplicates = new Set();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return Array.from(duplicates).sort();
}

/**
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
function runSmellCatalogCheck(options = {}) {
  const root = options.root || process.cwd();
  const docPath = path.join(root, "documentation", "conventions", "smell-prevention.md");
  /** @type {string[]} */
  const failures = [];

  if (!fs.existsSync(docPath)) {
    failures.push("documentation/conventions/smell-prevention.md is missing");
    return { ok: false, failures };
  }

  const rows = parseRuleRows(fs.readFileSync(docPath, "utf8"));
  const found = new Set(rows.map((row) => row.name));
  const required = new Set(REQUIRED_SMELL_RULES);

  for (const rule of REQUIRED_SMELL_RULES) {
    if (!found.has(rule)) failures.push(`missing smell catalog row for '${rule}'`);
  }
  for (const row of rows) {
    if (!required.has(row.name)) failures.push(`unknown smell catalog row '${row.name}'`);
  }
  for (const { owner, id } of EXECUTABLE_SMELL_RULE_IDS) {
    if (!rows.some((row) => row.text.includes("`" + id + "`"))) {
      failures.push(`missing executable smell rule '${id}' from ${owner}`);
    }
  }
  for (const duplicate of duplicateRows(rows.map((row) => row.name))) {
    failures.push(`duplicate smell catalog row '${duplicate}'`);
  }

  return { ok: failures.length === 0, failures };
}

/** @param {Record<string, string>} files @returns {string} */
function makeFakeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-smell-catalog-"));
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
  return root;
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

/**
 * @param {string[]} rules
 * @returns {string}
 */
function smellCatalogDocument(rules) {
  const executableIds = EXECUTABLE_SMELL_RULE_IDS.map((rule) => "`" + rule.id + "`").join(", ");
  const rows = rules
    .map((rule, index) => {
      const enforcement = index === 0 ? `checker (${executableIds})` : "checker";
      return `| ${rule} | forbidden | required | ${enforcement} |`;
    })
    .join("\n");
  return (
    "# Smell Prevention\n\n" +
    "**Status:** Current.\n\n" +
    "## Overview\n\n" +
    "Catalog.\n\n" +
    "## Key Details\n\n" +
    "| Rule | Forbidden or Required | Replacement or Required Pattern | Enforcement |\n" +
    "|---|---|---|---|\n" +
    rows +
    "\n\n## Related\n\n" +
    "- [Quality gates](quality-gates.md)\n"
  );
}

test("real repo passes", () => {
  const result = runSmellCatalogCheck({ root: process.cwd() });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("a clean fixture catalog passes", () => {
  const root = makeFakeRoot({
    "documentation/conventions/smell-prevention.md": smellCatalogDocument(REQUIRED_SMELL_RULES)
  });
  const result = runSmellCatalogCheck({ root });
  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

test("a missing required rule fails", () => {
  const root = makeFakeRoot({
    "documentation/conventions/smell-prevention.md": smellCatalogDocument(
      REQUIRED_SMELL_RULES.filter((rule) => rule !== "Ruff format")
    )
  });
  const result = runSmellCatalogCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("missing smell catalog row")));
  cleanup(root);
});

test("an unknown catalog row fails", () => {
  const root = makeFakeRoot({
    "documentation/conventions/smell-prevention.md": smellCatalogDocument(REQUIRED_SMELL_RULES.concat("Mystery rule"))
  });
  const result = runSmellCatalogCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("unknown smell catalog row")));
  cleanup(root);
});

test("a missing documentation file fails", () => {
  const root = makeFakeRoot({});
  const result = runSmellCatalogCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("is missing")));
  cleanup(root);
});

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PATTERN_RULE_IDS } from "./check-patterns.mjs";
import { SMELL_CONTRACT_RULE_IDS } from "./check-smell-contracts.mjs";

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
  "Viewer coverage target",
  "Untested viewer logic",
  "Viewer rendered sentinel",
  "Viewer absent placeholder",
  "Viewer falsy preservation",
  "`plugin.mjs` entry contract",
  "Viewer behavior regressions",
  "Documentation TOC coverage",
  "Documentation format",
  "Documentation reachability",
  "AI instruction drift",
  "Markdown file size",
  "Machine-specific host citation",
  "Unowned TODO",
  "Release artifact drift",
  "Hook installation drift",
  "Custom checker without tests",
  "Smell catalog completeness",
  "Pytest regressions",
  "Overall Python coverage",
  "Validation coverage floor",
  "Histogram coverage floor",
  "Fixture drift"
];

export const EXECUTABLE_SMELL_RULE_IDS = [
  ...PATTERN_RULE_IDS.map((id) => ({ owner: "check-patterns.mjs", id })),
  ...SMELL_CONTRACT_RULE_IDS.map((id) => ({ owner: "check-smell-contracts.mjs", id }))
];

export function runSmellCatalogCheck({ root = process.cwd(), print = true } = {}) {
  const docPath = path.join(root, "documentation", "conventions", "smell-prevention.md");
  const failures = [];

  if (!fs.existsSync(docPath)) {
    failures.push("documentation/conventions/smell-prevention.md is missing");
  } else {
    const rows = parseRuleRows(fs.readFileSync(docPath, "utf8"));
    const found = new Set(rows.map((row) => row.name));
    const required = new Set(REQUIRED_SMELL_RULES);

    for (const rule of REQUIRED_SMELL_RULES) {
      if (!found.has(rule)) {
        failures.push(`missing smell catalog row for '${rule}'`);
      }
    }
    for (const row of rows) {
      if (!required.has(row.name)) {
        failures.push(`unknown smell catalog row '${row.name}'`);
      }
    }
    for (const { owner, id } of EXECUTABLE_SMELL_RULE_IDS) {
      if (!rows.some((row) => row.text.includes("`" + id + "`"))) {
        failures.push(`missing executable smell rule '${id}' from ${owner}`);
      }
    }
    for (const duplicate of duplicateRows(rows.map((row) => row.name))) {
      failures.push(`duplicate smell catalog row '${duplicate}'`);
    }
  }

  const summary = {
    ok: failures.length === 0,
    requiredRules: REQUIRED_SMELL_RULES.length,
    executableRuleIds: EXECUTABLE_SMELL_RULE_IDS.length,
    failures: failures.length
  };

  if (print) reportSmellCatalog(failures, summary);
  return { ok: summary.ok, failures, summary };
}

function parseRuleRows(markdown) {
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

function duplicateRows(rows) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    if (seen.has(row)) duplicates.add(row);
    seen.add(row);
  }
  return Array.from(duplicates).sort();
}

function reportSmellCatalog(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[smell-catalog] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Smell catalog check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runSmellCatalogCheck().ok ? 0 : 1);
}

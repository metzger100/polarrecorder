import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

import { CANONICAL_GENERIC_RULE_IDS, runGenericRule } from "../../tools/portable-core/generic-rule-engine.mjs";

const ROOT = process.cwd();
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/portable-core/generic-rule-corpus.json"), "utf8"));
const golden = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/portable-core/generic-rule-conformance.golden.json"), "utf8")
);
/** @type {any[]} */
const rules = corpus.rules;

test("every canonical rule has executable clean and failing corpus cases", function () {
  expect(corpus.schemaVersion).toBe(1);
  expect(rules.map((/** @type {any} */ rule) => rule.id)).toEqual(CANONICAL_GENERIC_RULE_IDS);
  expect(Object.keys(golden)).toEqual(CANONICAL_GENERIC_RULE_IDS);
  for (const rule of rules) {
    expect(rule.clean.length).toBeGreaterThan(0);
    expect(rule.failing.length).toBeGreaterThan(0);
    expect(runGenericRule(rule.id, materialize(rule.clean))).toEqual([]);
    const findings = runGenericRule(rule.id, materialize(rule.failing));
    expect(findings).toHaveLength(rule.expectedFailingCount);
    expect(normalize(findings)).toEqual(golden[rule.id]);
  }
});

test("the corpus cannot silently omit a rule or use an external path", function () {
  const ids = rules.map((/** @type {any} */ rule) => rule.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const rule of rules) {
    for (const file of [...rule.clean, ...rule.failing]) {
      expect(file.path).not.toMatch(/^(?:\/|[A-Za-z]:|.*(?:^|\/)\.\.(?:\/|$))/);
    }
  }
});

/** @param {Array<{ruleId: string, path: string, line: number}>} findings */
function normalize(findings) {
  return findings.map(({ ruleId, path: filePath, line }) => ({ ruleId, path: filePath, line }));
}

/** @param {Array<{path: string, content?: string, fragments?: string[]}>} files */
function materialize(files) {
  return files.map((file) => ({ path: file.path, content: file.content ?? (file.fragments || []).join("") }));
}

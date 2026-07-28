/**
 * Contract tests for the declarative check-patterns rule registry (Phase E of the
 * quality-tooling convergence): the registry's rule names must match `PATTERN_RULE_IDS`
 * exactly (the drift assertion the smell catalog also depends on), and every file in the
 * generic rule directory must be free of project-specific tokens, so it can be lifted
 * verbatim into another repository that registers its own configuration.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

import { PATTERN_RULE_IDS, RULES } from "../../tools/check-patterns.mjs";
import { GENERIC_RULES, PROJECT_RULES } from "../../tools/check-patterns/rules.mjs";

const FORBIDDEN_GENERIC_TOKENS = ["polarrecorder", "avnav", "pluginhandler", "configcache"];
const GENERIC_DIR = path.join(process.cwd(), "tools", "check-patterns", "generic");

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listMjsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMjsFiles(abs));
    else if (entry.name.endsWith(".mjs")) out.push(abs);
  }
  return out;
}

test("every RULES entry names one of PATTERN_RULE_IDS, and every id is covered", () => {
  const registryNames = new Set(RULES.map((rule) => rule.name));
  const catalogIds = new Set(PATTERN_RULE_IDS);
  const missingFromCatalog = [...registryNames].filter((name) => !catalogIds.has(name)).sort();
  const missingFromRegistry = [...catalogIds].filter((id) => !registryNames.has(id)).sort();
  assert.deepEqual(missingFromCatalog, [], `rule registry names not in PATTERN_RULE_IDS: ${missingFromCatalog}`);
  assert.deepEqual(missingFromRegistry, [], `PATTERN_RULE_IDS not backed by a rule: ${missingFromRegistry}`);
});

test("RULES is exactly the concatenation of GENERIC_RULES and PROJECT_RULES", () => {
  assert.equal(RULES.length, GENERIC_RULES.length + PROJECT_RULES.length);
  assert.deepEqual(
    RULES.map((r) => r.id),
    [...GENERIC_RULES, ...PROJECT_RULES].map((r) => r.id)
  );
});

test("every generic rule-def file is free of project-specific tokens", () => {
  const files = listMjsFiles(GENERIC_DIR);
  assert.ok(files.length > 0, "expected at least one generic rule-def file");
  /** @type {string[]} */
  const violations = [];
  for (const file of files) {
    const lower = fs.readFileSync(file, "utf8").toLowerCase();
    for (const token of FORBIDDEN_GENERIC_TOKENS) {
      if (lower.includes(token)) violations.push(`${path.relative(process.cwd(), file)}: contains '${token}'`);
    }
  }
  assert.deepEqual(violations, []);
});

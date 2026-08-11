/**
 * Contract tests for the declarative check-patterns rule registry: the registry's rule names must match `PATTERN_RULE_IDS`
 * exactly (the drift assertion the smell catalog also depends on).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

import { PATTERN_RULE_IDS, RULES } from "../../tools/check-patterns.mjs";
import { findMatchingBrace } from "../../tools/check-patterns/ast-utils.mjs";
import { runNamespacePolicyRule } from "../../tools/check-patterns/generic/namespace-policy.mjs";
import { CANONICAL_GENERIC_RULE_IDS, runGenericRule } from "../../tools/portable-core/generic-rule-engine.mjs";
import { runRegexRule } from "../../tools/check-patterns/rules-core.mjs";
import { GENERIC_RULES, PROJECT_RULES } from "../../tools/check-patterns/rules.mjs";

const ROOT = process.cwd();
const PROJECT_SCOPES_PATH = path.join(ROOT, "tools", "quality-policy", "project-pattern-scopes.json");

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

test("the Tier 2 profile fixes every rule's final classification", () => {
  const { canonicalGenericRuleNames } = JSON.parse(fs.readFileSync(PROJECT_SCOPES_PATH, "utf8"));
  const genericNames = GENERIC_RULES.map((rule) => rule.name);
  const projectNames = PROJECT_RULES.map((rule) => rule.name);
  assert.deepEqual(genericNames, canonicalGenericRuleNames);
  assert.deepEqual(
    projectNames.filter((name) => canonicalGenericRuleNames.includes(name)),
    []
  );
  assert.deepEqual(
    RULES.filter((rule) => !canonicalGenericRuleNames.includes(rule.name)).map((rule) => rule.name),
    projectNames
  );
  assert.ok(PROJECT_RULES.some((rule) => rule.name === "avnav-import"));
  assert.ok(PROJECT_RULES.some((rule) => rule.name === "pluginhandler-import"));
  assert.ok(PROJECT_RULES.some((rule) => rule.name === "reverse-plugin-import"));
  assert.ok(PROJECT_RULES.some((rule) => rule.name === "domain-lock-acquisition"));
  assert.ok(PROJECT_RULES.some((rule) => rule.name === "domain-time-sleep"));
  assert.ok(!PROJECT_RULES.some((rule) => rule.name === "invalid-lint-suppression"));
});

test("generic engine helpers remain direct-importable manifest targets", () => {
  assert.equal(findMatchingBrace("{}", 0), 1);
  assert.equal(typeof runRegexRule, "function");
  assert.equal(typeof runNamespacePolicyRule, "function");
  assert.deepEqual(
    GENERIC_RULES.map((rule) => rule.name),
    CANONICAL_GENERIC_RULE_IDS
  );
  assert.deepEqual(runGenericRule(CANONICAL_GENERIC_RULE_IDS[0], []), []);
});

test("every generic rule has a clean corpus invocation", () => {
  for (const rule of GENERIC_RULES) {
    const runner = rule.run || runRegexRule;
    assert.equal(typeof runner, "function", `${rule.name} has no canonical runner`);
    assert.deepEqual(runner(rule, []), [], `${rule.name} rejects the clean corpus`);
  }
});

test("the registry remains fail-closed when a canonical rule is omitted", () => {
  const names = GENERIC_RULES.map((rule) => rule.name);
  assert.notDeepEqual(names.slice(0, -1), CANONICAL_GENERIC_RULE_IDS);
});

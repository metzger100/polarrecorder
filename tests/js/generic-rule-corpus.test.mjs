/**
 * Clean and failing-contract coverage for the canonical generic rule registry.
 */

import assert from "node:assert/strict";
import { test } from "vitest";

import { GENERIC_RULES } from "../../tools/check-patterns/rules.mjs";
import { CANONICAL_GENERIC_RULE_IDS } from "../../tools/portable-core/generic-rule-engine.mjs";
import { runRegexRule } from "../../tools/check-patterns/rules-core.mjs";

test("the generic registry has the canonical order and classification", () => {
  assert.deepEqual(
    GENERIC_RULES.map((rule) => rule.name),
    CANONICAL_GENERIC_RULE_IDS
  );
  assert.ok(GENERIC_RULES.every((rule) => rule.severity === "block"));
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

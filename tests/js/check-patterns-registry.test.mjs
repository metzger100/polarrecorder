/**
 * Contract tests for the declarative check-patterns rule registry: the registry's rule names must match `PATTERN_RULE_IDS`
 * exactly (the drift assertion the smell catalog also depends on), and every file in the
 * generic rule directory must be free of project-specific tokens, so it can be lifted
 * verbatim into an independent repository that registers its own configuration.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { PATTERN_RULE_IDS, RULES } from "../../tools/check-patterns.mjs";
import { findMatchingBrace } from "../../tools/check-patterns/ast-utils.mjs";
import { LINE_GENERIC_RULES } from "../../tools/check-patterns/generic/rules-regex-generic-defs.mjs";
import { runNamespacePolicyRule } from "../../tools/check-patterns/generic/namespace-policy.mjs";
import { STRUCTURAL_GENERIC_RULES } from "../../tools/check-patterns/generic/rules-core-generic-defs.mjs";
import { TODO_WITHOUT_OWNER_GENERIC_RULES } from "../../tools/check-patterns/generic/rules-failfast-generic-defs.mjs";
import { runRegexRule } from "../../tools/check-patterns/rules-core.mjs";
import { GENERIC_RULES, PROJECT_RULES } from "../../tools/check-patterns/rules.mjs";

const ROOT = process.cwd();
const GENERIC_TOKENS_PATH = path.join(ROOT, "tools", "quality-policy", "generic-tokens.json");
const PROJECT_SCOPES_PATH = path.join(ROOT, "tools", "quality-policy", "project-pattern-scopes.json");

/**
 * @param {string} [tokensPath]
 * @returns {string[]}
 */
function readGenericTokens(tokensPath = GENERIC_TOKENS_PATH) {
  const parsed = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
  return [...parsed.projectTokens, ...parsed.domainTokens, ...parsed.hostTokens];
}

const FORBIDDEN_GENERIC_TOKENS = readGenericTokens();
const GENERIC_DIR = path.join(ROOT, "tools", "check-patterns", "generic");

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
    GENERIC_RULES.slice(
      0,
      LINE_GENERIC_RULES.length + STRUCTURAL_GENERIC_RULES.length + TODO_WITHOUT_OWNER_GENERIC_RULES.length
    ),
    [...LINE_GENERIC_RULES, ...STRUCTURAL_GENERIC_RULES, ...TODO_WITHOUT_OWNER_GENERIC_RULES]
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

test("a token added to generic-tokens.json is picked up by this call site", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "generic-tokens-single-owner-"));
  const tokensPath = path.join(dir, "generic-tokens.json");
  fs.writeFileSync(
    tokensPath,
    JSON.stringify({ projectTokens: ["zzz-synthetic-token"], domainTokens: [], hostTokens: [] })
  );
  const tokens = readGenericTokens(tokensPath);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(tokens.includes("zzz-synthetic-token"));
});

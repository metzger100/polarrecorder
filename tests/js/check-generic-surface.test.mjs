/**
 * Self-test for `tools/check-generic-surface.mjs`: a fixture workspace with no
 * genericness token in any target passes, a fixture with a seeded token in each
 * of the target concepts is caught, and the repository's current finding list remains observable for contract tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { runGenericSurfaceCheck } from "../../tools/check-generic-surface.mjs";
import { runProfileSchemaCheck } from "../../tools/portable-core/schema-engine.mjs";

const BEGIN = "<!-- BEGIN SHARED_INSTRUCTIONS -->";
const END = "<!-- END SHARED_INSTRUCTIONS -->";

/**
 * @param {{seedToken: boolean}} options
 * @returns {string}
 */
function makeFixtureRoot({ seedToken }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "generic-surface-fixture-"));
  const marker = seedToken ? "This mentions widget behavior directly." : "This is repository-agnostic guidance.";
  fs.writeFileSync(root + "/AGENTS.md", `# AGENTS\n\n${BEGIN}\n${marker}\n${END}\n`);

  fs.mkdirSync(path.join(root, ".agents", "skills", "example"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".agents", "skills", "example", "SKILL.md"),
    seedToken ? "Use a gauge renderer here." : "Use a generic helper here."
  );

  fs.mkdirSync(path.join(root, "tools", "check-patterns", "generic"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "check-patterns", "generic", "example-rule.mjs"),
    seedToken ? "export const scope = 'avnav';\n" : "export const scope = 'json';\n"
  );

  fs.mkdirSync(path.join(root, "tools", "check-patterns"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "check-patterns", "shared.mjs"),
    seedToken ? "export const owner = 'polarrecorder';\n" : "export const owner = 'shared';\n"
  );

  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "generic-tokens.json"),
    JSON.stringify({
      schemaVersion: 1,
      profileType: "genericness-token-profile",
      note: "fixture",
      projectTokens: ["polarrecorder"],
      domainTokens: ["widget", "gauge", "renderer", "avnav"],
      hostTokens: ["avnav"]
    })
  );
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "generic-surface-scope.json"),
    JSON.stringify({
      skillDirs: ["example"],
      tier1ToolModules: ["tools/check-patterns/shared.mjs"],
      genericRuleDefDirs: ["tools/check-patterns/generic"]
    })
  );
  return root;
}

test("a clean fixture with no genericness token in any target passes", () => {
  const root = makeFixtureRoot({ seedToken: false });
  const result = runGenericSurfaceCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
});

test("a seeded token in each of the four target concepts is caught", () => {
  const root = makeFixtureRoot({ seedToken: true });
  const result = runGenericSurfaceCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  const targets = result.findings.map((f) => f.target);
  assert.ok(targets.some((t) => t.startsWith("SHARED_INSTRUCTIONS block")));
  assert.ok(targets.some((t) => t.startsWith("generic skill:")));
  assert.ok(targets.some((t) => t.startsWith("Tier 1 tool module:")));
  assert.ok(targets.some((t) => t.startsWith("generic rule definition:")));
});

test("current repository finding list is recorded", () => {
  const result = runGenericSurfaceCheck({ root: process.cwd(), print: false });
  assert.ok(Array.isArray(result.findings));
});

test("profile schema rejects unknown versions and fields", () => {
  assert.equal(
    runProfileSchemaCheck({ profile: { schemaVersion: 2 }, allowedFields: ["schemaVersion"], schemaVersion: 1 }).ok,
    false
  );
  assert.equal(
    runProfileSchemaCheck({
      profile: { schemaVersion: 1, extra: true },
      allowedFields: ["schemaVersion"],
      schemaVersion: 1
    }).ok,
    false
  );
});

/**
 * Self-tests for `tools/check-patterns/shared-suppressions.mjs`'s de-branded suppression
 * grammar: `plugin-lint-disable-next-line <rule> -- <reason>` and
 * `plugin-boundary-next-line(category:, owner:, date:[, expires:]) -- <reason>`. Also proves
 * the retired `pattern-ignore: <rule>` convention is no longer recognised at all -- it is
 * simply inert text now, not a suppression and not a flagged invalid directive.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import {
  resetContext,
  isLintSuppressed,
  getInvalidLintSuppressions,
  setKnownRuleNames,
  BOUNDARY_MARKER_RULE_NAME
} from "../../tools/check-patterns/shared.mjs";

/**
 * @param {string} content
 * @returns {string}
 */
function makeFixtureRoot(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pattern-suppression-"));
  fs.writeFileSync(path.join(root, "sample.js"), content);
  return root;
}

test("a well-formed plugin-lint-disable-next-line naming a known rule is still forbidden (no generic per-rule suppression exists)", () => {
  const root = makeFixtureRoot(
    ["// plugin-lint-disable-next-line some-rule -- documented false positive", "const x = 1;"].join("\n")
  );
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  assert.equal(isLintSuppressed("sample.js", 2, "some-rule"), false);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("is forbidden"));
});

test("a plugin-lint-disable directive referencing an unknown rule is invalid", () => {
  const root = makeFixtureRoot(
    ["// plugin-lint-disable-next-line unknown-rule -- some reason", "const x = 1;"].join("\n")
  );
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("unknown rule"));
});

test("a plugin-lint-disable directive missing a reason is invalid", () => {
  const root = makeFixtureRoot(["// plugin-lint-disable-next-line some-rule --", "const x = 1;"].join("\n"));
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
});

test("a malformed plugin-lint-disable directive is invalid", () => {
  const root = makeFixtureRoot(["// plugin-lint-disable-next-line", "const x = 1;"].join("\n"));
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("Malformed"));
});

test("a valid plugin-boundary-next-line marker suppresses the boundary rule on the next line", () => {
  const root = makeFixtureRoot(
    [
      "// plugin-boundary-next-line(category: host-window, owner: alice, date: 2026-01-01) -- window.name may be absent",
      "const x = 1;"
    ].join("\n")
  );
  resetContext({ root });
  setKnownRuleNames([]);
  assert.equal(isLintSuppressed("sample.js", 2, BOUNDARY_MARKER_RULE_NAME), true);
  assert.deepEqual(getInvalidLintSuppressions("sample.js"), []);
});

test("a plugin-boundary marker missing a required field is invalid", () => {
  const root = makeFixtureRoot(
    ["// plugin-boundary-next-line(category: host-window, date: 2026-01-01) -- missing owner", "const x = 1;"].join(
      "\n"
    )
  );
  resetContext({ root });
  setKnownRuleNames([]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("owner"));
});

test("an expired plugin-boundary marker is invalid", () => {
  const root = makeFixtureRoot(
    [
      "// plugin-boundary-next-line(category: host-window, owner: alice, date: 2020-01-01, expires: 2020-02-01) -- old",
      "const x = 1;"
    ].join("\n")
  );
  resetContext({ root });
  setKnownRuleNames([]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("expired"));
});

test("the retired pattern-ignore convention is no longer recognised at all", () => {
  const root = makeFixtureRoot(["// pattern-ignore: some-rule", "const x = 1;"].join("\n"));
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  assert.equal(isLintSuppressed("sample.js", 2, "some-rule"), false);
  assert.deepEqual(getInvalidLintSuppressions("sample.js"), []);
});

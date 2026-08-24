/**
 * Self-tests for the fail-closed suppression grammar.
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
  setKnownRuleNames
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

test("a well-formed lint marker naming a known rule is still forbidden", () => {
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

test("a lint marker referencing an unknown rule is invalid", () => {
  const root = makeFixtureRoot(
    ["// plugin-lint-disable-next-line unknown-rule -- some reason", "const x = 1;"].join("\n")
  );
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("unknown rule"));
});

test("a lint marker missing a reason is invalid", () => {
  const root = makeFixtureRoot(["// plugin-lint-disable-next-line some-rule --", "const x = 1;"].join("\n"));
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
});

test("a malformed lint marker is invalid", () => {
  const root = makeFixtureRoot(["// plugin-lint-disable-next-line", "const x = 1;"].join("\n"));
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("Malformed"));
});

test("a well-formed boundary marker is forbidden and suppresses nothing", () => {
  const root = makeFixtureRoot(
    [
      "// plugin-boundary-next-line(category: host-window, owner: alice, date: 2026-01-01) -- window.name may be absent",
      "const x = 1;"
    ].join("\n")
  );
  resetContext({ root });
  setKnownRuleNames([]);
  assert.equal(isLintSuppressed("sample.js", 2, "catch-fallback-without-suppression"), false);
  const invalids = getInvalidLintSuppressions("sample.js");
  assert.equal(invalids.length, 1);
  assert.ok(invalids[0].detail.includes("forbidden"));
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
  assert.ok(invalids[0].detail.includes("forbidden"));
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
  assert.ok(invalids[0].detail.includes("forbidden"));
});

test("the retired pattern-ignore convention is no longer recognised at all", () => {
  const root = makeFixtureRoot(["// pattern-ignore: some-rule", "const x = 1;"].join("\n"));
  resetContext({ root });
  setKnownRuleNames(["some-rule"]);
  assert.equal(isLintSuppressed("sample.js", 2, "some-rule"), false);
  assert.deepEqual(getInvalidLintSuppressions("sample.js"), []);
});

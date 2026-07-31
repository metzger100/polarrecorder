/**
 * Direct unit tests for `tools/check-file-size/oneliner-rules.mjs`,
 * `collapsed-literal-rules.mjs`, and `scan-helpers.mjs`. `tests/js/js-checkers.test.mjs`
 * already exercises every one-liner kind end to end through `runFileSizeCheck`; these tests
 * import the submodules directly so each has its own referencing self-test independent of
 * that composed entry point.
 */

import assert from "node:assert/strict";
import { test } from "vitest";

import {
  detectOneliners,
  countFindingsByKind,
  ONELINER_MESSAGE_BY_KIND
} from "../../tools/check-file-size/oneliner-rules.mjs";
import { isCollapsedLiteral, isPackedDestructuring } from "../../tools/check-file-size/collapsed-literal-rules.mjs";
import {
  findMatching,
  countTopLevelCommas,
  maskStringsAndComments
} from "../../tools/check-file-size/scan-helpers.mjs";

test("detectOneliners finds nothing in clean, readable content", () => {
  /** @type {import("../../tools/check-file-size/oneliner-rules.mjs").OnelinerFinding[]} */
  const findings = [];
  detectOneliners({ rel: "sample.js" }, "const value = 1;\nconst other = 2;\n", findings);
  assert.deepEqual(findings, []);
});

test("detectOneliners flags multiple statements packed onto one line", () => {
  /** @type {import("../../tools/check-file-size/oneliner-rules.mjs").OnelinerFinding[]} */
  const findings = [];
  detectOneliners({ rel: "sample.js" }, "const a = 1; const b = 2; const c = 3;\n", findings);
  assert.ok(findings.some((f) => f.kind === "dense-statements"));
  assert.ok(ONELINER_MESSAGE_BY_KIND[findings[0].kind]);
});

test("countFindingsByKind tallies findings per kind", () => {
  const counts = countFindingsByKind([
    { file: "a.js", line: 1, kind: "dense-statements", length: 10 },
    { file: "a.js", line: 2, kind: "dense-statements", length: 12 },
    { file: "a.js", line: 3, kind: "long-packed", length: 200 }
  ]);
  assert.equal(counts["dense-statements"], 2);
  assert.equal(counts["long-packed"], 1);
});

test("isCollapsedLiteral is false for a short readable line and true for a packed one", () => {
  assert.equal(isCollapsedLiteral("const x = 1;"), false);
  const packed = `const config = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12 };`;
  assert.equal(isCollapsedLiteral(packed), true);
});

test("isPackedDestructuring is false for a small destructure and true for a large one", () => {
  assert.equal(isPackedDestructuring("const { a, b } = obj;"), false);
  assert.equal(isPackedDestructuring("const { a, b, c, d, e } = obj;"), true);
});

test("findMatching locates the matching closing bracket", () => {
  assert.equal(findMatching("f({a: 1}, b)", 1, "(", ")"), 11);
});

test("countTopLevelCommas ignores commas nested inside brackets", () => {
  assert.equal(countTopLevelCommas("a, [b, c], d"), 2);
});

test("maskStringsAndComments blanks string and comment content but preserves length", () => {
  const masked = maskStringsAndComments('const s = "hello"; // a comment\n');
  assert.equal(masked.length, 'const s = "hello"; // a comment\n'.length);
  assert.ok(!masked.includes("hello"));
  assert.ok(!masked.includes("a comment"));
});

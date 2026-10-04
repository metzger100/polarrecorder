/**
 * The pattern runner honors no in-source suppression: a finding on or after a line carrying any
 * directive-like comment is still reported, and only a checker-owned configured exception (file,
 * line, rule, owner, reason) can filter one. `check:suppressions` separately rejects the directive
 * comments themselves (see suppression-policy.test.mjs). Directive text is assembled at runtime so
 * this file carries no directive comment of its own.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { runPatternCheck } from "../../tools/check-patterns/runner.mjs";

/** @typedef {import("../../tools/check-patterns/shared.mjs").Rule} Rule */

/** @type {Rule} */
const PROBE_RULE = {
  id: "probe-token",
  name: "probe-token",
  severity: "block",
  scope: { include: ["*.js"] },
  detect: /probeToken/,
  message: (/** @type {{file: string, line: number}} */ context) => `${context.file}:${context.line}: probe token`
};

const DIRECTIVES = [
  `// ${"plugin-lint-disable"}-next-line probe-token -- documented reason`,
  `// ${"plugin-boundary"}-next-line(category: host, owner: tests) -- documented reason`,
  `// ${"pattern-ignore"}: probe-token`,
  `/* ${"eslint-disable"} */`
];

/**
 * @param {string[]} lines
 * @returns {string}
 */
function makeFixtureRoot(lines) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pattern-suppression-"));
  fs.writeFileSync(path.join(root, "sample.js"), lines.join("\n"));
  return root;
}

test("no in-source directive suppresses a pattern finding", () => {
  for (const directive of DIRECTIVES) {
    const root = makeFixtureRoot([directive, "const probeToken = 1;", `const copy = probeToken; ${directive}`]);
    const result = runPatternCheck({ root, rules: [PROBE_RULE], print: false });
    fs.rmSync(root, { recursive: true, force: true });

    assert.deepEqual(
      result.findings.map((finding) => finding.line),
      [2, 3],
      directive
    );
  }
});

test("a configured exception is the only filter for a pattern finding", () => {
  const root = makeFixtureRoot(["const probeToken = 1;", "const copy = probeToken;"]);
  const exception = { file: "sample.js", line: 1, rule: "probe-token", owner: "tests", reason: "fixture" };

  const result = runPatternCheck({ root, rules: [PROBE_RULE], print: false, configuredExceptions: [exception] });
  fs.rmSync(root, { recursive: true, force: true });

  assert.deepEqual(
    result.findings.map((finding) => finding.line),
    [2]
  );
});

test("a configured exception without an owner and reason is rejected", () => {
  const root = makeFixtureRoot(["const probeToken = 1;"]);
  const exception = { file: "sample.js", line: 1, rule: "probe-token", owner: "", reason: "" };

  assert.throws(
    () => runPatternCheck({ root, rules: [PROBE_RULE], print: false, configuredExceptions: [exception] }),
    /Invalid configured pattern exception/
  );
  fs.rmSync(root, { recursive: true, force: true });
});

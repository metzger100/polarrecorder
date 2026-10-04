/**
 * Negative fixtures for the source suppression scanner. Fixtures are written at runtime so maintained source has no
 * inline directive comments of its own.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { runSuppressionCheck } from "../../tools/portable-core/suppression-engine.mjs";

test("clean temporary source passes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "suppression-clean-"));
  fs.writeFileSync(path.join(root, "clean.py"), "value = 1\n");
  assert.equal(runSuppressionCheck({ root, print: false }).ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test("generated Python and JavaScript directives fail", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "suppression-negative-"));
  fs.writeFileSync(path.join(root, "bad.py"), ["value = 1", `# ${"noqa"}: F401`].join("\n"));
  fs.writeFileSync(
    path.join(root, "bad.mjs"),
    [`const value = 1;`, `// ${"eslint-disable"} ${"no-unused-vars"}`].join("\n")
  );
  const result = runSuppressionCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.equal(result.findings.length, 2);
});

test("every suppression spelling the retired pattern grammar flagged is rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "suppression-spellings-"));
  const python = [
    `# ${"noqa"}`,
    `value = 1  # ${"noqa"}: F401  # documented reason`,
    `# ${"type"}: ignore`,
    `value = 2  # ${"type"}: ignore[attr-defined]  # documented reason`,
    `# ${"ruff"}: ${"noqa"}`,
    `# ${"flake8"}: ${"noqa"}`,
    `# ${"mypy"}: ignore-errors`
  ];
  const javascript = [
    `// ${"plugin-lint-disable"}-next-line some-rule -- documented reason`,
    `// ${"plugin-lint-disable"}-line some-rule -- documented reason`,
    `// ${"plugin-lint-disable"}-next-line`,
    `// ${"plugin-boundary"}-next-line(category: host, owner: tests) -- documented reason`,
    `/* ${"eslint-disable"} */`,
    `// ${"eslint-disable"}-next-line no-undef`,
    `const value = 1; // ${"eslint-disable"}-line no-undef`
  ];
  fs.writeFileSync(path.join(root, "bad.py"), python.join("\n"));
  fs.writeFileSync(path.join(root, "bad.mjs"), javascript.join("\n"));

  const result = runSuppressionCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });

  assert.equal(result.ok, false);
  assert.equal(result.findings.length, python.length + javascript.length);
});

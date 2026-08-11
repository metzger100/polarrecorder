/**
 * Closes the "narrated count" staleness class for `documentation/conventions/quality-gates.md`:
 * the document currently narrates no coverage-inventory/test-inventory/exception/complexity-
 * baseline entry counts at all (this repository's Phase F kept its own family-based coverage
 * schema and a baseline-free direct-ESLint complexity policy, so those counts do not exist here
 * the way the plan's originating audit found them elsewhere). The four numeric policy
 * thresholds it does narrate -- complexity 10/40/4/6 and viewer coverage 80/80/80/65 -- are
 * asserted here against their live config source, so the doc cannot silently drift from them.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

import { STRICT_LIMITS } from "../../tools/quality-policy/complexity-limits.mjs";

const ROOT = process.cwd();
const DOC_PATH = path.join(ROOT, "documentation", "conventions", "quality-gates.md");

test("quality-gates.md narrates no coverage-inventory/test-inventory/exception/complexity-baseline entry count", () => {
  const content = fs.readFileSync(DOC_PATH, "utf8");
  assert.ok(
    !/\b\d+\s+(entries|entry)\b/.test(content),
    "quality-gates.md must not narrate a hand-written inventory entry count"
  );
});

test("quality-gates.md's complexity thresholds match the live STRICT_LIMITS config", () => {
  const content = fs.readFileSync(DOC_PATH, "utf8");
  const expected = `complexity ${STRICT_LIMITS.complexity}/max-statements ${STRICT_LIMITS["max-statements"]}/max-depth ${STRICT_LIMITS["max-depth"]}/max-params ${STRICT_LIMITS["max-params"]}`;
  assert.ok(content.includes(expected), `quality-gates.md must state '${expected}'`);
});

test("quality-gates.md's viewer coverage thresholds match vitest.config.mjs", () => {
  const docContent = fs.readFileSync(DOC_PATH, "utf8");
  const vitestConfig = fs.readFileSync(path.join(ROOT, "vitest.config.mjs"), "utf8");
  const thresholdMatch =
    /lines:\s*(\d+)[\s\S]*?functions:\s*(\d+)[\s\S]*?statements:\s*(\d+)[\s\S]*?branches:\s*(\d+)/.exec(vitestConfig);
  assert.ok(thresholdMatch, "vitest.config.mjs must declare lines/functions/statements/branches thresholds");
  const [, lines, functions, statements, branches] = thresholdMatch;
  const expected = `${statements}/${statements}/${functions}/${branches}`;
  assert.ok(
    docContent.includes(expected) || docContent.includes(`${lines}/${functions}/${statements}/${branches}`),
    `quality-gates.md must state the vitest coverage thresholds (${lines}/${functions}/${statements}/${branches} or equivalent)`
  );
});

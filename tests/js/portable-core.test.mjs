/**
 * Extraction-layer contract tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

import { runPortableCoreAttest } from "../../tools/portable-core-attest.mjs";
import { runStandaloneBoundaryCheck } from "../../tools/check-standalone-boundary.mjs";

const ROOT = process.cwd();

test("attestation is anonymous, deterministic, and schema-shaped", () => {
  const first = runPortableCoreAttest({ root: ROOT, print: false });
  const second = runPortableCoreAttest({ root: ROOT, print: false });
  assert.equal(first, second);
  const parsed = JSON.parse(first);
  const golden = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tests", "fixtures", "portable-core", "attestation.json"), "utf8")
  );
  assert.deepEqual(parsed, golden);
  assert.deepEqual(Object.keys(parsed), ["coreVersion", "manifestSha256", "genericRulesSha256", "entries"]);
  assert.equal(runStandaloneBoundaryCheck({ root: ROOT, print: false }).ok, true);
});

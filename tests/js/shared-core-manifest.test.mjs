/**
 * Contract test for `tools/quality-policy/shared-core-manifest.json` and
 * `tools/check-shared-core.mjs`: the manifest's own digest is anchored against a literal
 * recorded here, and each of the checker's three failure modes -- a missing listed path, a digest
 * mismatch, and an unlisted Tier 1 path under a scan root -- has a negative fixture.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { runSharedCoreCheck, runManifestPreconditionCheck } from "../../tools/check-shared-core.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "tools", "quality-policy", "shared-core-manifest.json");
const ANCHORED_MANIFEST_DIGEST = "b36847694c88edb5704d6ae00cda7d8de92a7a8cdaab33f18ec1d6e64fa8d76e";

/**
 * @returns {string}
 */
function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shared-core-fixture-"));
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  return root;
}

/**
 * @param {string} root
 * @param {Record<string, string>} entries
 * @returns {void}
 */
function writeManifest(root, entries) {
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.json"),
    JSON.stringify({ entries })
  );
}

/**
 * @param {string} root
 * @param {string[]} roots
 * @returns {void}
 */
function writeScanRoots(root, roots) {
  fs.writeFileSync(path.join(root, "tools", "quality-policy", "tier1-scan-roots.json"), JSON.stringify({ roots }));
}

test("the committed manifest's own digest matches the anchored literal", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(MANIFEST_PATH)).digest("hex");
  assert.equal(
    digest,
    ANCHORED_MANIFEST_DIGEST,
    "shared-core-manifest.json changed; update ANCHORED_MANIFEST_DIGEST here in the same change as the manifest edit"
  );
});

test("a clean manifest with matching digests passes", () => {
  const root = makeFixtureRoot();
  fs.writeFileSync(path.join(root, "seed.txt"), "hello\n");
  writeManifest(root, { "seed.txt": crypto.createHash("sha256").update("hello\n").digest("hex") });
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
});

test("a manifest entry missing on disk is caught", () => {
  const root = makeFixtureRoot();
  writeManifest(root, { "missing.txt": "0".repeat(64) });
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.reason.includes("missing on disk")));
});

test("a digest mismatch is caught", () => {
  const root = makeFixtureRoot();
  fs.writeFileSync(path.join(root, "seed.txt"), "hello\n");
  writeManifest(root, { "seed.txt": "0".repeat(64) });
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.reason.includes("digest mismatch")));
});

test("an unlisted Tier 1 path under a scan root is caught", () => {
  const root = makeFixtureRoot();
  writeManifest(root, {});
  fs.mkdirSync(path.join(root, "tier1"), { recursive: true });
  fs.writeFileSync(path.join(root, "tier1", "unlisted.mjs"), "export const x = 1;\n");
  writeScanRoots(root, ["tier1"]);
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.path === "tier1/unlisted.mjs"));
});

/**
 * @param {string} root
 * @param {string} rel
 * @param {string} content
 * @param {{entryPoint?: boolean, withTest?: boolean}} [options]
 * @returns {void}
 */
function writeManifestMjsFixture(root, rel, content, { entryPoint = false, withTest = true } = {}) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  writeManifest(root, { [rel]: digest });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: entryPoint ? { "check:fixture": `node ${rel}` } : {} })
  );
  fs.mkdirSync(path.join(root, "tests", "js"), { recursive: true });
  if (withTest) {
    fs.writeFileSync(
      path.join(root, "tests", "js", "fixture.test.mjs"),
      `import "../../${rel}"; // references ${path.basename(rel)}\n`
    );
  }
}

test("a clean entry point with a run* export and a referencing self-test passes", async () => {
  const root = makeFixtureRoot();
  writeManifestMjsFixture(root, "tools/example.mjs", "export function runExample() { return true; }\n", {
    entryPoint: true
  });
  const result = await runManifestPreconditionCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
});

test("an entry point with no run* export is caught", async () => {
  const root = makeFixtureRoot();
  writeManifestMjsFixture(root, "tools/example.mjs", "export function example() { return true; }\n", {
    entryPoint: true
  });
  const result = await runManifestPreconditionCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.reason.includes("exports no run*() function")));
});

test("an .mjs entry with no referencing self-test is caught", async () => {
  const root = makeFixtureRoot();
  writeManifestMjsFixture(root, "tools/example.mjs", "export function runExample() { return true; }\n", {
    entryPoint: true,
    withTest: false
  });
  const result = await runManifestPreconditionCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.reason.includes("no referencing self-test")));
});

test("the real repository's manifest satisfies the precondition contract", async () => {
  const result = await runManifestPreconditionCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
});

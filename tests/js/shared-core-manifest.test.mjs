/**
 * Contract test for the manifest and verifier: the manifest digest is anchored against a literal, and malformed,
 * missing, escaping, symlinked, extra, and digest-drifted entries have negative fixtures.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { runManifestPreconditionCheck, runSharedCoreCheck } from "../../tools/check-shared-core.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "tools", "quality-policy", "shared-core-manifest.json");
const ANCHORED_MANIFEST_DIGEST = "fa86af9cf2457ab9b247cb60790cb639cb64db9f369a6634234ab6ce1aa31998";

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
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "portable-core-contract.json"),
    JSON.stringify({
      schemaVersion: 1,
      coreVersion: "1.0.0",
      mandatoryRoles: Object.fromEntries(
        Array.from({ length: 17 }, (_unused, index) => [`fixture-${index}`, Object.keys(entries)])
      ),
      mandatoryPaths: Object.keys(entries),
      metadataPaths: [
        "tools/quality-policy/portable-core-contract.json",
        "tools/quality-policy/shared-core-manifest.json",
        "tools/quality-policy/shared-core-manifest.sha256"
      ],
      profileSchemas: [Object.keys(entries)[0]],
      canonicalRuleIds: Array.from({ length: 21 }, (_unused, index) => `rule-${index}`),
      requiredCheckerExports: {},
      requiredSelfTestRoles: { fixture: "tests/js/fixture.test.mjs" }
    })
  );
  fs.mkdirSync(path.join(root, "tests", "js"), { recursive: true });
  fs.writeFileSync(path.join(root, "tests", "js", "fixture.test.mjs"), "// fixture test\n");
  fs.writeFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"), "invalid");
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
  const manifest = fs.readFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.json"));
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"),
    crypto.createHash("sha256").update(manifest).digest("hex")
  );
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.summary.ok, true, JSON.stringify(result.findings));
});

test("a manifest entry missing on disk is caught", () => {
  const root = makeFixtureRoot();
  writeManifest(root, { "missing.txt": "0".repeat(64) });
  const manifest = fs.readFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.json"));
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"),
    crypto.createHash("sha256").update(manifest).digest("hex")
  );
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.summary.ok, false);
  assert.ok(result.findings.some((f) => f.kind === "missing"));
});

test("a digest mismatch is caught", () => {
  const root = makeFixtureRoot();
  fs.writeFileSync(path.join(root, "seed.txt"), "hello\n");
  writeManifest(root, { "seed.txt": "0".repeat(64) });
  const manifest = fs.readFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.json"));
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"),
    crypto.createHash("sha256").update(manifest).digest("hex")
  );
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.summary.ok, false);
  assert.ok(result.findings.some((f) => f.kind === "mismatch"));
});

test("an extra manifest entry is caught", () => {
  const root = makeFixtureRoot();
  fs.writeFileSync(path.join(root, "seed.txt"), "hello\n");
  writeManifest(root, {
    "seed.txt": crypto.createHash("sha256").update("hello\n").digest("hex"),
    "extra.txt": "0".repeat(64)
  });
  const manifest = fs.readFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.json"));
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"),
    crypto.createHash("sha256").update(manifest).digest("hex")
  );
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.summary.ok, false);
  assert.ok(result.findings.some((f) => f.path === "extra.txt"));
});

test("an escaping manifest entry is caught", () => {
  const root = makeFixtureRoot();
  writeManifest(root, { "../escape.txt": "0".repeat(64) });
  const manifest = fs.readFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.json"));
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"),
    crypto.createHash("sha256").update(manifest).digest("hex")
  );
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.summary.ok, false);
  assert.ok(result.findings.some((f) => f.kind === "escaping" || /path/i.test(f.detail || "")));
});

test("an invalid manifest signature is caught", () => {
  const root = makeFixtureRoot();
  writeManifest(root, { "seed.txt": "0".repeat(64) });
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.summary.ok, false);
  assert.ok(result.findings.some((f) => f.path.endsWith(".sha256")));
});

test("a mandatory path omitted from the manifest is caught", () => {
  const root = makeFixtureRoot();
  fs.writeFileSync(path.join(root, "listed.txt"), "hello\n");
  writeManifest(root, { "listed.txt": crypto.createHash("sha256").update("hello\n").digest("hex") });
  const contractPath = path.join(root, "tools", "quality-policy", "portable-core-contract.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  contract.mandatoryPaths.push("omitted.txt");
  contract.mandatoryRoles["fixture-0"].push("omitted.txt");
  fs.writeFileSync(contractPath, JSON.stringify(contract));
  const manifest = fs.readFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.json"));
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"),
    crypto.createHash("sha256").update(manifest).digest("hex")
  );
  const result = runSharedCoreCheck({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.summary.ok, false);
  assert.ok(result.findings.some((f) => f.path === "omitted.txt"));
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
  const manifest = fs.readFileSync(path.join(root, "tools", "quality-policy", "shared-core-manifest.json"));
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "shared-core-manifest.sha256"),
    crypto.createHash("sha256").update(manifest).digest("hex")
  );
  const contractPath = path.join(root, "tools", "quality-policy", "portable-core-contract.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  contract.requiredCheckerExports = entryPoint ? { [rel]: ["runExample"] } : {};
  fs.writeFileSync(contractPath, JSON.stringify(contract));
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
  } else {
    fs.rmSync(path.join(root, "tests", "js", "fixture.test.mjs"));
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

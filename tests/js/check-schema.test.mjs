/**
 * Self-tests for tools/check-schema.mjs, the approved `schema:check` non-port.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";

import { SCHEMA_OWNED_ARTIFACTS, runSchemaCheck } from "../../tools/check-schema.mjs";

const ROOT = process.cwd();

/** @returns {string} */
function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-schema-check-"));
  fs.mkdirSync(path.join(root, "venv", "bin"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "tools", "release_manifest.py"),
    path.join(root, "tools", "release_manifest.py")
  );
  fs.writeFileSync(path.join(root, "plugin.json"), "{}");
  const realPython = execFileSync("which", ["python3"], { encoding: "utf8" }).trim();
  fs.symlinkSync(realPython, path.join(root, "venv", "bin", "python3"));
  return root;
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("the real repo schema check passes", () => {
  const result = runSchemaCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("passes for a clean {} dev-form plugin.json", () => {
  const root = makeFakeRoot();
  const result = runSchemaCheck({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

test("rejects a dev-form plugin.json that already carries a version", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(path.join(root, "plugin.json"), '{"version": "1.0.0"}');
  const result = runSchemaCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("must not carry a 'version' key")));
  cleanup(root);
});

test("rejects a non-object dev-form plugin.json", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(path.join(root, "plugin.json"), "[]");
  const result = runSchemaCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("development form) must be a JSON object")));
  cleanup(root);
});

test("checkInventoryComplete fails closed when an artifact is missing a validator", () => {
  const result = runSchemaCheck({
    root: ROOT,
    print: false,
    artifacts: [
      {
        name: "plugin.json",
        validateDevForm: () => [],
        validateReleaseForm: /** @type {any} */ (undefined)
      }
    ]
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("missing a validateReleaseForm validator")));
});

test("checkInventoryComplete fails closed when the inventory grows unreviewed", () => {
  const result = runSchemaCheck({
    root: ROOT,
    print: false,
    artifacts: [...SCHEMA_OWNED_ARTIFACTS, { ...SCHEMA_OWNED_ARTIFACTS[0], name: "second.json" }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("expected exactly 1 reviewed entries")));
});

test("release form validation rejects a plugin.json missing a version after stamping", () => {
  // Simulate a broken stamp_plugin_json by pointing at a release_manifest.py stub whose
  // stamp omits 'version' -- proves the release-form validator, not just the dev-form one.
  const root = makeFakeRoot();
  const brokenManifest = `
def stamp_plugin_json(version):
    return b'{"name": "polarrecorder"}'
`;
  fs.appendFileSync(path.join(root, "tools", "release_manifest.py"), "\n\n" + brokenManifest);
  const result = runSchemaCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("must have a non-empty string 'version'")));
  cleanup(root);
});

/**
 * Self-tests for tools/check-schema.mjs, the Ajv-driven `schema:check` plugin.json
 * validator.
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
  assert.ok(result.failures.some((f) => f.includes("development form")));
  cleanup(root);
});

test("rejects a dev-form plugin.json that declares userApps", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(path.join(root, "plugin.json"), '{"userApps": []}');
  const result = runSchemaCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("development form")));
  cleanup(root);
});

test("rejects a non-object dev-form plugin.json", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(path.join(root, "plugin.json"), "[]");
  const result = runSchemaCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("development form")));
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
  assert.ok(result.failures.some((f) => f.includes("release form") && f.includes("version")));
  cleanup(root);
});

test("release form validation rejects version-not-first-key even when the schema shape is valid", () => {
  const root = makeFakeRoot();
  const reorderedManifest =
    `
def stamp_plugin_json(version):
    return b'{"name": "polarrecorder", "version": "` +
    "0.0.0" +
    `"}'
`;
  fs.appendFileSync(path.join(root, "tools", "release_manifest.py"), "\n\n" + reorderedManifest);
  const result = runSchemaCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("first serialized key")));
  cleanup(root);
});

test("every genericBase and polarServerProfile corpus row matches the real Ajv validators", async () => {
  const corpus = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tools", "quality-policy", "plugin-schema-corpus.json"), "utf8")
  );
  const { default: Ajv } = await import("ajv");
  const ajv = new Ajv({ allErrors: true });
  ajv.addSchema(
    JSON.parse(fs.readFileSync(path.join(ROOT, "schemas", "avnav-plugin-base.schema.json"), "utf8"))
  );
  for (const value of corpus.genericBase.valid) {
    assert.equal(ajv.validate("avnav-plugin-base.schema.json", value), true, JSON.stringify(value));
  }
  for (const value of corpus.genericBase.invalid) {
    assert.equal(
      ajv.validate("avnav-plugin-base.schema.json", value),
      false,
      JSON.stringify(value)
    );
  }

  const validateDev = ajv.compile(
    JSON.parse(fs.readFileSync(path.join(ROOT, "schemas", "polar-plugin-dev.schema.json"), "utf8"))
  );
  for (const value of corpus.polarServerProfile.dev.valid) {
    assert.equal(validateDev(value), true, JSON.stringify(value));
  }
  for (const value of corpus.polarServerProfile.dev.invalid) {
    assert.equal(validateDev(value), false, JSON.stringify(value));
  }

  const validateRelease = ajv.compile(
    JSON.parse(
      fs.readFileSync(path.join(ROOT, "schemas", "polar-plugin-release.schema.json"), "utf8")
    )
  );
  for (const value of corpus.polarServerProfile.release.valid) {
    assert.equal(validateRelease(value), true, JSON.stringify(value));
  }
  for (const value of corpus.polarServerProfile.release.invalid) {
    assert.equal(validateRelease(value), false, JSON.stringify(value));
  }
});

#!/usr/bin/env node

/**
 * Approved schema-validation non-port: this behavior is deliberately folded into
 * `npm run package:check`'s command chain rather than exposed as its own `schema:check`
 * npm script -- the final command graph explicitly forbids a script by that exact name
 * (`tests/js/setup.test.mjs`'s "no accidental check:ci or pre-commit command" test asserts
 * `schema:check` is never a package.json script).
 *
 * `plugin.json` is the only schema/layout artifact this repository currently ships that
 * needs an explicit shape contract in both its committed development form (no
 * `version` key; `release_manifest.py`'s `plugin_json_version()` treats an absent
 * version as `None`) and its release form (version-stamped by
 * `release_manifest.stamp_plugin_json`, `version` first). `SCHEMA_OWNED_ARTIFACTS` is
 * the complete, reviewed inventory of such artifacts -- exactly one entry today. Adding
 * a new schema/layout artifact to the repository without adding a matching validator
 * here (and growing this inventory in the same change) fails `checkInventoryComplete`,
 * so `package:check` cannot silently go blind to a second unvalidated artifact.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** @typedef {{name: string, validateDevForm: (data: unknown) => string[], validateReleaseForm: (data: unknown) => string[]}} SchemaOwnedArtifact */

/**
 * @param {unknown} data
 * @returns {string[]}
 */
function validatePluginJsonDevForm(data) {
  /** @type {string[]} */
  const failures = [];
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    failures.push("plugin.json (development form) must be a JSON object");
    return failures;
  }
  if ("version" in data) {
    failures.push(
      "plugin.json (development form) must not carry a 'version' key; the release form stamps it"
    );
  }
  return failures;
}

/**
 * @param {unknown} data
 * @returns {string[]}
 */
function validatePluginJsonReleaseForm(data) {
  /** @type {string[]} */
  const failures = [];
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    failures.push("plugin.json (release form) must be a JSON object");
    return failures;
  }
  const record = /** @type {Record<string, unknown>} */ (data);
  if (typeof record.version !== "string" || record.version.trim() === "") {
    failures.push("plugin.json (release form) must have a non-empty string 'version'");
  }
  if (Object.keys(record)[0] !== "version") {
    failures.push("plugin.json (release form) must have 'version' as its first key");
  }
  return failures;
}

/** @type {SchemaOwnedArtifact[]} */
export const SCHEMA_OWNED_ARTIFACTS = [
  {
    name: "plugin.json",
    validateDevForm: validatePluginJsonDevForm,
    validateReleaseForm: validatePluginJsonReleaseForm
  }
];

/** The reviewed, expected artifact count; changing this is itself the required review. */
const EXPECTED_ARTIFACT_COUNT = 1;

/**
 * @param {SchemaOwnedArtifact[]} artifacts
 * @returns {string[]}
 */
function checkInventoryComplete(artifacts) {
  /** @type {string[]} */
  const failures = [];
  if (artifacts.length !== EXPECTED_ARTIFACT_COUNT) {
    failures.push(
      `SCHEMA_OWNED_ARTIFACTS has ${artifacts.length} entries; expected exactly ${EXPECTED_ARTIFACT_COUNT} reviewed entries`
    );
  }
  for (const artifact of artifacts) {
    if (typeof artifact.validateDevForm !== "function") {
      failures.push(`${artifact.name}: missing a validateDevForm validator`);
    }
    if (typeof artifact.validateReleaseForm !== "function") {
      failures.push(`${artifact.name}: missing a validateReleaseForm validator`);
    }
  }
  return failures;
}

/**
 * @param {string} root
 * @returns {unknown}
 */
function readPluginJsonDevForm(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
}

/**
 * @param {string} root
 * @returns {unknown}
 */
function buildPluginJsonReleaseForm(root) {
  const venvPython = path.join(root, "venv", "bin", "python3");
  const python = fs.existsSync(venvPython) ? venvPython : "python3";
  const script = [
    "import json, sys",
    "sys.path.insert(0, 'tools')",
    "import release_manifest as manifest",
    "sys.stdout.write(manifest.stamp_plugin_json('0.0.0-schema-check').decode('utf-8'))"
  ].join("\n");
  const result = execFileSync(python, ["-c", script], { cwd: root, encoding: "utf8" });
  return JSON.parse(result);
}

/**
 * @param {{root?: string, print?: boolean, artifacts?: SchemaOwnedArtifact[]}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runSchemaCheck(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  const artifacts = options.artifacts || SCHEMA_OWNED_ARTIFACTS;

  /** @type {string[]} */
  const failures = [...checkInventoryComplete(artifacts)];

  for (const artifact of artifacts) {
    if (artifact.name !== "plugin.json") continue;
    if (typeof artifact.validateDevForm === "function") {
      failures.push(...artifact.validateDevForm(readPluginJsonDevForm(root)));
    }
    if (typeof artifact.validateReleaseForm === "function") {
      try {
        failures.push(...artifact.validateReleaseForm(buildPluginJsonReleaseForm(root)));
      } catch (error) {
        failures.push(
          `${artifact.name}: could not build the release form: ${/** @type {Error} */ (error).message}`
        );
      }
    }
  }

  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[schema-check] ${failure}`);
    } else {
      console.log(`Schema check passed: ${artifacts.length} owned artifact(s) validated.`);
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runSchemaCheck();
  process.exit(result.ok ? 0 : 1);
}

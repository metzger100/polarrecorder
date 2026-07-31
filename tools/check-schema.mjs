#!/usr/bin/env node

/**
 * `npm run schema:check` -- Ajv-driven shape validator for every schema-owned artifact
 * named in project-owned `tools/quality-policy/project-schema-profile.json`. Composes the
 * generic, upstream-verified base schema with each artifact's dev/release profile schemas
 * via Ajv. `checkInventoryComplete` keeps the profile's `expectedArtifactCount` in sync with
 * reality, so adding a new schema/layout artifact to the repository without a matching
 * profile entry (and validator) fails closed instead of silently going unvalidated.
 *
 * Each artifact's release-form validator also checks that its `firstSerializedKey` (an
 * internal key-ordering contract of this repo's own stamping function, not something JSON
 * Schema can express) is really the first serialized key.
 */

import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { stampPluginJson } from "./release-archive.mjs";

const TOOLS_DIR = path.dirname(new URL(import.meta.url).pathname);
const SCHEMAS_DIR = path.join(TOOLS_DIR, "..", "schemas");
const PROFILE_PATH = path.join(TOOLS_DIR, "quality-policy", "project-schema-profile.json");
const PORTABLE_CONTRACT_SCHEMA = "portable-core-contract.schema.json";
const PORTABLE_CONTRACT_PATH = path.join("tools", "quality-policy", "portable-core-contract.json");

/** @typedef {{firstSerializedKey: string}} ReleaseFormProfile */
/** @typedef {{name: string, devSchema: string, releaseSchema: string, releaseForm: ReleaseFormProfile}} ArtifactProfile */
/** @typedef {{name: string, validateDevForm: (data: unknown) => string[], validateReleaseForm: (root: string) => string[]}} SchemaOwnedArtifact */

/**
 * @param {string} name
 * @returns {any}
 */
function readSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, name), "utf8"));
}

/**
 * @returns {{baseSchema: string, expectedArtifactCount: number, artifacts: ArtifactProfile[]}}
 */
function readProfile() {
  return JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
}

/**
 * @param {import("ajv").ValidateFunction} validate
 * @param {unknown} data
 * @param {string} artifactName
 * @param {string} formLabel
 * @returns {string[]}
 */
function runValidator(validate, data, artifactName, formLabel) {
  if (validate(data)) return [];
  const errors = validate.errors || [];
  return errors.map((error) => `${artifactName} (${formLabel}) ${error.instancePath || "/"} ${error.message}`);
}

/**
 * @param {string} root
 * @param {string} artifactName
 * @returns {unknown}
 */
function readArtifactDevForm(root, artifactName) {
  return JSON.parse(fs.readFileSync(path.join(root, artifactName), "utf8"));
}

/**
 * @param {string} root
 * @param {ReleaseFormProfile} releaseForm
 * @returns {unknown}
 */
function buildArtifactReleaseForm(root, releaseForm) {
  return JSON.parse(stampPluginJson(root, "0.0.0-schema-check"));
}

/**
 * @param {ArtifactProfile} artifact
 * @param {import("ajv").ValidateFunction} validateDev
 * @param {import("ajv").ValidateFunction} validateRelease
 * @returns {SchemaOwnedArtifact}
 */
function buildSchemaOwnedArtifact(artifact, validateDev, validateRelease) {
  return {
    name: artifact.name,
    validateDevForm: (data) => runValidator(validateDev, data, artifact.name, "development form"),
    validateReleaseForm: (root) => {
      const data = buildArtifactReleaseForm(root, artifact.releaseForm);
      const failures = runValidator(validateRelease, data, artifact.name, "release form");
      if (failures.length > 0) return failures;
      const record = /** @type {Record<string, unknown>} */ (data);
      if (Object.keys(record)[0] !== artifact.releaseForm.firstSerializedKey) {
        failures.push(
          `${artifact.name} (release form) must have '${artifact.releaseForm.firstSerializedKey}' as its first ` +
            "serialized key (the stamping function's own ordering contract; not an Ajv-expressible shape rule)"
        );
      }
      return failures;
    }
  };
}

/**
 * @returns {{profile: ReturnType<typeof readProfile>, artifacts: SchemaOwnedArtifact[]}}
 */
function buildSchemaOwnedArtifacts() {
  const profile = readProfile();
  const ajv = new Ajv({ allErrors: true });
  ajv.addSchema(readSchema(profile.baseSchema));
  const artifacts = profile.artifacts.map((artifact) => {
    const validateDev = ajv.compile(readSchema(artifact.devSchema));
    const validateRelease = ajv.compile(readSchema(artifact.releaseSchema));
    return buildSchemaOwnedArtifact(artifact, validateDev, validateRelease);
  });
  return { profile, artifacts };
}

const { profile: SCHEMA_PROFILE, artifacts: BUILT_ARTIFACTS } = buildSchemaOwnedArtifacts();

/** @type {SchemaOwnedArtifact[]} */
export const SCHEMA_OWNED_ARTIFACTS = BUILT_ARTIFACTS;

/**
 * @param {SchemaOwnedArtifact[]} artifacts
 * @returns {string[]}
 */
function checkInventoryComplete(artifacts) {
  /** @type {string[]} */
  const failures = [];
  if (artifacts.length !== SCHEMA_PROFILE.expectedArtifactCount) {
    failures.push(
      `SCHEMA_OWNED_ARTIFACTS has ${artifacts.length} entries; expected exactly ${SCHEMA_PROFILE.expectedArtifactCount} reviewed entries`
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
 * Validate the portable-core contract with its committed schema.
 * @param {string} root
 * @returns {string[]}
 */
function checkPortableCoreContract(root) {
  const contractPath = path.join(root, PORTABLE_CONTRACT_PATH);
  if (!fs.existsSync(contractPath)) return [];
  const schema = readSchema(PORTABLE_CONTRACT_SCHEMA);
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  return runValidator(validate, contract, "portable-core-contract", "contract");
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
  try {
    failures.push(...checkPortableCoreContract(root));
  } catch (error) {
    failures.push(`portable-core-contract: could not validate contract: ${/** @type {Error} */ (error).message}`);
  }

  for (const artifact of artifacts) {
    if (typeof artifact.validateDevForm === "function") {
      try {
        failures.push(...artifact.validateDevForm(readArtifactDevForm(root, artifact.name)));
      } catch (error) {
        failures.push(`${artifact.name}: could not read the development form: ${/** @type {Error} */ (error).message}`);
      }
    }
    if (typeof artifact.validateReleaseForm === "function") {
      try {
        failures.push(...artifact.validateReleaseForm(root));
      } catch (error) {
        failures.push(`${artifact.name}: could not build the release form: ${/** @type {Error} */ (error).message}`);
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

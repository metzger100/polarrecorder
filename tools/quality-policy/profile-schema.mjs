import { readJsonPolicy } from "./read-json-policy.mjs";
import { runProfileSchemaCheck } from "../portable-core/schema-engine.mjs";

/** @typedef {Record<string, unknown> & {schemaVersion: number}} VersionedProfile */

/**
 * Read a local profile through the portable profile envelope.
 * @param {string} filePath
 * @param {string[]} allowedKeys
 * @returns {any}
 */
export function readVersionedProfile(filePath, allowedKeys) {
  const profile = readJsonPolicy(filePath);
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error(`Invalid profile '${filePath}': schemaVersion 1 is required.`);
  }
  const result = runProfileSchemaCheck({
    profile,
    allowedFields: ["schemaVersion", ...allowedKeys],
    schemaVersion: 1
  });
  if (!result.ok) {
    const failures = result.failures.map((failure) => failure.replace("unknown profile field", "unknown field"));
    throw new Error(`Invalid profile '${filePath}': ${failures.join("; ")}.`);
  }
  return /** @type {VersionedProfile} */ (profile);
}

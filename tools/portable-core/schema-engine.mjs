/**
 * Product-neutral profile-schema policy engine.
 */

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Validate the common version and field contract for a local profile.
 * @param {{profile: Record<string, unknown>, allowedFields: string[], schemaVersion: number}} options
 * @returns {PolicyResult}
 */
export function runProfileSchemaCheck({ profile, allowedFields, schemaVersion }) {
  const failures = [];
  if (profile.schemaVersion !== schemaVersion) failures.push("unknown profile schema version");
  for (const key of Object.keys(profile)) {
    if (!allowedFields.includes(key)) failures.push(`unknown profile field: ${key}`);
  }
  return { ok: failures.length === 0, failures };
}

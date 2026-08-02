import path from "node:path";
import { getRoot } from "../shared.mjs";
import { readVersionedProfile } from "../../quality-policy/profile-schema.mjs";

/** @typedef {{catchFallbackExceptions: Array<{file: string, line: number, rule: string, owner: string, reason: string}>}} ProjectPatternContext */

/** @param {string} [root] @returns {ProjectPatternContext} */
export function getProjectPatternContext(root = getRoot()) {
  return readVersionedProfile(path.join(root, "tools/quality-policy/project-pattern-context.json"), [
    "catchFallbackExceptions"
  ]);
}

import { baselinePath, floorsPath, readJson } from "./shared.mjs";

/**
 * Proves the active floors in `coverage-floors.json` never fall below the reviewed minimums in
 * `coverage-floor-baseline.json`, and that every family and per-file floor has a minimum.
 * @param {string} root
 * @returns {{ok: boolean, failures: string[]}}
 */
export function checkFloorRatchet(root) {
  const floors = readJson(floorsPath(root));
  const baseline = readJson(baselinePath(root));
  /** @type {string[]} */
  const failures = [];
  for (const key of Object.keys(baseline.minimumFloors.families)) {
    const active = floors.families?.[key];
    const min = baseline.minimumFloors.families[key];
    if (typeof active !== "number" || active < min) {
      failures.push(`coverage-floors.json families.${key} (${active}) is below its baseline floor ${min}`);
    }
  }
  const pluginMin = baseline.minimumFloors.pluginPy.combinedLineAndBranchPercent;
  const pluginActive = floors.pluginPy?.combinedLineAndBranchPercent;
  if (typeof pluginActive !== "number" || pluginActive < pluginMin) {
    failures.push(
      `coverage-floors.json pluginPy.combinedLineAndBranchPercent (${pluginActive}) is below its baseline floor ${pluginMin}`
    );
  }
  for (const [file, min] of Object.entries(baseline.minimumFloors.viewerPerFileLinePercent)) {
    const active = floors.viewerPerFileLinePercent?.[file];
    if (typeof active !== "number" || active < /** @type {number} */ (min)) {
      failures.push(
        `coverage-floors.json viewerPerFileLinePercent["${file}"] (${active}) is below its baseline floor ${min}`
      );
    }
  }
  for (const key of Object.keys(floors.families)) {
    if (!(key in baseline.minimumFloors.families)) {
      failures.push(`coverage-floors.json families.${key} has no reviewed minimum in coverage-floor-baseline.json`);
    }
  }
  for (const file of Object.keys(floors.viewerPerFileLinePercent)) {
    if (!(file in baseline.minimumFloors.viewerPerFileLinePercent)) {
      failures.push(
        `coverage-floors.json viewerPerFileLinePercent["${file}"] has no reviewed minimum in coverage-floor-baseline.json`
      );
    }
  }
  return { ok: failures.length === 0, failures };
}

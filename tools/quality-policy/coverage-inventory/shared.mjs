import fs from "node:fs";
import path from "node:path";

/** @param {string} root @returns {string} */
export function pythonReportPath(root) {
  return path.join(root, "coverage", "python", "coverage.json");
}

/** @param {string} root @returns {string} */
export function viewerReportPath(root) {
  return path.join(root, "coverage", "viewer", "coverage-summary.json");
}

/** @param {string} root @returns {string} */
export function floorsPath(root) {
  return path.join(root, "tools", "quality-policy", "coverage-floors.json");
}

/** @param {string} root @returns {string} */
export function baselinePath(root) {
  return path.join(root, "tools", "quality-policy", "coverage-floor-baseline.json");
}

/** @param {string} filePath @returns {any} */
export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {string[]} failures
 * @param {string} label
 * @param {number} actual
 * @param {number} floor
 */
export function requireAtLeast(failures, label, actual, floor) {
  // Floors are captured rounded to 2 decimals (matching the baseline capture generator's
  // convention); round the live measurement the same way so genuine no-op reruns never
  // fail on sub-hundredth floating noise (coverage.py/c8 percentages carry more digits).
  const rounded = Math.round(actual * 100) / 100;
  if (rounded + 1e-9 < floor) {
    failures.push(`${label}: ${rounded.toFixed(2)}% is below the ${floor}% floor`);
  }
}

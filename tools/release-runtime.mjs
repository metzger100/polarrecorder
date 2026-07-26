/**
 * Small, explicitly non-authoritative release-impact classifier.
 *
 * `isRuntimePath` only powers `release-prepare.mjs`'s advisory "runtime vs dev-only"
 * change summary for human SemVer review -- it is never used to build or validate the
 * actual release archive. `tools/release_manifest.py`'s `expected_runtime_files()` is
 * the sole runtime-file-list authority; `release-create.mjs` orchestrates the Python
 * zip builder/validator rather than re-deriving or re-checking that list in JS.
 */

const FIXED_RUNTIME_FILES = [
  "plugin.css",
  "plugin.js",
  "plugin.json",
  "plugin.mjs",
  "plugin.py",
  "viewer/icon.svg",
  "viewer/viewer.html"
];

const RUNTIME_PREFIXES = ["server/polarrecorder/", "viewer/"];

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isRuntimePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return false;
  }
  const normalized = normalizeRelativePath(filePath);
  if (FIXED_RUNTIME_FILES.includes(normalized)) {
    return true;
  }
  return RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * @param {string} rawPath
 * @returns {string}
 */
function normalizeRelativePath(rawPath) {
  return rawPath.replace(/\\/g, "/").replace(/^\//, "").replace(/^\.\//, "").trim();
}

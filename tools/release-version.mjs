#!/usr/bin/env node

/**
 * Single JavaScript SemVer/tag parser, used by local release creation
 * (`release-create.mjs`) and the GitHub publisher workflow (invoked directly as a CLI
 * with `--github-output`). The canonical semver.org-recommended pattern, so a prerelease
 * identifier may start with a digit run followed by a required non-digit (e.g. `1x`,
 * `x-y-z.--`) -- `server/polarrecorder`'s `release_manifest.py` `SEMVER_RE` must stay
 * byte-equivalent; `tools/quality-policy/semver-corpus.json` is the shared valid/invalid
 * corpus both implementations' tests assert against.
 */

export const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** @typedef {{major: string, minor: string, patch: string, prerelease: string | null, build: string | null}} ParsedSemver */

/**
 * @param {string} version SemVer string, without a leading `v`.
 * @returns {ParsedSemver | null} the parsed components, or `null` if invalid.
 */
export function parseSemver(version) {
  const match = SEMVER_REGEX.exec(String(version));
  if (!match) return null;
  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease: match[4] ?? null,
    build: match[5] ?? null
  };
}

/**
 * @param {string} version
 * @returns {boolean}
 */
export function isValidSemver(version) {
  return parseSemver(version) !== null;
}

/**
 * A version is a prerelease only when its prerelease segment is present; build
 * metadata alone (e.g. `1.0.0+build.1`) never makes a version a prerelease.
 *
 * @param {string} version
 * @returns {boolean}
 */
export function isPrerelease(version) {
  const parsed = parseSemver(version);
  return parsed !== null && parsed.prerelease !== null;
}

/**
 * @param {string} version SemVer string, without a leading `v`.
 * @returns {string} the canonical `v`-prefixed Git tag.
 */
export function tagFor(version) {
  return `v${version}`;
}

/**
 * @param {string} tag a Git ref/tag name, with or without a leading `v`.
 * @returns {string} the version with any single leading `v` stripped.
 */
export function versionFromTag(tag) {
  const text = String(tag);
  return text.startsWith("v") ? text.slice(1) : text;
}

/**
 * Emits `version`/`prerelease` as `key=value` lines for `$GITHUB_OUTPUT`, given a raw
 * ref name (e.g. `$GITHUB_REF_NAME`, which for a `v*` tag push is the bare tag).
 *
 * @param {string} refName
 * @returns {string} the two output lines, newline-terminated.
 */
export function githubOutputLines(refName) {
  const version = versionFromTag(refName);
  if (!isValidSemver(version)) {
    throw new Error(`release-version: '${refName}' does not resolve to a valid SemVer version`);
  }
  return `version=${version}\nprerelease=${isPrerelease(version)}\n`;
}

/**
 * @param {string[]} argv
 * @returns {void}
 */
export function main(argv = process.argv.slice(2)) {
  const flagIndex = argv.indexOf("--github-output");
  if (flagIndex === -1 || !argv[flagIndex + 1]) {
    console.error("Usage: release-version.mjs --github-output <ref-name>");
    process.exit(1);
  }
  try {
    process.stdout.write(githubOutputLines(argv[flagIndex + 1]));
  } catch (error) {
    console.error(/** @type {Error} */ (error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

/**
 * Self-tests for tools/release-version.mjs, the single JavaScript
 * SemVer/tag parser. Asserts against the shared `tools/quality-policy/semver-corpus.json`
 * corpus used by the local JavaScript archive builder, so tag parsing and archive stamping
 * share one SemVer authority.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "vitest";
import path from "node:path";

import {
  githubOutputLines,
  isPrerelease,
  isValidSemver,
  parseSemver,
  tagFor,
  versionFromTag
} from "../../tools/release-version.mjs";

const ROOT = process.cwd();
const CORPUS = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "quality-policy", "semver-corpus.json"), "utf8"));

test("every corpus valid version is accepted with the expected prerelease classification", () => {
  for (const entry of CORPUS.valid) {
    assert.equal(isValidSemver(entry.version), true, `expected valid: ${entry.version}`);
    assert.equal(isPrerelease(entry.version), entry.prerelease, `prerelease mismatch for ${entry.version}`);
  }
});

test("every corpus invalid version is rejected", () => {
  for (const version of CORPUS.invalid) {
    assert.equal(isValidSemver(version), false, `expected invalid: ${JSON.stringify(version)}`);
  }
});

test("parseSemver extracts major/minor/patch/prerelease/build", () => {
  const parsed = parseSemver("2.10.3-rc.1+build.5");
  assert.deepEqual(parsed, {
    major: "2",
    minor: "10",
    patch: "3",
    prerelease: "rc.1",
    build: "build.5"
  });
  assert.equal(parseSemver("not-a-version"), null);
});

test("tagFor and versionFromTag round-trip", () => {
  assert.equal(tagFor("1.2.3"), "v1.2.3");
  assert.equal(versionFromTag("v1.2.3"), "1.2.3");
  assert.equal(versionFromTag("1.2.3"), "1.2.3");
});

test("githubOutputLines emits version and prerelease for a valid tag", () => {
  assert.equal(githubOutputLines("v1.2.3"), "version=1.2.3\nprerelease=false\n");
  assert.equal(githubOutputLines("v1.2.3-rc.1"), "version=1.2.3-rc.1\nprerelease=true\n");
});

test("githubOutputLines throws for an invalid tag", () => {
  assert.throws(() => githubOutputLines("v1.0"), /does not resolve to a valid SemVer version/);
});

test("CLI --github-output prints the two output lines", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "tools", "release-version.mjs"), "--github-output", "v3.4.5"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "version=3.4.5\nprerelease=false\n");
});

test("CLI --github-output exits non-zero for an invalid ref", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "tools", "release-version.mjs"), "--github-output", "v1.0"],
    { encoding: "utf8" }
  );
  assert.notEqual(result.status, 0);
});

test("CLI without --github-output exits non-zero with a usage message", () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, "tools", "release-version.mjs")], {
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: release-version\.mjs --github-output/);
});

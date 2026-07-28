/**
 * Self-tests for tools/release-git.mjs, the NUL-safe
 * `git status --porcelain=v1 -z` parser. Exercises real `git` output from throwaway
 * `git init` repositories (never the real clone) to prove rename/copy and
 * space-containing paths parse correctly, not just a hand-built fixture string.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import { entryPaths, isDirtyOutsidePrefix, parsePorcelainStatusZ } from "../../tools/release-git.mjs";

/** @returns {string} */
function makeFakeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-release-git-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  return root;
}

/**
 * @param {string} root
 * @returns {string}
 */
function statusZ(root) {
  return execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8"
  });
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("parses a real rename with a space in both the old and new name", () => {
  const root = makeFakeRepo();
  fs.writeFileSync(path.join(root, "file with space.txt"), "a");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: root });
  execFileSync("git", ["mv", "file with space.txt", "renamed file.txt"], { cwd: root });

  const entries = parsePorcelainStatusZ(statusZ(root));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].x, "R");
  assert.equal(entries[0].path, "renamed file.txt");
  assert.equal(entries[0].origPath, "file with space.txt");
  cleanup(root);
});

test("parses an untracked file with a space alongside a rename", () => {
  const root = makeFakeRepo();
  fs.writeFileSync(path.join(root, "original.txt"), "a");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: root });
  execFileSync("git", ["mv", "original.txt", "moved.txt"], { cwd: root });
  fs.writeFileSync(path.join(root, "new untracked.txt"), "b");

  const entries = parsePorcelainStatusZ(statusZ(root));

  assert.equal(entries.length, 2);
  const rename = entries.find((e) => e.x === "R");
  const untracked = entries.find((e) => e.x === "?");
  assert.ok(rename);
  assert.equal(rename.path, "moved.txt");
  assert.equal(rename.origPath, "original.txt");
  assert.ok(untracked);
  assert.equal(untracked.path, "new untracked.txt");
  assert.equal(untracked.origPath, null);
  cleanup(root);
});

test("parses a plain modification with no orig path", () => {
  const root = makeFakeRepo();
  fs.writeFileSync(path.join(root, "tracked.txt"), "a");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: root });
  fs.writeFileSync(path.join(root, "tracked.txt"), "b");

  const entries = parsePorcelainStatusZ(statusZ(root));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, "tracked.txt");
  assert.equal(entries[0].origPath, null);
  cleanup(root);
});

test("parses an empty clean status with no entries", () => {
  const root = makeFakeRepo();
  fs.writeFileSync(path.join(root, "tracked.txt"), "a");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: root });

  const entries = parsePorcelainStatusZ(statusZ(root));

  assert.deepEqual(entries, []);
  cleanup(root);
});

test("entryPaths returns both paths for a rename and normalizes separators", () => {
  const paths = entryPaths({ x: "R", y: " ", path: "a/b.txt", origPath: "a\\c.txt" });
  assert.deepEqual(paths, ["a/b.txt", "a/c.txt"]);
});

test("isDirtyOutsidePrefix is false when every path is under the allowed prefix", () => {
  const entries = parsePorcelainStatusZ("A  releases/x.zip\0A  releases/x.md\0");
  assert.equal(isDirtyOutsidePrefix(entries, "releases/"), false);
});

test("isDirtyOutsidePrefix is true when a rename's original path is outside the prefix", () => {
  const entries = parsePorcelainStatusZ("R  releases/x.zip\0somewhere-else.txt\0");
  assert.equal(isDirtyOutsidePrefix(entries, "releases/"), true);
});

test("isDirtyOutsidePrefix is true for any plain change outside the prefix", () => {
  const entries = parsePorcelainStatusZ("M  README.md\0");
  assert.equal(isDirtyOutsidePrefix(entries, "releases/"), true);
});

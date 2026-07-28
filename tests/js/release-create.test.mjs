/**
 * Self-tests for tools/release-create.mjs. All git/npm/python
 * interaction is injected via a fake `runCommand`, so these tests never touch the real
 * repository, spawn a real gate, or create a real Git commit/tag.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import { createRelease, parseReleaseCreateArgs } from "../../tools/release-create.mjs";

/** @returns {string} */
function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-release-create-"));
  fs.mkdirSync(path.join(root, "releases"), { recursive: true });
  return root;
}

/**
 * @param {string} root
 * @param {string} version
 * @param {string} [notesContent]
 */
function writeNotes(root, version, notesContent = "Release notes.\n") {
  fs.writeFileSync(path.join(root, "releases", `polarrecorder-${version}.md`), notesContent);
}

/**
 * @param {{cleanStatus?: boolean, existingTag?: boolean, checkAllStatus?: number, zipStatus?: number, zipStdout?: string, zipSummaryJson?: string, releaseCheckStatus?: number}} [overrides]
 * @returns {{runCommand: (command: string, args: string[], options: object) => {status: number, stdout: string, stderr: string}, calls: Array<{command: string, args: string[]}>}}
 */
function fakeRunCommand(overrides = {}) {
  const cleanStatus = overrides.cleanStatus !== false;
  const existingTag = overrides.existingTag === true;
  /** @type {Array<{command: string, args: string[]}>} */
  const calls = [];

  return {
    calls,
    runCommand(command, args) {
      calls.push({ command, args: [...args] });
      if (command === "git" && args[0] === "tag" && args[1] === "-l") {
        return { status: 0, stdout: existingTag ? `${args[2]}\n` : "", stderr: "" };
      }
      if (command === "git" && args[0] === "status") {
        return { status: 0, stdout: cleanStatus ? "" : " M unrelated.txt\0", stderr: "" };
      }
      if (command === "git") {
        return { status: 0, stdout: "", stderr: "" };
      }
      if (command === "npm" && args.join(" ") === "run check:all") {
        return { status: overrides.checkAllStatus ?? 0, stdout: "", stderr: "" };
      }
      if (command === "python" && args[0] === "tools/release-zip.py") {
        const summary = overrides.zipSummaryJson ?? '{"filesIncluded":1,"totalSizeBytes":42}';
        const stdout = overrides.zipStdout ?? `Wrote releases/x.zip with 1 files.\nSUMMARY_JSON=${summary}\n`;
        return { status: overrides.zipStatus ?? 0, stdout, stderr: "" };
      }
      if (command === "python" && args[0] === "tools/check-release.py") {
        return { status: overrides.releaseCheckStatus ?? 0, stdout: "", stderr: "" };
      }
      throw new Error(`fakeRunCommand: unexpected command '${command} ${args.join(" ")}'`);
    }
  };
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("parseReleaseCreateArgs extracts --version=", () => {
  assert.deepEqual(parseReleaseCreateArgs(["--version=1.2.3"]), { version: "1.2.3" });
});

test("rejects an invalid SemVer version before touching git", () => {
  const root = makeFakeRoot();
  const fake = fakeRunCommand();
  assert.throws(
    () => createRelease({ rootDir: root, version: "not-semver", runCommand: fake.runCommand }),
    /valid SemVer string/
  );
  assert.deepEqual(fake.calls, []);
  cleanup(root);
});

test("rejects a missing notes file", () => {
  const root = makeFakeRoot();
  const fake = fakeRunCommand();
  assert.throws(
    () => createRelease({ rootDir: root, version: "1.0.0", runCommand: fake.runCommand }),
    /notes file not found/
  );
  cleanup(root);
});

test("rejects an empty notes file", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0", "   \n");
  const fake = fakeRunCommand();
  assert.throws(
    () => createRelease({ rootDir: root, version: "1.0.0", runCommand: fake.runCommand }),
    /notes file is empty/
  );
  cleanup(root);
});

test("rejects an existing git tag", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0");
  const fake = fakeRunCommand({ existingTag: true });
  assert.throws(
    () => createRelease({ rootDir: root, version: "1.0.0", runCommand: fake.runCommand }),
    /git tag already exists: v1\.0\.0/
  );
  cleanup(root);
});

test("rejects a dirty tree outside releases/", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0");
  const fake = fakeRunCommand({ cleanStatus: false });
  assert.throws(
    () => createRelease({ rootDir: root, version: "1.0.0", runCommand: fake.runCommand }),
    /uncommitted changes outside releases\//
  );
  cleanup(root);
});

test("aborts on a failing gate with zero further side effects (no zip/commit/tag)", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0");
  const fake = fakeRunCommand({ checkAllStatus: 1 });
  assert.throws(
    () => createRelease({ rootDir: root, version: "1.0.0", runCommand: fake.runCommand }),
    /required gate failed \(npm run check:all\)/
  );
  const gateCallIndex = fake.calls.findIndex((c) => c.command === "npm" && c.args.join(" ") === "run check:all");
  assert.ok(gateCallIndex >= 0, "expected the gate to have been invoked exactly once");
  assert.equal(fake.calls.filter((c) => c.command === "npm" && c.args.join(" ") === "run check:all").length, 1);
  assert.ok(!fake.calls.some((c) => c.command === "python"));
  assert.ok(!fake.calls.some((c) => c.command === "git" && c.args[0] === "add"));
  assert.ok(!fake.calls.some((c) => c.command === "git" && c.args[0] === "commit"));
  assert.ok(!fake.calls.some((c) => c.command === "git" && c.args[0] === "tag" && c.args[1] === "-a"));
  cleanup(root);
});

test("aborts closed when release-zip.py reports no SUMMARY_JSON line, before any commit/tag", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0");
  const fake = fakeRunCommand({ zipStdout: "Wrote releases/x.zip with 1 files.\n" });
  assert.throws(
    () => createRelease({ rootDir: root, version: "1.0.0", runCommand: fake.runCommand }),
    /did not report a SUMMARY_JSON line/
  );
  assert.ok(!fake.calls.some((c) => c.command === "git" && c.args[0] === "add"));
  assert.ok(!fake.calls.some((c) => c.command === "git" && c.args[0] === "commit"));
  cleanup(root);
});

test("happy path runs exactly one gate invocation and the exact command sequence", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0");
  const fake = fakeRunCommand({ zipSummaryJson: '{"filesIncluded":9,"totalSizeBytes":12345}' });
  /** @type {string[]} */
  const logged = [];

  const summary = createRelease({
    rootDir: root,
    version: "1.0.0",
    runCommand: fake.runCommand,
    output: { log: (/** @type {string} */ message) => logged.push(message) }
  });

  assert.equal(summary.version, "1.0.0");
  assert.equal(summary.tag, "v1.0.0");
  assert.equal(summary.filesIncluded, 9);
  assert.equal(summary.totalSizeBytes, 12345);

  const sequence = fake.calls.map((c) => `${c.command} ${c.args.join(" ")}`);
  assert.deepEqual(sequence, [
    "git tag -l v1.0.0",
    "git status --porcelain=v1 -z --untracked-files=all",
    "npm run check:all",
    "python tools/release-zip.py --version 1.0.0",
    "python tools/check-release.py releases/polarrecorder-1.0.0.zip",
    "git add releases/polarrecorder-1.0.0.zip releases/polarrecorder-1.0.0.md",
    "git commit -m release: v1.0.0",
    "git tag -a v1.0.0 -m Release v1.0.0"
  ]);
  assert.ok(logged.some((line) => line.includes("v1.0.0")));
  cleanup(root);
});

test("accepts a prerelease version and produces the matching tag/zip names", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0-rc.1");
  const fake = fakeRunCommand();

  const summary = createRelease({
    rootDir: root,
    version: "1.0.0-rc.1",
    runCommand: fake.runCommand
  });

  assert.equal(summary.tag, "v1.0.0-rc.1");
  assert.equal(path.basename(summary.zipPath), "polarrecorder-1.0.0-rc.1.zip");
  cleanup(root);
});

test("accepts a build-metadata version and produces the matching tag/zip names", () => {
  const root = makeFakeRoot();
  writeNotes(root, "1.0.0+build.5");
  const fake = fakeRunCommand();

  const summary = createRelease({
    rootDir: root,
    version: "1.0.0+build.5",
    runCommand: fake.runCommand
  });

  assert.equal(summary.tag, "v1.0.0+build.5");
  assert.equal(path.basename(summary.zipPath), "polarrecorder-1.0.0+build.5.zip");
  cleanup(root);
});

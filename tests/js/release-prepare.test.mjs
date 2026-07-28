/**
 * Self-tests for tools/release-prepare.mjs. All git interaction is
 * injected via a fake `runGit`, so these tests never touch the real repository.
 */

import assert from "node:assert/strict";
import { test } from "vitest";

import { buildReleasePreparePayload, parseReleasePrepareArgs, requireCleanTree } from "../../tools/release-prepare.mjs";

/** @param {Record<string, string>} responses keyed by the joined argv */
function fakeRunGit(responses) {
  return (/** @type {string[]} */ args) => {
    const key = args.join(" ");
    if (!(key in responses)) throw new Error(`fakeRunGit: no fixture for 'git ${key}'`);
    return responses[key];
  };
}

test("parseReleasePrepareArgs recognizes --help and -h as side-effect-free", () => {
  assert.deepEqual(parseReleasePrepareArgs(["--help"]), { help: true });
  assert.deepEqual(parseReleasePrepareArgs(["-h"]), { help: true });
});

test("parseReleasePrepareArgs accepts no arguments", () => {
  assert.deepEqual(parseReleasePrepareArgs([]), { help: false });
});

test("parseReleasePrepareArgs rejects unknown arguments", () => {
  assert.throws(() => parseReleasePrepareArgs(["--bogus"]), /unknown argument/);
});

test("requireCleanTree passes on an empty status", () => {
  const runGit = fakeRunGit({ "status --porcelain=v1 -z --untracked-files=all": "" });
  assert.doesNotThrow(() => requireCleanTree(runGit));
});

test("requireCleanTree fails when anything is dirty", () => {
  const runGit = fakeRunGit({
    "status --porcelain=v1 -z --untracked-files=all": " M README.md\0"
  });
  assert.throws(() => requireCleanTree(runGit), /working tree must be completely clean/);
});

test("buildReleasePreparePayload summarizes a first release (no prior tag)", () => {
  /** @param {string[]} args */
  const runGit = (args) => {
    const key = args.join(" ");
    if (key === "describe --tags --abbrev=0 --match v*") throw new Error("no tags found");
    if (key === "log --reverse --oneline --root") return "abc123 Initial commit\ndef456 Add viewer";
    if (key === "diff --name-status --find-renames --root HEAD") {
      return "A\tplugin.py\nA\tREADME.md\nM\tviewer/viewer.js";
    }
    throw new Error(`no fixture for 'git ${key}'`);
  };

  const payload = buildReleasePreparePayload({ runGit });

  assert.equal(payload.lastRelease, null);
  assert.deepEqual(payload.commitsSinceLastRelease, ["abc123 Initial commit", "def456 Add viewer"]);
  assert.equal(payload.changeSummary.newFiles, 2);
  assert.equal(payload.semverReview.range, "repository history");
});

test("buildReleasePreparePayload summarizes changes since the last tag", () => {
  const runGit = fakeRunGit({
    "describe --tags --abbrev=0 --match v*": "v1.0.0\n",
    "log -1 --format=%cs v1.0.0": "2026-01-01\n",
    "log --reverse --oneline v1.0.0..HEAD": "abc123 Fix bug\ndef456 Add feature",
    "diff --name-status --find-renames v1.0.0..HEAD": "A\tviewer/new-file.js\nM\tREADME.md\nD\told.py"
  });

  const payload = buildReleasePreparePayload({ runGit, pluginName: "polarrecorder" });

  assert.equal(payload.plugin, "polarrecorder");
  assert.deepEqual(payload.lastRelease, { tag: "v1.0.0", date: "2026-01-01" });
  assert.deepEqual(payload.commitsSinceLastRelease, ["abc123 Fix bug", "def456 Add feature"]);
  assert.equal(payload.changeSummary.newFiles, 1);
  assert.equal(payload.changeSummary.deletedFiles, 1);
  assert.equal(payload.changeSummary.runtimeFilesChanged, 1);
  assert.equal(payload.changeSummary.devOnlyFilesChanged, 2);
  assert.deepEqual(payload.runtimeChangedPaths, ["viewer/new-file.js"]);
  assert.equal(payload.semverReview.mode, "manual-codebase-review");
  assert.equal(payload.semverReview.automaticSuggestion, null);
});

test("buildReleasePreparePayload handles renames via the last path field", () => {
  const runGit = fakeRunGit({
    "describe --tags --abbrev=0 --match v*": "v1.0.0\n",
    "log -1 --format=%cs v1.0.0": "2026-01-01\n",
    "log --reverse --oneline v1.0.0..HEAD": "abc123 Rename",
    "diff --name-status --find-renames v1.0.0..HEAD": "R100\told-name.py\tnew-name.py"
  });

  const payload = buildReleasePreparePayload({ runGit });

  assert.deepEqual(payload.changedPaths, ["new-name.py"]);
});

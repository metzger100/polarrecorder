/**
 * Self-tests for tools/check-publisher-workflow.mjs, the actionlint-backed parsed-workflow
 * contract, plus a real dependency-free execution proof for
 * `tools/release-version.mjs` (the publisher's only `run` step besides the artifact
 * lookup) in a temporary checkout with `node_modules` absent.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";

import { runPublisherWorkflowCheck } from "../../tools/check-publisher-workflow.mjs";

const ROOT = process.cwd();
const REAL_WORKFLOW = fs.readFileSync(
  path.join(ROOT, ".github", "workflows", "publish-release.yml"),
  "utf8"
);

/** @returns {string} */
function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-publisher-workflow-"));
  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  return root;
}

/**
 * @param {string} root
 * @param {string} content
 */
function writeWorkflow(root, content) {
  fs.writeFileSync(path.join(root, ".github", "workflows", "publish-release.yml"), content);
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("the real repo publisher workflow passes", () => {
  const result = runPublisherWorkflowCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("fails when a second workflow file exists", () => {
  const root = makeFakeRoot();
  writeWorkflow(root, REAL_WORKFLOW);
  fs.writeFileSync(path.join(root, ".github", "workflows", "ci.yml"), "name: CI\n");
  const result = runPublisherWorkflowCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("exactly one file")));
  cleanup(root);
});

test("fails when the trigger includes an extra event", () => {
  const root = makeFakeRoot();
  writeWorkflow(
    root,
    REAL_WORKFLOW.replace("on:\n  push:", "on:\n  workflow_dispatch: {}\n  push:")
  );
  const result = runPublisherWorkflowCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("no event besides")));
  cleanup(root);
});

test("fails when the job declares needs", () => {
  const root = makeFakeRoot();
  writeWorkflow(
    root,
    REAL_WORKFLOW.replace("runs-on: ubuntu-latest", "needs: []\n    runs-on: ubuntu-latest")
  );
  const result = runPublisherWorkflowCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("must not declare")));
  cleanup(root);
});

test("fails when a step is renamed", () => {
  const root = makeFakeRoot();
  writeWorkflow(root, REAL_WORKFLOW.replace("Validate release tag", "Validate the tag"));
  const result = runPublisherWorkflowCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("expected name")));
  cleanup(root);
});

test("fails when a uses step is pinned to a tag instead of a full SHA", () => {
  const root = makeFakeRoot();
  writeWorkflow(
    root,
    REAL_WORKFLOW.replace(
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2",
      "actions/checkout@v4"
    )
  );
  const result = runPublisherWorkflowCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("full 40-character commit SHA")));
  cleanup(root);
});

test("fails when the release step gains an extra `with` field", () => {
  const root = makeFakeRoot();
  writeWorkflow(
    root,
    REAL_WORKFLOW.replace(
      "prerelease: ${{ steps.release_version.outputs.prerelease }}",
      "prerelease: ${{ steps.release_version.outputs.prerelease }}\n          draft: true"
    )
  );
  const result = runPublisherWorkflowCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("unexpected 'with' keys")));
  cleanup(root);
});

test("release-version.mjs runs dependency-free in a checkout with node_modules absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-dep-free-"));
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "tools", "release-version.mjs"),
    path.join(root, "tools", "release-version.mjs")
  );
  assert.ok(!fs.existsSync(path.join(root, "node_modules")));

  const result = spawnSync(
    process.execPath,
    [path.join(root, "tools", "release-version.mjs"), "--github-output", "v1.2.3"],
    { cwd: root, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "version=1.2.3\nprerelease=false\n");
  cleanup(root);
});

/**
 * Self-tests for tools/hooks-install.mjs, tools/hooks-doctor.mjs, and
 * .githooks/pre-push -- the tracked-hook hardening.
 *
 * Every test builds its own throwaway `git init` repository under a tmpdir and never
 * touches the real clone's Git config (`core.hooksPath`) or `.git/` state.
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { test } from "node:test";
import path from "node:path";

import { installHooks } from "../../tools/hooks-install.mjs";
import { checkHooksDoctor } from "../../tools/hooks-doctor.mjs";

const ROOT = process.cwd();

/** @returns {string} */
function makeFakeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-hooks-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  fs.mkdirSync(path.join(root, ".githooks"), { recursive: true });
  fs.writeFileSync(path.join(root, ".githooks", "pre-push"), "#!/bin/bash\nexit 0\n");
  return root;
}

/**
 * @param {string} checkAllScript
 * @returns {string}
 */
function makeFakeRepoWithPackage(checkAllScript) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-prepush-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fake-repo", scripts: { "check:all": checkAllScript } })
  );
  fs.mkdirSync(path.join(root, ".githooks"), { recursive: true });
  const prePushSource = fs.readFileSync(path.join(ROOT, ".githooks", "pre-push"), "utf8");
  fs.writeFileSync(path.join(root, ".githooks", "pre-push"), prePushSource);
  fs.chmodSync(path.join(root, ".githooks", "pre-push"), 0o755);
  fs.mkdirSync(path.join(root, "nested"), { recursive: true });
  return root;
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("hooks-doctor fails closed on a fresh repo with no hooks configured", () => {
  const root = makeFakeRepo();
  const result = checkHooksDoctor({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("hooks:install")));
  cleanup(root);
});

test("hooks-install configures core.hooksPath and makes pre-push executable", () => {
  const root = makeFakeRepo();
  const installResult = installHooks({ root, print: false });
  assert.equal(installResult.ok, true, installResult.failures.join("\n"));
  const configured = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  assert.equal(configured, ".githooks");
  const mode = fs.statSync(path.join(root, ".githooks", "pre-push")).mode;
  assert.ok((mode & 0o111) !== 0);
  cleanup(root);
});

test("hooks-doctor passes once installed", () => {
  const root = makeFakeRepo();
  installHooks({ root, print: false });
  const result = checkHooksDoctor({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

test("install is idempotent", () => {
  const root = makeFakeRepo();
  const first = installHooks({ root, print: false });
  const second = installHooks({ root, print: false });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const configured = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  assert.equal(configured, ".githooks");
  cleanup(root);
});

test("hooks-doctor detects drift after core.hooksPath is changed away", () => {
  const root = makeFakeRepo();
  installHooks({ root, print: false });
  execFileSync("git", ["config", "core.hooksPath", "other-dir"], { cwd: root });
  const result = checkHooksDoctor({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("other-dir")));
  cleanup(root);
});

test("hooks-doctor detects a non-executable pre-push", () => {
  const root = makeFakeRepo();
  installHooks({ root, print: false });
  fs.chmodSync(path.join(root, ".githooks", "pre-push"), 0o644);
  const result = checkHooksDoctor({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("not executable")));
  cleanup(root);
});

test("hooks-install fails closed outside a git repository", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-hooks-nogit-"));
  const result = installHooks({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("Not a git repository")));
  cleanup(root);
});

test("hooks-install fails closed when pre-push is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-hooks-missing-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  const result = installHooks({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("Missing required hook file")));
  cleanup(root);
});

test("pre-push propagates a passing check:all", () => {
  const root = makeFakeRepoWithPackage("exit 0");
  const result = spawnSync("bash", [path.join(root, ".githooks", "pre-push")], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0);
  cleanup(root);
});

test("pre-push propagates a failing check:all", () => {
  const root = makeFakeRepoWithPackage("exit 1");
  const result = spawnSync("bash", [path.join(root, ".githooks", "pre-push")], {
    cwd: root,
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0);
  cleanup(root);
});

test("pre-push resolves and cds to the repository root even from a nested directory", () => {
  const root = makeFakeRepoWithPackage("pwd > pwd-output.txt");
  const result = spawnSync("bash", [path.join(root, ".githooks", "pre-push")], {
    cwd: path.join(root, "nested"),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  const recordedPwd = fs.readFileSync(path.join(root, "pwd-output.txt"), "utf8").trim();
  assert.equal(fs.realpathSync(recordedPwd), fs.realpathSync(root));
  cleanup(root);
});

test("pre-push tolerates git's push hook arguments and stdin without hanging or erroring", () => {
  const root = makeFakeRepoWithPackage("exit 0");
  const result = spawnSync(
    "bash",
    [path.join(root, ".githooks", "pre-push"), "origin", "git@example.com:x/y.git"],
    {
      cwd: root,
      input: "refs/heads/main abc123 refs/heads/main def456\n",
      encoding: "utf8",
      timeout: 10000
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  cleanup(root);
});

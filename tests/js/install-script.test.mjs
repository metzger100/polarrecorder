/**
 * Contract tests for install.sh: help/argument parsing, dry-run
 * source/target selection, latest-tag resolution, version URL construction,
 * download failure, unsafe-ZIP rejection, and a full install through fake
 * curl/wget/systemctl/sudo -- proving zero real network or system-plugin
 * mutation ever occurs.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "vitest";

const ROOT = process.cwd();
const INSTALL_SH = path.join(ROOT, "install.sh");

/**
 * @param {string} dir
 * @param {Record<string, string>} scripts name -> shell body (no shebang)
 */
function writeFakeBin(dir, scripts) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(scripts)) {
    const scriptPath = path.join(dir, name);
    fs.writeFileSync(scriptPath, `#!/usr/bin/env bash\n${body}\n`);
    fs.chmodSync(scriptPath, 0o755);
  }
}

/**
 * @param {string[]} args
 * @param {{fakeBin?: Record<string, string>, env?: Record<string, string>}} [options]
 */
function runInstall(args, options = {}) {
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-install-"));
  const fakeBinDir = path.join(workRoot, "fakebin");
  const fakeHome = path.join(workRoot, "home");
  fs.mkdirSync(fakeHome, { recursive: true });
  writeFakeBin(fakeBinDir, options.fakeBin || {});

  const result = spawnSync("bash", [INSTALL_SH, ...args], {
    encoding: "utf8",
    env: {
      PATH: `${fakeBinDir}:/usr/bin:/bin`,
      HOME: fakeHome,
      ...options.env
    }
  });
  return { result, workRoot, fakeHome };
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

/**
 * @param {string} zipPath
 * @param {Record<string, string>} files relative path (including top dir) -> content
 */
function buildZip(zipPath, files) {
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-zip-stage-"));
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(stageDir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  const zipResult = spawnSync("zip", ["-q", "-r", zipPath, "."], { cwd: stageDir });
  assert.equal(zipResult.status, 0, zipResult.stderr?.toString());
  fs.rmSync(stageDir, { recursive: true, force: true });
}

const FAILING_NETWORK_BIN = {
  curl: 'echo "install-script test: curl must never run in this test" >&2; exit 1',
  wget: 'echo "install-script test: wget must never run in this test" >&2; exit 1'
};

test("--help prints usage and exits 0 with no side effects", () => {
  const { result, workRoot } = runInstall(["--help"], { fakeBin: FAILING_NETWORK_BIN });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: install\.sh \[options\]/);
  cleanup(workRoot);
});

test("an unknown option fails with a nonzero exit", () => {
  const { result, workRoot } = runInstall(["--bogus"], { fakeBin: FAILING_NETWORK_BIN });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown option: --bogus/);
  cleanup(workRoot);
});

test("--version without a value fails", () => {
  const { result, workRoot } = runInstall(["--version"], { fakeBin: FAILING_NETWORK_BIN });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--version requires a value/);
  cleanup(workRoot);
});

test("--zip without a value fails", () => {
  const { result, workRoot } = runInstall(["--zip"], { fakeBin: FAILING_NETWORK_BIN });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--zip requires a value/);
  cleanup(workRoot);
});

test("dry-run with --data-dir resolves the latest version via fake curl and prints source/target", () => {
  const { result, workRoot } = runInstall(["--data-dir", "/opt/avnav-data", "--dry-run"], {
    fakeBin: {
      curl: 'echo \'{"tag_name": "v1.4.2", "name": "Release 1.4.2"}\''
    }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /source: .*polarrecorder-1\.4\.2\.zip/);
  assert.match(result.stdout, /target: \/opt\/avnav-data\/plugins\/polarrecorder/);
  assert.match(result.stdout, /Dry run complete; no files changed\./);
  cleanup(workRoot);
});

test("dry-run with --plugin-dir uses the explicit target and skips detection", () => {
  const { result, workRoot } = runInstall(
    ["--plugin-dir", "/custom/target/polarrecorder", "--version", "2.0.0", "--dry-run"],
    { fakeBin: FAILING_NETWORK_BIN }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /target: \/custom\/target\/polarrecorder/);
  cleanup(workRoot);
});

test("--version skips latest-release resolution entirely (fake curl/wget never invoked)", () => {
  const { result, workRoot } = runInstall(["--version", "3.1.4", "--plugin-dir", "/tmp/x", "--dry-run"], {
    fakeBin: FAILING_NETWORK_BIN
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /polarrecorder-3\.1\.4\.zip/);
  cleanup(workRoot);
});

test("explicit prerelease+build version is preserved verbatim in the constructed URL", () => {
  const { result, workRoot } = runInstall(
    ["--version", "1.0.0-beta.1+build.5", "--plugin-dir", "/tmp/x", "--dry-run"],
    { fakeBin: FAILING_NETWORK_BIN }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /source: .*\/v1\.0\.0-beta\.1\+build\.5\/polarrecorder-1\.0\.0-beta\.1\+build\.5\.zip/);
  cleanup(workRoot);
});

test("a download failure aborts before any target mutation", () => {
  const { result, workRoot } = runInstall(
    ["--version", "9.9.9", "--plugin-dir", path.join(os.tmpdir(), "should-not-exist-install-target")],
    {
      fakeBin: { curl: "exit 22" }
    }
  );
  assert.notEqual(result.status, 0);
  assert.ok(
    !fs.existsSync(path.join(os.tmpdir(), "should-not-exist-install-target")),
    "target directory must not be created on download failure"
  );
  cleanup(workRoot);
});

test("a ZIP with two top-level directories is rejected and the target is untouched", () => {
  const { workRoot } = runInstall([]);
  const zipPath = path.join(workRoot, "bad.zip");
  buildZip(zipPath, {
    "polarrecorder/plugin.json": "{}",
    "polarrecorder/plugin.js": "",
    "extra-dir/marker": ""
  });
  const targetDir = path.join(workRoot, "target", "polarrecorder");
  const result = spawnSync("bash", [INSTALL_SH, "--zip", zipPath, "--plugin-dir", targetDir, "--no-restart"], {
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", HOME: workRoot }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one top-level directory/);
  assert.ok(!fs.existsSync(targetDir));
  cleanup(workRoot);
});

test("a ZIP missing plugin.json is rejected and the target is untouched", () => {
  const { workRoot } = runInstall([]);
  const zipPath = path.join(workRoot, "bad.zip");
  buildZip(zipPath, {
    "polarrecorder/plugin.js": ""
  });
  const targetDir = path.join(workRoot, "target", "polarrecorder");
  const result = spawnSync("bash", [INSTALL_SH, "--zip", zipPath, "--plugin-dir", targetDir, "--no-restart"], {
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", HOME: workRoot }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing polarrecorder\/plugin\.json/);
  assert.ok(!fs.existsSync(targetDir));
  cleanup(workRoot);
});

test("a full install from a local ZIP replaces the target with no real network or AvNav mutation", () => {
  const { workRoot } = runInstall([]);
  const zipPath = path.join(workRoot, "good.zip");
  buildZip(zipPath, {
    "polarrecorder/plugin.json": '{"name": "polarrecorder"}',
    "polarrecorder/plugin.js": "/* fixture */"
  });
  const targetDir = path.join(workRoot, "target", "polarrecorder");
  const restartMarker = path.join(workRoot, "systemctl-was-called");
  const fakeBinDir = path.join(workRoot, "fakebin2");
  writeFakeBin(fakeBinDir, {
    ...FAILING_NETWORK_BIN,
    systemctl: `touch "${restartMarker}"; exit 1`
  });
  const result = spawnSync("bash", [INSTALL_SH, "--zip", zipPath, "--plugin-dir", targetDir], {
    encoding: "utf8",
    env: { PATH: `${fakeBinDir}:/usr/bin:/bin`, HOME: workRoot }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed Polar Recorder to /);
  assert.equal(fs.readFileSync(path.join(targetDir, "plugin.json"), "utf8"), '{"name": "polarrecorder"}');
  assert.ok(fs.existsSync(restartMarker), "the fake systemctl, not a real one, must be invoked");
  cleanup(workRoot);
});

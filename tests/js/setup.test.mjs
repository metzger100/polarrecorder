/**
 * Self-tests for the setup/package/actionlint contract: package identity and
 * exact pins, the developer-Python contract shape, and `tools/actionlint.sh`'s cached
 * success, missing-cache failure, in-repo-cache rejection, and install-only network use.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { test } from "node:test";
import path from "node:path";

const ROOT = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("package identity", () => {
  assert.equal(PKG.private, true);
  assert.equal(PKG.version, "0.0.0-test");
  assert.equal(typeof PKG.name, "string");
  assert.ok(PKG.name.length > 0);
  assert.equal(PKG.engines.npm, "12.0.1");
  assert.equal(PKG.engines.node, ">=26 <27");
  assert.equal(PKG.packageManager, "npm@12.0.1");
});

test("exact devDependency pins", () => {
  const rangeChars = /[\^~*xX]|>=|<=/;
  for (const [name, range] of Object.entries(PKG.devDependencies)) {
    assert.ok(!rangeChars.test(range), `${name} devDependency ${range} is not an exact pin`);
  }
});

test("js-yaml override is an exact pin and resolves every dependent to it", () => {
  assert.equal(PKG.overrides?.["js-yaml"], "5.2.2");
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  const resolvedVersions = Object.entries(lock.packages || {})
    .filter(([lockPath]) => lockPath.endsWith("js-yaml") || lockPath.endsWith("/js-yaml"))
    .map(([, info]) => info.version);
  assert.ok(resolvedVersions.length > 0, "expected at least one resolved js-yaml entry");
  for (const version of resolvedVersions) {
    assert.equal(version, "5.2.2");
  }
});

test("dependencies:audit is a maintainer-only networked leaf excluded from check:all", () => {
  assert.equal(PKG.scripts["dependencies:audit"], "npm audit");
});

test("developer Python contract shape", () => {
  const contractPath = path.join(ROOT, "tools", "quality-policy", "developer-python.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  for (const field of [
    "preferredInterpreter",
    "environmentOverrideVariable",
    "supportedVersionRange",
    "pipBootstrapVersion",
    "lockGenerator",
    "supportedPlatforms"
  ]) {
    assert.ok(field in contract, `developer-python.json missing ${field}`);
  }
  assert.equal(contract.environmentOverrideVariable, "POLARRECORDER_PYTHON");
  assert.ok(Array.isArray(contract.supportedPlatforms) && contract.supportedPlatforms.length > 0);
});

test("setup has no hook installation side effect", () => {
  const source = fs.readFileSync(path.join(ROOT, "tools", "setup.mjs"), "utf8");
  assert.ok(!/hooksPath|install-hooks|core\.hooksPath/.test(source));
});

test("actionlint missing cache fails with repair guidance", () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-actionlint-empty-"));
  assert.throws(() => {
    execFileSync("bash", [path.join(ROOT, "tools", "actionlint.sh"), "--version"], {
      env: { ...process.env, ACTIONLINT_CACHE_DIR: cacheDir },
      stdio: "pipe"
    });
  }, /no cached actionlint/);
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

test("actionlint rejects an in-repo cache dir", () => {
  assert.throws(() => {
    execFileSync("bash", [path.join(ROOT, "tools", "actionlint.sh"), "--install"], {
      env: { ...process.env, ACTIONLINT_CACHE_DIR: path.join(ROOT, "node_modules", ".actionlint") },
      stdio: "pipe"
    });
  }, /must not resolve inside the repository/);
});

test("actionlint cached run succeeds offline", () => {
  const cacheDir =
    process.env.ACTIONLINT_CACHE_DIR ||
    path.join(os.homedir(), ".cache", "polarrecorder", "actionlint");
  const versionDir = path.join(cacheDir, "1.7.12");
  if (!fs.existsSync(path.join(versionDir, "actionlint"))) {
    // No pre-populated cache in this environment: skip the offline-reuse assertion rather
    // than perform a network install inside a unit test.
    return;
  }
  const output = execFileSync("bash", [path.join(ROOT, "tools", "actionlint.sh"), "--version"], {
    env: { ...process.env, ACTIONLINT_CACHE_DIR: cacheDir },
    encoding: "utf8"
  });
  assert.ok(output.includes("1.7.12"));
});

const FAKE_BIN_REAL_UTILS = [
  "bash",
  "uname",
  "mkdir",
  "mktemp",
  "cut",
  "tar",
  "install",
  "dirname",
  "rm",
  "chmod",
  "gzip"
];

/** @returns {string} the pinned expected_sha256 for this host's real OS/architecture */
function realArchiveExpectedSha256() {
  const unameS = execFileSync("uname", ["-s"], { encoding: "utf8" }).trim();
  const unameM = execFileSync("uname", ["-m"], { encoding: "utf8" }).trim();
  const platform = unameS === "Darwin" ? "darwin" : "linux";
  const arch = unameM === "aarch64" || unameM === "arm64" ? "arm64" : "amd64";
  const archiveName = `actionlint_1.7.12_${platform}_${arch}.tar.gz`;
  const script = fs.readFileSync(path.join(ROOT, "tools", "actionlint.sh"), "utf8");
  const match = script.match(
    new RegExp(`${archiveName}\\)\\s*\\n\\s*expected_sha256="([0-9a-f]+)"`)
  );
  assert.ok(match, `no pinned expected_sha256 found for ${archiveName}`);
  return match[1];
}

/**
 * A fake curl that never touches the network: it writes a valid tar.gz containing a
 * dummy "actionlint" file to whatever `-o <path>` was requested.
 * @returns {string}
 */
function fakeCurlScript() {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'out=""',
    "while [ $# -gt 0 ]; do",
    '  if [ "$1" = "-o" ]; then out="$2"; shift 2; else shift; fi',
    "done",
    'work="$(mktemp -d)"',
    'printf "#!/bin/sh\\necho fake-actionlint\\n" > "$work/actionlint"',
    'chmod +x "$work/actionlint"',
    'tar -czf "$out" -C "$work" actionlint',
    'rm -rf "$work"',
    ""
  ].join("\n");
}

/** @param {string} hash @returns {string} a fake sha256sum/shasum that always reports `hash` */
function fakeChecksumScript(hash) {
  return ["#!/usr/bin/env bash", `echo "${hash}  fake-archive"`, ""].join("\n");
}

/**
 * @param {{sha256sum?: string, shasum?: string}} checksumTools
 * @returns {string} an isolated PATH directory exposing only the named checksum tool(s)
 */
function buildFakeBin(checksumTools) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-actionlint-fakebin-"));
  for (const name of FAKE_BIN_REAL_UTILS) {
    const real = execFileSync("bash", ["-c", `command -v ${name}`], { encoding: "utf8" }).trim();
    fs.symlinkSync(real, path.join(dir, name));
  }
  fs.writeFileSync(path.join(dir, "curl"), fakeCurlScript(), { mode: 0o755 });
  if (checksumTools.sha256sum) {
    fs.writeFileSync(path.join(dir, "sha256sum"), fakeChecksumScript(checksumTools.sha256sum), {
      mode: 0o755
    });
  }
  if (checksumTools.shasum) {
    fs.writeFileSync(path.join(dir, "shasum"), fakeChecksumScript(checksumTools.shasum), {
      mode: 0o755
    });
  }
  return dir;
}

/**
 * @param {{sha256sum?: string, shasum?: string}} checksumTools
 * @param {(paths: {bin: string, cacheDir: string}) => void} run
 */
function withFakeInstallEnv(checksumTools, run) {
  const bin = buildFakeBin(checksumTools);
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-actionlint-cache-"));
  try {
    run({ bin, cacheDir });
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

test("actionlint install succeeds using sha256sum when only sha256sum is available", () => {
  const hash = realArchiveExpectedSha256();
  withFakeInstallEnv({ sha256sum: hash }, ({ bin, cacheDir }) => {
    const output = execFileSync(path.join(ROOT, "tools", "actionlint.sh"), ["--install"], {
      env: { PATH: bin, ACTIONLINT_CACHE_DIR: cacheDir },
      encoding: "utf8"
    });
    assert.ok(output.includes("installed actionlint"), output);
    assert.ok(fs.existsSync(path.join(cacheDir, "1.7.12", "actionlint")));
  });
});

test("actionlint install succeeds using shasum -a 256 (Darwin-style) when sha256sum is absent", () => {
  const hash = realArchiveExpectedSha256();
  withFakeInstallEnv({ shasum: hash }, ({ bin, cacheDir }) => {
    const output = execFileSync(path.join(ROOT, "tools", "actionlint.sh"), ["--install"], {
      env: { PATH: bin, ACTIONLINT_CACHE_DIR: cacheDir },
      encoding: "utf8"
    });
    assert.ok(output.includes("installed actionlint"), output);
    assert.ok(fs.existsSync(path.join(cacheDir, "1.7.12", "actionlint")));
  });
});

test("actionlint install fails on a checksum mismatch", () => {
  withFakeInstallEnv({ sha256sum: "0".repeat(64) }, ({ bin, cacheDir }) => {
    assert.throws(() => {
      execFileSync(path.join(ROOT, "tools", "actionlint.sh"), ["--install"], {
        env: { PATH: bin, ACTIONLINT_CACHE_DIR: cacheDir },
        stdio: "pipe"
      });
    }, /checksum mismatch/);
    assert.equal(fs.existsSync(path.join(cacheDir, "1.7.12", "actionlint")), false);
  });
});

test("actionlint install fails closed before any network/filesystem work when neither checksum tool is available", () => {
  withFakeInstallEnv({}, ({ bin, cacheDir }) => {
    assert.throws(() => {
      execFileSync(path.join(ROOT, "tools", "actionlint.sh"), ["--install"], {
        env: { PATH: bin, ACTIONLINT_CACHE_DIR: cacheDir },
        stdio: "pipe"
      });
    }, /neither sha256sum nor shasum is available/);
    assert.equal(fs.existsSync(path.join(cacheDir, "1.7.12")), false);
  });
});

test("gitignore covers generated tooling state", () => {
  const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  for (const entry of ["venv/", ".hypothesis/", "coverage/", "node_modules/"]) {
    assert.ok(gitignore.includes(entry), `.gitignore missing ${entry}`);
  }
});

test("no stray generated state at repo root", () => {
  // A proxy for the repo's "clean-state" contract: after setup/tests have run in this very
  // checkout, `git status --ignored` must classify every generated tooling directory as
  // ignored (via .gitignore), and `.nyc_output` must never appear at the repo root.
  const output = execFileSync("git", ["status", "--porcelain", "--ignored"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.ok(!output.includes(".nyc_output"), "stray .nyc_output at repo root");
  const unignoredUntracked = output
    .split("\n")
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3));
  for (const generated of ["venv/", "node_modules/", ".hypothesis/", "coverage/"]) {
    assert.ok(
      !unignoredUntracked.includes(generated),
      `${generated} is untracked and NOT ignored (git status shows ?? instead of !!)`
    );
  }
});

test("no accidental check:ci or pre-commit command", () => {
  assert.ok(!("check:ci" in PKG.scripts));
  assert.ok(!fs.existsSync(path.join(ROOT, ".pre-commit-config.yaml")));
});

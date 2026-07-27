/**
 * Final command-authority contract: `check:core` is exactly the literal
 * target command graph, `check:all`/`check:strict` are exact aliases, `tools/check-all.sh` is a
 * pure root-scoped wrapper, no forbidden/duplicate/undeclared/cyclic script remains, and a
 * deliberate failing fixture proves both `check:core` and the wrapper propagate failure for
 * every required group.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const ROOT = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const REQUIRED_CHECK_CORE_GROUPS = [
  "check:standard",
  "typecheck",
  "package:check",
  "test:focus:check",
  "check:smells",
  "check:python-contracts",
  "test:split",
  "check:complexity",
  "check:scaling",
  "docs:check",
  "check:filesize"
];

const FORBIDDEN_SCRIPTS = ["check:migration", "check:ci", "check:js:core", "check:js:all"];

/** Scripts that are intentionally not reached by `check:all` (maintainer/dev entry points). */
const ALLOWED_OUTSIDE_CHECK_ALL = [
  "setup",
  "hooks:install",
  "hooks:doctor",
  "format",
  "format:scope",
  "requirements:lock",
  "release:prepare",
  "release:create",
  "check:fast",
  "check:strict",
  "dependencies:audit"
];

/**
 * @param {string} scriptBody
 * @returns {Set<string>}
 */
function npmRunTokens(scriptBody) {
  const tokens = new Set();
  const re = /npm run ([\w:-]+)/g;
  let match;
  while ((match = re.exec(scriptBody)) !== null) {
    tokens.add(match[1]);
  }
  return tokens;
}

test("check:core is exactly the literal target ordered graph", () => {
  const body = PKG.scripts["check:core"];
  assert.ok(body, "check:core must be defined");
  const orderedTokens = [...body.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
  assert.deepEqual(orderedTokens, REQUIRED_CHECK_CORE_GROUPS);
});

test("check:all is exactly check:core && test:coverage:check", () => {
  assert.equal(PKG.scripts["check:all"], "npm run check:core && npm run test:coverage:check");
});

test("check:strict is an exact alias of check:all", () => {
  assert.equal(PKG.scripts["check:strict"], "npm run check:all");
});

test("tools/check-all.sh is a pure root-scoped compatibility wrapper", () => {
  const source = fs.readFileSync(path.join(ROOT, "tools", "check-all.sh"), "utf8");
  const meaningfulLines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  assert.deepEqual(meaningfulLines, [
    "set -euo pipefail",
    'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
    'REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"',
    'cd "$REPO_ROOT"',
    "npm run check:all"
  ]);
});

test("no forbidden script name is declared", () => {
  for (const name of FORBIDDEN_SCRIPTS) {
    assert.ok(!(name in PKG.scripts), `forbidden script present: ${name}`);
  }
});

test("docs:check is reached by check:core", () => {
  assert.ok("docs:check" in PKG.scripts, "docs:check must be defined");
  assert.ok(
    npmRunTokens(PKG.scripts["check:core"]).has("docs:check"),
    "check:core must run docs:check"
  );
});

test("schema:check is a real leaf reached by package:check", () => {
  assert.ok("schema:check" in PKG.scripts, "schema:check must be defined");
  assert.equal(PKG.scripts["schema:check"], "node tools/check-schema.mjs");
  const packageCheckTokens = [...PKG.scripts["package:check"].matchAll(/npm run ([\w:-]+)/g)].map(
    (m) => m[1]
  );
  assert.equal(
    packageCheckTokens[0],
    "schema:check",
    "package:check must run schema:check as its first composed step"
  );
});

test("every declared script is reachable from check:all or explicitly allowed outside it", () => {
  const reachable = new Set();

  /** @param {string} name */
  function visit(name) {
    if (reachable.has(name) || !(name in PKG.scripts)) return;
    reachable.add(name);
    for (const token of npmRunTokens(PKG.scripts[name])) {
      visit(token);
    }
  }
  visit("check:all");

  for (const name of Object.keys(PKG.scripts)) {
    if (reachable.has(name)) continue;
    assert.ok(
      ALLOWED_OUTSIDE_CHECK_ALL.includes(name),
      `${name} is unreachable from check:all and not in ALLOWED_OUTSIDE_CHECK_ALL`
    );
  }

  for (const name of ALLOWED_OUTSIDE_CHECK_ALL) {
    assert.ok(name in PKG.scripts, `ALLOWED_OUTSIDE_CHECK_ALL names missing script '${name}'`);
    assert.ok(
      !reachable.has(name),
      `${name} is reachable from check:all; remove it from the allowlist`
    );
  }
});

test("no undeclared script is referenced by any npm run token", () => {
  for (const [name, body] of Object.entries(PKG.scripts)) {
    for (const token of npmRunTokens(body)) {
      assert.ok(token in PKG.scripts, `${name} references undeclared script '${token}'`);
    }
  }
});

test("the script reference graph has no recursive cycle", () => {
  const visiting = new Set();
  const visited = new Set();

  /**
   * @param {string} name
   * @param {string[]} chain
   */
  function visit(name, chain) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`cycle detected: ${[...chain, name].join(" -> ")}`);
    }
    visiting.add(name);
    for (const token of npmRunTokens(PKG.scripts[name] || "")) {
      visit(token, [...chain, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of Object.keys(PKG.scripts)) {
    visit(name, []);
  }
});

test("hook and release automation each invoke exactly one npm run check:all", () => {
  const prePush = fs.readFileSync(path.join(ROOT, ".githooks", "pre-push"), "utf8");
  const prePushMatches = prePush.match(/npm run check:all/g) || [];
  assert.equal(prePushMatches.length, 1, "pre-push must invoke check:all exactly once");

  const releaseCreate = fs.readFileSync(path.join(ROOT, "tools", "release-create.mjs"), "utf8");
  const releaseMatches = releaseCreate.match(/"check:all"/g) || [];
  assert.equal(
    releaseMatches.length,
    1,
    "release-create.mjs must reference check:all exactly once"
  );
});

/** @returns {string} */
function makeGraphFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-command-graph-"));
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "tools", "check-all.sh"),
    path.join(root, "tools", "check-all.sh")
  );
  fs.chmodSync(path.join(root, "tools", "check-all.sh"), 0o755);

  fs.writeFileSync(
    path.join(root, "leaf.mjs"),
    [
      "const [, , name] = process.argv;",
      "const failing = (process.env.POLARRECORDER_FAIL_LEAF || '').split(',');",
      "if (failing.includes(name)) {",
      "  console.error(`leaf ${name} failing by fixture request`);",
      "  process.exit(1);",
      "}",
      "console.log(`leaf ${name} ok`);",
      ""
    ].join("\n")
  );

  const leafScripts = Object.fromEntries(
    REQUIRED_CHECK_CORE_GROUPS.map((group) => [group, `node leaf.mjs ${group}`])
  );
  const pkg = {
    name: "command-graph-fixture",
    private: true,
    scripts: {
      ...leafScripts,
      "test:coverage:check": "node leaf.mjs test:coverage:check",
      "check:core": `npm run ${REQUIRED_CHECK_CORE_GROUPS.join(" && npm run ")}`,
      "check:all": "npm run check:core && npm run test:coverage:check"
    }
  };
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg, null, 2));
  return root;
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("a passing fixture graph exits 0 through both check:core and the wrapper", () => {
  const root = makeGraphFixture();
  const core = spawnSync("npm", ["run", "check:core"], { cwd: root, encoding: "utf8" });
  assert.equal(core.status, 0, core.stderr);
  const wrapper = spawnSync("bash", ["tools/check-all.sh"], { cwd: root, encoding: "utf8" });
  assert.equal(wrapper.status, 0, wrapper.stderr);
  cleanup(root);
});

for (const failingGroup of REQUIRED_CHECK_CORE_GROUPS) {
  test(`a failing '${failingGroup}' fixture leaf fails check:core and the wrapper`, () => {
    const root = makeGraphFixture();
    const env = { ...process.env, POLARRECORDER_FAIL_LEAF: failingGroup };

    const core = spawnSync("npm", ["run", "check:core"], { cwd: root, encoding: "utf8", env });
    assert.notEqual(core.status, 0, `check:core must fail when ${failingGroup} fails`);

    const wrapper = spawnSync("bash", ["tools/check-all.sh"], { cwd: root, encoding: "utf8", env });
    assert.notEqual(wrapper.status, 0, `tools/check-all.sh must fail when ${failingGroup} fails`);

    cleanup(root);
  });
}

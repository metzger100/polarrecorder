/**
 * Final command-authority contract: `check:core` is exactly the literal
 * target command graph, `check:all`/`check:strict` are exact aliases, `check:fast` is
 * exactly the bounded static/typing/unit graph, and the pre-push hook uses
 * wrapper, no forbidden/duplicate/undeclared/cyclic script remains, and deliberate failing
 * fixtures prove both `check:core`'s duplicate-leaf rejection and its per-group failure
 * propagation.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "vitest";

const ROOT = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const REQUIRED_CHECK_CORE_GROUPS = [
  "check:standard",
  "check:shared-core",
  "check:generic-surface",
  "check:standalone",
  "check:suppressions",
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
  "test:unit",
  "check:strict",
  "dependencies:audit",
  "portable-core:attest"
];

/** Exhaustive/coverage/complexity/scaling groups `check:fast` must never reach. */
const CHECK_FAST_EXCLUDED_GROUPS = [
  "test:split",
  "test:tools",
  "check:python-contracts",
  "test:coverage:check",
  "package:check",
  "docs:check",
  "check:complexity",
  "check:scaling",
  "release:create"
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

/**
 * @param {Record<string, string>} scripts
 * @param {string} rootName
 * @returns {{reachable: Set<string>, parents: Map<string, Set<string>>}}
 */
function walkFrom(scripts, rootName) {
  const reachable = new Set();
  /** @type {Map<string, Set<string>>} */
  const parents = new Map();

  /** @param {string} name */
  function visit(name) {
    if (reachable.has(name) || !(name in scripts)) return;
    reachable.add(name);
    for (const token of npmRunTokens(scripts[name])) {
      if (!parents.has(token)) parents.set(token, new Set());
      parents.get(token)?.add(name);
      visit(token);
    }
  }
  visit(rootName);
  return { reachable, parents };
}

/**
 * @param {Record<string, string>} scripts
 * @param {string} rootName
 * @returns {string[]} script names reached by more than one distinct parent from rootName
 */
function duplicateLeaves(scripts, rootName) {
  const { parents } = walkFrom(scripts, rootName);
  return [...parents.entries()]
    .filter(([, parentSet]) => parentSet.size > 1)
    .map(([name]) => name)
    .sort();
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

test("check:fast is exactly check:standard && typecheck && test:unit", () => {
  assert.equal(PKG.scripts["check:fast"], "npm run check:standard && npm run typecheck && npm run test:unit");
});

test("check:fast never reaches an exhaustive, package, docs, complexity, or scaling group", () => {
  const { reachable } = walkFrom(PKG.scripts, "check:fast");
  for (const excluded of CHECK_FAST_EXCLUDED_GROUPS) {
    assert.ok(!reachable.has(excluded), `check:fast must not reach ${excluded}`);
  }
});

test("no npm-script leaf is reachable more than once from check:core", () => {
  assert.deepEqual(duplicateLeaves(PKG.scripts, "check:core"), []);
});

test("no forbidden script name is declared", () => {
  for (const name of FORBIDDEN_SCRIPTS) {
    assert.ok(!(name in PKG.scripts), `forbidden script present: ${name}`);
  }
});

test("docs:check is reached by check:core", () => {
  assert.ok("docs:check" in PKG.scripts, "docs:check must be defined");
  assert.ok(npmRunTokens(PKG.scripts["check:core"]).has("docs:check"), "check:core must run docs:check");
});

test("schema:check is a real leaf reached by package:check", () => {
  assert.ok("schema:check" in PKG.scripts, "schema:check must be defined");
  assert.equal(PKG.scripts["schema:check"], "node tools/check-schema.mjs");
  const packageCheckTokens = [...PKG.scripts["package:check"].matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
  assert.equal(packageCheckTokens[0], "schema:check", "package:check must run schema:check as its first composed step");
});

test("every declared script is reachable from check:all or explicitly allowed outside it", () => {
  const { reachable } = walkFrom(PKG.scripts, "check:all");

  for (const name of Object.keys(PKG.scripts)) {
    if (reachable.has(name)) continue;
    assert.ok(
      ALLOWED_OUTSIDE_CHECK_ALL.includes(name),
      `${name} is unreachable from check:all and not in ALLOWED_OUTSIDE_CHECK_ALL`
    );
  }

  for (const name of ALLOWED_OUTSIDE_CHECK_ALL) {
    assert.ok(name in PKG.scripts, `ALLOWED_OUTSIDE_CHECK_ALL names missing script '${name}'`);
    assert.ok(!reachable.has(name), `${name} is reachable from check:all; remove it from the allowlist`);
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
  assert.equal(releaseMatches.length, 1, "release-create.mjs must reference check:all exactly once");
});

/** @returns {string} */
function makeGraphFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-command-graph-"));
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

  const leafScripts = Object.fromEntries(REQUIRED_CHECK_CORE_GROUPS.map((group) => [group, `node leaf.mjs ${group}`]));
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

test("a passing fixture graph exits 0 through check:core", () => {
  const root = makeGraphFixture();
  const core = spawnSync("npm", ["run", "check:core"], { cwd: root, encoding: "utf8" });
  assert.equal(core.status, 0, core.stderr);
  cleanup(root);
});

for (const failingGroup of REQUIRED_CHECK_CORE_GROUPS) {
  test(`a failing '${failingGroup}' fixture leaf fails check:core`, () => {
    const root = makeGraphFixture();
    const env = { ...process.env, POLARRECORDER_FAIL_LEAF: failingGroup };

    const core = spawnSync("npm", ["run", "check:core"], { cwd: root, encoding: "utf8", env });
    assert.notEqual(core.status, 0, `check:core must fail when ${failingGroup} fails`);

    cleanup(root);
  });
}

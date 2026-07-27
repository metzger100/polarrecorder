/**
 * Self-tests for tools/quality-policy/complexity-scan.mjs and complexity-budget.mjs --
 * the permanent, parser-locked complexity ratchet. The active baseline enforces the
 * strict 10/40/4/6 limits directly against the live tree; there is no historical
 * Git-blob-derived exception path to reconcile against.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "node:test";
import path from "node:path";

import { runComplexityBudgetCheck } from "../../tools/quality-policy/complexity-budget.mjs";

const ROOT = process.cwd();

test("the real repo complexity budget check passes", () => {
  const result = runComplexityBudgetCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("passes when no production function exceeds the strict limits", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", CLEAN_FIXTURE);
  writePolicies(root, []);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

test("fails on a new over-limit function that has no baseline entry", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", COMPLEXITY_FIXTURE);
  writePolicies(root, []);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((f) => f.includes("New over-limit function") && f.includes("complexity"))
  );
  cleanup(root);
});

test("fails on a new over-limit function in the shipped module entrypoint", () => {
  const root = makeFakeRoot();
  writeFile(root, "plugin.mjs", `export ${COMPLEXITY_FIXTURE}`);
  writePolicies(root, []);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((f) => f.includes("plugin.mjs") && f.includes("New over-limit function"))
  );
  cleanup(root);
});

test("passes a max-statements violation that exactly matches its recorded baseline value", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", STATEMENTS_FIXTURE);
  writePolicies(root, [
    {
      file: "viewer/example.js",
      identity: "tooManyStatements",
      metric: "max-statements",
      value: 43,
      limit: 40
    }
  ]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

test("fails when an active baseline value is above the current finding", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", STATEMENTS_FIXTURE);
  const active = {
    file: "viewer/example.js",
    identity: "tooManyStatements",
    metric: "max-statements",
    value: 44,
    limit: 40
  };
  writePolicies(root, [active]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("Complexity baseline can shrink")));
  assert.ok(
    result.failures.some((f) => f.includes("update the active baseline to the current value"))
  );
  cleanup(root);
});

test("fails a max-depth violation whose value increased past its recorded baseline", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", DEPTH_FIXTURE);
  const entry = {
    file: "viewer/example.js",
    identity: "tooDeep",
    metric: "max-depth",
    value: 5,
    limit: 4
  };
  writePolicies(root, [entry]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((f) => f.includes("Complexity regression") && f.includes("max-depth"))
  );
  cleanup(root);
});

test("fails a max-params violation with a stale baseline entry once the function is fixed", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", CLEAN_FIXTURE);
  const entry = {
    file: "viewer/example.js",
    identity: "tooManyParams",
    metric: "max-params",
    value: 7,
    limit: 6
  };
  writePolicies(root, [entry]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some(
      (f) => f.includes("Stale complexity-baseline entry") && f.includes("tooManyParams")
    )
  );
  cleanup(root);
});

test("fails when the baseline file has a duplicate entry for the same function and metric", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", PARAMS_FIXTURE);
  const entry = {
    file: "viewer/example.js",
    identity: "tooManyParams",
    metric: "max-params",
    value: 7,
    limit: 6
  };
  writePolicies(root, [entry, entry]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("Duplicate complexity-baseline entry")));
  cleanup(root);
});

test("fails closed when a baseline value is not a finite integer", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", PARAMS_FIXTURE);
  const entry = {
    file: "viewer/example.js",
    identity: "tooManyParams",
    metric: "max-params",
    value: "7",
    limit: 6
  };
  writePolicies(root, [entry]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("value must be an integer above 6")));
  cleanup(root);
});

test("fails closed when a baseline metric or strict limit is invalid", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", PARAMS_FIXTURE);
  writePolicies(root, [
    {
      file: "viewer/example.js",
      identity: "tooManyParams",
      metric: "max-params",
      value: 7,
      limit: 7
    },
    { file: "viewer/example.js", identity: "other", metric: "unknown", value: 7, limit: 6 }
  ]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("limit must be 6")));
  assert.ok(result.failures.some((f) => f.includes("unknown metric 'unknown'")));
  cleanup(root);
});

test("passes when an active baseline entry exactly matches its live finding value", () => {
  const root = makeFakeRoot();
  writeFile(root, "viewer/example.js", COMPLEXITY_FIXTURE);
  const entry = {
    file: "viewer/example.js",
    identity: "tooComplex",
    metric: "complexity",
    value: 12,
    limit: 10
  };
  writePolicies(root, [entry]);

  const result = runComplexityBudgetCheck({ root, print: false });

  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

/** @param {number} count @returns {string} */
function buildIfChain(count) {
  const lines = [];
  for (let i = 0; i < count; i += 1) lines.push(`  if (a === ${i}) { b += ${i}; }`);
  return lines.join("\n");
}

/** @param {number} count @returns {string} */
function buildStatements(count) {
  const lines = [];
  for (let i = 0; i < count; i += 1) lines.push(`  b += ${i};`);
  return lines.join("\n");
}

const COMPLEXITY_FIXTURE = `function tooComplex(a) {
  let b = 0;
${buildIfChain(11)}
  return b;
}
`;

const STATEMENTS_FIXTURE = `function tooManyStatements() {
  let b = 0;
${buildStatements(41)}
  return b;
}
`;

const DEPTH_FIXTURE = `function tooDeep(a) {
  if (a === 1) {
    if (a === 2) {
      if (a === 3) {
        if (a === 4) {
          if (a === 5) {
            if (a === 6) {
              return a;
            }
          }
        }
      }
    }
  }
  return 0;
}
`;

const PARAMS_FIXTURE = `function tooManyParams(a, b, c, d, e, f, g) {
  return a + b + c + d + e + f + g;
}
`;

const CLEAN_FIXTURE = `function clean(a, b) {
  return a + b;
}
`;

/** @returns {string} */
function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-complexity-budget-"));
  fs.mkdirSync(path.join(root, "viewer"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  return root;
}

/**
 * @param {string} root
 * @param {string} relativePath
 * @param {string} content
 */
function writeFile(root, relativePath, content) {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

/**
 * @param {string} root
 * @param {object[]} entries
 */
function writePolicies(root, entries) {
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "complexity-baseline.json"),
    JSON.stringify({ entries })
  );
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

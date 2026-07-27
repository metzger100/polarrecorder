/**
 * Self-tests for the direct-ESLint shipped-JavaScript complexity policy
 * (`tools/quality-policy/eslint.complexity.config.mjs`, run by `npm run check:complexity`).
 * There is no baseline, scanner, or budget ledger: every one of the four strict limits
 * (complexity 10, max-statements 40, max-depth 4, max-params 6) is enforced by ESLint's
 * own rule implementations, at error severity, directly against the live shipped tree.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";
import path from "node:path";

const ROOT = process.cwd();
const ESLINT_BIN = path.join(ROOT, "node_modules", ".bin", "eslint");
const COMPLEXITY_CONFIG = path.join(
  ROOT,
  "tools",
  "quality-policy",
  "eslint.complexity.config.mjs"
);
const BASELINE_PATH = path.join(ROOT, "tools", "quality-policy", "complexity-baseline.json");

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

const CLEAN_FIXTURE = [
  "/** Module: Probe */",
  "window.Polarrecorder = window.Polarrecorder || {};",
  "(function () {",
  '  "use strict";',
  "  function render(a, b) {",
  "    return a + b;",
  "  }",
  "  window.Polarrecorder.Probe = { Render: render };",
  "}());",
  ""
].join("\n");

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

/**
 * @param {unknown} error
 * @returns {string}
 */
function execErrorOutput(error) {
  if (error && typeof error === "object" && "stdout" in error && "stderr" in error) {
    const withOutput = /** @type {{stdout?: unknown, stderr?: unknown}} */ (error);
    return String(withOutput.stdout || "") + String(withOutput.stderr || "");
  }
  return String(error);
}

/**
 * @param {string} relativePath
 * @param {string} content
 * @returns {{ok: boolean, output: string}}
 */
function runComplexityEslintOnFixture(relativePath, content) {
  const absolutePath = path.join(ROOT, relativePath);
  fs.writeFileSync(absolutePath, content);
  try {
    execFileSync(ESLINT_BIN, ["--config", COMPLEXITY_CONFIG, relativePath], {
      cwd: ROOT,
      stdio: "pipe"
    });
    return { ok: true, output: "" };
  } catch (error) {
    return { ok: false, output: execErrorOutput(error) };
  } finally {
    fs.rmSync(absolutePath, { force: true });
  }
}

test("the retired baseline/scanner/budget files are absent", () => {
  for (const relative of [
    "tools/quality-policy/complexity-baseline.json",
    "tools/quality-policy/complexity-budget.mjs",
    "tools/quality-policy/complexity-scan.mjs"
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `${relative} must be deleted`);
  }
});

test("a clean viewer function passes", () => {
  const result = runComplexityEslintOnFixture("viewer/__complexity_probe.js", CLEAN_FIXTURE);
  assert.equal(result.ok, true, result.output);
});

test("a complexity violation fails independently", () => {
  const result = runComplexityEslintOnFixture("viewer/__complexity_probe.js", COMPLEXITY_FIXTURE);
  assert.equal(result.ok, false);
  assert.ok(result.output.includes("complexity"), result.output);
});

test("a max-statements violation fails independently", () => {
  const result = runComplexityEslintOnFixture("viewer/__complexity_probe.js", STATEMENTS_FIXTURE);
  assert.equal(result.ok, false);
  assert.ok(result.output.includes("too many statements"), result.output);
});

test("a max-depth violation fails independently", () => {
  const result = runComplexityEslintOnFixture("viewer/__complexity_probe.js", DEPTH_FIXTURE);
  assert.equal(result.ok, false);
  assert.ok(result.output.includes("nested too deeply"), result.output);
});

test("a max-params violation fails independently", () => {
  const result = runComplexityEslintOnFixture("viewer/__complexity_probe.js", PARAMS_FIXTURE);
  assert.equal(result.ok, false);
  assert.ok(result.output.includes("too many parameters"), result.output);
});

test("the legacy plugin.js entrypoint is covered as a classic script", () => {
  const absolutePath = path.join(ROOT, "plugin.js");
  const original = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(absolutePath, PARAMS_FIXTURE);
  try {
    execFileSync(ESLINT_BIN, ["--config", COMPLEXITY_CONFIG, "plugin.js"], {
      cwd: ROOT,
      stdio: "pipe"
    });
    assert.fail("expected plugin.js with a 7-parameter function to fail");
  } catch (error) {
    assert.ok(execErrorOutput(error).includes("too many parameters"));
  } finally {
    fs.writeFileSync(absolutePath, original);
  }
});

test("the plugin.mjs entrypoint is covered as an ES module", () => {
  const absolutePath = path.join(ROOT, "plugin.mjs");
  const original = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(absolutePath, `export ${PARAMS_FIXTURE}`);
  try {
    execFileSync(ESLINT_BIN, ["--config", COMPLEXITY_CONFIG, "plugin.mjs"], {
      cwd: ROOT,
      stdio: "pipe"
    });
    assert.fail("expected plugin.mjs with a 7-parameter function to fail");
  } catch (error) {
    assert.ok(execErrorOutput(error).includes("too many parameters"));
  } finally {
    fs.writeFileSync(absolutePath, original);
  }
});

test("a dev-tool function over the product limit is outside the shipped-product scope", () => {
  const relativePath = "tools/__complexity_probe.mjs";
  const absolutePath = path.join(ROOT, relativePath);
  fs.writeFileSync(absolutePath, `export ${PARAMS_FIXTURE}`);
  try {
    execFileSync(ESLINT_BIN, ["--config", COMPLEXITY_CONFIG, relativePath], {
      cwd: ROOT,
      stdio: "pipe"
    });
    // No error thrown: the complexity policy's `files` scope excludes tools/**, so
    // this over-limit dev-tool function is not held to the shipped-product limit here.
  } finally {
    fs.rmSync(absolutePath, { force: true });
  }
});

test("an arbitrary matching complexity-baseline.json cannot authorize a real violation", () => {
  const relativePath = "viewer/__complexity_probe.js";
  const absolutePath = path.join(ROOT, relativePath);
  fs.writeFileSync(absolutePath, PARAMS_FIXTURE);
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify({
      entries: [
        {
          file: "viewer/__complexity_probe.js",
          identity: "tooManyParams",
          metric: "max-params",
          value: 7,
          limit: 6
        }
      ]
    })
  );
  try {
    execFileSync(ESLINT_BIN, ["--config", COMPLEXITY_CONFIG, relativePath], {
      cwd: ROOT,
      stdio: "pipe"
    });
    assert.fail("expected the coordinated baseline fixture to still fail");
  } catch (error) {
    assert.ok(execErrorOutput(error).includes("too many parameters"));
  } finally {
    fs.rmSync(absolutePath, { force: true });
    fs.rmSync(BASELINE_PATH, { force: true });
  }
});

/**
 * Negative/clean proof that eslint.config.mjs actually catches every generic JS rule
 * retired from tools/check-patterns.mjs (console.log, var, eval, bare
 * isFinite, loose equality, ES-module syntax by runtime scope, empty catch, unreferenced
 * top-level function, and lint-suppression comments), by running the real `eslint`
 * binary against small temp fixtures copied into the real repo tree (ESLint's flat
 * config resolves relative to cwd, so fixtures must live under `viewer/`/`plugin.js`
 * paths for the classic-script config block to apply).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";
import path from "node:path";

const ROOT = process.cwd();
const ESLINT_BIN = path.join(ROOT, "node_modules", ".bin", "eslint");
const PROBE_PATH = path.join(ROOT, "viewer", "__eslint_test_probe.js");

if (fs.existsSync(PROBE_PATH)) {
  fs.rmSync(PROBE_PATH, { force: true });
}

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
function runEslintOnFixture(relativePath, content) {
  const absolutePath = path.join(ROOT, relativePath);
  fs.writeFileSync(absolutePath, content);
  try {
    execFileSync(ESLINT_BIN, [relativePath], { cwd: ROOT, stdio: "pipe" });
    return { ok: true, output: "" };
  } catch (error) {
    return { ok: false, output: execErrorOutput(error) };
  } finally {
    fs.rmSync(absolutePath, { force: true });
  }
}

test("catches every retired rule in one multi-violation fixture", () => {
  const source = [
    "window.Polarrecorder = window.Polarrecorder || {};",
    "(function () {",
    '  "use strict";',
    "  var x = 1;",
    "  if (x == 1) {",
    '    console.log("debug");',
    "  }",
    '  eval("1+1");',
    "  if (isFinite(x)) {",
    "    try {",
    "      doSomething();",
    "    } catch (e) {}",
    "  }",
    "  function unusedHelper() {",
    "    return 1;",
    "  }",
    "  window.Polarrecorder.Probe = {};",
    "}());",
    ""
  ].join("\n");
  const result = runEslintOnFixture("viewer/__eslint_test_probe.js", source);
  assert.equal(result.ok, false, "expected the multi-violation fixture to fail lint");
  for (const rule of [
    "no-var",
    "eqeqeq",
    "no-console",
    "no-eval",
    "no-restricted-globals",
    "no-empty",
    "no-unused-vars"
  ]) {
    assert.ok(result.output.includes(rule), `expected ${rule} to fire; got:\n${result.output}`);
  }
});

test("a clean file stays clean", () => {
  const source = [
    "/** Module: Probe */",
    "window.Polarrecorder = window.Polarrecorder || {};",
    "(function () {",
    '  "use strict";',
    "  function render() {",
    '    return document.createElement("div");',
    "  }",
    "  window.Polarrecorder.Probe = { Render: render };",
    "}());",
    ""
  ].join("\n");
  const result = runEslintOnFixture("viewer/__eslint_test_probe.js", source);
  assert.equal(result.ok, true, result.output);
});

test("plugin.js rejects ES-module syntax", () => {
  const absolutePath = path.join(ROOT, "plugin.js");
  const original = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(absolutePath, "export default 1;\n");
  try {
    execFileSync(ESLINT_BIN, ["plugin.js"], { cwd: ROOT, stdio: "pipe" });
    assert.fail("expected plugin.js with export syntax to fail lint");
  } catch (error) {
    const output = execErrorOutput(error);
    assert.ok(/Parsing error/.test(output), output);
  } finally {
    fs.writeFileSync(absolutePath, original);
  }
});

test("plugin.mjs allows ES-module syntax but not console.log", () => {
  const absolutePath = path.join(ROOT, "plugin.mjs");
  const original = fs.readFileSync(absolutePath, "utf8");
  fs.writeFileSync(
    absolutePath,
    'console.log("debug");\nexport default function plugin(_api) {}\n'
  );
  try {
    execFileSync(ESLINT_BIN, ["plugin.mjs"], { cwd: ROOT, stdio: "pipe" });
    assert.fail("expected plugin.mjs console.log to fail lint");
  } catch (error) {
    const output = execErrorOutput(error);
    assert.ok(output.includes("no-console"), output);
  } finally {
    fs.writeFileSync(absolutePath, original);
  }
});

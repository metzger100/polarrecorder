/**
 * Self-tests for the custom viewer/JS checkers, mirroring the way
 * check-patterns.test.mjs guards check-patterns.mjs. Each checker exposes a
 * run*({ root, print }) entry point so a temp workspace can drive a clean case
 * and a failing case without touching the real tree. This makes the documented
 * "Untested custom JS checker rule" smell true for every custom JS checker, not
 * just check-patterns.mjs.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import { runDependencyCheck } from "../../tools/check-dependencies.mjs";
import { runSmellContracts } from "../../tools/check-smell-contracts.mjs";
import { runJsDuplicationCheck } from "../../tools/check-js-duplication.mjs";
import { runFileSizeCheck } from "../../tools/check-file-size.mjs";
import { findLeakTokens } from "../../tools/check-viewer-contracts.mjs";

/** @typedef {{ok: boolean, failures: string[], summary?: any}} CheckResult */
/** @typedef {{root: string, print: boolean}} CheckOptions */

test("viewer contract leak scan", () => {
  assert.deepEqual(findLeakTokens("STW 5.9 kt"), []);
  assert.deepEqual(findLeakTokens("No Data"), []);
  assert.ok(findLeakTokens("STW NaN kt").length === 1);
  assert.ok(findLeakTokens("value: undefined").length === 1);
  assert.ok(findLeakTokens("value: null").length === 1);
});

test("dependency check", () => {
  const clean = runIn(
    {
      "viewer/theme.js":
        header() + "window.Polarrecorder = window.Polarrecorder || {};\nwindow.Polarrecorder.Theme = {};\n",
      "viewer/viewer.js":
        header() +
        "window.Polarrecorder = window.Polarrecorder || {};\nwindow.Polarrecorder.Boot = Polarrecorder.Theme;\n"
    },
    runDependencyCheck
  );
  assert.equal(clean.ok, true, clean.failures.join("\n"));

  const cycle = runIn(
    {
      "viewer/a.js": header() + "window.Polarrecorder.A = function () { return Polarrecorder.B; };\n",
      "viewer/b.js": header() + "window.Polarrecorder.B = function () { return Polarrecorder.A; };\n"
    },
    runDependencyCheck
  );
  assert.equal(cycle.ok, false);
  assert.ok(cycle.failures.some((/** @type {string} */ f) => f.includes("circular JS namespace reference")));
});

test("smell contracts", () => {
  const clean = smellContractsWorkspace();
  const result = runIn(clean, runSmellContracts);
  assert.equal(result.ok, true, result.failures.join("\n"));

  const rogue = smellContractsWorkspace();
  rogue["viewer/rogue.js"] = header() + namespaced("Rogue");
  const rogueResult = runIn(rogue, runSmellContracts);
  assert.equal(rogueResult.ok, false);
  assert.ok(rogueResult.failures.some((/** @type {string} */ f) => f.includes("viewer-script-contract: rogue.js")));

  const drift = smellContractsWorkspace();
  drift["viewer/presets.js"] =
    headerDepends("none") + "window.Polarrecorder.Presets = function () { return Polarrecorder.Theme; };\n";
  const driftResult = runIn(drift, runSmellContracts);
  assert.equal(driftResult.ok, false);
  assert.ok(driftResult.failures.some((/** @type {string} */ f) => f.includes("viewer-dependency-header-contract")));
});

test("JS duplication check", () => {
  const clean = runIn(
    {
      "viewer/a.js": header() + "window.Polarrecorder.A = " + bodyFn("alpha") + "\n",
      "viewer/b.js": header() + "window.Polarrecorder.B = function () { return 1; };\n"
    },
    runJsDuplicationCheck
  );
  assert.equal(clean.ok, true, clean.failures.join("\n"));

  const dup = runIn(
    {
      "viewer/a.js": header() + "window.Polarrecorder.A = " + bodyFn("alpha") + "\n",
      "viewer/b.js": header() + "window.Polarrecorder.B = " + bodyFn("beta") + "\n"
    },
    runJsDuplicationCheck
  );
  assert.equal(dup.ok, false);
  assert.ok(dup.failures.some((/** @type {string} */ f) => f.includes("duplicate function body across files")));
});

test("file size check", () => {
  const clean = runIn({ "viewer/good.js": header() + namespaced("Good") }, (/** @type {CheckOptions} */ opts) =>
    runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(clean.ok, true, clean.failures.join("\n"));

  const dense = runIn(
    { "viewer/bad.js": header() + "const a = 1; const b = 2; const c = 3;\n" },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(dense.ok, false);
  assert.ok(dense.failures.some((/** @type {string} */ f) => f.includes("dense-statements")));

  assertFileSizeFails(
    "stacked declarators",
    "viewer/bad.js",
    header() + "const first = 1, second = 2;\n",
    "dense-statements"
  );
  assertFileSizeFails(
    "packed destructuring",
    "viewer/bad.js",
    header() + "const { first, second, third, fourth } = source;\n",
    "dense-statements"
  );
  assertFileSizeFails(
    "packed for header",
    "viewer/bad.js",
    header() + "for (let a = 0, b = 1, c = 2, d = 3; a < b; a += 1) {}\n",
    "dense-statements"
  );
  assertFileSizeFails(
    "comma assignment sequence",
    "viewer/bad.js",
    header() + "alpha = 1, beta = 2;\n",
    "dense-statements"
  );
  assertFileSizeFails(
    "collapsed literal",
    "viewer/bad.js",
    header() +
      "const model = { alphaValue: 1, betaValue: 2, gammaValue: 3, deltaValue: 4, epsilonValue: 5, zetaValue: 6 };\n",
    "collapsed-literal"
  );

  const denseWarn = runIn(
    { "viewer/bad.js": header() + "const a = 1; const b = 2; const c = 3;\n" },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "warn" })
  );
  assert.equal(denseWarn.ok, true, "warn mode must not block one-liners");

  const oversized = runIn(
    { "documentation/big.md": "# Title\n" + "line\n".repeat(401) },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(oversized.ok, false);
  assert.ok(oversized.failures.some((/** @type {string} */ f) => f.includes("non-empty lines (limit 400)")));

  const pluginPacked = runIn(
    { "plugin.mjs": "export default function plugin() { const a = 1; const b = 2; }\n" },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(pluginPacked.ok, false);
  assert.ok(pluginPacked.failures.some((/** @type {string} */ f) => f.includes("single-line-body")));

  const legacyPluginPacked = runIn(
    { "plugin.js": "function plugin() { const a = 1; const b = 2; }\n" },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(legacyPluginPacked.ok, false);
  assert.ok(legacyPluginPacked.failures.some((/** @type {string} */ f) => f.includes("single-line-body")));

  const oversizedTool = runIn(
    { "tools/example.mjs": "export const noop = 1;\n".repeat(401) },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(oversizedTool.ok, false);
  assert.ok(oversizedTool.failures.some((/** @type {string} */ f) => f.includes("non-empty lines (limit 400)")));

  const cleanTool = runIn(
    { "tools/nested/example.mjs": "export function helper() {\n  return 1;\n}\n" },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(cleanTool.ok, true, cleanTool.failures.join("\n"));

  const densePackedTool = runIn(
    { "tools/example.mjs": "export function helper() { const a = 1; const b = 2; }\n" },
    (/** @type {CheckOptions} */ opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(densePackedTool.ok, true, "tools/**/*.mjs is scoped to the line-count limit only, not oneliner density");
});

/**
 * @param {string} label
 * @param {string} rel
 * @param {string} content
 * @param {string} kind
 */
function assertFileSizeFails(label, rel, content, kind) {
  const result = runIn({ [rel]: content }, (/** @type {CheckOptions} */ opts) =>
    runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(result.ok, false, label);
  assert.ok(
    result.failures.some((/** @type {string} */ f) => f.includes(kind)),
    label
  );
}

/** @returns {Record<string, string>} */
function smellContractsWorkspace() {
  const scripts = [
    "theme.js",
    "placeholders.js",
    "viewer.js",
    "dom.js",
    "status-ui.js",
    "presets.js",
    "polar-chart-geometry.js",
    "polar-chart.js",
    "timeline-chart.js",
    "grid-editor.js",
    "export-fields.js",
    "export-presets.js",
    "export-ui.js",
    "import-upload.js",
    "enhanced-settings.js",
    "advanced-settings.js",
    "settings-ui.js"
  ];
  /** @type {Record<string, string>} */
  const files = {};
  for (const name of scripts) {
    const member = pascal(name);
    files[`viewer/${name}`] =
      name === "viewer.js" ? header() + namespaced(member) : headerDepends("none") + namespaced(member);
  }
  const order = scripts.map((name) => `    <script src="${name}"></script>`).join("\n");
  files["viewer/viewer.html"] = `<!doctype html><html><body>\n${order}\n</body></html>\n`;
  return files;
}

/**
 * @param {string} name
 * @returns {string}
 */
function bodyFn(name) {
  return (
    `function ${name}(alpha, beta, gamma) {\n` +
    `  const total = alpha + beta + gamma;\n` +
    `  const scaled = total * 2;\n` +
    `  const trimmed = scaled - alpha;\n` +
    `  const doubled = trimmed + scaled;\n` +
    `  const capped = doubled - total;\n` +
    `  return { total: total, scaled: scaled, trimmed: trimmed, doubled: doubled, capped: capped };\n` +
    `};`
  );
}

/**
 * @param {string} fileName
 * @returns {string}
 */
function pascal(fileName) {
  return fileName
    .replace(/\.js$/, "")
    .split("-")
    .map((/** @type {string} */ part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * @param {string} member
 * @returns {string}
 */
function namespaced(member) {
  return "window.Polarrecorder = window.Polarrecorder || {};\n" + `window.Polarrecorder.${member} = {};\n`;
}

/** @returns {string} */
function header() {
  return headerDepends("none");
}

/**
 * @param {string} depends
 * @returns {string}
 */
function headerDepends(depends) {
  return `/**\n * Module: Test\n * Documentation: documentation/architecture/ui.md\n * Depends: ${depends}\n */\n`;
}

/**
 * @param {Record<string, string>} files
 * @param {(opts: CheckOptions) => CheckResult} runFn
 * @returns {CheckResult}
 */
function runIn(files, runFn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-jschk-"));
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(workspace, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
  try {
    return runFn({ root: workspace, print: false });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

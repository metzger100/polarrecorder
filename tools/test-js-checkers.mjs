#!/usr/bin/env node

/**
 * Self-tests for the custom viewer/JS checkers, mirroring the way
 * test-check-patterns.mjs guards check-patterns.mjs. Each checker exposes a
 * run*({ root, print }) entry point so a temp workspace can drive a clean case
 * and a failing case without touching the real tree. This makes the documented
 * "Untested custom JS checker rule" smell true for every custom JS checker, not
 * just check-patterns.mjs.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runNamespaceCheck } from "./check-namespace.mjs";
import { runNamingCheck } from "./check-naming.mjs";
import { runHeadersCheck } from "./check-headers.mjs";
import { runDependencyCheck } from "./check-dependencies.mjs";
import { runSmellContracts } from "./check-smell-contracts.mjs";
import { runJsDuplicationCheck } from "./check-js-duplication.mjs";
import { runFileSizeCheck } from "./check-file-size.mjs";
import { findLeakTokens } from "./check-viewer-contracts.mjs";

testNamespaceCheck();
testNamingCheck();
testHeadersCheck();
testDependencyCheck();
testSmellContracts();
testJsDuplicationCheck();
testFileSizeCheck();
testViewerContractLeakScan();

console.log("JS checker tests passed.");

function testViewerContractLeakScan() {
  assert.deepEqual(findLeakTokens("STW 5.9 kt"), []);
  assert.deepEqual(findLeakTokens("No Data"), []);
  assert.ok(findLeakTokens("STW NaN kt").length === 1);
  assert.ok(findLeakTokens("value: undefined").length === 1);
  assert.ok(findLeakTokens("value: null").length === 1);
}

function testNamespaceCheck() {
  const clean = runIn({ "viewer/good.js": header() + namespaced("Good") }, runNamespaceCheck);
  assert.equal(clean.ok, true, clean.failures.join("\n"));

  const bad = runIn(
    { "viewer/bad.js": header() + "window.Rogue = {};\n" },
    runNamespaceCheck
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.failures.some((f) => f.includes("illegal global window.Rogue")));
}

function testNamingCheck() {
  const clean = runIn({ "viewer/good.js": header() + namespaced("Good") }, runNamingCheck);
  assert.equal(clean.ok, true, clean.failures.join("\n"));

  const lowerMember = runIn(
    { "viewer/bad.js": header() + "window.Polarrecorder = window.Polarrecorder || {};\nwindow.Polarrecorder.bad = {};\n" },
    runNamingCheck
  );
  assert.equal(lowerMember.ok, false);
  assert.ok(lowerMember.failures.some((f) => f.includes("must be PascalCase")));

  const badFile = runIn({ "viewer/BadName.js": header() + namespaced("Good") }, runNamingCheck);
  assert.equal(badFile.ok, false);
  assert.ok(badFile.failures.some((f) => f.includes("must be kebab-case")));
}

function testHeadersCheck() {
  const clean = runIn(
    {
      "viewer/good.js": header() + namespaced("Good"),
      "documentation/architecture/ui.md": "# UI\n"
    },
    runHeadersCheck
  );
  assert.equal(clean.ok, true, clean.failures.join("\n"));

  const missing = runIn({ "viewer/bad.js": namespaced("Good") }, runHeadersCheck);
  assert.equal(missing.ok, false);
  assert.ok(missing.failures.some((f) => f.includes("missing top")));
}

function testDependencyCheck() {
  const clean = runIn(
    {
      "viewer/theme.js": header() + "window.Polarrecorder = window.Polarrecorder || {};\nwindow.Polarrecorder.Theme = {};\n",
      "viewer/viewer.js": header() + "window.Polarrecorder = window.Polarrecorder || {};\nwindow.Polarrecorder.Boot = Polarrecorder.Theme;\n"
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
  assert.ok(cycle.failures.some((f) => f.includes("circular JS namespace reference")));
}

function testSmellContracts() {
  const clean = smellContractsWorkspace();
  const result = runIn(clean, runSmellContracts);
  assert.equal(result.ok, true, result.failures.join("\n"));

  const rogue = smellContractsWorkspace();
  rogue["viewer/rogue.js"] = header() + namespaced("Rogue");
  const rogueResult = runIn(rogue, runSmellContracts);
  assert.equal(rogueResult.ok, false);
  assert.ok(rogueResult.failures.some((f) => f.includes("viewer-script-contract: rogue.js")));
  assert.ok(rogueResult.failures.some((f) => f.includes("viewer-coverage-target-contract: rogue.js")));

  const drift = smellContractsWorkspace();
  drift["viewer/presets.js"] = headerDepends("none")
    + "window.Polarrecorder.Presets = function () { return Polarrecorder.Theme; };\n";
  const driftResult = runIn(drift, runSmellContracts);
  assert.equal(driftResult.ok, false);
  assert.ok(driftResult.failures.some((f) => f.includes("viewer-dependency-header-contract")));
}

function testJsDuplicationCheck() {
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
  assert.ok(dup.failures.some((f) => f.includes("duplicate function body across files")));
}

function testFileSizeCheck() {
  const clean = runIn({ "viewer/good.js": header() + namespaced("Good") }, (opts) =>
    runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(clean.ok, true, clean.failures.join("\n"));

  const dense = runIn(
    { "viewer/bad.js": header() + "const a = 1; const b = 2; const c = 3;\n" },
    (opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(dense.ok, false);
  assert.ok(dense.failures.some((f) => f.includes("dense-statements")));

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
    header() + "const model = { alphaValue: 1, betaValue: 2, gammaValue: 3, deltaValue: 4, epsilonValue: 5, zetaValue: 6 };\n",
    "collapsed-literal"
  );

  const denseWarn = runIn(
    { "viewer/bad.js": header() + "const a = 1; const b = 2; const c = 3;\n" },
    (opts) => runFileSizeCheck({ ...opts, onelinerMode: "warn" })
  );
  assert.equal(denseWarn.ok, true, "warn mode must not block one-liners");

  const oversized = runIn(
    { "documentation/big.md": "# Title\n" + "line\n".repeat(401) },
    (opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(oversized.ok, false);
  assert.ok(oversized.failures.some((f) => f.includes("non-empty lines (limit 400)")));

  const pluginPacked = runIn(
    { "plugin.mjs": "export default function plugin() { const a = 1; const b = 2; }\n" },
    (opts) => runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(pluginPacked.ok, false);
  assert.ok(pluginPacked.failures.some((f) => f.includes("single-line-body")));
}

function assertFileSizeFails(label, rel, content, kind) {
  const result = runIn({ [rel]: content }, (opts) =>
    runFileSizeCheck({ ...opts, onelinerMode: "block" })
  );
  assert.equal(result.ok, false, label);
  assert.ok(result.failures.some((f) => f.includes(kind)), label);
}

function smellContractsWorkspace() {
  const scripts = [
    "theme.js", "placeholders.js", "viewer.js", "dom.js", "presets.js", "polar-chart.js",
    "timeline-chart.js", "grid-editor.js", "export-ui.js", "settings-ui.js"
  ];
  const files = {};
  for (const name of scripts) {
    const member = pascal(name);
    files[`viewer/${name}`] = name === "viewer.js"
      ? header() + namespaced(member)
      : headerDepends("none") + namespaced(member);
  }
  const order = scripts.map((name) => `    <script src="${name}"></script>`).join("\n");
  files["viewer/viewer.html"] = `<!doctype html><html><body>\n${order}\n</body></html>\n`;
  const targets = scripts.map((name) => `  "viewer/${name}": 50`).join(",\n");
  files["tools/check-js-coverage.mjs"] =
    `const TEST_FILES = ["tools/test-viewer-smoke.mjs"];\nconst COVERAGE_TARGETS = {\n${targets}\n};\n`;
  return files;
}

function bodyFn(name) {
  return `function ${name}(alpha, beta, gamma) {\n`
    + `  const total = alpha + beta + gamma;\n`
    + `  const scaled = total * 2;\n`
    + `  const trimmed = scaled - alpha;\n`
    + `  const doubled = trimmed + scaled;\n`
    + `  const capped = doubled - total;\n`
    + `  return { total: total, scaled: scaled, trimmed: trimmed, doubled: doubled, capped: capped };\n`
    + `};`;
}

function pascal(fileName) {
  return fileName
    .replace(/\.js$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function namespaced(member) {
  return "window.Polarrecorder = window.Polarrecorder || {};\n"
    + `window.Polarrecorder.${member} = {};\n`;
}

function header() {
  return headerDepends("none");
}

function headerDepends(depends) {
  return `/**\n * Module: Test\n * Documentation: documentation/architecture/ui.md\n * Depends: ${depends}\n */\n`;
}

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

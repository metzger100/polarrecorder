#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runPatternCheck } from "./check-patterns.mjs";

testCleanWorkspacePasses();
testPluginMjsIsScannedButAllowsEsModules();
testDefaultTruthyFallbackFails();
testHardcodedRuntimeDefaultFails();
testConfigCacheLiteralDefaultFails();
testBroadConfigDefaultFails();
testPlaceholderLiteralFails();
testResponsiveHardFloorFails();
testCanvasApiGuardFails();
testTryFinallyCanvasDrawingFails();
testPromiseEmptyCatchFails();
testFrameworkMethodGuardFails();
testCatchFallbackFails();
testCatchWithBoundaryMarkerPasses();
testInternalNamespaceFallbackFails();
testAbsolutePathInWorkflowFails();
testMarkdownTodoWithoutOwnerFails();

console.log("Pattern checker tests passed.");

function testCleanWorkspacePasses() {
  const result = runChecker({
    "viewer/good.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  const Polarrecorder = window.Polarrecorder;
  function createLabel(text) {
    const node = document.createElement("span");
    node.textContent = text;
    return node;
  }
  Polarrecorder.Good = { CreateLabel: createLabel };
}());
`
  });

  assert.equal(result.status, 0, result.failures.join("\n"));
  assert.equal(result.summary.ok, true);
}

function testPluginMjsIsScannedButAllowsEsModules() {
  const clean = runChecker({
    "plugin.mjs": "export default function plugin(_api) {}\n"
  });

  assert.equal(clean.status, 0, clean.failures.join("\n"));

  const bad = runChecker({
    "plugin.mjs": "export default function plugin(_api) {\n  console.log(\"debug\");\n}\n"
  });

  assert.equal(bad.status, 1);
  assert.equal(bad.summary.byRule["console-log"], 1);
}

function testDefaultTruthyFallbackFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function read(def) {
    return def.default || "x";
  }
  window.Polarrecorder.Bad = { Read: read };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["default-truthy-fallback"], 1);
}

function testHardcodedRuntimeDefaultFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  const Polarrecorder = window.Polarrecorder;
  function readPercentile() {
    const config = Polarrecorder["ConfigCache"] || {};
    return config.percentile || 65;
  }
  Polarrecorder.Bad = { ReadPercentile: readPercentile };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["hardcoded-runtime-default"], 2);
}

function testConfigCacheLiteralDefaultFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  const Polarrecorder = window.Polarrecorder;
  function loadDefault() {
    Polarrecorder.ConfigCache = { min_samples_for_export: 10, percentile: 65 };
  }
  Polarrecorder.Bad = { LoadDefault: loadDefault };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["hardcoded-runtime-default"], 1);
}

function testBroadConfigDefaultFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  const Polarrecorder = window.Polarrecorder;
  function readConfig() {
    const config = Polarrecorder.ConfigCache;
    return config.flush_interval_s ?? 30;
  }
  Polarrecorder.Bad = { ReadConfig: readConfig };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["hardcoded-runtime-default"], 1);
}

function testPlaceholderLiteralFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function render() {
    return "No Data";
  }
  window.Polarrecorder.Bad = { Render: render };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["placeholder-literal"], 1);
}

function testResponsiveHardFloorFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function textSize(size) {
    return Math.max(12, size);
  }
  window.Polarrecorder.Bad = { TextSize: textSize };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["responsive-layout-hard-floor"], 1);
}

function testCanvasApiGuardFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function draw(ctx) {
    if (typeof ctx.save === "function") ctx.save();
  }
  window.Polarrecorder.Bad = { Draw: draw };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["canvas-api-typeof-guard"], 1);
}

function testTryFinallyCanvasDrawingFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function draw(ctx) {
    try {
      ctx.save();
      ctx.fill();
    } finally {
      ctx.restore();
    }
  }
  window.Polarrecorder.Bad = { Draw: draw };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["try-finally-canvas-drawing"], 1);
}

function testPromiseEmptyCatchFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function refresh() {
    fetch("status").catch(function () {});
  }
  window.Polarrecorder.Bad = { Refresh: refresh };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["promise-empty-catch"], 1);
}

function testFrameworkMethodGuardFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  const Polarrecorder = window.Polarrecorder;
  function maybeCall() {
    if (typeof Polarrecorder.Dom.Button === "function") {
      return Polarrecorder.Dom.Button("x", function () {}, "primary-action");
    }
    return null;
  }
  Polarrecorder.Bad = { MaybeCall: maybeCall };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["framework-method-typeof-guard"], 1);
}

function testCatchFallbackFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function load() {
    try {
      return JSON.parse(window.name);
    } catch (error) {
      return {};
    }
  }
  window.Polarrecorder.Bad = { Load: load };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["catch-fallback"], 1);
}

function testCatchWithBoundaryMarkerPasses() {
  const result = runChecker({
    "viewer/good.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function load() {
    try {
      return JSON.parse(window.name);
    } catch (error) {
      // polarrecorder-boundary-fallback(host-window-name): window.name may be absent.
      return {};
    }
  }
  window.Polarrecorder.Good = { Load: load };
}());
`
  });

  assert.equal(result.status, 0, result.failures.join("\n"));
}

function testInternalNamespaceFallbackFails() {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  const Polarrecorder = window.Polarrecorder;
  function resolve() {
    return Polarrecorder.Presets.Fallback(0) || [];
  }
  Polarrecorder.Bad = { Resolve: resolve };
}());
`
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["internal-namespace-fallback"], 1);
}

function testAbsolutePathInWorkflowFails() {
  const result = runChecker({
    ".github/workflows/release.yml": "path: /home/leobareth/project\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["absolute-home-path"], 1);
}

function testMarkdownTodoWithoutOwnerFails() {
  const result = runChecker({
    "documentation/note.md": "# Note\n\nTODO: wire this later\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["unowned-todo"], 1);
}

function runChecker(files) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-patterns-"));
  fs.mkdirSync(path.join(workspace, "server", "polarrecorder"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "viewer"), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(workspace, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }

  const result = runPatternCheck({ root: workspace, print: false });
  return {
    failures: result.failures,
    status: result.summary.ok ? 0 : 1,
    summary: result.summary
  };
}

function viewerHeader() {
  return `/**
 * Module: Test
 * Documentation: documentation/architecture/ui.md
 * Depends: none
 */
`;
}

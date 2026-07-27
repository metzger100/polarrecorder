import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "node:test";
import path from "node:path";

import { runPatternCheck } from "../../tools/check-patterns.mjs";

test("a clean workspace passes", () => {
  const result = runChecker({
    "viewer/good.js":
      viewerHeader() +
      `
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
});

test("plugin entrypoints are scanned", () => {
  // ES-module syntax by runtime scope and console.log are ESLint's job now (see
  // tests/js/eslint-config.test.mjs); this only proves check-patterns.mjs still visits
  // both entrypoint files for its own retained rules (e.g. inner-html-assignment).
  const legacyClean = runChecker({
    "plugin.js": '(function () {\n  "use strict";\n}());\n'
  });
  assert.equal(legacyClean.status, 0, legacyClean.failures.join("\n"));

  const legacyBad = runChecker({
    "plugin.js": 'document.body.innerHTML = "<b>x</b>";\n'
  });
  assert.equal(legacyBad.status, 1);
  assert.equal(legacyBad.summary.byRule["inner-html-assignment"], 1);

  const clean = runChecker({
    "plugin.mjs": "export default function plugin(_api) {}\n"
  });
  assert.equal(clean.status, 0, clean.failures.join("\n"));
});

test("a default-truthy fallback fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a hardcoded runtime default fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a ConfigCache literal default fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a broad ConfigCache default fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a placeholder literal fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a responsive hard floor fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a Canvas API typeof guard fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("try/finally canvas drawing fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("an empty Promise catch fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a framework-method typeof guard fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a comment-only catch fallback fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("a catch with a boundary-fallback marker passes", () => {
  const result = runChecker({
    "viewer/good.js":
      viewerHeader() +
      `
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
});

test("an internal-namespace fallback fails", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() +
      `
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
});

test("an absolute home path in a workflow file fails", () => {
  const result = runChecker({
    ".github/workflows/release.yml": "path: /home/leobareth/project\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["absolute-home-path"], 1);
});

test("a Markdown TODO without an owner fails", () => {
  const result = runChecker({
    "documentation/note.md": "# Note\n\nTODO: wire this later\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["unowned-todo"], 1);
});

test("a real historical exec-plan filename reference passes", () => {
  const result = runChecker({
    "documentation/note.md": "# Note\n\nSee `exec-plans/completed/PLAN1.md` for history.\n"
  });

  assert.equal(result.status, 0, result.failures.join("\n"));
});

test("a plan number citation in a tool comment fails", () => {
  // Built by concatenation so this fixture's own literal text never matches the rule
  // it exercises: check-patterns.mjs also scans this very test file.
  const planCitation = "// " + "PLAN" + "5's helper.\nexport function helper() {}\n";
  const result = runChecker({ "tools/example.mjs": planCitation });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["exec-plan-reference"], 1);
});

test("a bare phase citation without a plan number fails", () => {
  const phaseCitation = "// Retired in " + "Phase" + " 5B, replaced by the new owner.\n";
  const result = runChecker({ "tests/example.test.mjs": phaseCitation });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["exec-plan-reference"], 1);
});

test("a literal NUL byte inside a comment fails even though it cannot break parsing", () => {
  const result = runChecker({
    "tools/example.mjs": "// note\u0000 with a stray NUL\nexport function helper() {}\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["no-nul-byte"], 1);
});

test("a clean tool file with no NUL byte passes", () => {
  const result = runChecker({
    "tools/example.mjs": "// note\nexport function helper() {}\n"
  });

  assert.equal(result.status, 0, result.failures.join("\n"));
});

/** @param {Record<string, string>} files */
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

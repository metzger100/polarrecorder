import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
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

test("plugin.py owns exactly one ordinary lock", () => {
  const clean = runChecker({ "plugin.py": "import threading\nlock = threading.Lock()\n" });
  const recursive = runChecker({ "plugin.py": "import threading\nlock = threading.RLock()\n" });
  const multiple = runChecker({
    "plugin.py": "import threading\nfirst = threading.Lock()\nsecond = threading.Lock()\n"
  });

  assert.equal(clean.status, 0, clean.failures.join("\n"));
  assert.equal(recursive.summary.byRule["plugin-lock-ownership"], 2);
  assert.equal(multiple.summary.byRule["plugin-lock-ownership"], 1);
});

test("variable-renamed cross-file functions fail the generic duplication rule", () => {
  const result = runChecker({
    "viewer/one.js":
      viewerHeader() +
      "function first(alpha) { const local = alpha + 7; const next = local * 3; const total = next + alpha + 9; return total + local + next + alpha + 11 + total + local + next + alpha + 13; }\n",
    "viewer/two.js":
      viewerHeader() +
      "function second(beta) { const value = beta + 7; const result = value * 3; const sum = result + beta + 9; return sum + value + result + beta + 11 + sum + value + result + beta + 13; }\n"
  });
  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["duplicate-functions"], 2);
});

test("plugin entrypoints are scanned", () => {
  // ES-module syntax by runtime scope and console.log are ESLint's job now (see
  // tests/js/eslint-config.test.mjs); this only proves check-patterns.mjs still visits
  // both entrypoint files for its own retained rules (e.g. unsafe-html-dom-sink).
  const legacyClean = runChecker({
    "plugin.js": '(function () {\n  "use strict";\n}());\n'
  });
  assert.equal(legacyClean.status, 0, legacyClean.failures.join("\n"));

  const legacyBad = runChecker({
    "plugin.js": 'document.body.innerHTML = "<b>x</b>";\n'
  });
  assert.equal(legacyBad.status, 1);
  assert.equal(legacyBad.summary.byRule["unsafe-html-dom-sink"], 1);

  const clean = runChecker({
    "plugin.mjs": "export default function plugin(_api) {}\n"
  });
  assert.equal(clean.status, 0, clean.failures.join("\n"));
});

test("a console call in a runtime entrypoint fails", () => {
  const result = runChecker({ "plugin.mjs": "console.error('unexpected');\n" });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["console-in-runtime"], 1);
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
  assert.equal(result.summary.byRule["empty-catch"], 1);
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
  assert.equal(result.summary.byRule["catch-fallback-without-suppression"], 1);
});

test("a catch returning an explicit boundary failure passes", () => {
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
      return { ok: false, error: error };
    }
  }
  window.Polarrecorder.Good = { Load: load };
}());
`
  });

  assert.equal(result.status, 0, result.failures.join("\n"));
});

test("catches returning null or undefined without handling fail", () => {
  for (const absent of ["null", "undefined"]) {
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
      window.name = "failed";
      return ${absent};
    }
  }
  window.Polarrecorder.Bad = { Load: load };
}());
`
    });

    assert.equal(result.status, 1);
    assert.equal(result.summary.byRule["catch-fallback-without-suppression"], 1);
  }
});

test("a catch updating visible failure state passes", () => {
  const result = runChecker({
    "viewer/good.js":
      viewerHeader() +
      `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  function load(message) {
    try {
      return JSON.parse(window.name);
    } catch (error) {
      message.textContent = error.message;
      return undefined;
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
  assert.equal(result.summary.byRule["internal-contract-fallback"], 1);
});

test("an illegal global assignment fails namespace-token-consistency", () => {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + "window.Rogue = {};\n"
  });

  assert.equal(result.status, 1);
  assert.ok(result.summary.byRule["namespace-token-consistency"] >= 1);
  assert.ok(result.failures.some((f) => f.includes("illegal global window.Rogue")));
});

test("a lowercase namespace member fails namespace-token-consistency", () => {
  const result = runChecker({
    "viewer/bad.js":
      viewerHeader() + "window.Polarrecorder = window.Polarrecorder || {};\nwindow.Polarrecorder.bad = {};\n"
  });

  assert.equal(result.status, 1);
  assert.ok(result.summary.byRule["namespace-token-consistency"] >= 1);
  assert.ok(result.failures.some((f) => f.includes("must be PascalCase")));
});

test("a non-kebab-case viewer filename fails namespace-token-consistency", () => {
  const result = runChecker({
    "viewer/BadName.js":
      viewerHeader() +
      `
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";
  window.Polarrecorder.Good = {};
}());
`
  });

  assert.equal(result.status, 1);
  assert.ok(result.summary.byRule["namespace-token-consistency"] >= 1);
  assert.ok(result.failures.some((f) => f.includes("must be kebab-case")));
});

test("an absolute home path in a workflow file fails", () => {
  const result = runChecker({
    ".github/workflows/release.yml": "path: " + ["/", "home/leobareth/project"].join("") + "\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["absolute-home-path"], 1);
});

test("a Markdown TODO without an owner fails", () => {
  const result = runChecker({
    "documentation/note.md": "# Note\n\nTODO: wire this later\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["todo-without-owner"], 1);
});

test("the canonical work-marker rule preserves the JavaScript, Python, and Markdown finding union", () => {
  const result = runChecker({
    "viewer/bad.js": viewerHeader() + "// TODO: JavaScript marker\n",
    "server/polarrecorder/bad.py": "# TODO: Python marker\n",
    "documentation/note.md": "# Note\n\nTODO: Markdown marker\n"
  });

  assert.equal(result.status, 1);
  assert.equal(result.summary.byRule["todo-without-owner"], 3);
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

/** @param {Record<string, string>} files @returns {{failures: string[], status: number, summary: any}} */
function runChecker(files) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-patterns-"));
  fs.mkdirSync(path.join(workspace, "server", "polarrecorder"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "viewer"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "tools", "quality-policy", "project-pattern-context.json"),
    JSON.stringify({ schemaVersion: 1, catchFallbackExceptions: [] }),
    "utf8"
  );
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

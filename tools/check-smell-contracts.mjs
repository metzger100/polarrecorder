#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SMELL_CONTRACT_RULE_IDS = [
  "viewer-script-contract",
  "viewer-coverage-target-contract",
  "viewer-dependency-header-contract"
];

export function runSmellContracts({ root = process.cwd(), print = true } = {}) {
  const ctx = { root, viewerRoot: path.join(root, "viewer"), failures: [] };
  checkViewerScriptContract(ctx);
  checkViewerCoverageTargetContract(ctx);
  checkViewerDependencyHeaders(ctx);

  const summary = {
    ok: ctx.failures.length === 0,
    checkedRules: 3,
    failures: ctx.failures.length
  };

  if (print) reportSmellContracts(ctx.failures, summary);
  return { ok: summary.ok, failures: ctx.failures, summary };
}

function reportSmellContracts(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[smell-contracts] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Smell contract check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

function checkViewerScriptContract(ctx) {
  const expected = [
    "theme.js",
    "placeholders.js",
    "viewer.js",
    "dom.js",
    "presets.js",
    "polar-chart.js",
    "timeline-chart.js",
    "grid-editor.js",
    "export-ui.js",
    "import-upload.js",
    "enhanced-settings.js",
    "advanced-settings.js",
    "settings-ui.js"
  ];
  const html = read(ctx, "viewer/viewer.html");
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+\.js)"/g)).map(function (match) {
    return match[1];
  });
  if (scripts.join("\n") !== expected.join("\n")) {
    ctx.failures.push(
      "viewer-script-contract: viewer.html script order must be "
      + expected.join(", ")
      + "; found "
      + scripts.join(", ")
    );
  }
  const files = collectViewerJsNames(ctx);
  for (const file of files) {
    if (!scripts.includes(file)) {
      ctx.failures.push(`viewer-script-contract: ${file} is not loaded by viewer/viewer.html`);
    }
  }
}

function checkViewerCoverageTargetContract(ctx) {
  const source = read(ctx, "tools/check-js-coverage.mjs");
  const targets = new Set(Array.from(source.matchAll(/"viewer\/([^"]+\.js)"\s*:/g)).map(function (match) {
    return match[1];
  }));
  for (const file of collectViewerJsNames(ctx)) {
    if (!targets.has(file)) {
      ctx.failures.push(`viewer-coverage-target-contract: ${file} is missing from COVERAGE_TARGETS`);
    }
  }
  if (!source.includes('"tools/test-viewer-smoke.mjs"')) {
    ctx.failures.push("viewer-coverage-target-contract: test-viewer-smoke.mjs must run under coverage");
  }
}

function checkViewerDependencyHeaders(ctx) {
  const files = collectViewerFiles(ctx);
  const definitions = mapDefinitions(files);
  for (const file of files) {
    const declared = declaredDepends(file.content);
    const actual = actualDepends(file, definitions);
    for (const missing of difference(actual, declared)) {
      ctx.failures.push(
        `viewer-dependency-header-contract: ${file.name} references ${missing} but the Depends header omits it`
      );
    }
    for (const stale of difference(declared, actual)) {
      ctx.failures.push(
        `viewer-dependency-header-contract: ${file.name} lists ${stale} but does not reference it`
      );
    }
  }
}

function mapDefinitions(files) {
  const out = new Map();
  for (const file of files) {
    for (const match of file.content.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)\s*=/g)) {
      out.set(match[1], file.name);
    }
  }
  return out;
}

function actualDepends(file, definitions) {
  if (file.name === "viewer.js") return new Set();
  const out = new Set();
  for (const match of file.content.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)/g)) {
    const owner = definitions.get(match[1]);
    if (owner && owner !== file.name) out.add(owner);
  }
  for (const match of file.content.matchAll(/Polarrecorder\["([A-Za-z_$][\w$]*)"]/g)) {
    const owner = definitions.get(match[1]);
    if (owner && owner !== file.name) out.add(owner);
  }
  return out;
}

function declaredDepends(content) {
  const match = content.match(/^\s*\*\s*Depends:\s*(.+?)\s*$/m);
  if (!match) return new Set();
  const raw = match[1].trim();
  if (raw === "none" || raw === "(none)") return new Set();
  return new Set(raw.split(",").map(function (item) {
    return item.trim().replace(/^viewer\//, "");
  }).filter(Boolean));
}

function difference(left, right) {
  return Array.from(left).filter(function (item) {
    return !right.has(item);
  }).sort();
}

function collectViewerJsNames(ctx) {
  return collectViewerFiles(ctx).map(function (file) {
    return file.name;
  });
}

function collectViewerFiles(ctx) {
  if (!fs.existsSync(ctx.viewerRoot)) return [];
  return fs.readdirSync(ctx.viewerRoot)
    .filter(function (name) {
      return name.endsWith(".js");
    })
    .sort()
    .map(function (name) {
      const rel = `viewer/${name}`;
      return { content: read(ctx, rel), name, rel };
    });
}

function read(ctx, rel) {
  return fs.readFileSync(path.join(ctx.root, rel), "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runSmellContracts().ok ? 0 : 1);
}

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VIEWER_FILE = "viewer/viewer.js";
const LATE_WIRED_MODULES = new Set([
  "viewer/polar-chart.js",
  "viewer/timeline-chart.js",
  "viewer/export-ui.js",
  "viewer/grid-editor.js"
]);

export function runDependencyCheck({ root = process.cwd(), print = true } = {}) {
  const viewerRoot = path.join(root, "viewer");
  const failures = [];
  const files = collectViewerJsFiles(viewerRoot);
  const definitions = mapDefinitions(files);
  const graph = mapReferences(files, definitions);

  for (const cycle of findCycles(graph)) {
    failures.push(`circular JS namespace reference: ${cycle.join(" -> ")}`);
  }
  checkViewerModuleLoadReferences(files, definitions, failures);

  const summary = {
    ok: failures.length === 0,
    checkedJsFiles: files.length,
    failures: failures.length
  };

  if (print) reportDependencies(failures, summary);
  return { ok: summary.ok, failures, summary };
}

function reportDependencies(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[dependencies] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Dependency check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

function collectViewerJsFiles(viewerRoot) {
  if (!fs.existsSync(viewerRoot)) return [];
  return fs.readdirSync(viewerRoot)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(viewerRoot, name), rel: `viewer/${name}` }));
}

function mapDefinitions(jsFiles) {
  const out = new Map();
  for (const file of jsFiles) {
    const content = fs.readFileSync(file.abs, "utf8");
    for (const match of content.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)\s*=/g)) {
      out.set(match[1], file.rel);
    }
  }
  return out;
}

function mapReferences(jsFiles, definitionMap) {
  const out = new Map(jsFiles.map((file) => [file.rel, new Set()]));
  for (const file of jsFiles) {
    const content = fs.readFileSync(file.abs, "utf8");
    for (const match of content.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)/g)) {
      const owner = definitionMap.get(match[1]);
      if (owner && owner !== file.rel) out.get(file.rel).add(owner);
    }
  }
  return out;
}

function findCycles(referenceGraph) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  for (const node of referenceGraph.keys()) visit(node);
  return cycles;

  function visit(node) {
    if (visiting.has(node)) {
      cycles.push(stack.slice(stack.indexOf(node)).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of referenceGraph.get(node) || []) visit(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
}

function checkViewerModuleLoadReferences(jsFiles, definitionMap, failures) {
  const viewer = jsFiles.find((file) => file.rel === VIEWER_FILE);
  if (!viewer) return;
  const content = fs.readFileSync(viewer.abs, "utf8");
  const moduleLoadContent = content.split(/DOMContentLoaded/)[0];
  for (const match of moduleLoadContent.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)/g)) {
    const owner = definitionMap.get(match[1]);
    if (owner && LATE_WIRED_MODULES.has(owner)) {
      failures.push(`${VIEWER_FILE}: module-load reference to ${match[1]} from ${owner}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runDependencyCheck().ok ? 0 : 1);
}

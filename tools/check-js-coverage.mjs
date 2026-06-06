#!/usr/bin/env node

/**
 * Module: check-js-coverage — Viewer JS line-coverage gate.
 * Documentation: documentation/QUALITY.md
 * Depends: tools/test-viewer-polar.mjs, tools/test-viewer-theme.mjs
 *
 * Runs the dependency-free vm-based viewer tests under NODE_V8_COVERAGE,
 * attributes V8 block ranges back to each viewer source file, and gates the
 * exercised files against per-file line-coverage thresholds. Every viewer
 * source file must have an explicit target, so new modules cannot hide behind
 * a green check. Uses only Node's standard library.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();

// Tests run under coverage. Each loads its viewer source through vm with a
// filename option, so V8 attributes ranges to the real file path.
const TEST_FILES = [
  "tools/test-viewer-polar.mjs",
  "tools/test-viewer-smoke.mjs",
  "tools/test-viewer-theme.mjs"
];

// Per-file minimum line coverage. Every viewer/*.js file must be listed here
// and exercised by the viewer tests.
const COVERAGE_TARGETS = {
  "viewer/dom.js": 80,
  "viewer/export-ui.js": 60,
  "viewer/grid-editor.js": 75,
  "viewer/placeholders.js": 100,
  "viewer/polar-chart.js": 85,
  "viewer/presets.js": 90,
  "viewer/settings-ui.js": 60,
  "viewer/theme.js": 95,
  "viewer/timeline-chart.js": 75,
  "viewer/viewer.js": 45
};

const coverageDir = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-cov-"));
try {
  runTests(coverageDir);
  const coverage = collectCoverage(coverageDir);
  process.exit(report(coverage));
} finally {
  fs.rmSync(coverageDir, { recursive: true, force: true });
}

function runTests(dir) {
  for (const testFile of TEST_FILES) {
    const result = spawnSync(process.execPath, [testFile], {
      cwd: ROOT,
      env: { ...process.env, NODE_V8_COVERAGE: dir },
      encoding: "utf8"
    });
    if (result.status !== 0) {
      process.stderr.write(`[js-coverage] viewer test failed: ${testFile}\n`);
      process.stderr.write(result.stderr || "");
      process.exit(1);
    }
  }
}

function collectCoverage(dir) {
  const byFile = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const payload = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    for (const script of payload.result) {
      const rel = toViewerRelative(script.url);
      if (!rel) continue;
      if (!byFile.has(rel)) byFile.set(rel, []);
      byFile.get(rel).push(script.functions);
    }
  }
  return byFile;
}

function toViewerRelative(url) {
  if (!url.startsWith("file://")) return null;
  const filePath = new URL(url).pathname;
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  return rel.startsWith("viewer/") && rel.endsWith(".js") ? rel : null;
}

function report(coverage) {
  const failures = [];
  for (const [rel, threshold] of Object.entries(COVERAGE_TARGETS)) {
    const runs = coverage.get(rel);
    if (!runs) {
      failures.push(`${rel}: expected coverage target was never executed by a viewer test`);
      continue;
    }
    const percent = lineCoverage(rel, runs);
    const rounded = Math.floor(percent * 10) / 10;
    if (percent + 1e-9 < threshold) {
      failures.push(`${rel}: line coverage ${rounded}% is below the ${threshold}% floor`);
    } else {
      process.stdout.write(`[js-coverage] ${rel}: ${rounded}% (floor ${threshold}%)\n`);
    }
  }

  for (const rel of listUntargetedViewerFiles()) {
    failures.push(`${rel}: missing coverage target; add viewer tests and a floor`);
  }

  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`[js-coverage] ${failure}\n`);
    return 1;
  }
  process.stdout.write("Viewer JS coverage check passed.\n");
  return 0;
}

function listUntargetedViewerFiles() {
  return fs.readdirSync(path.join(ROOT, "viewer"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => `viewer/${name}`)
    .filter((rel) => !(rel in COVERAGE_TARGETS))
    .sort();
}

function lineCoverage(rel, runs) {
  const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const executable = new Uint8Array(source.length);
  const covered = new Uint8Array(source.length);
  for (const functions of runs) {
    applyRun(source.length, functions, executable, covered);
  }
  return linePercent(source, executable, covered);
}

function applyRun(length, functions, executable, covered) {
  const ranges = [];
  for (const fn of functions) {
    for (const range of fn.ranges) ranges.push(range);
  }
  // Outer ranges first; deeper (later) ranges override the enclosing count.
  ranges.sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const hit = new Uint8Array(length);
  for (const range of ranges) {
    const end = Math.min(range.endOffset, length);
    const value = range.count > 0 ? 1 : 2;
    for (let i = range.startOffset; i < end; i += 1) {
      executable[i] = 1;
      hit[i] = value;
    }
  }
  for (let i = 0; i < length; i += 1) {
    if (hit[i] === 1) covered[i] = 1;
  }
}

function linePercent(source, executable, covered) {
  let total = 0;
  let hit = 0;
  let lineExecutable = false;
  let lineCovered = false;
  const flush = () => {
    if (lineExecutable) {
      total += 1;
      if (lineCovered) hit += 1;
    }
    lineExecutable = false;
    lineCovered = false;
  };
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\n") {
      flush();
      continue;
    }
    if (executable[i] && !/\s/.test(char)) {
      lineExecutable = true;
      if (covered[i]) lineCovered = true;
    }
  }
  flush();
  return total === 0 ? 100 : (hit / total) * 100;
}

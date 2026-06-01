#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const VIEWER_ROOT = path.join(ROOT, "viewer");
const MAX_ALLOWED_LINES = 400;
const ONELINER_LONG_LINE_THRESHOLD = 180;
const onelinerMode = process.argv.includes("--oneliner=block") ? "block" : "warn";
const failures = [];
const onelinerFindings = [];
const targetFiles = collectViewerJsFiles();

for (const file of targetFiles) {
  const content = fs.readFileSync(file.abs, "utf8");
  const nonEmptyLines = content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  if (nonEmptyLines > MAX_ALLOWED_LINES) {
    failures.push(`${file.rel}: ${nonEmptyLines} non-empty lines (limit ${MAX_ALLOWED_LINES})`);
  }
  detectOneliners(file, content);
}

for (const finding of onelinerFindings) {
  const line = `[oneliner] ${finding.file}:${finding.line}: ${finding.reason}`;
  if (onelinerMode === "block") failures.push(line);
  else console.warn(line);
}

const summary = {
  ok: failures.length === 0,
  checkedFiles: targetFiles.length,
  failures: failures.length,
  onelinerMode,
  onelinerFindings: onelinerFindings.length
};

if (failures.length > 0) {
  for (const failure of failures) console.error(`[file-size] ${failure}`);
  console.error("SUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("File size check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function collectViewerJsFiles() {
  return fs.readdirSync(VIEWER_ROOT)
    .filter((name) => name.endsWith(".js") && name !== "plugin.mjs")
    .sort()
    .map((name) => ({ abs: path.join(VIEWER_ROOT, name), rel: `viewer/${name}` }));
}

function detectOneliners(file, content) {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripLineComment(lines[index]).trim();
    if (!line) continue;
    if (line.length > ONELINER_LONG_LINE_THRESHOLD && /[{}();,]/.test(line)) {
      onelinerFindings.push({ file: file.rel, line: index + 1, reason: "packed long line" });
    }
    if (/\b(if|for|while|function)\b.*\{.+\}/.test(line)) {
      onelinerFindings.push({ file: file.rel, line: index + 1, reason: "single-line block" });
    }
  }
}

function stripLineComment(line) {
  const index = line.indexOf("//");
  return index >= 0 ? line.slice(0, index) : line;
}

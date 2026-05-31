#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const failures = [];

for (const file of collectRootJsFiles()) {
  checkJavaScript(file);
}
for (const file of collectPythonFiles(path.join(ROOT, "polarrecorder"))) {
  checkPython(file);
}

const summary = {
  ok: failures.length === 0,
  checkedJsFiles: collectRootJsFiles().length,
  checkedPythonFiles: collectPythonFiles(path.join(ROOT, "polarrecorder")).length,
  failures: failures.length
};

if (failures.length > 0) {
  for (const failure of failures) console.error(`[patterns] ${failure}`);
  console.error("SUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("Pattern check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function checkJavaScript(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  let commentedCodeRun = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const code = stripStrings(line);
    if (/\bconsole\.log\s*\(/.test(code)) fail(file.rel, index, "console.log is forbidden");
    if (/\bvar\s+[A-Za-z_$]/.test(code)) fail(file.rel, index, "var declarations are forbidden");
    if (/\beval\s*\(/.test(code)) fail(file.rel, index, "eval() is forbidden");
    if (/\.innerHTML\s*=/.test(code)) fail(file.rel, index, "innerHTML assignment is forbidden");
    if (/(^|[^=!<>])==(?!=)|(^|[^=!<>])!=(?!=)/.test(code)) {
      fail(file.rel, index, "loose equality is forbidden");
    }
    if (/^\s*(import|export)\b/.test(code)) fail(file.rel, index, "ES module syntax is forbidden");

    if (/^\s*\/\//.test(line) && /[={}(]|\b(function|return)\b/.test(line)) {
      commentedCodeRun += 1;
      if (commentedCodeRun === 3) {
        fail(file.rel, index, "three or more consecutive commented-out code lines");
      }
    } else {
      commentedCodeRun = 0;
    }
  }
}

function checkPython(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(import|from)\s+avnav/.test(line)) fail(file.rel, index, "AvNav import forbidden");
    if (/^\s*import\s+pluginhandler\b/.test(line)) fail(file.rel, index, "pluginhandler import forbidden");
    if (/^\s*from\s+plugin\s+import\b|^\s*import\s+plugin\b/.test(line)) {
      fail(file.rel, index, "plugin.py import forbidden");
    }
    if (/\bthreading\.(Lock|RLock|Condition)\s*\(/.test(line)) {
      fail(file.rel, index, "threading lock acquisition forbidden in polarrecorder/");
    }
    if (/\btime\.sleep\s*\(/.test(line)) fail(file.rel, index, "time.sleep forbidden");
  }
}

function fail(file, zeroBasedLine, message) {
  failures.push(`${file}:${zeroBasedLine + 1}: ${message}`);
}

function collectRootJsFiles() {
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(ROOT, name), rel: name }));
}

function collectPythonFiles(start) {
  if (!fs.existsSync(start)) return [];
  const out = [];
  walkPython(start, out);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function walkPython(current, out) {
  const stat = fs.statSync(current);
  if (stat.isFile()) {
    if (current.endsWith(".py")) out.push({ abs: current, rel: toRel(current) });
    return;
  }
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    walkPython(path.join(current, entry.name), out);
  }
}

function stripStrings(line) {
  return line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "\"\"");
}

function toRel(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, "/");
}

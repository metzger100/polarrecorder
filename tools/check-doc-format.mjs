#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOC_ROOT = path.join(ROOT, "documentation");
const REQUIRED_SECTIONS = ["Overview", "Key Details", "Related"];
const findings = [];

for (const file of collectMarkdownFiles(DOC_ROOT)) {
  const rel = toRel(file);
  const content = fs.readFileSync(file, "utf8");

  if (!hasTitle(content)) {
    addFinding(rel, "missing '# Title' heading at top of file.");
  }
  if (!hasStatus(content)) {
    addFinding(rel, "missing '**Status:**' line.");
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!hasSection(content, section)) {
      addFinding(rel, `missing '## ${section}' section.`);
    }
  }
}

const summary = {
  ok: findings.length === 0,
  checkedDocs: collectMarkdownFiles(DOC_ROOT).length,
  failures: findings.length
};

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`[doc-format] ${finding.file}: ${finding.message}`);
  }
  console.error("SUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("Doc format check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function addFinding(file, message) {
  findings.push({ file, message });
}

function hasTitle(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    return /^#\s+\S/.test(line);
  }
  return false;
}

function hasStatus(content) {
  return /^\*\*Status:\*\*.+$/m.test(content);
}

function hasSection(content, name) {
  const escaped = name.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\b`, "m").test(content);
}

function collectMarkdownFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];
  const out = [];
  walk(startPath, out);
  return out.sort((a, b) => toRel(a).localeCompare(toRel(b)));
}

function walk(currentPath, out) {
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    if (currentPath.endsWith(".md")) out.push(currentPath);
    return;
  }
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    walk(path.join(currentPath, entry.name), out);
  }
}

function toRel(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, "/");
}

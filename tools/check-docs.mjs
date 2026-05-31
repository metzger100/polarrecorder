#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOC_ROOT = path.join(ROOT, "documentation");
const TOC = path.join(DOC_ROOT, "TABLEOFCONTENTS.md");
const failures = [];

const docFiles = collectMarkdownFiles(DOC_ROOT);
const tocLinks = parseTocLinks();
const linkedDocs = new Set(tocLinks.map((link) => link.abs));

for (const file of docFiles) {
  if (file === TOC) continue;
  if (!linkedDocs.has(file)) {
    fail("missing-toc-link", file, "documentation file is not linked from TABLEOFCONTENTS.md");
  }
}

for (const link of tocLinks) {
  if (!fs.existsSync(link.abs)) {
    fail(
      "missing-toc-target",
      TOC,
      `TABLEOFCONTENTS.md links to missing documentation file '${link.target}'`
    );
  }
}

const summary = {
  ok: failures.length === 0,
  checkedDocumentationFiles: docFiles.length,
  tocLinks: tocLinks.length,
  failures: failures.length
};

if (failures.length > 0) {
  console.error("Documentation table-of-contents check failed:\n");
  for (const item of failures) {
    console.error(`- [${item.type}] ${rel(item.file)}: ${item.message}`);
  }
  console.error("\nSUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("Documentation table-of-contents check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function parseTocLinks() {
  if (!fs.existsSync(TOC)) {
    fail("missing-toc", TOC, "documentation/TABLEOFCONTENTS.md does not exist");
    return [];
  }

  const links = [];
  const content = stripCode(fs.readFileSync(TOC, "utf8"));
  const re = /!?\[[^\]]*]\(([^)]+)\)/g;
  let match;

  while ((match = re.exec(content))) {
    const target = normalizeMarkdownTarget(match[1]);
    if (!target) continue;
    const abs = path.resolve(path.dirname(TOC), target);
    if (isInsideDocumentation(abs)) {
      links.push({ target, abs: stripFragment(abs) });
    }
  }

  return links;
}

function collectMarkdownFiles(start) {
  if (!fs.existsSync(start)) return [];
  const out = [];
  walk(start, out);
  return out.map((file) => path.resolve(file)).sort((a, b) => rel(a).localeCompare(rel(b)));
}

function walk(current, out) {
  const stat = fs.statSync(current);
  if (stat.isFile()) {
    if (current.endsWith(".md")) out.push(current);
    return;
  }
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    walk(path.join(current, entry.name), out);
  }
}

function normalizeMarkdownTarget(raw) {
  let out = raw.trim();
  if (!out) return "";
  if (out.startsWith("<") && out.endsWith(">")) out = out.slice(1, -1).trim();
  if (/^(https?:|mailto:|tel:|data:|#)/i.test(out)) return "";
  const space = out.search(/\s/);
  if (space !== -1) out = out.slice(0, space);
  if (!out.toLowerCase().endsWith(".md")) return "";
  return out;
}

function stripFragment(absPath) {
  const hashIndex = absPath.indexOf("#");
  return hashIndex >= 0 ? absPath.slice(0, hashIndex) : absPath;
}

function isInsideDocumentation(absPath) {
  const relative = path.relative(DOC_ROOT, stripFragment(absPath));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function stripCode(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let inFence = false;

  for (const line of lines) {
    if (/^(```+|~~~+)/.test(line)) {
      inFence = !inFence;
      out.push("");
      continue;
    }
    out.push(inFence ? "" : line.replace(/`[^`\n]*`/g, ""));
  }

  return out.join("\n");
}

function fail(type, file, message) {
  failures.push({ type, file, message });
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/") || ".";
}

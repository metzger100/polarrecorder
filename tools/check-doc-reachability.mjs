#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENTRY_FILES = ["AGENTS.md", "CLAUDE.md"].map((p) => path.join(ROOT, p)).filter(fs.existsSync);
const ROOT_DOCS = ["AGENTS.md", "CLAUDE.md", "ARCHITECTURE.md"]
  .map((p) => path.join(ROOT, p))
  .filter(fs.existsSync);
const EXCLUDED = new Set([path.join(ROOT, "documentation/exec-plans/TEMPLATE.md")]);
const discoveredDocs = Array.from(
  new Set([...collectMarkdown(path.join(ROOT, "documentation")), ...ROOT_DOCS])
).filter((p) => !EXCLUDED.has(p));

const linkCache = new Map();
const broken = [];
const brokenSeen = new Set();

for (const file of discoveredDocs) {
  for (const link of getLinks(file)) {
    if (fs.existsSync(link.abs)) continue;
    const key = `${file}::${link.target}`;
    if (brokenSeen.has(key)) continue;
    brokenSeen.add(key);
    broken.push({ file, target: link.target });
  }
}

const reachable = new Set(ENTRY_FILES);
const queue = [...ENTRY_FILES];

while (queue.length > 0) {
  const current = queue.shift();
  for (const link of getLinks(current)) {
    if (!fs.existsSync(link.abs)) continue;
    if (reachable.has(link.abs)) continue;
    reachable.add(link.abs);
    queue.push(link.abs);
  }
}

const orphans = discoveredDocs.filter((file) => !reachable.has(file));

broken.sort((a, b) => {
  const byFile = toRel(a.file).localeCompare(toRel(b.file));
  return byFile !== 0 ? byFile : a.target.localeCompare(b.target);
});
orphans.sort((a, b) => toRel(a).localeCompare(toRel(b)));

for (const item of broken) {
  console.error(
    `[doc-broken-link] ${toRel(item.file)} contains a link to '${item.target}' which does not exist. Fix or remove the link.`
  );
}

for (const file of orphans) {
  console.error(
    `[doc-orphan] ${toRel(file)} is not reachable from AGENTS.md or CLAUDE.md via any link chain. Add a link to this file from the appropriate parent document (usually TABLEOFCONTENTS.md or a relevant guide/index). The agent cannot find docs it cannot navigate to.`
  );
}

const reachableInScope = discoveredDocs.filter((file) => reachable.has(file)).length;
const summary = {
  ok: broken.length === 0 && orphans.length === 0,
  discovered: discoveredDocs.length,
  reachable: reachableInScope,
  orphans: orphans.length,
  brokenLinks: broken.length
};

if (!summary.ok) {
  console.error("SUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("Documentation reachability check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function getLinks(file) {
  if (linkCache.has(file)) return linkCache.get(file);
  if (!fs.existsSync(file) || !file.endsWith(".md")) {
    linkCache.set(file, []);
    return [];
  }

  const links = [];
  const content = fs.readFileSync(file, "utf8");
  const re = /!?\[[^\]]*]\(([^)]+)\)/g;
  let match;

  while ((match = re.exec(content))) {
    const target = normalizeMarkdownTarget(match[1]);
    if (!target) continue;
    links.push({ target, abs: path.resolve(path.dirname(file), target) });
  }

  linkCache.set(file, links);
  return links;
}

function normalizeMarkdownTarget(raw) {
  let out = raw.trim();
  if (!out) return "";
  if (out.startsWith("<") && out.endsWith(">")) out = out.slice(1, -1).trim();
  if (out.startsWith("#") || /^(https?:|mailto:|tel:|data:)/i.test(out)) return "";
  const hash = out.indexOf("#");
  if (hash !== -1) out = out.slice(0, hash);
  const space = out.search(/\s/);
  if (space !== -1) out = out.slice(0, space);
  if (!out.toLowerCase().endsWith(".md")) return "";
  return out;
}

function collectMarkdown(start) {
  if (!fs.existsSync(start)) return [];
  const out = [];
  walk(start, out);
  return out;
}

function walk(current, out) {
  const stat = fs.statSync(current);
  if (stat.isFile()) {
    if (current.endsWith(".md")) out.push(current);
    return;
  }
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    walk(path.join(current, entry.name), out);
  }
}

function toRel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/") || ".";
}

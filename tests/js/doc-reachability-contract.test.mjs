/**
 * Contract test for the documentation reachability rule: every discovered doc must be
 * reachable from AGENTS.md/CLAUDE.md via a link chain, and every discovered doc's links
 * must resolve to real files. This is the Vitest contract replacement for the retired
 * tools/check-doc-reachability.mjs; every assertion it made is preserved below.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

/**
 * @param {Map<string, {target: string, abs: string}[]>} linkCache
 * @param {string} file
 * @returns {{target: string, abs: string}[]}
 */
function getLinks(linkCache, file) {
  if (linkCache.has(file)) return /** @type {{target: string, abs: string}[]} */ (linkCache.get(file));
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

/**
 * @param {string} raw
 * @returns {string}
 */
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

/**
 * @param {string} start
 * @returns {string[]}
 */
function collectMarkdown(start) {
  if (!fs.existsSync(start)) return [];
  /** @type {string[]} */
  const out = [];
  walk(start, out);
  return out;
}

/**
 * @param {string} current
 * @param {string[]} out
 * @returns {void}
 */
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

/**
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, discovered: number, reachable: number, orphans: number, brokenLinks: number}}
 */
function runDocReachabilityCheck(options = {}) {
  const root = options.root || process.cwd();

  const entryFiles = ["AGENTS.md", "CLAUDE.md"].map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
  const rootDocs = ["AGENTS.md", "CLAUDE.md", "ARCHITECTURE.md"]
    .map((p) => path.join(root, p))
    .filter((p) => fs.existsSync(p));
  const excluded = new Set([path.join(root, "documentation/exec-plans/TEMPLATE.md")]);
  const discoveredDocs = Array.from(
    new Set([...collectMarkdown(path.join(root, "documentation")), ...rootDocs])
  ).filter((p) => !excluded.has(p));

  const linkCache = new Map();
  /** @type {{file: string, target: string}[]} */
  const broken = [];
  const brokenSeen = new Set();

  for (const file of discoveredDocs) {
    for (const link of getLinks(linkCache, file)) {
      if (fs.existsSync(link.abs)) continue;
      const key = `${file}::${link.target}`;
      if (brokenSeen.has(key)) continue;
      brokenSeen.add(key);
      broken.push({ file, target: link.target });
    }
  }

  const reachable = new Set(entryFiles);
  const queue = [...entryFiles];

  while (queue.length > 0) {
    const current = /** @type {string} */ (queue.shift());
    for (const link of getLinks(linkCache, current)) {
      if (!fs.existsSync(link.abs)) continue;
      if (reachable.has(link.abs)) continue;
      reachable.add(link.abs);
      queue.push(link.abs);
    }
  }

  const orphans = discoveredDocs.filter((file) => !reachable.has(file));
  const reachableInScope = discoveredDocs.filter((file) => reachable.has(file)).length;

  return {
    ok: broken.length === 0 && orphans.length === 0,
    discovered: discoveredDocs.length,
    reachable: reachableInScope,
    orphans: orphans.length,
    brokenLinks: broken.length
  };
}

const ROOT = process.cwd();

/** @returns {string} */
function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-doc-reach-"));
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

/**
 * A minimal, fully valid doc tree: one doc, linked from a TOC, reachable from AGENTS.md.
 * @param {string} root
 * @returns {void}
 */
function writeValidDocTree(root) {
  fs.mkdirSync(path.join(root, "documentation"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "AGENTS.md"),
    ["# Agents", "", "See [TOC](documentation/TABLEOFCONTENTS.md).", ""].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "documentation", "TABLEOFCONTENTS.md"),
    [
      "# TOC",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "## Key Details",
      "",
      "## Related",
      "",
      "- [Guide](guide.md)",
      ""
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    ["# Guide", "", "**Status:** Current.", "", "## Overview", "", "## Key Details", "", "## Related", ""].join("\n")
  );
}

test("real repo passes", () => {
  const result = runDocReachabilityCheck({ root: ROOT });
  assert.equal(result.ok, true);
});

test("a valid temp doc tree passes", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  const result = runDocReachabilityCheck({ root });
  assert.equal(result.ok, true);
  cleanup(root);
});

test("a broken file link fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    [
      "# Guide",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "See [missing](missing.md).",
      "",
      "## Key Details",
      "",
      "## Related",
      ""
    ].join("\n")
  );
  const result = runDocReachabilityCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.brokenLinks >= 1);
  cleanup(root);
});

test("an unreachable document fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "unreachable.md"),
    ["# Unreachable", "", "**Status:** Current.", "", "## Overview", "", "## Key Details", "", "## Related", ""].join(
      "\n"
    )
  );
  const result = runDocReachabilityCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.orphans >= 1);
  cleanup(root);
});

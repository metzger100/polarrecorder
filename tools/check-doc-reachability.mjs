#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

/**
 * @param {Map<string, {target: string, abs: string}[]>} linkCache
 * @param {string} file
 * @returns {{target: string, abs: string}[]}
 */
function getLinks(linkCache, file) {
  if (linkCache.has(file))
    return /** @type {{target: string, abs: string}[]} */ (linkCache.get(file));
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
 * Verify every discovered doc is reachable from `AGENTS.md`/`CLAUDE.md` and every discovered
 * doc's links resolve to real files.
 *
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, discovered: number, reachable: number, orphans: number, brokenLinks: number}}
 */
export function runDocReachabilityCheck(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;

  const entryFiles = ["AGENTS.md", "CLAUDE.md"]
    .map((p) => path.join(root, p))
    .filter((p) => fs.existsSync(p));
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

  broken.sort((a, b) => {
    const byFile = toRel(root, a.file).localeCompare(toRel(root, b.file));
    return byFile !== 0 ? byFile : a.target.localeCompare(b.target);
  });
  orphans.sort((a, b) => toRel(root, a).localeCompare(toRel(root, b)));

  const reachableInScope = discoveredDocs.filter((file) => reachable.has(file)).length;
  const summary = {
    ok: broken.length === 0 && orphans.length === 0,
    discovered: discoveredDocs.length,
    reachable: reachableInScope,
    orphans: orphans.length,
    brokenLinks: broken.length
  };

  if (print) {
    for (const item of broken) {
      console.error(
        `[doc-broken-link] ${toRel(root, item.file)} contains a link to '${item.target}' which does not exist. Fix or remove the link.`
      );
    }
    for (const file of orphans) {
      console.error(
        `[doc-orphan] ${toRel(root, file)} is not reachable from AGENTS.md or CLAUDE.md via any link chain. Add a link to this file from the appropriate parent document (usually TABLEOFCONTENTS.md or a relevant guide/index). The agent cannot find docs it cannot navigate to.`
      );
    }
    if (!summary.ok) {
      console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    } else {
      console.log("Documentation reachability check passed.");
      console.log("SUMMARY_JSON=" + JSON.stringify(summary));
    }
  }

  return summary;
}

/**
 * @param {string} root
 * @param {string} file
 * @returns {string}
 */
function toRel(root, file) {
  return path.relative(root, file).replace(/\\/g, "/") || ".";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runDocReachabilityCheck();
  process.exitCode = result.ok ? 0 : 1;
}

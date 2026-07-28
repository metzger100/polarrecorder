/**
 * Contract test for the documentation table-of-contents rule: every documentation file
 * must be linked from documentation/TABLEOFCONTENTS.md, and every TOC link must resolve
 * to a real file. This is the Vitest contract replacement for the retired
 * tools/check-docs.mjs; every assertion it made is preserved below.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

/**
 * @param {string} root
 * @returns {string}
 */
function docRoot(root) {
  return path.join(root, "documentation");
}

/**
 * @param {string} root
 * @returns {string}
 */
function tocPath(root) {
  return path.join(docRoot(root), "TABLEOFCONTENTS.md");
}

/**
 * @param {{root: string, docRoot: string, toc: string, failures: {type: string, file: string, message: string}[]}} ctx
 * @returns {{target: string, abs: string}[]}
 */
function parseTocLinks(ctx) {
  if (!fs.existsSync(ctx.toc)) {
    ctx.failures.push({
      type: "missing-toc",
      file: ctx.toc,
      message: "documentation/TABLEOFCONTENTS.md does not exist"
    });
    return [];
  }

  const links = [];
  const content = stripCode(fs.readFileSync(ctx.toc, "utf8"));
  const re = /!?\[[^\]]*]\(([^)]+)\)/g;
  let match;

  while ((match = re.exec(content))) {
    const target = normalizeMarkdownTarget(match[1]);
    if (!target) continue;
    const abs = path.resolve(path.dirname(ctx.toc), target);
    if (isInsideDocumentation(ctx.docRoot, abs)) {
      links.push({ target, abs: stripFragment(abs) });
    }
  }

  return links;
}

/**
 * @param {string} start
 * @returns {string[]}
 */
function collectMarkdownFiles(start) {
  if (!fs.existsSync(start)) return [];
  /** @type {string[]} */
  const out = [];
  walk(start, out);
  return out.map((file) => path.resolve(file)).sort();
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
    walk(path.join(current, entry.name), out);
  }
}

/**
 * @param {string} raw
 * @returns {string}
 */
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

/**
 * @param {string} absPath
 * @returns {string}
 */
function stripFragment(absPath) {
  const hashIndex = absPath.indexOf("#");
  return hashIndex >= 0 ? absPath.slice(0, hashIndex) : absPath;
}

/**
 * @param {string} docRootPath
 * @param {string} absPath
 * @returns {boolean}
 */
function isInsideDocumentation(docRootPath, absPath) {
  const relative = path.relative(docRootPath, stripFragment(absPath));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * @param {string} markdown
 * @returns {string}
 */
function stripCode(markdown) {
  const lines = markdown.split(/\r?\n/);
  /** @type {string[]} */
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

/**
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, checkedDocumentationFiles: number, tocLinks: number, failures: number}}
 */
function runDocsCheck(options = {}) {
  const root = options.root || process.cwd();
  /** @type {{root: string, docRoot: string, toc: string, failures: {type: string, file: string, message: string}[]}} */
  const ctx = { root, docRoot: docRoot(root), toc: tocPath(root), failures: [] };

  const docFiles = collectMarkdownFiles(ctx.docRoot);
  const tocLinks = parseTocLinks(ctx);
  const linkedDocs = new Set(tocLinks.map((link) => link.abs));

  for (const file of docFiles) {
    if (file === ctx.toc) continue;
    if (!linkedDocs.has(file)) {
      ctx.failures.push({
        type: "missing-toc-link",
        file,
        message: "documentation file is not linked from TABLEOFCONTENTS.md"
      });
    }
  }

  for (const link of tocLinks) {
    if (!fs.existsSync(link.abs)) {
      ctx.failures.push({
        type: "missing-toc-target",
        file: ctx.toc,
        message: `TABLEOFCONTENTS.md links to missing documentation file '${link.target}'`
      });
    }
  }

  return {
    ok: ctx.failures.length === 0,
    checkedDocumentationFiles: docFiles.length,
    tocLinks: tocLinks.length,
    failures: ctx.failures.length
  };
}

const ROOT = process.cwd();

/** @returns {string} */
function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-doc-toc-"));
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

/**
 * A minimal, fully valid doc tree: one doc, linked from a TOC.
 * @param {string} root
 * @returns {void}
 */
function writeValidDocTree(root) {
  fs.mkdirSync(path.join(root, "documentation"), { recursive: true });
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
  const result = runDocsCheck({ root: ROOT });
  assert.equal(result.ok, true);
});

test("a valid temp doc tree passes", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  const result = runDocsCheck({ root });
  assert.equal(result.ok, true);
  cleanup(root);
});

test("a doc missing from the TOC fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "orphan.md"),
    ["# Orphan", "", "**Status:** Current.", "", "## Overview", "", "## Key Details", "", "## Related", ""].join("\n")
  );
  const result = runDocsCheck({ root });
  assert.equal(result.ok, false);
  cleanup(root);
});

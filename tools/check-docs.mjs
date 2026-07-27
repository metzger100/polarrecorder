#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

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
 * Verify every `documentation/**\/*.md` file is linked from the TOC and every TOC link
 * resolves to a real file.
 *
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, checkedDocumentationFiles: number, tocLinks: number, failures: number}}
 */
export function runDocsCheck(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
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

  const summary = {
    ok: ctx.failures.length === 0,
    checkedDocumentationFiles: docFiles.length,
    tocLinks: tocLinks.length,
    failures: ctx.failures.length
  };

  if (print) {
    if (!summary.ok) {
      console.error("Documentation table-of-contents check failed:\n");
      for (const item of ctx.failures) {
        console.error(`- [${item.type}] ${path.relative(root, item.file) || "."}: ${item.message}`);
      }
      console.error("\nSUMMARY_JSON=" + JSON.stringify(summary));
    } else {
      console.log("Documentation table-of-contents check passed.");
      console.log("SUMMARY_JSON=" + JSON.stringify(summary));
    }
  }

  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runDocsCheck();
  process.exitCode = result.ok ? 0 : 1;
}

/**
 * Product-neutral scanner for inline suppression directives in maintained source comments.
 */

import fs from "node:fs";
import path from "node:path";

import { listRegularFiles, relativePath } from "./path-policy.mjs";

const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".jsonc",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".toml",
  ".ts",
  ".yaml",
  ".yml"
]);
const SKIP_DIRS = new Set([".git", ".claude", ".vscode", "coverage", "node_modules", "releases", "venv"]);
const DIRECTIVE_PATTERN =
  /eslint-disable|@ts-(?:ignore|nocheck|expect-error)|prettier-ignore|(?:c8|istanbul)\s+ignore|(?:#\s*)?(?:noqa|type:\s*ignore|mypy:)|pattern-ignore|plugin-(?:lint-disable|boundary)-/i;
const MARKDOWN_FENCE_LANGUAGES = new Set([
  "bash",
  "css",
  "html",
  "js",
  "javascript",
  "json",
  "jsonc",
  "mjs",
  "py",
  "python",
  "sh",
  "shell",
  "toml",
  "ts",
  "typescript",
  "yaml",
  "yml"
]);

/**
 * Extract comments without interpreting directive-like text inside strings.
 * @param {string} source
 * @param {string} extension
 * @returns {Array<{line: number, text: string}>}
 */
function extractComments(source, extension) {
  /** @type {Array<{line: number, text: string}>} */
  const comments = [];
  if (extension === ".md") return extractMarkdownComments(source);
  let state = "code";
  let quote = "";
  let buffer = "";
  let line = 1;
  let startLine = 1;
  const hashComments = new Set([".md", ".py", ".sh", ".toml", ".yaml", ".yml"]);
  const push = () => {
    if (buffer) comments.push({ line: startLine, text: buffer });
    buffer = "";
  };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1] || "";
    if (character === "\n") line += 1;
    if (state === "string") {
      if (character === "\\") index += 1;
      else if (character === quote) state = "code";
      continue;
    }
    if (state === "line") {
      if (character === "\n") {
        push();
        state = "code";
      } else buffer += character;
      continue;
    }
    if (state === "block") {
      if (character === "*" && next === "/") {
        push();
        state = "code";
        index += 1;
      } else buffer += character;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      state = "string";
      quote = character;
    } else if (character === "/" && next === "/") {
      state = "line";
      startLine = line;
      index += 1;
    } else if (character === "/" && next === "*") {
      state = "block";
      startLine = line;
      index += 1;
    } else if (
      character === "#" &&
      hashComments.has(extension) &&
      (extension !== ".md" || source.slice(source.lastIndexOf("\n", index - 1) + 1, index).trim() === "")
    ) {
      state = "line";
      startLine = line;
    }
  }
  push();
  return comments;
}

/** @param {string} source @returns {Array<{line: number, text: string}>} */
function extractMarkdownComments(source) {
  /** @type {Array<{line: number, text: string}>} */
  const comments = [];
  let fenceLanguage = "";
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = /^\s*```\s*([A-Za-z0-9_-]*)/.exec(line);
    if (fence) {
      fenceLanguage = fenceLanguage ? "" : fence[1].toLowerCase();
      continue;
    }
    if (fenceLanguage && MARKDOWN_FENCE_LANGUAGES.has(fenceLanguage)) {
      comments.push(...extractCodeLineComments(line, index + 1, fenceLanguage));
    }
    const html = /<!--[\s\S]*?-->/g;
    let match;
    while ((match = html.exec(line))) comments.push({ line: index + 1, text: match[0] });
  }
  return comments;
}

/** @param {string} line @param {number} lineNumber @param {string} language @returns {Array<{line: number, text: string}>} */
function extractCodeLineComments(line, lineNumber, language) {
  const hash = new Set(["bash", "py", "python", "sh", "shell", "toml", "yaml", "yml"]);
  const slash = new Set(["css", "js", "javascript", "json", "jsonc", "mjs", "ts", "typescript"]);
  const html = new Set(["html"]);
  const comments = [];
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (slash.has(language) && character === "/" && line[index + 1] === "/") {
      comments.push({ line: lineNumber, text: line.slice(index + 2) });
      break;
    }
    if (slash.has(language) && character === "/" && line[index + 1] === "*") {
      comments.push({ line: lineNumber, text: line.slice(index) });
      break;
    }
    if (hash.has(language) && character === "#") {
      comments.push({ line: lineNumber, text: line.slice(index + 1) });
      break;
    }
    if (html.has(language) && line.startsWith("<!--", index)) {
      comments.push({ line: lineNumber, text: line.slice(index) });
      break;
    }
  }
  return comments;
}

/**
 * Scan maintained source comments for suppression directives.
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, checkedFiles: number, findings: Array<{path: string, line: number, text: string}>}}
 */
export function runSuppressionCheck({ root = process.cwd(), print = true } = {}) {
  const absoluteRoot = fs.realpathSync(path.resolve(root));
  /** @type {Array<{path: string, line: number, text: string}>} */
  const findings = [];
  for (const file of listRegularFiles(absoluteRoot)) {
    const relative = relativePath(absoluteRoot, file);
    if (relative.split("/").some((part) => SKIP_DIRS.has(part))) continue;
    if (relative.startsWith("exec-plans/completed/")) continue;
    const extension = path.extname(relative).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(extension)) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const comment of extractComments(source, extension)) {
      if (DIRECTIVE_PATTERN.test(comment.text)) findings.push({ path: relative, ...comment });
    }
  }
  const ok = findings.length === 0;
  if (print) {
    for (const finding of findings)
      console.error(`[suppression] ${finding.path}:${finding.line}: ${finding.text.trim()}`);
    console.log(`Suppression check ${ok ? "passed" : "failed"}.`);
  }
  return { ok, findings, checkedFiles: listRegularFiles(absoluteRoot).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runSuppressionCheck().ok ? 0 : 1);
}

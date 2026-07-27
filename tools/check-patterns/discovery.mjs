import fs from "node:fs";
import path from "node:path";

import { ROOT, VIEWER_ROOT, SERVER_PACKAGE_ROOT, toRel } from "./shared.mjs";

const ROOT_JS_PATTERN_FILES = new Set(["plugin.js", "plugin.mjs"]);
const ABSOLUTE_PATH_EXTENSIONS = new Set([
  ".md",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".json",
  ".sh",
  ".css",
  ".html",
  ".txt",
  ".yml",
  ".yaml"
]);
const EXEC_PLAN_REFERENCE_EXTENSIONS = new Set([
  ".md",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".json",
  ".jsonc",
  ".toml",
  ".sh",
  ".css",
  ".html",
  ".txt",
  ".yml",
  ".yaml"
]);
// tools/ and tests/ are in scope here (unlike ABSOLUTE_PATH_EXCLUDED_DIRS): this is
// exactly where historical exec-plan/phase citations leaked into permanent tooling and
// had to be removed after the fact.
const EXEC_PLAN_REFERENCE_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".claude",
  ".vscode",
  "releases",
  "exec-plans",
  "venv",
  "__pycache__",
  "coverage"
]);
const ROOT_MARKDOWN_FILES = new Set([
  "AGENTS.md",
  "ARCHITECTURE.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "README.md",
  "ROADMAP.md"
]);
const ABSOLUTE_PATH_INCLUDED_DOT_DIRS = new Set([".github", ".githooks"]);
// Generated, local-only, or developer-tooling trees are out of scope.
const ABSOLUTE_PATH_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".claude",
  ".vscode",
  "tools",
  "tests",
  "releases",
  "exec-plans",
  "venv",
  "__pycache__",
  "coverage"
]);
const ABSOLUTE_PATH_EXCLUDED_FILES = new Set(["package-lock.json"]);

/**
 * @returns {import("./shared.mjs").PatternFile[]} Every file eligible for the
 *   absolute-home-path scan, sorted by path.
 */
export function collectAbsolutePathTargets() {
  return collectFilesByExtension(ABSOLUTE_PATH_EXTENSIONS, ABSOLUTE_PATH_EXCLUDED_DIRS);
}

/**
 * @returns {import("./shared.mjs").PatternFile[]} Every file eligible for the
 *   exec-plan-reference scan, sorted by path.
 */
export function collectExecPlanReferenceTargets() {
  return collectFilesByExtension(EXEC_PLAN_REFERENCE_EXTENSIONS, EXEC_PLAN_REFERENCE_EXCLUDED_DIRS);
}

/**
 * @param {Set<string>} extensions Allowed file extensions (with leading dot).
 * @param {Set<string>} excludedDirs Directory names to skip entirely.
 * @returns {import("./shared.mjs").PatternFile[]} Every matching file under ROOT, sorted by path.
 */
function collectFilesByExtension(extensions, excludedDirs) {
  /** @type {import("./shared.mjs").PatternFile[]} */
  const out = [];
  walkFilesByExtension(ROOT, extensions, excludedDirs, out);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} current Directory being walked.
 * @param {Set<string>} extensions Allowed file extensions (with leading dot).
 * @param {Set<string>} excludedDirs Directory names to skip entirely.
 * @param {import("./shared.mjs").PatternFile[]} out Accumulator collecting discovered files.
 * @returns {void}
 */
function walkFilesByExtension(current, extensions, excludedDirs, out) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") && !ABSOLUTE_PATH_INCLUDED_DOT_DIRS.has(entry.name)) continue;
      if (excludedDirs.has(entry.name)) continue;
      walkFilesByExtension(path.join(current, entry.name), extensions, excludedDirs, out);
    } else if (entry.isFile()) {
      if (ABSOLUTE_PATH_EXCLUDED_FILES.has(entry.name)) continue;
      if (!extensions.has(path.extname(entry.name))) continue;
      const abs = path.join(current, entry.name);
      out.push({ abs, rel: toRel(abs) });
    }
  }
}

/**
 * @returns {import("./shared.mjs").PatternFile[]} Every `viewer/*.js` file plus the root JS
 *   entrypoints (`plugin.js`, `plugin.mjs`) that exist, sorted by path.
 */
export function collectJavaScriptPatternFiles() {
  const out = collectViewerJsFiles();
  for (const name of ROOT_JS_PATTERN_FILES) {
    const abs = path.join(ROOT, name);
    if (fs.existsSync(abs)) {
      out.push({ abs, rel: name });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @returns {import("./shared.mjs").PatternFile[]} Every `viewer/*.js` file, or an empty array
 *   if the viewer directory does not exist.
 */
function collectViewerJsFiles() {
  if (!fs.existsSync(VIEWER_ROOT)) return [];
  return fs
    .readdirSync(VIEWER_ROOT)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({
      abs: path.join(VIEWER_ROOT, name),
      rel: `viewer/${name}`
    }));
}

/**
 * @returns {import("./shared.mjs").PatternFile[]} Every `documentation/**\/*.md` file plus the
 *   tracked root Markdown files that exist, sorted by path.
 */
export function collectMarkdownTodoTargets() {
  /** @type {import("./shared.mjs").PatternFile[]} */
  const out = [];
  const docRoot = path.join(ROOT, "documentation");
  if (fs.existsSync(docRoot)) walkMarkdownTodoTargets(docRoot, out);
  for (const rel of ROOT_MARKDOWN_FILES) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) out.push({ abs, rel });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} current File or directory being walked.
 * @param {import("./shared.mjs").PatternFile[]} out Accumulator collecting discovered
 *   Markdown files.
 * @returns {void}
 */
function walkMarkdownTodoTargets(current, out) {
  const stat = fs.statSync(current);
  if (stat.isFile()) {
    if (current.endsWith(".md")) out.push({ abs: current, rel: toRel(current) });
    return;
  }
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    walkMarkdownTodoTargets(path.join(current, entry.name), out);
  }
}

/**
 * @param {string} start Directory to search (`server/polarrecorder/`).
 * @returns {import("./shared.mjs").PatternFile[]} Every `.py` file under `start`, sorted by
 *   path, or an empty array if `start` does not exist.
 */
export function collectPythonFiles(start = SERVER_PACKAGE_ROOT) {
  if (!fs.existsSync(start)) return [];
  /** @type {import("./shared.mjs").PatternFile[]} */
  const out = [];
  walkPython(start, out);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} current File or directory being walked.
 * @param {import("./shared.mjs").PatternFile[]} out Accumulator collecting discovered
 *   Python files.
 * @returns {void}
 */
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

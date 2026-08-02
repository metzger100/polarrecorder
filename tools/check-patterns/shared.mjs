import fs from "node:fs";
import path from "node:path";

import { maskCode, maskStringsOnly } from "./ast-utils.mjs";
import { resetSuppressionState, setKnownRuleNames } from "./shared-suppressions.mjs";

export {
  BOUNDARY_MARKER_RULE_NAME,
  getInvalidLintSuppressions,
  isLintSuppressed,
  setKnownRuleNames
} from "./shared-suppressions.mjs";

/** @typedef {{text: string, lineStarts: number[], masked: string, maskedStringsOnly: string}} FileData */
/** @typedef {{file: string, line: number, message: string, [key: string]: any}} Finding */
/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   severity?: "block"|"warn",
 *   scope: {include: string[], exclude?: string[]},
 *   detect?: RegExp,
 *   run?: (rule: Rule, files: string[]) => Finding[],
 *   message?: (context: any) => string,
 *   [key: string]: any
 * }} Rule
 */

const SKIP_DIRS = new Set(["node_modules", "coverage", "artifacts", "venv", ".quality-cache", "__pycache__"]);
const DEFAULT_INCLUDED_DOT_DIRS = new Set([".github", ".githooks"]);
const PROJECT_PATTERN_SCOPES_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "quality-policy",
  "project-pattern-scopes.json"
);

/** @type {Record<string, {include: string[], exclude?: string[]}> | null} */
let projectScopesCache = null;

/**
 * Read a named `{include, exclude}` glob scope from project-owned
 * `tools/quality-policy/project-pattern-scopes.json`. Rule definitions look up their scope
 * by key instead of embedding a literal product path, which is what keeps a generic rule
 * definition file free of project tokens.
 * @param {string} scopeKey
 * @returns {{include: string[], exclude?: string[]}}
 */
export function scopeFor(scopeKey) {
  if (!projectScopesCache) {
    projectScopesCache = JSON.parse(fs.readFileSync(PROJECT_PATTERN_SCOPES_PATH, "utf8")).scopes;
  }
  const scope = /** @type {Record<string, {include: string[], exclude?: string[]}>} */ (projectScopesCache)[scopeKey];
  if (!scope) throw new Error(`No project-pattern-scopes.json entry for scope key '${scopeKey}'`);
  return scope;
}

let ROOT = process.cwd();
let WARN_MODE = false;
/** @type {Map<string, FileData>} */
const fileCache = new Map();
/** @type {Map<string, string[]>} */
const scopeCache = new Map();

/**
 * Point the engine at a (possibly fake) workspace root and reset every
 * per-run cache and the suppression state for a fresh run.
 * @param {{root?: string, warnMode?: boolean}} [options]
 * @returns {void}
 */
export function resetContext(options = {}) {
  ROOT = path.resolve(options.root || process.cwd());
  WARN_MODE = !!options.warnMode;
  fileCache.clear();
  scopeCache.clear();
  resetSuppressionState();
  setKnownRuleNames([]);
}

/** @returns {boolean} */
export function getWarnMode() {
  return WARN_MODE;
}

/** @returns {string} */
export function getRoot() {
  return ROOT;
}

/**
 * Resolve every file under `ROOT` matching a rule's `{include, exclude}` glob
 * scope, cached per unique scope for the duration of one run.
 * @param {{include: string[], exclude?: string[]}} scope
 * @returns {string[]} Root-relative, forward-slash-separated paths, sorted.
 */
export function filesForScope(scope) {
  const key = JSON.stringify(scope);
  const cached = scopeCache.get(key);
  if (cached) return cached;
  const includes = scope.include.map(globToRegExp);
  const excludes = (scope.exclude || []).map(globToRegExp);
  const roots = [...new Set(scope.include.map(scopeRoot))];
  /** @type {Set<string>} */
  const candidates = new Set();
  for (const root of roots) {
    walk(path.join(ROOT, root), candidates);
  }
  const files = [...candidates]
    .filter((file) => includes.some((re) => re.test(file)) && !excludes.some((re) => re.test(file)))
    .sort((a, b) => a.localeCompare(b));
  scopeCache.set(key, files);
  return files;
}

/**
 * @param {string} file Root-relative path (as returned by `filesForScope`).
 * @returns {FileData} Cached raw text, line-start offsets, and two masked views.
 */
export function getFileData(file) {
  const cached = fileCache.get(file);
  if (cached) return cached;
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  const lineStarts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }
  const data = { text, lineStarts, masked: maskCode(text), maskedStringsOnly: maskStringsOnly(text) };
  fileCache.set(file, data);
  return data;
}

/**
 * @param {string} absPath
 * @param {Set<string>} out
 * @returns {void}
 */
function walk(absPath, out) {
  if (!fs.existsSync(absPath)) return;
  const stat = fs.statSync(absPath);
  if (stat.isFile()) {
    out.add(toRel(absPath));
    return;
  }
  for (const entry of fs.readdirSync(absPath, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && !DEFAULT_INCLUDED_DOT_DIRS.has(entry.name)) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    walk(path.join(absPath, entry.name), out);
  }
}

/**
 * @param {string} pattern
 * @returns {string} The non-wildcard directory prefix of a glob pattern, or "." if none.
 */
function scopeRoot(pattern) {
  const segments = normalizePath(pattern).split("/");
  const root = [];
  for (const segment of segments) {
    if (!segment || segment.includes("*")) break;
    root.push(segment);
  }
  return root.length ? root.join("/") : ".";
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const segments = normalizePath(pattern).split("/").filter(Boolean);
  let regex = "^";
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment === "**") {
      regex += i === segments.length - 1 ? ".*" : "(?:[^/]+/)*";
      continue;
    }
    regex += escapeRegex(segment).replace(/\*/g, "[^/]*");
    if (i < segments.length - 1) regex += "/";
  }
  return new RegExp(regex + "$");
}

/**
 * @param {number} index
 * @param {number[]} starts
 * @returns {number} 1-based line number.
 */
export function lineAt(index, starts) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= index) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi + 1;
}

/** @param {RegExp} re @returns {RegExp} the same pattern, guaranteed to carry the "g" flag. */
export function asGlobal(re) {
  if (re.flags.includes("g")) return new RegExp(re.source, re.flags);
  return new RegExp(re.source, re.flags + "g");
}

/** @param {Finding} a @param {Finding} b @returns {number} */
export function compareFindings(a, b) {
  return a.file.localeCompare(b.file) || a.line - b.line;
}

/** @param {string} text @returns {string} */
export function escapeRegex(text) {
  return text.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePath(value) {
  return String(value).replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * @param {string} absPath
 * @returns {string}
 */
function toRel(absPath) {
  return normalizePath(path.relative(ROOT, absPath));
}

/**
 * Permanent, parser-locked stable-identity complexity scanner.
 *
 * Adapted from the sibling `dyninstruments` plugin's `tools/quality-policy/complexity-scan.mjs`
 * for Polar Recorder's own production JavaScript roots. Rather than hand-rolling cyclomatic
 * complexity/statement/depth/param counting, this delegates to ESLint's own `complexity`,
 * `max-statements`, `max-depth`, and `max-params` rule implementations via the
 * programmatic `Linter` API, and reports only functions that already violate the strict
 * limits -- so the immutable baseline findings capture and the active debt ledger only ever
 * need to track real over-limit functions, not every function in the tree.
 *
 * Function identity is derived from lexical nesting and naming (declaration/assignment/
 * property target names, falling back to "anonymous"), with an occurrence-counted `#n`
 * suffix disambiguating same-named siblings -- stable across unrelated edits elsewhere in
 * the file, unlike a line-number-based identity.
 */

import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";

/** @typedef {{type: string, [key: string]: any}} AstNode */
/** @typedef {{file: string, identity: string, metric: string, value: number, limit: number}} Finding */
/** @typedef {{identity: string, start: number, end: number}} FunctionIndexEntry */

export const STRICT_LIMITS = /** @type {Record<string, number>} */ (
  Object.freeze({
    complexity: 10,
    "max-statements": 40,
    "max-depth": 4,
    "max-params": 6
  })
);

/** Polar Recorder's shipped production JavaScript roots, beyond the two entrypoints. */
export const PRODUCTION_ROOTS = ["viewer"];

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression"
]);

/** @type {Record<string, RegExp>} */
const METRIC_PATTERNS = {
  complexity: /has a complexity of (\d+)/,
  "max-statements": /has too many statements \((\d+)\)/,
  "max-depth": /nested too deeply \((\d+)\)/,
  "max-params": /has too many parameters \((\d+)\)/
};

/** @param {string} root @returns {string[]} absolute paths of every shipped production JavaScript file */
export function collectProductionFiles(root) {
  /** @type {string[]} */
  const files = [];
  for (const entrypoint of ["plugin.js", "plugin.mjs"]) {
    if (fs.existsSync(path.join(root, entrypoint))) files.push(path.join(root, entrypoint));
  }
  for (const relativeRoot of PRODUCTION_ROOTS) {
    collectJsFiles(path.join(root, relativeRoot), files);
  }
  return files;
}

/**
 * @param {string} directory
 * @param {string[]} out
 * @returns {void}
 */
function collectJsFiles(directory, out) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJsFiles(absolutePath, out);
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(absolutePath);
  }
}

/**
 * @param {unknown} value
 * @returns {value is AstNode}
 */
function isNode(value) {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (/** @type {AstNode} */ (value).type) === "string"
  );
}

/**
 * @param {AstNode | null} node
 * @returns {string | null}
 */
function identifierNameFromTarget(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property &&
    node.property.type === "Identifier"
  ) {
    return node.property.name;
  }
  return null;
}

/**
 * @param {AstNode} owner
 * @param {string} key
 * @param {AstNode} fn
 * @returns {string | null}
 */
function computeNameHint(owner, key, fn) {
  if (fn.id && fn.id.name) return fn.id.name;
  if (
    owner.type === "VariableDeclarator" &&
    key === "init" &&
    owner.id &&
    owner.id.type === "Identifier"
  ) {
    return owner.id.name;
  }
  if (owner.type === "AssignmentExpression" && key === "right") {
    return identifierNameFromTarget(owner.left);
  }
  if ((owner.type === "Property" || owner.type === "MethodDefinition") && key === "value") {
    if (owner.key && owner.key.type === "Identifier") return owner.key.name;
    if (owner.key && owner.key.type === "Literal") return String(owner.key.value);
  }
  return null;
}

/**
 * Builds a flat index of every function-like node in the file, each carrying a stable
 * identity path derived from lexical nesting/naming rather than line numbers, so unrelated
 * edits elsewhere in the file do not silently reassign an existing function's identity.
 * @param {AstNode} ast
 * @returns {FunctionIndexEntry[]}
 */
export function buildFunctionIndex(ast) {
  /** @type {Map<string, number>} */
  const occurrenceCounts = new Map();
  /** @type {Map<string, number>} */
  const runningIndex = new Map();
  /** @type {FunctionIndexEntry[]} */
  const collected = [];

  countOccurrences(ast, "");
  assignIdentities(ast, "");

  return collected;

  /**
   * @param {AstNode} node
   * @param {string | null} hint
   * @returns {string}
   */
  function labelFor(node, hint) {
    return hint || "anonymous";
  }

  /**
   * @param {AstNode} node
   * @param {string} parentPath
   * @returns {void}
   */
  function countOccurrences(node, parentPath) {
    visitChildren(node, parentPath, function (child, hint, childParentPath) {
      const label = labelFor(child, hint);
      const key = `${childParentPath} ${label}`;
      occurrenceCounts.set(key, (occurrenceCounts.get(key) || 0) + 1);
      countOccurrences(child, `${childParentPath}.${label}`);
    });
  }

  /**
   * @param {AstNode} node
   * @param {string} parentPath
   * @returns {void}
   */
  function assignIdentities(node, parentPath) {
    visitChildren(node, parentPath, function (child, hint, childParentPath) {
      const label = labelFor(child, hint);
      const key = `${childParentPath} ${label}`;
      const total = occurrenceCounts.get(key) || 1;
      let identity = childParentPath ? `${childParentPath}.${label}` : label;
      if (total > 1) {
        const next = (runningIndex.get(key) || 0) + 1;
        runningIndex.set(key, next);
        identity = `${identity}#${next}`;
      }
      collected.push({ identity: identity, start: child.range[0], end: child.range[1] });
      assignIdentities(child, identity);
    });
  }
}

/**
 * Walks every reachable node, invoking onFunction(childFunctionNode, nameHint, parentPath)
 * for each direct function-like descendant (stopping descent at function boundaries; the
 * caller re-enters with the function's own identity as the new parentPath).
 * @param {AstNode} node
 * @param {string} parentPath
 * @param {(child: AstNode, hint: string | null, parentPath: string) => void} onFunction
 * @returns {void}
 */
function visitChildren(node, parentPath, onFunction) {
  if (!isNode(node)) return;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "range" || key === "loc") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) visitChildOrRecurse(node, key, item, parentPath, onFunction);
    } else {
      visitChildOrRecurse(node, key, value, parentPath, onFunction);
    }
  }
}

/**
 * @param {AstNode} owner
 * @param {string} key
 * @param {AstNode} child
 * @param {string} parentPath
 * @param {(child: AstNode, hint: string | null, parentPath: string) => void} onFunction
 * @returns {void}
 */
function visitChildOrRecurse(owner, key, child, parentPath, onFunction) {
  if (!isNode(child)) return;
  if (FUNCTION_TYPES.has(child.type)) {
    onFunction(child, computeNameHint(owner, key, child), parentPath);
    return;
  }
  visitChildren(child, parentPath, onFunction);
}

/**
 * @param {FunctionIndexEntry[]} functionIndex
 * @param {number} offset
 * @returns {string | null}
 */
function findEnclosingIdentity(functionIndex, offset) {
  /** @type {FunctionIndexEntry | null} */
  let best = null;
  for (const entry of functionIndex) {
    if (offset < entry.start || offset > entry.end) continue;
    if (!best || entry.end - entry.start < best.end - best.start) best = entry;
  }
  return best ? best.identity : null;
}

/**
 * @param {string} absoluteFile
 * @param {string} root
 * @returns {Finding[]}
 */
export function scanFile(absoluteFile, root) {
  const code = fs.readFileSync(absoluteFile, "utf8");
  const relativeFile = path.relative(root, absoluteFile).split(path.sep).join("/");
  return scanSource(code, relativeFile);
}

/**
 * @param {string} code
 * @param {string} relativeFile
 * @returns {Finding[]}
 */
export function scanSource(code, relativeFile) {
  const linter = new Linter();
  const rules = /** @type {import("eslint").Linter.RulesRecord} */ (
    /** @type {unknown} */ ({
      complexity: ["warn", STRICT_LIMITS.complexity],
      "max-statements": ["warn", STRICT_LIMITS["max-statements"]],
      "max-depth": ["warn", STRICT_LIMITS["max-depth"]],
      "max-params": ["warn", STRICT_LIMITS["max-params"]]
    })
  );
  const sourceType = relativeFile.endsWith(".mjs") ? "module" : "script";
  const messages = linter.verify(code, {
    rules,
    languageOptions: { ecmaVersion: 2022, sourceType }
  });
  if (messages.length === 0) return [];

  const sourceCode = linter.getSourceCode();
  const functionIndex = buildFunctionIndex(/** @type {AstNode} */ (sourceCode.ast));
  /** @type {Map<string, Finding>} */
  const byKey = new Map();

  for (const message of messages) {
    const ruleId = message.ruleId;
    if (!ruleId) continue;
    const pattern = METRIC_PATTERNS[ruleId];
    if (!pattern) continue;
    const match = message.message.match(pattern);
    if (!match) continue;
    const offset = sourceCode.getIndexFromLoc({
      line: message.line,
      column: Math.max(0, message.column - 1)
    });
    const identity = findEnclosingIdentity(functionIndex, offset);
    if (!identity) continue;
    const value = Number(match[1]);
    const key = `${identity} ${ruleId}`;
    const existing = byKey.get(key);
    if (!existing || value > existing.value) {
      byKey.set(key, {
        file: relativeFile,
        identity,
        metric: ruleId,
        value,
        limit: STRICT_LIMITS[ruleId]
      });
    }
  }

  return [...byKey.values()];
}

/** @param {string} root @returns {Finding[]} */
export function scanRepository(root) {
  /** @type {Finding[]} */
  const findings = [];
  for (const file of collectProductionFiles(root)) {
    findings.push(...scanFile(file, root));
  }
  return findings;
}

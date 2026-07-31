#!/usr/bin/env node

/**
 * JavaScript half of `test:focus:check`: a real-AST (via `acorn`, a dependency-free
 * parser) scanner that fails on
 * `.only(`/`.skip(`/`.todo(` test-focus calls, Jasmine/Jest-style bare aliases
 * (`fdescribe`/`fit`/`xdescribe`/`xit`/`xtest`), Vitest's chained conditional modifiers
 * (`test.skipIf(cond)("name", fn)` / `describe.runIf(...)`), and the options-object form
 * (`test(name, { skip: true }, fn)`), across every executable JS test/helper file
 * (`tests/js/**\/*.test.mjs` plus `tools/*-harness.mjs`, reusing
 * `test-inventory.mjs`'s own discovery so the file set can never drift between the two
 * checkers). Real AST parsing means string and comment content can never trigger a false
 * positive -- unlike a regex/masking approach, `.only(`/`.skip(` text inside a string
 * literal or a comment is never visited as a call expression at all.
 *
 * The verified initial exception set is empty. Adding one requires reviewed owner, date,
 * reason, hash-locked-site, and explicit-negative-test justification -- not silent
 * implementation convenience.
 */

import * as acorn from "acorn";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { discoverExecutableTestHelpers } from "./quality-policy/test-inventory.mjs";
import { runFocusedTestPolicy } from "./portable-core/focused-test-engine.mjs";

const ROOT = process.cwd();
const FOCUS_PROPERTY_NAMES = new Set(["only", "skip", "todo"]);
const BARE_FOCUS_ALIASES = new Set(["fdescribe", "fit", "xdescribe", "xit", "xtest"]);
const CONDITIONAL_SKIP_NAMES = new Set(["skipIf", "runIf"]);
const TEST_CALL_NAMES = new Set(["test", "describe", "it", "suite"]);
const OPTION_KEYS = new Set(["only", "skip", "todo"]);
const SKIPPED_KEYS = new Set(["type", "start", "end", "loc", "range"]);

/** @typedef {{type: string, [key: string]: any}} AstNode */

/**
 * @param {AstNode} node
 * @param {(child: AstNode) => void} callback
 * @returns {void}
 */
function forEachChildNode(node, callback) {
  for (const key of Object.keys(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === "string") callback(item);
      }
    } else if (value && typeof value.type === "string") {
      callback(value);
    }
  }
}

/**
 * @param {AstNode} node
 * @returns {boolean}
 */
function isMemberFocusCall(node) {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.property.type !== "Identifier" || !FOCUS_PROPERTY_NAMES.has(callee.property.name)) {
    return false;
  }
  const firstArg = node.arguments[0];
  return Boolean(firstArg && firstArg.type === "Literal" && typeof firstArg.value === "string");
}

/**
 * @param {AstNode} node
 * @returns {boolean}
 */
function isTestEntryPoint(node) {
  if (node.type === "Identifier") return TEST_CALL_NAMES.has(node.name);
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return isTestEntryPoint(node.object) || TEST_CALL_NAMES.has(node.property.name);
  }
  return false;
}

/**
 * Vitest's conditional modifiers read `test.skipIf(cond)("name", fn)`, so the test name
 * is an argument of the *outer* call and the modifier takes the condition instead. The
 * string-literal shape `isMemberFocusCall` relies on therefore never matches them.
 * @param {AstNode} node
 * @returns {string | null}
 */
function conditionalSkipName(node) {
  if (node.type !== "CallExpression") return null;
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  if (callee.property.type !== "Identifier" || !CONDITIONAL_SKIP_NAMES.has(callee.property.name)) {
    return null;
  }
  if (!isTestEntryPoint(callee.object)) return null;
  return callee.property.name;
}

/**
 * @param {AstNode} node
 * @returns {boolean}
 */
function isBareFocusAliasCall(node) {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  return callee.type === "Identifier" && BARE_FOCUS_ALIASES.has(callee.name);
}

/**
 * @param {AstNode} node
 * @returns {string | null}
 */
function testCallName(node) {
  if (node.callee.type === "Identifier" && TEST_CALL_NAMES.has(node.callee.name)) {
    return node.callee.name;
  }
  if (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    TEST_CALL_NAMES.has(node.callee.property.name)
  ) {
    return node.callee.property.name;
  }
  return null;
}

/**
 * @param {AstNode} node
 * @returns {string | null}
 */
function optionsObjectFocusKey(node) {
  if (node.type !== "CallExpression" || !testCallName(node)) return null;
  for (const argument of node.arguments) {
    if (argument.type !== "ObjectExpression") continue;
    for (const property of argument.properties) {
      if (property.type !== "Property" || property.computed) continue;
      const keyName = property.key.type === "Identifier" ? property.key.name : property.key.value;
      if (
        typeof keyName === "string" &&
        OPTION_KEYS.has(keyName) &&
        property.value.type === "Literal" &&
        property.value.value === true
      ) {
        return keyName;
      }
    }
  }
  return null;
}

/**
 * @param {string} source
 * @param {string} rel
 * @returns {string[]}
 */
function scanFile(source, rel) {
  /** @type {string[]} */
  const failures = [];
  let root;
  try {
    // Turn a leading shebang into a same-length line comment ("#!" -> "//") so acorn can
    // parse it without shifting any reported line/column positions.
    const parsable = source.startsWith("#!") ? "//" + source.slice(2) : source;
    root = acorn.parse(parsable, {
      ecmaVersion: 2022,
      sourceType: "module",
      locations: true
    });
  } catch (error) {
    failures.push(`${rel}: could not parse (${/** @type {Error} */ (error).message})`);
    return failures;
  }

  /** @param {AstNode} node */
  function visit(node) {
    if (isMemberFocusCall(node)) {
      const callee = /** @type {AstNode} */ (node.callee);
      failures.push(`${rel}:${node.loc.start.line}: focused/disabled test call '.${callee.property.name}(...)'`);
    } else if (isBareFocusAliasCall(node)) {
      failures.push(`${rel}:${node.loc.start.line}: focused/disabled test alias '${node.callee.name}(...)'`);
    } else if (conditionalSkipName(node)) {
      failures.push(`${rel}:${node.loc.start.line}: conditionally disabled test '.${conditionalSkipName(node)}(...)'`);
    } else {
      const optionKey = optionsObjectFocusKey(node);
      if (optionKey) {
        failures.push(`${rel}:${node.loc.start.line}: focused/disabled test options object '{ ${optionKey}: true }'`);
      }
    }
    forEachChildNode(node, visit);
  }

  visit(root);
  return failures;
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[], checkedFiles: number}}
 */
export function runTestFocusCheck({ root = ROOT, print = true } = {}) {
  const relFiles = discoverExecutableTestHelpers(root);
  /** @type {string[]} */
  const failures = [];
  for (const rel of relFiles) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    failures.push(...scanFile(source, rel));
  }
  const policy = runFocusedTestPolicy({ findings: failures });
  const summary = { ok: policy.ok, checkedFiles: relFiles.length };
  if (print) reportTestFocus(failures, summary);
  return { ok: summary.ok, failures, checkedFiles: summary.checkedFiles };
}

/**
 * @param {string[]} failures
 * @param {{ok: boolean, checkedFiles: number}} summary
 */
function reportTestFocus(failures, summary) {
  if (!summary.ok) {
    for (const failure of failures) console.error(`[test-focus] ${failure}`);
    return;
  }
  console.log(`JS test-focus check passed (${summary.checkedFiles} files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runTestFocusCheck().ok ? 0 : 1);
}

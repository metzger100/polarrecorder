#!/usr/bin/env node

/**
 * Strict-typing owner for every executable JavaScript test/helper file (`tests/js/**\/*.test.mjs`
 * plus `tools/*-harness.mjs`).
 *
 * Live discovery is the only list of those files. This script fails when a discovered file falls
 * outside `tsconfig.tests.json`'s `include` globs, then runs strict no-emit `tsc` over that
 * project, so a type error in any discovered test or helper fails as well. There is no committed
 * inventory to regenerate and no exception class.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TSCONFIG_NAME = "tsconfig.tests.json";

/**
 * @param {string} [root]
 * @returns {string[]}
 */
export function discoverExecutableTestHelpers(root = ROOT) {
  /** @type {string[]} */
  const found = [];
  const jsTestsDir = path.join(root, "tests", "js");
  if (fs.existsSync(jsTestsDir)) {
    for (const entry of fs.readdirSync(jsTestsDir, { recursive: true, encoding: "utf8" })) {
      if (entry.endsWith(".test.mjs")) {
        found.push(path.join("tests", "js", entry).split(path.sep).join("/"));
      }
    }
  }
  const toolsDir = path.join(root, "tools");
  for (const name of fs.readdirSync(toolsDir, { encoding: "utf8" })) {
    if (/-harness\.mjs$/.test(name)) {
      found.push(path.join("tools", name).split(path.sep).join("/"));
    }
  }
  return found.sort();
}

/**
 * Convert a tsconfig `include` glob (`*` within a segment, `**` across segments) into an
 * anchored pattern over repository-relative paths.
 * @param {string} glob
 * @returns {RegExp}
 */
export function includeGlobToRegExp(glob) {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/\*\*\//g, "(?:.*/)?").replace(/\*/g, "[^/]*") + "$");
}

/**
 * Discovered test/helper files that none of the tsconfig's `include` globs covers.
 * @param {string} [root]
 * @returns {string[]}
 */
export function filesOutsideTypecheckScope(root = ROOT) {
  const config = JSON.parse(fs.readFileSync(path.join(root, TSCONFIG_NAME), "utf8"));
  if (!Array.isArray(config.include) || config.files !== undefined) {
    throw new Error(`${TSCONFIG_NAME} must scope tests with "include" globs and no "files" list`);
  }
  /** @type {RegExp[]} */
  const patterns = config.include.map(includeGlobToRegExp);
  return discoverExecutableTestHelpers(root).filter((file) => !patterns.some((pattern) => pattern.test(file)));
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[], checkedFiles: number}}
 */
export function runTypecheckTests({ root = ROOT, print = true } = {}) {
  const outside = filesOutsideTypecheckScope(root);
  if (outside.length > 0) {
    const failures = outside.map((file) => `${file} is outside ${TSCONFIG_NAME}'s include globs`);
    if (print) for (const failure of failures) console.error(`[test-typecheck] ${failure}`);
    return { ok: false, failures, checkedFiles: 0 };
  }
  const checkedFiles = discoverExecutableTestHelpers(root).length;
  try {
    execFileSync(path.join(ROOT, "node_modules", ".bin", "tsc"), ["--noEmit", "-p", path.join(root, TSCONFIG_NAME)], {
      cwd: root,
      stdio: print ? "inherit" : "pipe"
    });
  } catch {
    if (print) console.error(`[test-typecheck] tsc reported errors over the ${checkedFiles} discovered test files`);
    return { ok: false, failures: ["tsc reported errors over the discovered test files"], checkedFiles };
  }
  if (print) console.log(`Test typecheck passed (${checkedFiles} discovered test files).`);
  return { ok: true, failures: [], checkedFiles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runTypecheckTests().ok ? 0 : 1);
}

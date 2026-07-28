#!/usr/bin/env node

/**
 * Permanent strict-typing owner for every maintained `tools/**\/*.mjs` quality-tool file.
 *
 * Requires the complete live tool-source inventory to be listed in `tsconfig.tools.json`'s
 * `files` array and strictly no-emit `checkJs`-types the whole set every run, so a new tool
 * file can never hide from strict typing by omission. This is the tools/ twin of
 * `typecheck-source.mjs` (shipped viewer/plugin source) and `test-inventory.mjs`
 * (tests/js/*.test.mjs).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TSCONFIG_PATH = path.join(ROOT, "tsconfig.tools.json");

/**
 * @param {string} current
 * @param {string[]} out
 * @returns {void}
 */
function walk(current, out) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const abs = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      out.push(abs);
    }
  }
}

/**
 * @param {string} [root]
 * @returns {string[]}
 */
export function liveToolSourcePaths(root = ROOT) {
  /** @type {string[]} */
  const found = [];
  walk(path.join(root, "tools"), found);
  return found.map((abs) => path.relative(root, abs).split(path.sep).join("/")).sort();
}

/**
 * @param {string} [root]
 * @returns {string[]}
 */
export function configuredToolSourcePaths(root = ROOT) {
  const config = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.tools.json"), "utf8"));
  /** @type {string[]} */
  const files = config.files;
  return files.slice().sort();
}

/**
 * @param {string} [root]
 * @returns {{missingFromInventory: string[], extraInInventory: string[]}}
 */
export function diffToolSourceInventory(root = ROOT) {
  const live = new Set(liveToolSourcePaths(root));
  const configured = new Set(configuredToolSourcePaths(root));
  const missingFromInventory = [...live].filter((p) => !configured.has(p)).sort();
  const extraInInventory = [...configured].filter((p) => !live.has(p)).sort();
  return { missingFromInventory, extraInInventory };
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{
 *   ok: boolean,
 *   missingFromInventory: string[],
 *   extraInInventory: string[],
 *   checkedFiles: number
 * }}
 */
export function runToolsTypecheck({ root = ROOT, print = true } = {}) {
  const { missingFromInventory, extraInInventory } = diffToolSourceInventory(root);
  if (missingFromInventory.length > 0 || extraInInventory.length > 0) {
    if (print) {
      if (missingFromInventory.length > 0) {
        console.error(`Tool source file(s) missing from tsconfig.tools.json: ${missingFromInventory.join(", ")}`);
      }
      if (extraInInventory.length > 0) {
        console.error(`tsconfig.tools.json lists stale/removed tool file(s): ${extraInInventory.join(", ")}`);
      }
    }
    return { ok: false, missingFromInventory, extraInInventory, checkedFiles: 0 };
  }

  const checkedFiles = configuredToolSourcePaths(root).length;
  try {
    execFileSync(path.join(ROOT, "node_modules", ".bin", "tsc"), ["--noEmit", "-p", TSCONFIG_PATH], {
      cwd: ROOT,
      stdio: print ? "inherit" : "pipe"
    });
    return { ok: true, missingFromInventory, extraInInventory, checkedFiles };
  } catch {
    return { ok: false, missingFromInventory, extraInInventory, checkedFiles };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runToolsTypecheck();
  process.exit(result.ok ? 0 : 1);
}

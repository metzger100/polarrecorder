#!/usr/bin/env node

/**
 * Permanent strict-typing owner for shipped JavaScript source files (`plugin.js`,
 * `plugin.mjs`, `viewer/*.js`).
 *
 * Replaces a prior `typecheck:migration-source` owner (deleted in the same change that
 * activated this script), which typechecked only files newly added since a frozen source
 * capture. This owner instead requires the complete live source inventory to be listed in
 * `tsconfig.checkjs.json` and strictly no-emit `checkJs`-types the whole set every run, so a
 * new shipped file can never hide from strict typing by omission.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TSCONFIG_PATH = path.join(ROOT, "tsconfig.checkjs.json");

/**
 * @param {string} [root]
 * @returns {string[]}
 */
export function liveShippedSourcePaths(root = ROOT) {
  const found = ["plugin.js", "plugin.mjs"].filter((name) => fs.existsSync(path.join(root, name)));
  for (const name of fs.readdirSync(path.join(root, "viewer"), { encoding: "utf8" })) {
    if (name.endsWith(".js")) found.push(path.join("viewer", name));
  }
  return found.sort();
}

/**
 * @param {string} [root]
 * @returns {string[]}
 */
export function configuredSourcePaths(root = ROOT) {
  const config = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.checkjs.json"), "utf8"));
  /** @type {string[]} */
  const include = config.include;
  return include
    .filter((entry) => !entry.endsWith(".d.ts"))
    .map((entry) => entry.split("/").join(path.sep))
    .sort();
}

/**
 * @param {string} [root]
 * @returns {{missingFromInventory: string[], extraInInventory: string[]}}
 */
export function diffSourceInventory(root = ROOT) {
  const live = new Set(liveShippedSourcePaths(root));
  const configured = new Set(configuredSourcePaths(root));
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
export function runSourceTypecheck({ root = ROOT, print = true } = {}) {
  const { missingFromInventory, extraInInventory } = diffSourceInventory(root);
  if (missingFromInventory.length > 0 || extraInInventory.length > 0) {
    if (print) {
      if (missingFromInventory.length > 0) {
        console.error(`Shipped source file(s) missing from tsconfig.checkjs.json: ${missingFromInventory.join(", ")}`);
      }
      if (extraInInventory.length > 0) {
        console.error(`tsconfig.checkjs.json lists stale/removed source file(s): ${extraInInventory.join(", ")}`);
      }
    }
    return { ok: false, missingFromInventory, extraInInventory, checkedFiles: 0 };
  }

  const checkedFiles = configuredSourcePaths(root).length;
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
  const result = runSourceTypecheck();
  process.exit(result.ok ? 0 : 1);
}

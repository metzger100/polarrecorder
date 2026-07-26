#!/usr/bin/env node

/**
 * Persistent per-file hotspot-budget owner.
 *
 * Enforces `hotspot-budgets.json`'s named, reviewed ceilings (each below 400 and no more
 * than 10 lines above its captured clean count) for files close enough to the repo's
 * global 400-non-empty-line limit that unbounded growth deserves an earlier warning.
 * This is independent of and does not replace the global file-size/anti-compression
 * gate (`tools/check-file-size.mjs` / `tools/check-python-filesize.py`).
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const BUDGETS_PATH = path.join(ROOT, "tools", "quality-policy", "hotspot-budgets.json");
const GLOBAL_LIMIT = 400;

/**
 * @param {string} absolutePath
 * @returns {number}
 */
function countNonEmptyLines(absolutePath) {
  const text = fs.readFileSync(absolutePath, "utf8");
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runHotspotBudgetsCheck(options = {}) {
  const root = options.root || ROOT;
  const print = options.print !== false;
  const budgetsPath =
    root === ROOT
      ? BUDGETS_PATH
      : path.join(root, "tools", "quality-policy", "hotspot-budgets.json");
  const data = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));

  /** @type {string[]} */
  const failures = [];
  for (const [relativePath, budget] of Object.entries(data.budgets)) {
    if (typeof budget !== "number" || budget >= GLOBAL_LIMIT || budget <= 0) {
      failures.push(
        `${relativePath}: invalid budget ${budget} (must be a positive number below ${GLOBAL_LIMIT})`
      );
      continue;
    }
    const filePath = path.join(root, relativePath);
    if (!fs.existsSync(filePath)) {
      failures.push(`${relativePath}: missing file for a recorded hotspot budget`);
      continue;
    }
    const actual = countNonEmptyLines(filePath);
    if (actual > budget) {
      failures.push(
        `${relativePath}: ${actual} non-empty lines exceeds its hotspot budget of ${budget}`
      );
    }
  }

  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[hotspot-budgets] ${failure}`);
    } else {
      console.log("Hotspot budget check passed.");
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runHotspotBudgetsCheck();
  process.exit(result.ok ? 0 : 1);
}

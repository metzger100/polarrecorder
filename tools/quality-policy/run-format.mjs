#!/usr/bin/env node

/**
 * `format`/`format:check` runner. Both modes iterate the exact same
 * `format-scope.json` classification; the only difference is Prettier/Ruff write vs.
 * check mode, so the write and check inventories can never drift apart.
 *
 * Usage:
 *   node tools/quality-policy/run-format.mjs --check
 *   node tools/quality-policy/run-format.mjs --write
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

/**
 * @returns {string} the `ruff` executable, preferring the project/POLARRECORDER_VENV venv
 */
function resolveRuff() {
  const venvDir = process.env.POLARRECORDER_VENV || path.join(ROOT, "venv");
  const venvRuff = path.join(venvDir, "bin", "ruff");
  return fs.existsSync(venvRuff) ? venvRuff : "ruff";
}

function loadScope() {
  const scopePath = path.join(ROOT, "tools", "quality-policy", "format-scope.json");
  return JSON.parse(fs.readFileSync(scopePath, "utf8"));
}

/**
 * @param {string} mode "check" | "write"
 * @returns {number} exit code
 */
function run(mode) {
  const scope = loadScope();
  const prettierPaths = scope.rows.filter((row) => row.owner === "prettier").map((row) => row.path);
  const ruffPaths = scope.rows.filter((row) => row.owner === "ruff").map((row) => row.path);

  let failed = false;

  if (prettierPaths.length > 0) {
    const prettierArgs = [mode === "check" ? "--check" : "--write", ...prettierPaths];
    try {
      execFileSync(path.join(ROOT, "node_modules", ".bin", "prettier"), prettierArgs, {
        cwd: ROOT,
        stdio: "inherit"
      });
    } catch {
      failed = true;
    }
  }

  if (ruffPaths.length > 0) {
    const ruffArgs = ["format", ...(mode === "check" ? ["--check"] : []), ...ruffPaths];
    try {
      execFileSync(resolveRuff(), ruffArgs, { cwd: ROOT, stdio: "inherit" });
    } catch {
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

const mode = process.argv.includes("--write") ? "write" : "check";
process.exit(run(mode));

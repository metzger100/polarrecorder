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
import { pathToFileURL } from "node:url";
import { runFormatPolicy } from "../portable-core/format-engine.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const HOOK_ENVIRONMENT_PATH = path.join(ROOT, "tools", "quality-policy", "project-hook-environment.json");

/**
 * @returns {{venvEnvironmentVariable: string}}
 */
function readHookEnvironment() {
  return JSON.parse(fs.readFileSync(HOOK_ENVIRONMENT_PATH, "utf8"));
}

/**
 * @returns {string} the `ruff` executable, preferring the project-owned venv env var's venv
 */
function resolveRuff() {
  const { venvEnvironmentVariable } = readHookEnvironment();
  const venvDir = process.env[venvEnvironmentVariable] || path.join(ROOT, "venv");
  const venvRuff = path.join(venvDir, "bin", "ruff");
  return fs.existsSync(venvRuff) ? venvRuff : "ruff";
}

/**
 * @param {string} root
 * @returns {{rows: {path: string, owner: string}[]}}
 */
function loadScope(root) {
  const scopePath = path.join(root, "tools", "quality-policy", "format-scope.json");
  return JSON.parse(fs.readFileSync(scopePath, "utf8"));
}

/**
 * Run Prettier/Ruff over `format-scope.json`'s classification in either check or write mode.
 * @param {{mode?: "check"|"write", root?: string}} [options]
 * @returns {{ok: boolean}}
 */
export function runFormat({ mode = "check", root = ROOT } = {}) {
  const scope = loadScope(root);
  const owners = [...new Set(scope.rows.map((row) => row.owner))];
  if (!runFormatPolicy({ rows: scope.rows, owners }).ok) return { ok: false };
  const prettierPaths = scope.rows.filter((row) => row.owner === "prettier").map((row) => row.path);
  const ruffPaths = scope.rows.filter((row) => row.owner === "ruff").map((row) => row.path);

  let failed = false;

  if (prettierPaths.length > 0) {
    const prettierArgs = [mode === "check" ? "--check" : "--write", ...prettierPaths];
    try {
      execFileSync(path.join(root, "node_modules", ".bin", "prettier"), prettierArgs, {
        cwd: root,
        stdio: "inherit"
      });
    } catch {
      failed = true;
    }
  }

  if (ruffPaths.length > 0) {
    const ruffArgs = ["format", ...(mode === "check" ? ["--check"] : []), ...ruffPaths];
    try {
      execFileSync(resolveRuff(), ruffArgs, { cwd: root, stdio: "inherit" });
    } catch {
      failed = true;
    }
  }

  return { ok: !failed };
}

/**
 * @returns {boolean}
 */
function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntrypoint()) {
  const mode = process.argv.includes("--write") ? "write" : "check";
  process.exit(runFormat({ mode }).ok ? 0 : 1);
}

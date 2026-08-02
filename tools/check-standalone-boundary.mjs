#!/usr/bin/env node

/**
 * Check that maintained repository text and package commands stay inside one local root.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { listRegularFiles, relativePath } from "./portable-core/path-policy.mjs";

const SKIP_DIRS = new Set([
  ".git",
  ".claude",
  ".vscode",
  "node_modules",
  "venv",
  ".quality-cache",
  "coverage",
  "releases"
]);
// The distribution verifier must name rejected product tokens to detect them in neutral metadata.
const SKIP_FILES = new Set(["tools/check-distribution.mjs", "tools/regenerate-distribution-manifest.mjs"]);
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".js",
  ".mjs",
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
const BOUNDARY_PATTERNS = [new RegExp(`${"/"}(?:home|Users)${"/"}`), /\bdyninstruments\b/i, /\bdynicomponents\b/i];

/**
 * @typedef {{path: string, reason: string}}
 * BoundaryFinding
 */

/**
 * @param {string} root
 * @returns {string[]}
 */
function listMaintainedFiles(root) {
  return listRegularFiles(root).filter((file) => {
    const rel = relativePath(root, file);
    const first = rel.split("/")[0];
    return !SKIP_DIRS.has(first) && !SKIP_FILES.has(rel) && TEXT_EXTENSIONS.has(path.extname(rel));
  });
}

/**
 * Run the standalone-boundary audit.
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, findings: BoundaryFinding[]}}
 */
export function runStandaloneBoundaryCheck(options = {}) {
  const root = fs.realpathSync(path.resolve(options.root || process.cwd()));
  const findings = [];
  for (const file of listMaintainedFiles(root)) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of BOUNDARY_PATTERNS) {
      if (pattern.test(source))
        findings.push({ path: relativePath(root, file), reason: "standalone boundary token found" });
    }
  }
  const packagePath = path.join(root, "package.json");
  if (fs.existsSync(packagePath)) {
    const packageText = fs.readFileSync(packagePath, "utf8");
    if (/\$\{[^}]*?(?:CHECKOUT|REPOSITORY|WORKSPACE)[^}]*?\}/i.test(packageText)) {
      findings.push({ path: "package.json", reason: "package script uses an external-root environment variable" });
    }
  }
  const result = { ok: findings.length === 0, findings };
  if (options.print !== false) {
    if (result.ok) console.log("Standalone boundary check passed.");
    else for (const finding of findings) console.error(`[standalone-boundary] ${finding.path}: ${finding.reason}`);
  }
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exit(runStandaloneBoundaryCheck().ok ? 0 : 1);
}

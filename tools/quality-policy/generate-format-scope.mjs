#!/usr/bin/env node

/**
 * Machine-readable disposition of every maintained file: `prettier`, `ruff`, or
 * `unsupported` (with an exact reason and alternate validation owner).
 * Discovers files via `git ls-files --cached --others --exclude-standard` (tracked plus
 * untracked-but-not-`.gitignore`d) rather than a hand-maintained list, so a new file --
 * committed or not yet staged -- is classified automatically and the format-scope
 * contract test fails loudly on anything genuinely unmatched.
 *
 * Historical/generated exclusions (release ZIPs/notes, completed plans) are a separate,
 * narrow exclusion list, not "unsupported maintained files" -- they are not maintained
 * inputs at all.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const OUTPUT_PATH = path.join(ROOT, "tools", "quality-policy", "format-scope.json");

const HISTORICAL_EXCLUSION_PATTERNS = [/^releases\/.*\.(zip|md)$/, /^exec-plans\/completed\//];

const IMMUTABLE_CAPTURE_JSON_FILES = new Set([
  "tools/quality-policy/baseline-coverage-capture.json",
  "tools/quality-policy/planned-quality-fixtures.json"
]);

/**
 * @param {string} relativePath
 * @returns {{owner: "prettier" | "ruff" | "unsupported", reason?: string, alternateValidation?: string} | null}
 */
function classify(relativePath) {
  if (relativePath === "exec-plans/active/.gitkeep") {
    return {
      owner: "unsupported",
      reason: "empty placeholder file",
      alternateValidation: "none needed"
    };
  }
  if (relativePath === ".codex") {
    return {
      owner: "unsupported",
      reason: "empty editor/tool marker file",
      alternateValidation: "none needed"
    };
  }
  if (relativePath.endsWith(".py")) {
    return { owner: "ruff" };
  }
  if (
    relativePath.endsWith(".mjs") ||
    relativePath.endsWith(".js") ||
    relativePath.endsWith(".d.ts")
  ) {
    return { owner: "prettier" };
  }
  if (relativePath.endsWith(".html") || relativePath.endsWith(".css")) {
    return { owner: "prettier" };
  }
  if (relativePath.endsWith(".yml") || relativePath.endsWith(".yaml")) {
    return { owner: "prettier" };
  }
  if (
    relativePath === "package-lock.json" ||
    relativePath.endsWith(".json") ||
    relativePath.endsWith(".jsonc")
  ) {
    if (relativePath.startsWith("tests/mock-data/")) {
      return {
        owner: "unsupported",
        reason:
          "functional test fixture; reformatting is a fixture-sync decision (CLAUDE.md Section 10), not an automated one",
        alternateValidation:
          "tests/test_export.py and related fixture-sync tests exercise byte content"
      };
    }
    if (IMMUTABLE_CAPTURE_JSON_FILES.has(relativePath)) {
      return {
        owner: "unsupported",
        reason:
          "byte-stable immutable capture owned by its Python generator's canonical_json.dumps_canonical (or hand-authored and reviewed directly), not Prettier's JSON style",
        alternateValidation:
          "tests/test_baseline_captures.py digest anchors and regeneration proofs"
      };
    }
    return { owner: "prettier" };
  }
  if (relativePath.endsWith(".md")) {
    if (HISTORICAL_EXCLUSION_PATTERNS.some((pattern) => pattern.test(relativePath))) return null;
    return { owner: "prettier" };
  }
  if (relativePath.endsWith(".svg")) {
    return {
      owner: "unsupported",
      reason:
        "Prettier's SVG support is XML-as-HTML best-effort only; this repo's one icon is hand-authored and reviewed, not machine-formatted",
      alternateValidation: "manual review on change"
    };
  }
  if (relativePath.endsWith(".sh") || relativePath === ".githooks/pre-push") {
    return {
      owner: "unsupported",
      reason: "no maintained shell formatter in this inventory",
      alternateValidation: "bash -n syntax check (see check:filesize/test:tools shell smoke)"
    };
  }
  if (relativePath === "pyproject.toml") {
    return {
      owner: "unsupported",
      reason: "Prettier has no built-in TOML support and no TOML plugin is in this inventory",
      alternateValidation: "Ruff/mypy/pytest consume it directly every gate run"
    };
  }
  if (relativePath === "requirements-dev.in" || relativePath === "requirements-dev.txt") {
    return {
      owner: "unsupported",
      reason:
        "pip requirements format; pip-compile is the sole generator of the hash-locked file, not a formatter",
      alternateValidation:
        "npm run requirements:lock regenerates requirements-dev.txt deterministically"
    };
  }
  if (relativePath.endsWith(".zip")) return null;
  if (relativePath.endsWith(".csv")) {
    return {
      owner: "unsupported",
      reason:
        "functional test fixture; Prettier has no CSV formatter and byte content is test-asserted",
      alternateValidation: "tests/test_export.py exercises the exact CSV bytes"
    };
  }
  if (
    relativePath === ".gitignore" ||
    relativePath === ".prettierignore" ||
    relativePath === ".stylelintignore" ||
    relativePath === ".nvmrc" ||
    relativePath === ".markdownlint-cli2.jsonc"
  ) {
    if (relativePath === ".markdownlint-cli2.jsonc") return { owner: "prettier" };
    return {
      owner: "unsupported",
      reason: "plain dotfile with no maintained formatter target",
      alternateValidation: "reviewed on change"
    };
  }
  return { owner: "unsupported", reason: "unclassified -- requires an explicit disposition" };
}

/**
 * Build the canonical format-scope classification for every tracked file.
 *
 * @returns {{path: string, owner: string, reason?: string, alternateValidation?: string}[]}
 */
export function buildFormatScope() {
  // Tracked plus untracked-but-not-ignored files: mid-migration, several genuinely
  // maintained files (a fresh package-lock.json, newly authored tools) are not yet
  // staged/committed, and `git ls-files` alone would silently miss them.
  const discovered = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: ROOT, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);
  const tracked = [...new Set(discovered)].sort();
  /** @type {{path: string, owner: string, reason?: string, alternateValidation?: string}[]} */
  const rows = [];
  for (const relativePath of tracked) {
    if (HISTORICAL_EXCLUSION_PATTERNS.some((pattern) => pattern.test(relativePath))) continue;
    const entry = classify(relativePath);
    if (entry === null) continue;
    rows.push({ path: relativePath, ...entry });
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function main() {
  const rows = buildFormatScope();
  const unclassified = rows.filter((row) => row.owner === "unsupported" && !row.reason);
  if (unclassified.length > 0) {
    console.error("format-scope: unclassified files require an explicit disposition:");
    for (const row of unclassified) console.error(`  ${row.path}`);
    process.exitCode = 1;
    return;
  }
  /** @type {Record<string, number>} */
  const byOwner = {};
  for (const row of rows) byOwner[row.owner] = (byOwner[row.owner] || 0) + 1;
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ rows, countByOwner: byOwner }, null, 2) + "\n");
  console.log(
    `format-scope: wrote ${rows.length} rows (${JSON.stringify(byOwner)}) to ${OUTPUT_PATH}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

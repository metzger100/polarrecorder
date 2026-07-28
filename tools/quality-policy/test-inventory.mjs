#!/usr/bin/env node

/**
 * Permanent strict-typing and inventory owner for every executable JavaScript test/helper
 * file (`tests/js/**\/*.test.mjs` plus `tools/*-harness.mjs`).
 *
 * Replaces a prior `typecheck:migration-tests` owner (deleted in the same change that
 * activated this script). Every executable JS test/helper is classified `strict`; there is no harness
 * exception class. The only non-strict classification is `fixture`, restricted to
 * non-executable data files under `tests/fixtures/quality/` that were named in
 * `planned-quality-fixtures.json` before creation -- this script validates that
 * provenance too, so an unplanned, executable, ownerless, path-mismatched,
 * hash-mismatched, or unused fixture fails closed.
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TSCONFIG_PATH = path.join(ROOT, "tsconfig.tests.json");
const EXECUTABLE_EXTENSIONS = new Set([".mjs", ".js", ".py", ".sh"]);

/**
 * @param {string} root
 * @returns {string}
 */
function inventoryPath(root) {
  return path.join(root, "tools", "quality-policy", "test-inventory.json");
}

/**
 * @param {string} root
 * @returns {string}
 */
function exceptionBaselinePath(root) {
  return path.join(root, "tools", "quality-policy", "test-exception-baseline.json");
}

/**
 * @param {string} root
 * @returns {string}
 */
function plannedFixturesPath(root) {
  return path.join(root, "tools", "quality-policy", "planned-quality-fixtures.json");
}

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
 * @param {string} [root]
 * @returns {{path: string, classification: "strict"}[]}
 */
export function buildTestInventory(root = ROOT) {
  return discoverExecutableTestHelpers(root).map((relPath) => ({
    path: relPath,
    classification: "strict"
  }));
}

/**
 * @param {string} [root]
 * @returns {{missingFromInventory: string[], extraInInventory: string[], nonStrictEntries: string[]}}
 */
export function diffTestInventory(root = ROOT) {
  const live = new Set(discoverExecutableTestHelpers(root));
  const committed = JSON.parse(fs.readFileSync(inventoryPath(root), "utf8"));
  /** @type {{path: string, classification: string}[]} */
  const entries = committed.executableTestHelpers;
  const committedPaths = new Set(entries.map((entry) => entry.path));
  const missingFromInventory = [...live].filter((p) => !committedPaths.has(p)).sort();
  const extraInInventory = [...committedPaths].filter((p) => !live.has(p)).sort();
  const nonStrictEntries = entries
    .filter((entry) => entry.classification !== "strict")
    .map((entry) => entry.path)
    .sort();
  return { missingFromInventory, extraInInventory, nonStrictEntries };
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function looksExecutable(filePath) {
  if (EXECUTABLE_EXTENSIONS.has(path.extname(filePath))) return true;
  const head = fs.readFileSync(filePath, "utf8").slice(0, 2);
  return head === "#!";
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function sha256Of(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function collectQualityFixtureFiles(root) {
  const dir = path.join(root, "tests", "fixtures", "quality");
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    const absolute = path.join(dir, entry);
    if (fs.statSync(absolute).isFile()) {
      found.push(path.join("tests", "fixtures", "quality", entry).split(path.sep).join("/"));
    }
  }
  return found.sort();
}

/**
 * @param {string} root
 * @param {string} fixtureRelPath
 * @returns {boolean}
 */
function fixtureIsReferenced(root, fixtureRelPath) {
  const searchRoots = ["tests", "tools"];
  for (const searchRoot of searchRoots) {
    const absoluteRoot = path.join(root, searchRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    for (const entry of fs.readdirSync(absoluteRoot, { recursive: true, encoding: "utf8" })) {
      const absoluteEntry = path.join(absoluteRoot, entry);
      if (!fs.statSync(absoluteEntry).isFile()) continue;
      if (absoluteEntry.startsWith(path.join(root, fixtureRelPath))) continue;
      // Provenance metadata (test-inventory.json, planned-quality-fixtures.json,
      // ...) legitimately names every fixture path without "using" it as an owner test.
      if (absoluteEntry.endsWith(".json")) continue;
      const content = fs.readFileSync(absoluteEntry, "utf8");
      if (content.includes(fixtureRelPath)) return true;
    }
  }
  return false;
}

/**
 * @param {string} [root]
 * @returns {string[]}
 */
export function checkPlannedFixtureProvenance(root = ROOT) {
  /** @type {string[]} */
  const failures = [];
  const plannedRaw = JSON.parse(fs.readFileSync(plannedFixturesPath(root), "utf8"));
  /** @type {{path: string, sha256: string, ownerTest: string, rule: string, reason: string}[]} */
  const planned = plannedRaw.plannedFixtures;
  const plannedByPath = new Map(planned.map((entry) => [entry.path, entry]));
  const liveFixtures = collectQualityFixtureFiles(root);

  for (const entry of planned) {
    if (!entry.ownerTest) failures.push(`planned fixture ${entry.path} is ownerless`);
    if (!entry.rule) failures.push(`planned fixture ${entry.path} names no rule/command`);
    if (!entry.reason) failures.push(`planned fixture ${entry.path} has no reason`);
    const absolute = path.join(root, entry.path);
    if (!fs.existsSync(absolute)) {
      failures.push(`planned fixture ${entry.path} is missing`);
      continue;
    }
    if (looksExecutable(absolute)) {
      failures.push(`planned fixture ${entry.path} must not be executable`);
    }
    if (sha256Of(absolute) !== entry.sha256) {
      failures.push(`planned fixture ${entry.path} content does not match its captured hash`);
    }
    if (!fixtureIsReferenced(root, entry.path)) {
      failures.push(`planned fixture ${entry.path} is unused (not referenced by any test/tool)`);
    }
  }

  for (const livePath of liveFixtures) {
    if (!plannedByPath.has(livePath)) {
      failures.push(`${livePath} is an unplanned quality fixture`);
    }
  }

  return failures;
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runTestInventoryCheck({ root = ROOT, print = true } = {}) {
  /** @type {string[]} */
  const failures = [];
  const { missingFromInventory, extraInInventory, nonStrictEntries } = diffTestInventory(root);
  for (const missing of missingFromInventory) {
    failures.push(`${missing} is missing from test-inventory.json`);
  }
  for (const extra of extraInInventory) {
    failures.push(`test-inventory.json lists stale/removed executable ${extra}`);
  }
  for (const nonStrict of nonStrictEntries) {
    failures.push(`${nonStrict} is classified non-strict; every executable must be strict`);
  }

  const exceptionBaseline = JSON.parse(fs.readFileSync(exceptionBaselinePath(root), "utf8"));
  if (exceptionBaseline.exceptions.length > 0) {
    failures.push(
      "test-exception-baseline.json is non-empty; a strict-typing exception requires " +
        "reviewed owner/date/reason justification, not silent implementation convenience"
    );
  }

  failures.push(...checkPlannedFixtureProvenance(root));

  const summary = { ok: failures.length === 0 };
  if (print) reportInventory(failures, summary);
  return { ok: summary.ok, failures };
}

/**
 * @param {string[]} failures
 * @param {{ok: boolean}} summary
 */
function reportInventory(failures, summary) {
  if (!summary.ok) {
    for (const failure of failures) console.error(`[test-inventory] ${failure}`);
    return;
  }
  console.log("Test inventory check passed.");
}

/**
 * Compares `tsconfig.tests.json`'s `include` array against the live executable
 * test/helper discovery, so the strict-checkJs project file itself cannot silently
 * drift from the same file set `test-inventory.json` and the runner both track.
 *
 * @param {string} [root]
 * @param {string} [tsconfigPath]
 * @returns {{missingFromTsconfig: string[], extraInTsconfig: string[]}}
 */
export function diffTsconfigTestsInventory(root = ROOT, tsconfigPath = TSCONFIG_PATH) {
  const live = new Set(discoverExecutableTestHelpers(root));
  const config = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  /** @type {string[]} */
  const included = config.include.filter((/** @type {string} */ entry) => !entry.endsWith(".d.ts"));
  const includedSet = new Set(included);
  const missingFromTsconfig = [...live].filter((p) => !includedSet.has(p)).sort();
  const extraInTsconfig = included.filter((p) => !live.has(p)).sort();
  return { missingFromTsconfig, extraInTsconfig };
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[], checkedFiles: number}}
 */
export function runTypecheckTests({ root = ROOT, print = true } = {}) {
  const inventoryResult = runTestInventoryCheck({ root, print });
  if (!inventoryResult.ok) {
    return { ok: false, failures: inventoryResult.failures, checkedFiles: 0 };
  }

  const { missingFromTsconfig, extraInTsconfig } = diffTsconfigTestsInventory();
  if (missingFromTsconfig.length > 0 || extraInTsconfig.length > 0) {
    /** @type {string[]} */
    const failures = [];
    for (const missing of missingFromTsconfig) {
      failures.push(`${missing} is missing from tsconfig.tests.json's include list`);
    }
    for (const extra of extraInTsconfig) {
      failures.push(`tsconfig.tests.json includes stale/removed executable ${extra}`);
    }
    if (print) for (const failure of failures) console.error(`[test-inventory] ${failure}`);
    return { ok: false, failures, checkedFiles: 0 };
  }

  const checkedFiles = discoverExecutableTestHelpers(root).length;
  try {
    execFileSync(path.join(ROOT, "node_modules", ".bin", "tsc"), ["--noEmit", "-p", TSCONFIG_PATH], {
      cwd: ROOT,
      stdio: print ? "inherit" : "pipe"
    });
    return { ok: true, failures: [], checkedFiles };
  } catch {
    return {
      ok: false,
      failures: ["tsc reported errors over the executable test inventory"],
      checkedFiles
    };
  }
}

function writeInventory() {
  const entries = buildTestInventory();
  const payload = {
    note:
      "Committed executable JS test/helper inventory. Regenerate with " +
      "`node tools/quality-policy/test-inventory.mjs --write` whenever a test/helper file " +
      "is added, removed, or renamed under tests/js/ or as a tools/*-harness.mjs file.",
    executableTestHelpers: entries
  };
  fs.writeFileSync(inventoryPath(ROOT), JSON.stringify(payload, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    writeInventory();
  } else {
    process.exit(runTypecheckTests().ok ? 0 : 1);
  }
}

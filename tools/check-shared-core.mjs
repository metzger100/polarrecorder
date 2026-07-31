#!/usr/bin/env node

/**
 * `npm run check:shared-core` -- verifies `tools/quality-policy/shared-core-manifest.json`
 * against the files on disk: every listed path must exist and its SHA-256 must match the
 * recorded digest. It also fails if a directory named in the project-owned
 * `tools/quality-policy/tier1-scan-roots.json` contains a file absent from the manifest.
 *
 * Cross-repository identity is a property of both repositories committing the identical
 * manifest `entries` object (verified out of band with `cmp`); this checker never reads or
 * resolves any path outside its own repository.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** @typedef {{path: string, reason: string}} SharedCoreFinding */
/** @typedef {{root?: string, print?: boolean}} SharedCoreOptions */
/** @typedef {{ok: boolean, findings: SharedCoreFinding[], checkedEntries: number}} SharedCoreResult */

const MANIFEST_REL = path.join("tools", "quality-policy", "shared-core-manifest.json");
const SCAN_ROOTS_REL = path.join("tools", "quality-policy", "tier1-scan-roots.json");

/**
 * @param {string} absolutePath
 * @returns {string}
 */
function sha256File(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

/**
 * @param {string} root
 * @returns {{entries: Record<string, string>}}
 */
function readManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, MANIFEST_REL), "utf8"));
}

/**
 * @param {string} root
 * @returns {{roots: string[]}}
 */
function readScanRoots(root) {
  const scanPath = path.join(root, SCAN_ROOTS_REL);
  if (!fs.existsSync(scanPath)) return { roots: [] };
  return JSON.parse(fs.readFileSync(scanPath, "utf8"));
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(abs));
    else out.push(abs);
  }
  return out;
}

/**
 * Run the shared-core manifest check against a repository root.
 * @param {SharedCoreOptions} [options]
 * @returns {SharedCoreResult}
 */
export function runSharedCoreCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const print = options.print !== false;
  const manifest = readManifest(root);
  /** @type {SharedCoreFinding[]} */
  const findings = [];

  for (const [rel, expectedDigest] of Object.entries(manifest.entries)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      findings.push({ path: rel, reason: "listed in manifest but missing on disk" });
      continue;
    }
    const actualDigest = sha256File(abs);
    if (actualDigest !== expectedDigest) {
      findings.push({ path: rel, reason: `digest mismatch: expected ${expectedDigest}, got ${actualDigest}` });
    }
  }

  const manifestPaths = new Set(Object.keys(manifest.entries));
  const scanRoots = readScanRoots(root);
  for (const scanRoot of scanRoots.roots) {
    for (const abs of listFilesRecursive(path.join(root, scanRoot))) {
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      if (!manifestPaths.has(rel)) {
        findings.push({ path: rel, reason: "Tier 1 path on disk is absent from shared-core-manifest.json" });
      }
    }
  }

  const ok = findings.length === 0;
  if (print) {
    if (ok) {
      console.log(`Shared core check passed over ${Object.keys(manifest.entries).length} manifest entries.`);
    } else {
      for (const finding of findings) console.error(`[shared-core] ${finding.path}: ${finding.reason}`);
    }
    console.log(
      "SUMMARY_JSON=" +
        JSON.stringify({ ok, checkedEntries: Object.keys(manifest.entries).length, findings: findings.length })
    );
  }
  return { ok, findings, checkedEntries: Object.keys(manifest.entries).length };
}

/**
 * @param {string} root
 * @returns {Set<string>} repo-relative `.mjs` paths directly invoked by an `npm run` script
 */
function readNpmScriptEntryPoints(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  /** @type {Set<string>} */
  const entryPoints = new Set();
  for (const command of Object.values(pkg.scripts || {})) {
    for (const match of String(command).matchAll(/node ([\w./-]+\.mjs)/g)) {
      entryPoints.add(match[1]);
    }
  }
  return entryPoints;
}

/**
 * @param {string} root
 * @returns {string[]} absolute paths of every `tests/js/**\/*.test.mjs` file
 */
function listTestFiles(root) {
  return listFilesRecursive(path.join(root, "tests", "js")).filter((abs) => abs.endsWith(".test.mjs"));
}

/**
 * The manifest precondition contract: every `.mjs` manifest entry must have at least one
 * referencing self-test under `tests/js/`, and every entry directly invoked by an `npm run`
 * script (a checker entry point, as opposed to an internal helper submodule donated
 * alongside it) must export at least one `run*()` function.
 * @param {SharedCoreOptions} [options]
 * @returns {Promise<SharedCoreResult>}
 */
export async function runManifestPreconditionCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const print = options.print !== false;
  const manifest = readManifest(root);
  const mjsEntries = Object.keys(manifest.entries).filter((rel) => rel.endsWith(".mjs"));
  const entryPoints = readNpmScriptEntryPoints(root);
  const testContents = listTestFiles(root).map((abs) => fs.readFileSync(abs, "utf8"));

  /** @type {SharedCoreFinding[]} */
  const findings = [];
  for (const rel of mjsEntries) {
    const basename = path.basename(rel);
    const hasReferencingTest = testContents.some((content) => content.includes(basename));
    if (!hasReferencingTest) {
      findings.push({ path: rel, reason: "no referencing self-test found under tests/js/" });
    }
    if (entryPoints.has(rel)) {
      let moduleExports;
      try {
        moduleExports = await import(pathToFileURL(path.join(root, rel)).href);
      } catch (error) {
        findings.push({ path: rel, reason: `could not import: ${/** @type {Error} */ (error).message}` });
        continue;
      }
      const hasRunExport = Object.keys(moduleExports).some(
        (name) => name.startsWith("run") && typeof moduleExports[name] === "function"
      );
      if (!hasRunExport) {
        findings.push({ path: rel, reason: "npm-script entry point exports no run*() function" });
      }
    }
  }

  const ok = findings.length === 0;
  if (print) {
    if (ok) {
      console.log(`Manifest precondition check passed over ${mjsEntries.length} .mjs entries.`);
    } else {
      for (const finding of findings) console.error(`[manifest-precondition] ${finding.path}: ${finding.reason}`);
    }
  }
  return { ok, findings, checkedEntries: mjsEntries.length };
}

/**
 * @returns {boolean}
 */
function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntrypoint()) {
  const sharedCoreResult = runSharedCoreCheck({ root: process.cwd(), print: true });
  runManifestPreconditionCheck({ root: process.cwd(), print: true }).then((preconditionResult) => {
    process.exit(sharedCoreResult.ok && preconditionResult.ok ? 0 : 1);
  });
}

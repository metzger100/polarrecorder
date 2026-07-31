#!/usr/bin/env node

/**
 * @file check-shared-core - Verifies the signed, contract-complete portable quality core
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  CONTRACT_PATH,
  MANIFEST_PATH,
  SIGNATURE_PATH,
  resolveContainedPath,
  readPortableCoreContract
} from "./quality-policy/portable-core-contract.mjs";
import { readJsonPolicy } from "./quality-policy/read-json-policy.mjs";

/** @typedef {{ path: string, kind: string, detail?: string }} SharedCoreFinding */
/** @typedef {{ ok: boolean, checkedEntries: number, contractPaths: number, findings: number }} SharedCoreSummary */
/** @typedef {{ root?: string, print?: boolean }} SharedCoreCheckOptions */

/**
 * @param {SharedCoreCheckOptions} [options]
 * @returns {{ summary: SharedCoreSummary, findings: SharedCoreFinding[], entries: Record<string, string> }}
 */
export function runSharedCoreCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  /** @type {SharedCoreFinding[]} */
  const findings = [];
  /** @type {Record<string, string>} */
  let entries = {};
  let contract;

  try {
    contract = readPortableCoreContract(root);
  } catch (error) {
    findings.push({ path: CONTRACT_PATH, kind: "contract", detail: errorMessage(error) });
    return report(findings, entries, 0, options.print !== false);
  }

  const contractPaths = new Set(contract.mandatoryPaths);
  for (const relativePath of contract.metadataPaths) {
    try {
      resolveContainedPath(root, relativePath);
    } catch (error) {
      findings.push({ path: relativePath, kind: "escaping", detail: errorMessage(error) });
    }
  }

  let manifest;
  try {
    const manifestPath = resolveContainedPath(root, MANIFEST_PATH);
    manifest = readJsonPolicy(manifestPath);
    entries = parseEntries(manifest, findings);
    checkSignature(root, findings);
  } catch (error) {
    findings.push({ path: MANIFEST_PATH, kind: "manifest", detail: errorMessage(error) });
    return report(findings, entries, contractPaths.size, options.print !== false);
  }

  const entryPaths = Object.keys(entries);
  const expectedPaths = [...contractPaths].sort(comparePaths);
  const sortedEntryPaths = [...entryPaths].sort(comparePaths);
  if (entryPaths.some((entryPath, index) => entryPath !== sortedEntryPaths[index])) {
    findings.push({ path: MANIFEST_PATH, kind: "ordering", detail: "Manifest entries must be sorted by path." });
  }

  for (const relativePath of expectedPaths) {
    if (!Object.prototype.hasOwnProperty.call(entries, relativePath)) {
      findings.push({ path: relativePath, kind: "missing" });
      continue;
    }
    checkEntry(root, relativePath, entries[relativePath], findings);
  }

  for (const relativePath of entryPaths) {
    if (!contractPaths.has(relativePath) && !contract.metadataPaths.includes(relativePath)) {
      findings.push({ path: relativePath, kind: "extra" });
    }
  }

  checkRoleCompleteness(root, contract, findings);
  const summary = report(findings, entries, contractPaths.size, options.print !== false);
  return summary;
}

/** @param {any} manifest @param {SharedCoreFinding[]} findings @returns {Record<string, string>} */
function parseEntries(manifest, findings) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    findings.push({ path: MANIFEST_PATH, kind: "manifest", detail: "Manifest must be an object." });
    return {};
  }
  if (!manifest.entries || typeof manifest.entries !== "object" || Array.isArray(manifest.entries)) {
    findings.push({
      path: MANIFEST_PATH,
      kind: "manifest",
      detail: "Manifest entries must be a path-to-digest object."
    });
    return {};
  }
  /** @type {Record<string, string>} */
  const entries = {};
  for (const [relativePath, digest] of Object.entries(manifest.entries)) {
    try {
      resolveManifestPath(relativePath);
    } catch (error) {
      findings.push({ path: relativePath, kind: "escaping", detail: errorMessage(error) });
    }
    if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
      findings.push({
        path: relativePath,
        kind: "digest",
        detail: "Manifest digests must be lowercase SHA-256 values."
      });
    }
    entries[relativePath] = digest;
  }
  return entries;
}

/** @param {string} relativePath @returns {void} */
function resolveManifestPath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    relativePath.startsWith("../") ||
    relativePath.includes("/../") ||
    relativePath.endsWith("/..")
  ) {
    throw new Error("Manifest path is not a normalized repository-relative path.");
  }
}

/** @param {string} root @param {string} relativePath @param {string} expectedDigest @param {SharedCoreFinding[]} findings @returns {void} */
function checkEntry(root, relativePath, expectedDigest, findings) {
  let absolutePath;
  try {
    absolutePath = resolveContainedPath(root, relativePath);
  } catch (error) {
    findings.push({ path: relativePath, kind: "escaping", detail: errorMessage(error) });
    return;
  }
  if (!fs.existsSync(absolutePath)) {
    findings.push({ path: relativePath, kind: "missing" });
    return;
  }
  if (!fs.statSync(absolutePath).isFile()) {
    findings.push({ path: relativePath, kind: "not-file" });
    return;
  }
  const actualDigest = sha256File(absolutePath);
  if (actualDigest !== expectedDigest) {
    findings.push({
      path: relativePath,
      kind: "mismatch",
      detail: `expected ${expectedDigest}, found ${actualDigest}`
    });
  }
}

/** @param {string} root @param {any} contract @param {SharedCoreFinding[]} findings @returns {void} */
function checkRoleCompleteness(root, contract, findings) {
  const mandatory = new Set(contract.mandatoryPaths);
  for (const [role, paths] of Object.entries(contract.mandatoryRoles)) {
    for (const relativePath of paths) {
      if (!mandatory.has(relativePath)) {
        findings.push({ path: relativePath, kind: "contract", detail: `role '${role}' is not in mandatoryPaths` });
      }
    }
  }
  for (const [relativePath, exports] of Object.entries(contract.requiredCheckerExports)) {
    if (!mandatory.has(relativePath)) {
      findings.push({ path: relativePath, kind: "contract", detail: "checker export path is not mandatory" });
    }
    let absolutePath;
    try {
      absolutePath = resolveContainedPath(root, relativePath);
    } catch (error) {
      findings.push({ path: relativePath, kind: "escaping", detail: errorMessage(error) });
      continue;
    }
    if (!fs.existsSync(absolutePath)) continue;
    const source = fs.readFileSync(absolutePath, "utf8");
    for (const exportName of exports) {
      if (!new RegExp(`export (?:async )?function ${exportName}\\b|export \\{[^}]*\\b${exportName}\\b`).test(source)) {
        findings.push({
          path: relativePath,
          kind: "export",
          detail: `required checker exports no run*() function: ${exportName} is missing`
        });
      }
    }
  }
  for (const relativePath of Object.values(contract.requiredSelfTestRoles)) {
    let absolutePath;
    try {
      absolutePath = resolveContainedPath(root, relativePath);
    } catch (error) {
      findings.push({ path: relativePath, kind: "escaping", detail: errorMessage(error) });
      continue;
    }
    if (!fs.existsSync(absolutePath)) {
      findings.push({ path: relativePath, kind: "self-test", detail: "no referencing self-test found" });
    }
  }
}

/**
 * Run only checker-export and self-test preconditions from the local contract.
 * @param {SharedCoreCheckOptions} [options]
 * @returns {{ok: boolean, findings: Array<SharedCoreFinding & {reason: string}>, checkedEntries: number}}
 */
export function runManifestPreconditionCheck(options = {}) {
  const result = runSharedCoreCheck({ ...options, print: false });
  const findings = result.findings
    .filter((finding) => finding.kind === "export" || finding.kind === "self-test")
    .map((finding) => ({ ...finding, reason: finding.detail || finding.kind }));
  const output = { ok: findings.length === 0, findings, checkedEntries: result.summary.checkedEntries };
  if (options.print !== false) console.log(`Manifest precondition check ${output.ok ? "passed" : "failed"}.`);
  return output;
}

/** @param {string} root @param {SharedCoreFinding[]} findings @returns {void} */
function checkSignature(root, findings) {
  const manifestPath = resolveContainedPath(root, MANIFEST_PATH);
  const signaturePath = resolveContainedPath(root, SIGNATURE_PATH);
  if (!fs.existsSync(signaturePath)) {
    findings.push({ path: SIGNATURE_PATH, kind: "signature", detail: "Manifest signature is missing." });
    return;
  }
  const expected = createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");
  const actual = fs.readFileSync(signaturePath, "utf8");
  if (actual !== expected && actual !== `${expected}\n`) {
    findings.push({
      path: SIGNATURE_PATH,
      kind: "signature",
      detail: "Manifest signature does not match exact manifest bytes."
    });
  }
}

/** @param {SharedCoreFinding[]} findings @param {Record<string, string>} entries @param {number} contractPaths @param {boolean} print @returns {{summary: SharedCoreSummary, findings: SharedCoreFinding[], entries: Record<string, string>}} */
function report(findings, entries, contractPaths, print) {
  const summary = {
    ok: findings.length === 0,
    checkedEntries: Object.keys(entries).length,
    contractPaths,
    findings: findings.length
  };
  if (print) {
    for (const finding of findings) {
      console.error(`[shared-core] ${finding.path}: ${finding.kind}${finding.detail ? ` (${finding.detail})` : ""}`);
    }
    const printSummary = summary.ok ? console.log : console.error;
    printSummary("SUMMARY_JSON=" + JSON.stringify(summary));
  }
  return { summary, findings, entries };
}

/** @param {string} absolutePath @returns {string} */
function sha256File(absolutePath) {
  return createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {string} left @param {string} right @returns {number} */
function comparePaths(left, right) {
  return left.localeCompare(right);
}

/** @returns {boolean} */
function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntrypoint()) {
  const { summary } = runSharedCoreCheck({ root: process.cwd(), print: true });
  process.exitCode = summary.ok ? 0 : 1;
}

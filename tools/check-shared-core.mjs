#!/usr/bin/env node

/**
 * Verify the local portable-core contract, manifest signature, entry digests, and self-test preconditions.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readJson } from "./portable-core/json.mjs";
import { listRegularFiles, resolveContainedPath } from "./portable-core/path-policy.mjs";
import { CANONICAL_GENERIC_RULE_IDS } from "./check-patterns/generic/canonical-rule-ids.mjs";

const CONTRACT_REL = "tools/quality-policy/portable-core-contract.json";
const MANIFEST_REL = "tools/quality-policy/shared-core-manifest.json";
const SIGNATURE_REL = "tools/quality-policy/shared-core-manifest.sha256";

/** @typedef {{path: string, reason: string}} SharedCoreFinding */
/** @typedef {{ok: boolean, findings: SharedCoreFinding[], checkedEntries: number}} SharedCoreResult */
/** @typedef {{root?: string, print?: boolean}} SharedCoreOptions */

/**
 * @param {string} source
 * @returns {string}
 */
function hashBytes(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

/**
 * @param {string} root
 * @param {string} relativePath
 * @returns {{value: unknown} | {error: string}}
 */
function readLocalJson(root, relativePath) {
  const contained = resolveContainedPath(root, relativePath);
  if (!contained.ok) return { error: `${relativePath}: ${contained.reason}` };
  if (!fs.existsSync(contained.absolutePath)) return { error: `${relativePath}: missing on disk` };
  const result = readJson(contained.absolutePath);
  return result.ok ? { value: result.value } : { error: `${relativePath}: ${result.error}` };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {string[]}
 */
function stringArray(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${name} must be an array of strings`);
  }
  return /** @type {string[]} */ (value);
}

/**
 * @param {unknown} value
 * @returns {{mandatoryPaths: string[], metadataPaths: string[], profileSchemas: string[], checkerExports: Array<{path: string, exports: string[]}>, selfTests: string[]}}
 */
function contractParts(value) {
  if (!isObject(value)) throw new Error("portable-core contract must be an object");
  if (value.schemaVersion !== 1) throw new Error("portable-core contract has an unknown schema version");
  const mandatoryPaths = stringArray(value.mandatoryPaths, "mandatoryPaths");
  const metadataPaths = stringArray(value.metadataPaths, "metadataPaths");
  const canonicalRuleIds = stringArray(value.canonicalRuleIds, "canonicalRuleIds");
  if (JSON.stringify(canonicalRuleIds) !== JSON.stringify(CANONICAL_GENERIC_RULE_IDS)) {
    throw new Error("portable-core contract has noncanonical generic rule identifiers");
  }
  const profileSchemas = Array.isArray(value.profileSchemas)
    ? value.profileSchemas.map((entry) => {
        if (!isObject(entry) || typeof entry.path !== "string" || entry.schemaVersion !== 1) {
          throw new Error("profileSchemas contains a malformed entry");
        }
        return entry.path;
      })
    : [];
  const mandatoryRoles = Array.isArray(value.mandatoryRoles) ? value.mandatoryRoles : [];
  if (mandatoryRoles.length < 16) throw new Error("portable-core contract is missing mandatory roles");
  const rolePaths = new Set();
  for (const role of mandatoryRoles) {
    if (!isObject(role) || typeof role.name !== "string") throw new Error("mandatoryRoles contains a malformed role");
    for (const rolePath of stringArray(role.paths, "role paths")) rolePaths.add(rolePath);
  }
  for (const mandatoryPath of mandatoryPaths) {
    if (!rolePaths.has(mandatoryPath)) throw new Error(`mandatory path has no role owner: ${mandatoryPath}`);
  }
  const checkerExports = Array.isArray(value.requiredCheckerExports)
    ? value.requiredCheckerExports.map((entry) => {
        if (!isObject(entry) || typeof entry.path !== "string" || !Array.isArray(entry.exports)) {
          throw new Error("requiredCheckerExports contains a malformed entry");
        }
        return { path: entry.path, exports: stringArray(entry.exports, "checker exports") };
      })
    : [];
  const roles = Array.isArray(value.requiredSelfTestRoles) ? value.requiredSelfTestRoles : [];
  const selfTests = roles.flatMap((entry) => (isObject(entry) ? stringArray(entry.tests, "self-test paths") : []));
  if (
    mandatoryPaths.length === 0 ||
    metadataPaths.length < 3 ||
    profileSchemas.length === 0 ||
    checkerExports.length === 0 ||
    selfTests.length === 0
  ) {
    throw new Error("portable-core contract has an incomplete mandatory inventory");
  }
  for (const schemaPath of profileSchemas) {
    if (!mandatoryPaths.includes(schemaPath)) throw new Error(`profile schema is not mandatory: ${schemaPath}`);
  }
  for (const checker of checkerExports) {
    if (!mandatoryPaths.includes(checker.path)) throw new Error(`checker path is not mandatory: ${checker.path}`);
  }
  return { mandatoryPaths, metadataPaths, profileSchemas, checkerExports, selfTests: [...new Set(selfTests)] };
}

/**
 * @param {string} root
 * @param {SharedCoreFinding[]} findings
 * @returns {boolean}
 */
function verifySignature(root, findings) {
  const manifestResult = resolveContainedPath(root, MANIFEST_REL);
  const signatureResult = resolveContainedPath(root, SIGNATURE_REL);
  if (!manifestResult.ok || !signatureResult.ok) {
    findings.push({ path: MANIFEST_REL, reason: "manifest metadata path escapes root" });
    return false;
  }
  const manifestPath = manifestResult.absolutePath;
  const signaturePath = signatureResult.absolutePath;
  if (!fs.existsSync(manifestPath)) {
    findings.push({ path: MANIFEST_REL, reason: "manifest is missing on disk" });
    return false;
  }
  if (!fs.existsSync(signaturePath)) {
    findings.push({ path: SIGNATURE_REL, reason: "manifest signature is missing on disk" });
    return false;
  }
  const signature = fs.readFileSync(signaturePath, "utf8");
  const actual = hashBytes(fs.readFileSync(manifestPath).toString("utf8"));
  if (!/^[0-9a-f]{64}\n?$/.test(signature) || (signature !== actual && signature !== `${actual}\n`)) {
    findings.push({ path: SIGNATURE_REL, reason: "manifest signature does not match exact manifest bytes" });
    return false;
  }
  return true;
}

/**
 * @param {string} root
 * @param {string} relativePath
 * @param {SharedCoreFinding[]} findings
 */
function verifyContainedFile(root, relativePath, findings) {
  const contained = resolveContainedPath(root, relativePath);
  if (!contained.ok) {
    findings.push({ path: relativePath, reason: contained.reason });
    return;
  }
  if (!fs.existsSync(contained.absolutePath)) {
    const reason = relativePath.startsWith("tests/")
      ? "no referencing self-test found"
      : "mandatory path is missing on disk";
    findings.push({ path: relativePath, reason });
    return;
  }
  if (!fs.statSync(contained.absolutePath).isFile())
    findings.push({ path: relativePath, reason: "path is not a file" });
}

/**
 * @param {string} root
 * @param {Array<{path: string, exports: string[]}>} required
 * @param {SharedCoreFinding[]} findings
 */
function verifyCheckerExports(root, required, findings) {
  for (const checker of required) {
    const contained = resolveContainedPath(root, checker.path);
    if (!contained.ok || !fs.existsSync(contained.absolutePath)) {
      findings.push({ path: checker.path, reason: "required checker path is missing or escapes root" });
      continue;
    }
    const source = fs.readFileSync(contained.absolutePath, "utf8");
    for (const name of checker.exports) {
      if (!new RegExp(`export (?:async )?function ${name}\\b|export const ${name}\\b`).test(source)) {
        findings.push({
          path: checker.path,
          reason: `required checker exports no run*() function: ${name} is missing`
        });
      }
    }
  }
}

/**
 * Run the complete shared-core contract check against one repository root.
 * @param {SharedCoreOptions} [options]
 * @returns {SharedCoreResult}
 */
export function runSharedCoreCheck(options = {}) {
  const root = fs.realpathSync(path.resolve(options.root || process.cwd()));
  const print = options.print !== false;
  /** @type {SharedCoreFinding[]} */
  const findings = [];
  verifySignature(root, findings);
  const contractResult = readLocalJson(root, CONTRACT_REL);
  const manifestResult = readLocalJson(root, MANIFEST_REL);
  /** @type {Record<string, string>} */
  let entries = {};
  try {
    if ("error" in contractResult) throw new Error(contractResult.error);
    const parts = contractParts(contractResult.value);
    if ("error" in manifestResult) throw new Error(manifestResult.error);
    if (!isObject(manifestResult.value) || !isObject(manifestResult.value.entries)) {
      throw new Error("manifest entries must be an object");
    }
    entries = /** @type {Record<string, string>} */ (manifestResult.value.entries);
    const entryNames = Object.keys(entries);
    if (JSON.stringify(entryNames) !== JSON.stringify([...entryNames].sort())) {
      findings.push({ path: MANIFEST_REL, reason: "manifest entries are not sorted by path" });
    }
    const expected = new Set(parts.mandatoryPaths.filter((entry) => !parts.metadataPaths.includes(entry)));
    const actual = new Set(Object.keys(entries));
    for (const entry of expected)
      if (!actual.has(entry)) findings.push({ path: entry, reason: "mandatory path is absent from manifest" });
    for (const entry of actual)
      if (!expected.has(entry))
        findings.push({ path: entry, reason: "manifest contains an unplanned Tier 2 or unknown path" });
    for (const entry of expected) {
      const digest = entries[entry];
      if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
        findings.push({ path: entry, reason: "manifest digest is malformed" });
        continue;
      }
      const contained = resolveContainedPath(root, entry);
      if (!contained.ok) {
        findings.push({ path: entry, reason: contained.reason });
        continue;
      }
      if (!fs.existsSync(contained.absolutePath)) {
        findings.push({ path: entry, reason: "listed in manifest but missing on disk" });
        continue;
      }
      if (hashBytes(fs.readFileSync(contained.absolutePath).toString("utf8")) !== digest) {
        findings.push({ path: entry, reason: "digest mismatch: manifest does not match exact file bytes" });
      }
    }
    for (const entry of parts.mandatoryPaths) verifyContainedFile(root, entry, findings);
    verifyCheckerExports(root, parts.checkerExports, findings);
    for (const testPath of parts.selfTests) verifyContainedFile(root, testPath, findings);
    const listed = new Set(Object.keys(entries));
    const tier1Files = listRegularFiles(path.join(root, "tools", "portable-core"));
    for (const absolutePath of tier1Files) {
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (!listed.has(relativePath))
        findings.push({ path: relativePath, reason: "portable-core path is absent from manifest" });
    }
  } catch (error) {
    findings.push({ path: CONTRACT_REL, reason: error instanceof Error ? error.message : "contract is invalid" });
  }
  const result = { ok: findings.length === 0, findings, checkedEntries: Object.keys(entries).length };
  if (print) {
    if (result.ok) console.log(`Shared core check passed over ${result.checkedEntries} manifest entries.`);
    else for (const finding of findings) console.error(`[shared-core] ${finding.path}: ${finding.reason}`);
    console.log(
      "SUMMARY_JSON=" +
        JSON.stringify({ ok: result.ok, checkedEntries: result.checkedEntries, findings: findings.length })
    );
  }
  return result;
}

/**
 * Run only the export and self-test preconditions from the local contract.
 * @param {SharedCoreOptions} [options]
 * @returns {SharedCoreResult}
 */
export function runManifestPreconditionCheck(options = {}) {
  const result = runSharedCoreCheck({ ...options, print: false });
  const output = {
    ...result,
    findings: result.findings.filter(
      (finding) => finding.reason.includes("export") || finding.reason.includes("self-test")
    )
  };
  if (options.print !== false) console.log(`Manifest precondition check ${output.ok ? "passed" : "failed"}.`);
  return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exit(runSharedCoreCheck({ root: process.cwd(), print: true }).ok ? 0 : 1);
}

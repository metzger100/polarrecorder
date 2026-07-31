#!/usr/bin/env node

/**
 * @file portable-core-contract - Loads and validates the portable quality-core contract
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readJsonPolicy } from "./read-json-policy.mjs";

export const CONTRACT_PATH = "tools/quality-policy/portable-core-contract.json";
export const MANIFEST_PATH = "tools/quality-policy/shared-core-manifest.json";
export const SIGNATURE_PATH = "tools/quality-policy/shared-core-manifest.sha256";
export const CONTRACT_SCHEMA_PATH = "schemas/portable-core-contract.schema.json";

/** @typedef {{path: string, kind: string, detail?: string}} PortableCoreFinding */

/**
 * @param {string} root
 * @param {string} relativePath
 * @returns {string}
 */
export function resolveContainedPath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("Portable-core paths must be non-empty strings.");
  }

  const normalized = relativePath.replace(/\\/g, "/");
  if (
    normalized !== relativePath ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..")
  ) {
    throw new Error(`Portable-core path escapes the repository root: '${relativePath}'.`);
  }

  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, normalized);
  if (!isContained(absoluteRoot, absolutePath)) {
    throw new Error(`Portable-core path escapes the repository root: '${relativePath}'.`);
  }

  const realRoot = fs.realpathSync(absoluteRoot);
  const realPath = realpathWithMissingLeaf(absolutePath);
  if (!isContained(realRoot, realPath)) {
    throw new Error(`Portable-core path resolves outside the repository root: '${relativePath}'.`);
  }
  return absolutePath;
}

/** @param {string} root @returns {any} */
export function readPortableCoreContract(root) {
  const contractPath = resolveContainedPath(root, CONTRACT_PATH);
  const contract = readJsonPolicy(contractPath);
  validateContractShape(contract);
  return contract;
}

/** @param {any} contract @returns {void} */
export function validateContractShape(contract) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    throw new Error("Portable-core contract must be a JSON object.");
  }
  if (contract.schemaVersion !== 1 || typeof contract.coreVersion !== "string") {
    throw new Error("Portable-core contract has an unsupported schema or core version.");
  }
  const allowedKeys = new Set([
    "schemaVersion",
    "coreVersion",
    "mandatoryRoles",
    "mandatoryPaths",
    "metadataPaths",
    "profileSchemas",
    "canonicalRuleIds",
    "requiredCheckerExports",
    "requiredSelfTestRoles"
  ]);
  const unknownKeys = Object.keys(contract).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0)
    throw new Error(`Portable-core contract has unknown field(s): ${unknownKeys.join(", ")}.`);
  const arrays = ["mandatoryPaths", "metadataPaths", "profileSchemas", "canonicalRuleIds"];
  for (const key of arrays) {
    if (!Array.isArray(contract[key]) || contract[key].length === 0) {
      throw new Error(`Portable-core contract field '${key}' must be a non-empty array.`);
    }
    assertUnique(contract[key], key);
  }
  if (!contract.mandatoryRoles || typeof contract.mandatoryRoles !== "object") {
    throw new Error("Portable-core contract must declare mandatory roles.");
  }
  if (Object.keys(contract.mandatoryRoles).length < 16) {
    throw new Error("Portable-core contract is missing mandatory roles.");
  }
  for (const [role, paths] of Object.entries(contract.mandatoryRoles)) {
    if (!Array.isArray(paths) || paths.length === 0) throw new Error(`Role '${role}' has no paths.`);
    assertUnique(paths, `mandatoryRoles.${role}`);
    for (const relativePath of paths) assertPortableRelativePath(relativePath, `role '${role}'`);
  }
  for (const key of ["mandatoryPaths", "metadataPaths", "profileSchemas"]) {
    for (const relativePath of contract[key]) assertPortableRelativePath(relativePath, key);
  }
  assertUnique(contract.canonicalRuleIds, "canonicalRuleIds");
  if (contract.canonicalRuleIds.length !== 21) {
    throw new Error("Portable-core contract must declare exactly 21 canonical rule identifiers.");
  }
  if (!contract.requiredCheckerExports || typeof contract.requiredCheckerExports !== "object") {
    throw new Error("Portable-core contract must declare checker exports.");
  }
  for (const [relativePath, exports] of Object.entries(contract.requiredCheckerExports)) {
    assertPortableRelativePath(relativePath, "requiredCheckerExports");
    if (!Array.isArray(exports) || exports.length === 0) throw new Error(`Checker '${relativePath}' has no exports.`);
  }
  if (!contract.requiredSelfTestRoles || typeof contract.requiredSelfTestRoles !== "object") {
    throw new Error("Portable-core contract must declare self-test roles.");
  }
  for (const relativePath of Object.values(contract.requiredSelfTestRoles)) {
    assertPortableRelativePath(relativePath, "requiredSelfTestRoles");
  }
}

/** @param {any} values @param {string} label @returns {void} */
function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate value in portable-core '${label}'.`);
}

/** @param {any} value @param {string} label @returns {void} */
function assertPortableRelativePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    value === "." ||
    value.startsWith("../") ||
    value.includes("/../") ||
    value.endsWith("/..")
  ) {
    throw new Error(`Invalid portable-core path '${String(value)}' in ${label}.`);
  }
}

/** @param {string} root @param {Record<string, string>} entries @returns {{coreVersion: string, manifestSha256: string, genericRulesSha256: string, entries: Record<string, string>}} */
export function buildAttestation(root, entries) {
  const contract = readPortableCoreContract(root);
  const manifestPath = resolveContainedPath(root, MANIFEST_PATH);
  const manifestSha256 = createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");
  return {
    coreVersion: contract.coreVersion,
    manifestSha256,
    genericRulesSha256: hashGenericRules(root),
    entries
  };
}

/** @param {string} root @returns {string} */
function hashGenericRules(root) {
  const genericRoot = resolveContainedPath(root, "tools/check-patterns/generic");
  if (!fs.statSync(genericRoot).isDirectory()) throw new Error("Generic rule path must be a directory.");
  /** @type {string[]} */
  const files = [];
  /** @param {string} directory */
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
    }
  }
  visit(genericRoot);
  if (files.length === 0) throw new Error("Generic rule directory must not be empty.");
  const hash = createHash("sha256");
  for (const absolutePath of files.sort()) {
    hash.update(path.relative(genericRoot, absolutePath).split(path.sep).join("/"));
    hash.update("\0");
    hash.update(fs.readFileSync(absolutePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** @param {string} absolutePath @returns {string} */
function realpathWithMissingLeaf(absolutePath) {
  if (fs.existsSync(absolutePath)) return fs.realpathSync(absolutePath);
  const parent = path.dirname(absolutePath);
  return path.join(fs.realpathSync(parent), path.basename(absolutePath));
}

/** @param {string} root @param {string} candidate @returns {boolean} */
function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

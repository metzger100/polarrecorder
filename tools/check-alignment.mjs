#!/usr/bin/env node

/**
 * @file check-alignment - validates the neutral cross-project inventory and optional peer comparison.
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { runPortableCoreAttestation } from "./portable-core-attest.mjs";
import { readPortableCoreContract } from "./quality-policy/portable-core-contract.mjs";
import { readQualityBoundary, runProfileContractCheck } from "./portable-core/gate-role-engine.mjs";

const INVENTORY_PATH = "tools/quality-policy/alignment-inventory.json";
const SHARED_PATHS = "portable-identical";
const CLASSIFICATIONS = new Set(["portable-identical", "profile-owned", "adapter-owned", "remove"]);
const PACKAGE_ROOTS = ["dependencies", "devDependencies", "optionalDependencies"];
const BUILTIN_PREFIX = "node:";
const PACKAGE_IMPORT =
  /(?:import\s+(?:[^"']+?\s+from\s+|["']|)|export\s+[^"']+?\s+from\s+|require\(\s*)["']([^"']+)["']/g;
const SKIP_DIRS = new Set([
  ".git",
  "coverage",
  "node_modules",
  "releases",
  "venv",
  ".venv",
  ".quality-cache",
  "test-data",
  "lint-fixtures"
]);

/** @typedef {{path: string, kind: string, detail?: string}} AlignmentFinding */

/** @param {{root?: string, peerRoot?: string, print?: boolean}} [options] */
export function runAlignmentCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const peerRoot = options.peerRoot ? path.resolve(options.peerRoot) : undefined;
  /** @type {AlignmentFinding[]} */
  const findings = [];
  const local = inspectRepository(root, findings);
  if (peerRoot) {
    /** @type {AlignmentFinding[]} */
    const peerFindings = [];
    const peer = inspectRepository(peerRoot, peerFindings);
    findings.push(...peerFindings.map((finding) => ({ ...finding, path: `peer:${finding.path}` })));
    compareShared(root, peerRoot, local.sharedPaths, findings);
    compareAttestation(local.attestation, peer.attestation, findings);
  }
  const result = { ok: findings.length === 0, findings };
  if (options.print !== false) {
    for (const finding of findings) {
      console.error(`[alignment] ${finding.path}: ${finding.kind}${finding.detail ? ` (${finding.detail})` : ""}`);
    }
    console.log(
      `SUMMARY_JSON=${JSON.stringify({ ok: result.ok, findings: findings.length, peer: Boolean(peerRoot) })}`
    );
  }
  return result;
}

/** @param {string} root @param {AlignmentFinding[]} findings */
function inspectRepository(root, findings) {
  const inventory = readJson(root, INVENTORY_PATH, findings);
  const sharedPaths = new Set();
  let attestation = null;
  if (!inventory) return { sharedPaths, attestation };
  validateInventory(inventory, findings);
  for (const relativePath of inventory[SHARED_PATHS] || []) sharedPaths.add(relativePath);
  try {
    const contract = readPortableCoreContract(root);
    for (const relativePath of contract.mandatoryPaths) sharedPaths.add(relativePath);
  } catch (error) {
    findings.push({
      path: "tools/quality-policy/portable-core-contract.json",
      kind: "contract",
      detail: errorMessage(error)
    });
  }
  for (const relativePath of sharedPaths) checkFile(root, relativePath, "shared-path", findings);
  const boundary = readBoundary(root, findings);
  if (boundary) {
    findings.push(...runProfileContractCheck(boundary.profile, { root }).findings);
  }
  checkInventoryPaths(root, inventory, findings);
  checkDirectDependencies(root, findings);
  try {
    attestation = runPortableCoreAttestation({ root, print: false });
  } catch (error) {
    findings.push({ path: "tools/portable-core-attest.mjs", kind: "attestation", detail: errorMessage(error) });
  }
  return { sharedPaths, attestation };
}

/** @param {string} root @param {string} relativePath @param {string} kind @param {AlignmentFinding[]} findings */
function checkFile(root, relativePath, kind, findings) {
  if (!isRelativePath(relativePath)) {
    findings.push({ path: relativePath || "<empty>", kind: "path", detail: `${kind} must be repository-relative` });
    return;
  }
  const absolutePath = path.resolve(root, relativePath);
  if (!isContained(root, absolutePath)) {
    findings.push({ path: relativePath, kind: "path", detail: `${kind} escapes repository root` });
    return;
  }
  if (!fs.existsSync(absolutePath)) findings.push({ path: relativePath, kind: "stale-path" });
  else if (!fs.statSync(absolutePath).isFile())
    findings.push({ path: relativePath, kind: "path-kind", detail: "expected file" });
}

/** @param {any} inventory @param {AlignmentFinding[]} findings */
function validateInventory(inventory, findings) {
  if (inventory.schemaVersion !== 1 || inventory.inventoryVersion !== 1) {
    findings.push({ path: INVENTORY_PATH, kind: "version", detail: "schemaVersion and inventoryVersion must be 1" });
  }
  const seen = new Set();
  for (const classification of CLASSIFICATIONS) {
    const entries = inventory[classification];
    if (!Array.isArray(entries)) {
      findings.push({ path: INVENTORY_PATH, kind: "classification", detail: `missing '${classification}' array` });
      continue;
    }
    for (const relativePath of entries) {
      if (typeof relativePath !== "string")
        findings.push({ path: INVENTORY_PATH, kind: "path", detail: "paths must be strings" });
      if (seen.has(relativePath)) findings.push({ path: relativePath, kind: "duplicate-owner" });
      seen.add(relativePath);
    }
  }
  if (!Array.isArray(inventory[SHARED_PATHS]) || inventory[SHARED_PATHS].length === 0) {
    findings.push({ path: INVENTORY_PATH, kind: "shared", detail: "portable-identical inventory must not be empty" });
  }
}

/** @param {string} root @param {any} inventory @param {AlignmentFinding[]} findings */
function checkInventoryPaths(root, inventory, findings) {
  for (const classification of CLASSIFICATIONS) {
    for (const relativePath of inventory[classification] || []) {
      checkFile(root, relativePath, `inventory:${classification}`, findings);
    }
  }
}

/** @param {string} root @param {AlignmentFinding[]} findings */
function checkDirectDependencies(root, findings) {
  const packageJson = readJson(root, "package.json", findings);
  if (!packageJson) return;
  const declared = new Set();
  for (const key of PACKAGE_ROOTS) {
    for (const name of Object.keys(packageJson[key] || {})) declared.add(name);
  }
  const files = listFiles(path.join(root, "tools"));
  files.push(
    ...fs
      .readdirSync(root)
      .filter((file) => /^eslint\.config\.(?:mjs|js)$|^vitest\.config\.(?:mjs|js)$/.test(file))
      .map((file) => path.join(root, file))
  );
  for (const absolutePath of files.filter((file) => /\.(?:js|mjs|cjs)$/.test(file))) {
    const source = fs.readFileSync(absolutePath, "utf8");
    let match;
    PACKAGE_IMPORT.lastIndex = 0;
    while ((match = PACKAGE_IMPORT.exec(source))) {
      const imported = match[1];
      if (imported.startsWith(".") || imported.startsWith("/") || imported.startsWith(BUILTIN_PREFIX)) continue;
      const packageName = imported.startsWith("@") ? imported.split("/", 2).join("/") : imported.split("/", 1)[0];
      if (!declared.has(packageName)) {
        findings.push({ path: relative(root, absolutePath), kind: "undeclared-dependency", detail: packageName });
      }
    }
  }
}

/** @param {string} root @param {AlignmentFinding[]} findings */
function readBoundary(root, findings) {
  try {
    return readQualityBoundary(root);
  } catch (error) {
    findings.push({ path: "tools/quality-policy/project-profile.json", kind: "profile", detail: errorMessage(error) });
    return null;
  }
}

/** @param {string} root @param {string} relativePath @param {AlignmentFinding[]} findings */
function readJson(root, relativePath, findings) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    findings.push({ path: relativePath, kind: "read", detail: errorMessage(error) });
    return null;
  }
}

/** @param {string} root @returns {string[]} */
function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) return [];
    const absolutePath = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
  });
}

/** @param {string} root @param {string} peerRoot @param {Set<string>} paths @param {AlignmentFinding[]} findings */
function compareShared(root, peerRoot, paths, findings) {
  for (const relativePath of paths) {
    const left = path.join(root, relativePath);
    const right = path.join(peerRoot, relativePath);
    if (!fs.existsSync(right)) {
      findings.push({ path: relativePath, kind: "peer-missing" });
      continue;
    }
    if (!fs.existsSync(left)) continue;
    const leftDigest = sha256File(left);
    const rightDigest = sha256File(right);
    if (leftDigest !== rightDigest)
      findings.push({ path: relativePath, kind: "peer-mismatch", detail: `${leftDigest} != ${rightDigest}` });
  }
}

/** @param {any} left @param {any} right @param {AlignmentFinding[]} findings */
function compareAttestation(left, right, findings) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    findings.push({ path: "portable-core-attestation", kind: "peer-mismatch", detail: "attestation records differ" });
  }
}

/** @param {string} root @param {string} absolutePath @returns {string} */
function relative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

/** @param {string} root @param {string} candidate @returns {boolean} */
function isContained(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(".." + path.sep) && relativePath !== ".." && !path.isAbsolute(relativePath))
  );
}

/** @param {string} value @returns {boolean} */
function isRelativePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\\") &&
    !path.posix.isAbsolute(value) &&
    !value.startsWith("../") &&
    !value.includes("/../") &&
    value !== "."
  );
}

/** @param {string} file @returns {string} */
function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

if (pathToFileURL(path.resolve(process.argv[1] || "")).href === import.meta.url) {
  const peerArg = process.argv.find((argument) => argument.startsWith("--peer="));
  process.exitCode = runAlignmentCheck({ peerRoot: peerArg?.slice("--peer=".length) }).ok ? 0 : 1;
}

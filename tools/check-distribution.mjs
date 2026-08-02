#!/usr/bin/env node

/**
 * @file check-distribution - verifies the neutral vendored distribution manifest.
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { runPortableCoreAttestation } from "./portable-core-attest.mjs";
import { runDistributionMaterialization } from "./regenerate-distribution-manifest.mjs";

const MANIFEST_PATH = "tools/quality-policy/distribution-manifest.json";
const PRODUCT_TOKENS = /dyninstruments|polarrecorder|polar\s+recorder|viewer-widget|python-plus-browser/i;

/** @typedef {{path: string, kind: string, detail?: string}} DistributionFinding */

/** @param {{root?: string, peerRoot?: string, print?: boolean}} [options] */
export function runDistributionCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const peerRoot = options.peerRoot ? path.resolve(options.peerRoot) : undefined;
  /** @type {DistributionFinding[]} */
  const findings = [];
  const local = inspect(root, findings);
  if (peerRoot) {
    /** @type {DistributionFinding[]} */
    const peerFindings = [];
    const peer = inspect(peerRoot, peerFindings);
    findings.push(...peerFindings.map((finding) => ({ ...finding, path: `peer:${finding.path}` })));
    if (JSON.stringify(local.manifest) !== JSON.stringify(peer.manifest)) {
      findings.push({ path: MANIFEST_PATH, kind: "peer-mismatch", detail: "distribution manifests differ" });
    }
  }
  const result = { ok: findings.length === 0, findings };
  if (options.print !== false) {
    for (const finding of findings)
      console.error(`[distribution] ${finding.path}: ${finding.kind}${finding.detail ? ` (${finding.detail})` : ""}`);
    console.log(
      `SUMMARY_JSON=${JSON.stringify({ ok: result.ok, findings: findings.length, peer: Boolean(peerRoot) })}`
    );
  }
  return result;
}

/** @param {string} root @param {DistributionFinding[]} findings */
function inspect(root, findings) {
  try {
    if (!runDistributionMaterialization({ root, print: false }).ok)
      findings.push({ path: "tools/quality-policy/distribution-manifest.json", kind: "source-stale" });
  } catch (error) {
    findings.push({
      path: "tools/quality-policy/distribution-source.json",
      kind: "source",
      detail: errorMessage(error)
    });
  }
  const manifest = readManifest(root, findings);
  if (!manifest) return { manifest: null };
  if (manifest.schemaVersion !== 1 || manifest.distributionVersion !== "1.0.0") {
    findings.push({ path: MANIFEST_PATH, kind: "version", detail: "unsupported distribution version" });
  }
  if (
    manifest.sourceOwner !== "avnav-plugin-ai-environment" ||
    manifest.materialization !== "vendored-contract-output"
  ) {
    findings.push({ path: MANIFEST_PATH, kind: "owner", detail: "neutral source owner/materialization is required" });
  }
  if (PRODUCT_TOKENS.test(JSON.stringify(manifest))) {
    findings.push({ path: MANIFEST_PATH, kind: "product-token", detail: "distribution metadata must remain neutral" });
  }
  const paths = manifest.paths;
  if (!paths || typeof paths !== "object" || Array.isArray(paths) || Object.keys(paths).length === 0) {
    findings.push({ path: MANIFEST_PATH, kind: "paths", detail: "materialized paths are required" });
  } else {
    const sorted = Object.keys(paths).sort();
    if (JSON.stringify(Object.keys(paths)) !== JSON.stringify(sorted)) {
      findings.push({ path: MANIFEST_PATH, kind: "ordering", detail: "paths must be sorted" });
    }
    for (const [relativePath, expectedDigest] of Object.entries(paths))
      checkPath(root, relativePath, expectedDigest, findings);
  }
  try {
    const attestation = runPortableCoreAttestation({ root, print: false });
    if (JSON.stringify(attestation).includes("undefined")) findings.push({ path: MANIFEST_PATH, kind: "attestation" });
    const attestationValues =
      /** @type {{coreVersion?: string, manifestSha256?: string, genericRulesSha256?: string}} */ (attestation);
    const attestationKeys = /** @type {Array<"coreVersion" | "manifestSha256" | "genericRulesSha256">} */ ([
      "coreVersion",
      "manifestSha256",
      "genericRulesSha256"
    ]);
    for (const key of attestationKeys) {
      if (manifest.portableCore?.[key] !== attestationValues[key]) {
        findings.push({ path: MANIFEST_PATH, kind: "core-mismatch", detail: key });
      }
    }
  } catch (error) {
    findings.push({ path: MANIFEST_PATH, kind: "attestation", detail: errorMessage(error) });
  }
  return { manifest };
}

/** @param {string} root @param {string} relativePath @param {unknown} expectedDigest @param {DistributionFinding[]} findings */
function checkPath(root, relativePath, expectedDigest, findings) {
  if (!isRelativePath(relativePath) || typeof expectedDigest !== "string" || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
    findings.push({
      path: String(relativePath),
      kind: "path",
      detail: "normalized path and SHA-256 digest are required"
    });
    return;
  }
  const absolutePath = path.resolve(root, relativePath);
  if (!isContained(root, absolutePath)) {
    findings.push({ path: relativePath, kind: "path", detail: "path escapes repository root" });
    return;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    findings.push({ path: relativePath, kind: "missing" });
    return;
  }
  const actual = createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
  if (actual !== expectedDigest)
    findings.push({ path: relativePath, kind: "mismatch", detail: `${expectedDigest} != ${actual}` });
}

/** @param {string} root @param {DistributionFinding[]} findings */
function readManifest(root, findings) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, MANIFEST_PATH), "utf8"));
  } catch (error) {
    findings.push({ path: MANIFEST_PATH, kind: "read", detail: errorMessage(error) });
    return null;
  }
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

/** @param {string} root @param {string} candidate @returns {boolean} */
function isContained(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(".." + path.sep) && relativePath !== ".." && !path.isAbsolute(relativePath))
  );
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

if (pathToFileURL(path.resolve(process.argv[1] || "")).href === import.meta.url) {
  const peerArg = process.argv.find((argument) => argument.startsWith("--peer="));
  process.exitCode = runDistributionCheck({ peerRoot: peerArg?.slice("--peer=".length) }).ok ? 0 : 1;
}

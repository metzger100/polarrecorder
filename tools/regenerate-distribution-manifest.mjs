#!/usr/bin/env node

/**
 * Deterministically materialize the neutral distribution manifest from its source-owner descriptor.
 * This is maintainer tooling; required gates use --check and never rewrite repository state.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { runPortableCoreAttestation } from "./portable-core-attest.mjs";

const SOURCE_PATH = "tools/quality-policy/distribution-source.json";
const MANIFEST_PATH = "tools/quality-policy/distribution-manifest.json";
const NEUTRAL_OWNER = "avnav-plugin-ai-environment";
const MATERIALIZATION = "vendored-contract-output";
const PRODUCT_TOKEN = /dyninstruments|polarrecorder|polar\s+recorder|viewer-widget|python-plus-browser/i;

/** @typedef {{schemaVersion: number, distributionVersion: string, sourceOwner: string, materialization: string, paths: string[]}} DistributionSource */

/** @param {{root?: string, write?: boolean, print?: boolean}} [options] */
export function runDistributionMaterialization(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const source = readSource(root);
  const manifest = buildManifest(root, source);
  const manifestPath = path.join(root, MANIFEST_PATH);
  const expectedText = `${JSON.stringify(manifest, null, 2)}\n`;
  const currentText = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf8") : "";
  const matches = currentText === expectedText;
  if (options.write) fs.writeFileSync(manifestPath, expectedText, "utf8");
  const ok = options.write || matches;
  if (options.print !== false) {
    if (!ok) console.error(`Distribution manifest is stale; run npm run distribution:source:write.`);
    console.log(`SUMMARY_JSON=${JSON.stringify({ ok, write: Boolean(options.write), paths: source.paths.length })}`);
  }
  return { ok, manifest, source };
}

/** @param {string} root @returns {DistributionSource} */
function readSource(root) {
  const source = /** @type {DistributionSource} */ (JSON.parse(fs.readFileSync(path.join(root, SOURCE_PATH), "utf8")));
  return validateDistributionSource(source);
}

/** @param {DistributionSource} source @returns {DistributionSource} */
export function validateDistributionSource(source) {
  if (source.schemaVersion !== 1 || source.distributionVersion !== "1.0.0")
    throw new Error("unsupported distribution source version");
  if (source.sourceOwner !== NEUTRAL_OWNER || source.materialization !== MATERIALIZATION)
    throw new Error("distribution source owner/materialization is not neutral");
  if (!Array.isArray(source.paths) || source.paths.length === 0)
    throw new Error("distribution source paths are required");
  const sorted = [...source.paths].sort();
  if (JSON.stringify(source.paths) !== JSON.stringify(sorted))
    throw new Error("distribution source paths must be sorted");
  if (new Set(source.paths).size !== source.paths.length) throw new Error("distribution source paths must be unique");
  if (source.paths.some((relativePath) => !isRelativePath(relativePath)))
    throw new Error("distribution source paths must be repository-relative");
  if (PRODUCT_TOKEN.test(JSON.stringify(source))) throw new Error("distribution source contains a product token");
  return source;
}

/** @param {string} root @param {DistributionSource} source */
function buildManifest(root, source) {
  /** @type {Record<string, string>} */
  const paths = {};
  for (const relativePath of source.paths) {
    if (!isRelativePath(relativePath)) throw new Error(`invalid distribution source path: ${relativePath}`);
    const absolutePath = path.resolve(root, relativePath);
    if (!isContained(root, absolutePath) || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile())
      throw new Error(`distribution source path is missing: ${relativePath}`);
    paths[relativePath] = createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
  }
  const attestation = runPortableCoreAttestation({ root, print: false });
  return {
    schemaVersion: 1,
    distributionVersion: source.distributionVersion,
    sourceOwner: source.sourceOwner,
    materialization: source.materialization,
    portableCore: {
      coreVersion: attestation.coreVersion,
      manifestSha256: attestation.manifestSha256,
      genericRulesSha256: attestation.genericRulesSha256
    },
    paths
  };
}

/** @param {string} value @returns {boolean} */
function isRelativePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\\") &&
    !path.posix.isAbsolute(value) &&
    !value.startsWith("../") &&
    !value.includes("/../")
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

if (pathToFileURL(path.resolve(process.argv[1] || "")).href === import.meta.url) {
  const write = process.argv.includes("--write");
  process.exitCode = runDistributionMaterialization({ write }).ok ? 0 : 1;
}

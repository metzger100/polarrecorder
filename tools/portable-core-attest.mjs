#!/usr/bin/env node

/**
 * @file portable-core-attest - Emits the anonymous portable-core digest record
 * Documentation: documentation/conventions/quality-gates.md
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  MANIFEST_PATH,
  buildAttestation,
  readPortableCoreContract,
  resolveContainedPath
} from "./quality-policy/portable-core-contract.mjs";
import { readJsonPolicy } from "./quality-policy/read-json-policy.mjs";

/** @param {{root?: string, print?: boolean}} [options] @returns {{coreVersion: string, manifestSha256: string, genericRulesSha256: string, entries: Record<string, string>}} */
export function runPortableCoreAttestation(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  readPortableCoreContract(root);
  const manifest = readJsonPolicy(resolveContainedPath(root, MANIFEST_PATH));
  const entries = /** @type {Record<string, string>} */ (manifest.entries);
  const attestation = buildAttestation(root, entries);
  if (options.print !== false) process.stdout.write(JSON.stringify(attestation) + "\n");
  return attestation;
}

/** @param {{root?: string, print?: boolean}} [options] @returns {string} */
export function runPortableCoreAttest(options = {}) {
  const output = JSON.stringify(runPortableCoreAttestation({ ...options, print: false }), null, 2) + "\n";
  if (options.print !== false) process.stdout.write(output);
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  runPortableCoreAttestation();
}

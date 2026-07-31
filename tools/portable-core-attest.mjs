#!/usr/bin/env node

/**
 * Emit the anonymous portable-core identity for this repository's local manifest.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {string} root
 * @returns {{coreVersion: string, manifestSha256: string, entries: Record<string, string>}}
 */
function readAttestation(root) {
  const contractPath = path.join(root, "tools", "quality-policy", "portable-core-contract.json");
  const manifestPath = path.join(root, "tools", "quality-policy", "shared-core-manifest.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entries = Object.fromEntries(
    Object.entries(manifest.entries).sort(([left], [right]) => left.localeCompare(right))
  );
  return {
    coreVersion: contract.coreVersion,
    manifestSha256: crypto.createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex"),
    entries
  };
}

/**
 * Run the deterministic attestation.
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {string}
 */
export function runPortableCoreAttest(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const output = JSON.stringify(readAttestation(root), null, 2) + "\n";
  if (options.print !== false) process.stdout.write(output);
  return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) runPortableCoreAttest();

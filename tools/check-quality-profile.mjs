#!/usr/bin/env node

/**
 * @file check-quality-profile - validates the local profile against the portable role boundary.
 * Documentation: documentation/conventions/quality-gates.md
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  readQualityBoundary,
  runGateRoleGraphCheck,
  runProfileContractCheck
} from "./portable-core/gate-role-engine.mjs";
import { readPortableCoreContract } from "./quality-policy/portable-core-contract.mjs";

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, findings: Array<{path: string, kind: string, detail?: string}>}}
 */
export function runQualityProfileCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const findings = [];
  try {
    const { graph, profile } = readQualityBoundary(root);
    findings.push(...runGateRoleGraphCheck(graph).findings);
    findings.push(...runProfileContractCheck(profile).findings);
    const contract = readPortableCoreContract(root);
    if (profile.portableCore.coreVersion !== contract.coreVersion) {
      findings.push({
        path: "tools/quality-policy/project-profile.json",
        kind: "core-version",
        detail: `profile declares ${profile.portableCore.coreVersion}, contract declares ${contract.coreVersion}`
      });
    }
  } catch (error) {
    findings.push({ path: "tools/quality-policy/project-profile.json", kind: "read", detail: errorMessage(error) });
  }
  const result = { ok: findings.length === 0, findings };
  if (options.print !== false) {
    for (const finding of findings) {
      console.error(
        `[quality-profile] ${finding.path}: ${finding.kind}${finding.detail ? ` (${finding.detail})` : ""}`
      );
    }
    console.log(`SUMMARY_JSON=${JSON.stringify({ ok: result.ok, findings: findings.length })}`);
  }
  return result;
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

if (pathToFileURL(path.resolve(process.argv[1] || "")).href === import.meta.url) {
  process.exitCode = runQualityProfileCheck().ok ? 0 : 1;
}

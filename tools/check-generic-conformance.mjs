#!/usr/bin/env node

/**
 * @file check-generic-conformance - executes the signed generic-rule corpus in the live gate.
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runGenericRule } from "./portable-core/generic-rule-engine.mjs";
import { readPortableCoreContract } from "./quality-policy/portable-core-contract.mjs";

const CORPUS_PATH = "tests/portable-core/generic-rule-corpus.json";
const GOLDEN_PATH = "tests/portable-core/generic-rule-conformance.golden.json";

/** @typedef {{ruleId: string, path: string, line: number}} NormalizedFinding */

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, findings: Array<{ruleId: string, kind: string, detail?: string}>}}
 */
export function runGenericConformanceCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const findings = [];
  try {
    const contract = readPortableCoreContract(root);
    const corpus = readJson(root, CORPUS_PATH);
    const golden = readJson(root, GOLDEN_PATH);
    if (corpus.schemaVersion !== 1 || !Array.isArray(corpus.rules)) {
      findings.push({ ruleId: "corpus", kind: "schema", detail: "corpus envelope is invalid" });
    } else if (
      corpus.rules.map((/** @type {any} */ rule) => rule.id).join("\0") !== contract.canonicalRuleIds.join("\0")
    ) {
      findings.push({ ruleId: "corpus", kind: "rule-order", detail: "corpus IDs differ from the signed contract" });
    }
    for (const rule of corpus.rules || []) {
      const clean = runGenericRule(rule.id, materialize(rule.clean));
      const failing = runGenericRule(rule.id, materialize(rule.failing));
      if (clean.length !== 0) findings.push({ ruleId: rule.id, kind: "clean", detail: `${clean.length} finding(s)` });
      if (failing.length !== rule.expectedFailingCount) {
        findings.push({ ruleId: rule.id, kind: "failing", detail: `${failing.length} finding(s)` });
      }
      if (JSON.stringify(normalize(failing)) !== JSON.stringify(golden[rule.id])) {
        findings.push({ ruleId: rule.id, kind: "golden", detail: "normalized output differs" });
      }
    }
  } catch (error) {
    findings.push({ ruleId: "corpus", kind: "read", detail: errorMessage(error) });
  }
  const result = { ok: findings.length === 0, findings };
  if (options.print !== false) {
    for (const finding of findings) {
      console.error(
        `[generic-conformance] ${finding.ruleId}: ${finding.kind}${finding.detail ? ` (${finding.detail})` : ""}`
      );
    }
    console.log(`SUMMARY_JSON=${JSON.stringify({ ok: result.ok, findings: findings.length })}`);
  }
  return result;
}

/** @param {string} root @param {string} relativePath @returns {any} */
function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

/** @param {Array<{path: string, content?: string, fragments?: string[]}>} files */
function materialize(files) {
  return files.map((file) => ({ path: file.path, content: file.content ?? (file.fragments || []).join("") }));
}

/** @param {Array<{ruleId: string, path: string, line: number}>} findings @returns {NormalizedFinding[]} */
function normalize(findings) {
  return findings.map(({ ruleId, path: filePath, line }) => ({ ruleId, path: filePath, line }));
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

if (pathToFileURL(path.resolve(process.argv[1] || "")).href === import.meta.url) {
  process.exitCode = runGenericConformanceCheck().ok ? 0 : 1;
}

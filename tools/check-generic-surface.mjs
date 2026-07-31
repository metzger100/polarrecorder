#!/usr/bin/env node

/**
 * @file check-generic-surface - Genericness token scanner for the Tier 1 shared-core surface
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CONTRACT_PATH, readPortableCoreContract } from "./quality-policy/portable-core-contract.mjs";
import { readVersionedProfile } from "./quality-policy/profile-schema.mjs";

const AGENTS_PATH = "AGENTS.md";
const BEGIN_MARKER = "<!-- BEGIN SHARED_INSTRUCTIONS -->";
const END_MARKER = "<!-- END SHARED_INSTRUCTIONS -->";
const GENERIC_RULE_DEFINITIONS_DIR = "tools/check-patterns/generic";
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".toml"]);

/** @typedef {{ target: string, token: string }} GenericSurfaceFinding */
/** @typedef {{ ok: boolean, checkedTargets: number, findings: number, warn: boolean }} GenericSurfaceSummary */
/** @typedef {{ root?: string, print?: boolean, warn?: boolean, patternEngineOnly?: boolean }} GenericSurfaceCheckOptions */
/** @typedef {{ name: string, content: string, genericDefinitions?: boolean }} ScanTarget */

/**
 * @param {GenericSurfaceCheckOptions} [options]
 * @returns {{ summary: GenericSurfaceSummary, findings: GenericSurfaceFinding[], ok: boolean }}
 */
export function runGenericSurfaceCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const warn = Boolean(options.warn);
  const tokens = loadTokens(root);
  const targets = collectTargets(root, options.patternEngineOnly === true);

  /** @type {GenericSurfaceFinding[]} */
  const findings = [];
  for (const target of targets) {
    const haystack = scanContent(target).toLowerCase();
    for (const token of tokens) {
      if (containsToken(haystack, token)) findings.push({ target: target.name, token });
    }
  }

  const ok = warn || findings.length === 0;
  const summary = {
    ok,
    checkedTargets: targets.length,
    findings: findings.length,
    warn
  };

  if (options.print !== false) printFindings(findings, summary, warn);

  return { summary, findings, ok: summary.ok };
}

/** @param {string} haystack @param {string} token @returns {boolean} */
function containsToken(haystack, token) {
  const loweredToken = token.toLowerCase();
  if (!/\.(?:js|mjs|json|py)$/.test(loweredToken)) return haystack.includes(loweredToken);
  const escaped = loweredToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "i").test(haystack);
}

/** @param {GenericSurfaceFinding[]} findings @param {GenericSurfaceSummary} summary @param {boolean} warn @returns {void} */
function printFindings(findings, summary, warn) {
  const prefix = warn ? "[generic-surface-warn]" : "[generic-surface]";
  const print = warn ? console.log : console.error;
  for (const finding of findings) {
    print(`${prefix} ${finding.target}: contains project-specific token '${finding.token}'`);
  }
  const printSummary = summary.ok ? console.log : console.error;
  printSummary("SUMMARY_JSON=" + JSON.stringify(summary));
}

/** @param {string} root @returns {string[]} */
function loadTokens(root) {
  const data = readVersionedProfile(path.join(root, "tools/quality-policy/generic-tokens.json"), [
    "profileType",
    "note",
    "projectTokens",
    "domainTokens",
    "hostTokens"
  ]);
  if (data.profileType !== undefined && data.profileType !== "genericness-token-profile") {
    throw new Error("Genericness token profile has an unknown profileType.");
  }
  return [...data.projectTokens, ...data.domainTokens, ...data.hostTokens];
}

/** @param {string} root @param {boolean} patternEngineOnly @returns {ScanTarget[]} */
function collectTargets(root, patternEngineOnly) {
  /** @type {ScanTarget[]} */
  const targets = [];

  const manifestPaths = loadManifestPaths(root);
  const selected = manifestPaths.filter((relativePath) => {
    if (!TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) return false;
    return (
      !patternEngineOnly ||
      relativePath === "tools/check-patterns.mjs" ||
      relativePath.startsWith("tools/check-patterns/")
    );
  });
  for (const relativePath of selected) {
    const absolutePath = path.join(root, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    targets.push({
      name: relativePath,
      content,
      genericDefinitions: relativePath.startsWith(`${GENERIC_RULE_DEFINITIONS_DIR}/`)
    });
  }

  if (!patternEngineOnly) {
    const agentsPath = path.join(root, AGENTS_PATH);
    targets.push({
      name: "AGENTS.md#SHARED_INSTRUCTIONS",
      content: extractSharedInstructionsBlock(fs.readFileSync(agentsPath, "utf8"))
    });
  }

  return targets;
}

/** @param {string} root @returns {string[]} */
function loadManifestPaths(root) {
  const contractPath = path.join(root, CONTRACT_PATH);
  if (fs.existsSync(contractPath)) {
    return [...new Set([...readPortableCoreContract(root).mandatoryPaths, ...discoverGenericRulePaths(root)])].sort();
  }
  return discoverFallbackPatternPaths(root);
}

/** @param {string} root @returns {string[]} */
function discoverGenericRulePaths(root) {
  const genericRoot = path.join(root, GENERIC_RULE_DEFINITIONS_DIR);
  if (!fs.existsSync(genericRoot)) throw new Error(`Missing generic rule directory: ${GENERIC_RULE_DEFINITIONS_DIR}`);
  /** @type {string[]} */
  const discovered = [];
  /** @param {string} directory */
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        discovered.push(path.relative(root, absolutePath).split(path.sep).join("/"));
      }
    }
  }
  visit(genericRoot);
  if (discovered.length === 0) throw new Error(`Generic rule directory is empty: ${GENERIC_RULE_DEFINITIONS_DIR}`);
  return discovered.sort();
}

/** @param {string} root @returns {string[]} */
function discoverFallbackPatternPaths(root) {
  const patternRoot = path.join(root, "tools", "check-patterns");
  if (!fs.existsSync(patternRoot)) return [];
  /** @type {string[]} */
  const discovered = [];
  /** @param {string} directory */
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        discovered.push(path.relative(root, absolutePath).split(path.sep).join("/"));
      }
    }
  }
  visit(patternRoot);
  const runnerPath = path.join(root, "tools", "check-patterns.mjs");
  if (fs.existsSync(runnerPath)) discovered.push(path.relative(root, runnerPath).split(path.sep).join("/"));
  const skillsRoot = path.join(root, ".agents", "skills");
  if (fs.existsSync(skillsRoot)) {
    for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
      const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
      if (entry.isDirectory() && fs.existsSync(skillPath)) {
        discovered.push(path.relative(root, skillPath).split(path.sep).join("/"));
      }
    }
  }
  return [...new Set(discovered)].sort();
}

/** @param {ScanTarget} target @returns {string} */
function scanContent(target) {
  if (!target.genericDefinitions) return target.content;
  return target.content.replace(/name:\s*"[^"]+"/g, 'name: "<canonical-rule-id>"');
}

/** @param {string} content @returns {string} */
function extractSharedInstructionsBlock(content) {
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin === -1 || end === -1) {
    throw new Error("AGENTS.md is missing the SHARED_INSTRUCTIONS marker pair.");
  }
  return content.slice(begin + BEGIN_MARKER.length, end);
}

/** @param {string[]} [argv] @returns {void} */
export function runGenericSurfaceCheckCli(argv = process.argv.slice(2)) {
  const warn = argv.includes("--warn");
  const patternEngineOnly = argv.includes("--pattern-engine-only");
  const { summary } = runGenericSurfaceCheck({ root: process.cwd(), warn, patternEngineOnly, print: true });
  process.exitCode = summary.ok ? 0 : 1;
}

/** @returns {boolean} */
function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntrypoint()) {
  runGenericSurfaceCheckCli();
}

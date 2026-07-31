#!/usr/bin/env node

/**
 * `npm run check:generic-surface` -- applies the single genericness token owner
 * (`tools/quality-policy/generic-tokens.json`) case-insensitively to every text
 * target the Shared Core Contract names: the `SHARED_INSTRUCTIONS` block, every
 * generic skill file, every Tier 1 tool module's full content, and every generic
 * rule definition's content. A finding here means a candidate "generic" artifact
 * still carries a token that would make it un-liftable to a different repository.
 *
 * The token arrays and the four target *concepts* are Tier 1 (this module and
 * `generic-tokens.json`); the concrete file paths and skill directory names for
 * this repository are project-owned data in
 * `tools/quality-policy/generic-surface-scope.json`.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BEGIN_MARKER = "<!-- BEGIN SHARED_INSTRUCTIONS -->";
const END_MARKER = "<!-- END SHARED_INSTRUCTIONS -->";

/** @typedef {{target: string, token: string}} GenericSurfaceFinding */
/** @typedef {{root?: string, print?: boolean}} GenericSurfaceOptions */
/** @typedef {{ok: boolean, findings: GenericSurfaceFinding[]}} GenericSurfaceResult */

/**
 * @param {string} root
 * @returns {{projectTokens: string[], domainTokens: string[], hostTokens: string[]}}
 */
function readTokens(root) {
  const raw = fs.readFileSync(path.join(root, "tools", "quality-policy", "generic-tokens.json"), "utf8");
  const parsed = JSON.parse(raw);
  return {
    projectTokens: parsed.projectTokens,
    domainTokens: parsed.domainTokens,
    hostTokens: parsed.hostTokens
  };
}

/**
 * @param {string} root
 * @returns {{skillDirs: string[], tier1ToolModules: string[], genericRuleDefDirs: string[]}}
 */
function readScope(root) {
  const raw = fs.readFileSync(path.join(root, "tools", "quality-policy", "generic-surface-scope.json"), "utf8");
  return JSON.parse(raw);
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listMjsFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMjsFilesRecursive(abs));
    else if (entry.name.endsWith(".mjs")) out.push(abs);
  }
  return out.sort();
}

/**
 * @param {string} content
 * @returns {string}
 */
function extractSharedInstructionsBlock(content) {
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin < 0 || end < 0 || end <= begin) return "";
  return content.slice(begin + BEGIN_MARKER.length, end);
}

/**
 * @param {string} root
 * @returns {{name: string, content: string}[]}
 */
function collectTargets(root) {
  const scope = readScope(root);
  /** @type {{name: string, content: string}[]} */
  const targets = [];

  const agentsPath = path.join(root, "AGENTS.md");
  if (fs.existsSync(agentsPath)) {
    targets.push({
      name: "SHARED_INSTRUCTIONS block (AGENTS.md)",
      content: extractSharedInstructionsBlock(fs.readFileSync(agentsPath, "utf8"))
    });
  }

  for (const name of scope.skillDirs) {
    const skillPath = path.join(root, ".agents", "skills", name, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      targets.push({ name: `generic skill: ${name}`, content: fs.readFileSync(skillPath, "utf8") });
    }
  }

  for (const rel of scope.tier1ToolModules) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) {
      targets.push({ name: `Tier 1 tool module: ${rel}`, content: fs.readFileSync(abs, "utf8") });
    }
  }

  for (const rel of scope.genericRuleDefDirs) {
    for (const abs of listMjsFilesRecursive(path.join(root, rel))) {
      targets.push({
        name: `generic rule definition: ${path.relative(root, abs).replace(/\\/g, "/")}`,
        content: fs.readFileSync(abs, "utf8")
      });
    }
  }

  return targets;
}

/**
 * Run the genericness token scan and return every finding.
 * @param {GenericSurfaceOptions} [options]
 * @returns {GenericSurfaceResult}
 */
export function runGenericSurfaceCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const print = options.print !== false;
  const tokens = readTokens(root);
  const allTokens = [...tokens.projectTokens, ...tokens.domainTokens, ...tokens.hostTokens];
  const targets = collectTargets(root);

  /** @type {GenericSurfaceFinding[]} */
  const findings = [];
  for (const target of targets) {
    const lower = target.content.toLowerCase();
    for (const token of allTokens) {
      if (lower.includes(token.toLowerCase())) {
        findings.push({ target: target.name, token });
      }
    }
  }

  const ok = findings.length === 0;
  if (print) {
    if (ok) {
      console.log("Generic surface check passed: zero genericness token findings.");
    } else {
      for (const finding of findings) {
        console.error(`[generic-surface] ${finding.target}: contains token '${finding.token}'`);
      }
    }
    console.log("SUMMARY_JSON=" + JSON.stringify({ ok, checkedTargets: targets.length, findings: findings.length }));
  }
  return { ok, findings };
}

/**
 * @returns {boolean}
 */
function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntrypoint()) {
  const result = runGenericSurfaceCheck({ root: process.cwd(), print: true });
  process.exit(result.ok ? 0 : 1);
}

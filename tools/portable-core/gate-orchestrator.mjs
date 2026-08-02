#!/usr/bin/env node

/**
 * @file gate-orchestrator - executes a validated local adapter sequence in canonical role order.
 * Documentation: documentation/conventions/quality-gates.md
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  readPortableRoleGraph,
  readProjectProfile,
  runGateRoleGraphCheck,
  runProfileContractCheck
} from "./gate-role-engine.mjs";

/** @typedef {{role: string, kind: string, detail?: string}} GateFinding */
/** @typedef {{ok: boolean, executed: string[], findings: GateFinding[], failedRole?: string}} GateResult */

/**
 * Execute selected quality roles exactly once in the signed order.
 * @param {{graph: any, profile: any, roles: string[], root?: string, runCommand?: (command: string, root: string) => number}} options
 * @returns {GateResult}
 */
export function runQualityRoleGraph({ graph, profile, roles, root = process.cwd(), runCommand = runCommandSync }) {
  const findings = [];
  const graphResult = runGateRoleGraphCheck(graph);
  const profileResult = runProfileContractCheck(profile);
  findings.push(...graphResult.findings.map((finding) => ({ role: "graph", ...finding })));
  findings.push(...profileResult.findings.map((finding) => ({ role: "profile", ...finding })));
  if (findings.length > 0) return { ok: false, executed: [], findings };

  /** @type {string[]} */
  const order = graph.requiredOrder;
  const knownRoles = new Set(order);
  /** @type {string[]} */
  const selected = roles.length > 0 ? roles : order.filter((role) => role !== "setup");
  if (new Set(selected).size !== selected.length) {
    findings.push({ role: "selection", kind: "duplicate-role", detail: "selected roles must be unique" });
  }
  if (selected.some((role) => !knownRoles.has(role))) {
    findings.push({ role: "selection", kind: "unknown-role", detail: "selected role is not in the signed graph" });
  }
  const selectedIndexes = selected.map((role) => order.indexOf(role));
  if (selectedIndexes.some((value, index) => index > 0 && value <= selectedIndexes[index - 1])) {
    findings.push({
      role: "selection",
      kind: "reordered-role",
      detail: "selected roles must preserve canonical order"
    });
  }
  if (findings.length > 0) return { ok: false, executed: [], findings };

  /** @type {string[]} */
  const executed = [];
  for (const role of selected) {
    const command = profile.adapters[role];
    if (typeof command !== "string") {
      findings.push({ role, kind: "missing-adapter", detail: "profile has no command adapter" });
      return { ok: false, executed, findings, failedRole: role };
    }
    if (isRecursiveCommand(command)) {
      findings.push({ role, kind: "recursive-command", detail: command });
      return { ok: false, executed, findings, failedRole: role };
    }
    executed.push(role);
    const status = runCommand(command, root);
    if (status !== 0) {
      findings.push({ role, kind: "command-failed", detail: `exit status ${status}` });
      return { ok: false, executed, findings, failedRole: role };
    }
  }
  return { ok: true, executed, findings };
}

/** @param {string} command @param {string} root @returns {number} */
function runCommandSync(command, root) {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: "inherit" });
  return typeof result.status === "number" ? result.status : 1;
}

/** @param {string} command @returns {boolean} */
function isRecursiveCommand(command) {
  return /(?:run-quality-gate|check:core|check:all|check:fast)/.test(command);
}

/** @param {string} root @returns {{graph: any, profile: any}} */
export function readQualityGraphFiles(root = process.cwd()) {
  return {
    graph: readPortableRoleGraph(path.join(root, "tools/quality-policy/portable-role-graph.json")),
    profile: readProjectProfile(path.join(root, "tools/quality-policy/project-profile.json"))
  };
}

/** @param {string[]} argv @returns {string[]} */
function selectedRoles(argv) {
  const index = argv.indexOf("--roles");
  if (index === -1) return [];
  return (argv[index + 1] || "").split(",").filter(Boolean);
}

if (pathToFileURL(path.resolve(process.argv[1] || "")).href === import.meta.url) {
  const root = process.cwd();
  const { graph, profile } = readQualityGraphFiles(root);
  const result = runQualityRoleGraph({
    graph,
    profile,
    roles: selectedRoles(process.argv.slice(2)),
    root
  });
  if (!result.ok) {
    for (const finding of result.findings) {
      console.error(`[quality-gate] ${finding.role}: ${finding.kind}${finding.detail ? ` (${finding.detail})` : ""}`);
    }
  }
  console.log(
    `SUMMARY_JSON=${JSON.stringify({ ok: result.ok, executed: result.executed, failedRole: result.failedRole })}`
  );
  process.exitCode = result.ok ? 0 : 1;
}

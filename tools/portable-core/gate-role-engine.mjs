#!/usr/bin/env node

/**
 * @file gate-role-engine - validates the product-neutral quality role graph and local profile boundary.
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";

const GRAPH_PATH = "tools/quality-policy/portable-role-graph.json";
const PROFILE_PATH = "tools/quality-policy/project-profile.json";
const ROLE_ID = /^[a-z][a-z0-9-]*$/;
const RELATIVE_PATH = /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\).+$/;
const COMMAND = /^(?!.*(?:^|[ /])(?:\/|[A-Za-z]:|\.\.(?:\/|$))).+$/;

/** @typedef {{path: string, kind: string, detail?: string}} RoleFinding */

/**
 * Validate the canonical graph without reading product-specific files.
 * @param {unknown} graph
 * @returns {{ok: boolean, findings: RoleFinding[]}}
 */
export function runGateRoleGraphCheck(graph) {
  const value = /** @type {any} */ (graph);
  /** @type {RoleFinding[]} */
  const findings = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, findings: [{ path: GRAPH_PATH, kind: "shape", detail: "graph must be an object" }] };
  }
  if (value.schemaVersion !== 1 || value.graphVersion !== 1) {
    findings.push({ path: GRAPH_PATH, kind: "version", detail: "schemaVersion and graphVersion must be 1" });
  }
  const order = value.requiredOrder;
  const roles = value.roles;
  if (!Array.isArray(order) || !roles || typeof roles !== "object" || Array.isArray(roles)) {
    findings.push({ path: GRAPH_PATH, kind: "shape", detail: "requiredOrder and roles are required" });
    return { ok: findings.length === 0, findings };
  }
  if (new Set(order).size !== order.length) {
    findings.push({ path: GRAPH_PATH, kind: "duplicate-role", detail: "requiredOrder contains duplicates" });
  }
  for (const role of order) {
    if (typeof role !== "string" || !ROLE_ID.test(role)) {
      findings.push({ path: GRAPH_PATH, kind: "role-id", detail: `invalid role '${String(role)}'` });
      continue;
    }
    const definition = roles[role];
    if (!definition || definition.required !== true || definition.exactlyOnce !== true) {
      findings.push({ path: GRAPH_PATH, kind: "required-role", detail: `role '${role}' is not required exactly once` });
    }
  }
  for (const role of Object.keys(roles)) {
    if (!order.includes(role)) {
      findings.push({ path: GRAPH_PATH, kind: "unknown-role", detail: `role '${role}' is absent from requiredOrder` });
    }
  }
  const extensions = value.extensionPolicy;
  if (
    !extensions ||
    extensions.allowProfileExtensions !== true ||
    extensions.unknownRole !== "reject" ||
    extensions.duplicateRole !== "reject" ||
    extensions.recursiveCommand !== "reject" ||
    extensions.failure !== "stop"
  ) {
    findings.push({ path: GRAPH_PATH, kind: "extension-policy", detail: "graph extension policy is not fail-closed" });
  }
  return { ok: findings.length === 0, findings };
}

/**
 * Validate a product profile's boundary fields and role adapter commands.
 * @param {unknown} profile
 * @returns {{ok: boolean, findings: RoleFinding[]}}
 */
export function runProfileContractCheck(profile) {
  const value = /** @type {any} */ (profile);
  /** @type {RoleFinding[]} */
  const findings = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, findings: [{ path: PROFILE_PATH, kind: "shape", detail: "profile must be an object" }] };
  }
  if (value.schemaVersion !== 1 || value.profileType !== "product-quality-profile") {
    findings.push({ path: PROFILE_PATH, kind: "version", detail: "profile envelope is unsupported" });
  }
  if (!value.portableCore || typeof value.portableCore !== "object") {
    findings.push({ path: PROFILE_PATH, kind: "portable-core", detail: "portableCore is required" });
  } else {
    if (typeof value.portableCore.coreVersion !== "string") {
      findings.push({ path: PROFILE_PATH, kind: "portable-core", detail: "coreVersion is required" });
    }
    if (!isRelativePath(value.portableCore.roleGraph)) {
      findings.push({ path: PROFILE_PATH, kind: "path", detail: "roleGraph must be repository-relative" });
    }
  }
  if (!Array.isArray(value.sourceScopes) || value.sourceScopes.length === 0) {
    findings.push({ path: PROFILE_PATH, kind: "source-scope", detail: "sourceScopes must be non-empty" });
  }
  if (!Array.isArray(value.testProjects) || value.testProjects.length === 0) {
    findings.push({ path: PROFILE_PATH, kind: "test-project", detail: "testProjects must be non-empty" });
  } else {
    const ids = value.testProjects.map((/** @type {any} */ project) => project && project.id);
    if (
      ids.some((/** @type {any} */ id) => typeof id !== "string" || !ROLE_ID.test(id)) ||
      new Set(ids).size !== ids.length
    ) {
      findings.push({ path: PROFILE_PATH, kind: "test-project", detail: "test project ids must be unique role ids" });
    }
    for (const project of value.testProjects) {
      if (!project || !isCommand(project.command)) {
        findings.push({ path: PROFILE_PATH, kind: "command", detail: "test project command must be local" });
      }
    }
  }
  if (!value.adapters || typeof value.adapters !== "object" || Array.isArray(value.adapters)) {
    findings.push({ path: PROFILE_PATH, kind: "adapter", detail: "adapters are required" });
  } else {
    for (const [role, command] of Object.entries(value.adapters)) {
      if (!ROLE_ID.test(role) || !isCommand(command)) {
        findings.push({ path: PROFILE_PATH, kind: "command", detail: `invalid adapter '${role}'` });
      }
    }
  }
  return { ok: findings.length === 0, findings };
}

/** @param {string} filePath @returns {unknown} */
export function readPortableRoleGraph(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** @param {string} filePath @returns {unknown} */
export function readProjectProfile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** @param {unknown} value @returns {boolean} */
function isRelativePath(value) {
  return typeof value === "string" && RELATIVE_PATH.test(value);
}

/** @param {unknown} value @returns {boolean} */
function isCommand(value) {
  return typeof value === "string" && value.length > 0 && COMMAND.test(value);
}

/** @param {string} root @returns {{graph: any, profile: any}} */
export function readQualityBoundary(root = process.cwd()) {
  return {
    graph: readPortableRoleGraph(path.join(root, GRAPH_PATH)),
    profile: readProjectProfile(path.join(root, PROFILE_PATH))
  };
}

#!/usr/bin/env node

/**
 * @file gate-role-engine - validates the quality role graph and the local adapter profile.
 * Documentation: documentation/conventions/quality-gates.md
 *
 * The orchestrator reads exactly two fields: the graph's `requiredOrder` and the profile's
 * `adapters`. Both files hold nothing else, so this engine rejects any other field instead of
 * validating metadata that no code reads.
 */

import fs from "node:fs";
import path from "node:path";

const GRAPH_PATH = "tools/quality-policy/portable-role-graph.json";
const PROFILE_PATH = "tools/quality-policy/project-profile.json";
const ROLE_ID = /^[a-z][a-z0-9-]*$/;
const COMMAND = /^(?!.*(?:^|[ /])(?:\/|[A-Za-z]:|\.\.(?:\/|$))).+$/;

/** @typedef {{path: string, kind: string, detail?: string}} RoleFinding */

/**
 * Validate the canonical role order: a non-empty list of unique role ids and nothing else.
 * @param {unknown} graph
 * @returns {{ok: boolean, findings: RoleFinding[]}}
 */
export function runGateRoleGraphCheck(graph) {
  const value = /** @type {any} */ (graph);
  if (!isPlainObject(value) || !Array.isArray(value.requiredOrder) || value.requiredOrder.length === 0) {
    return {
      ok: false,
      findings: [{ path: GRAPH_PATH, kind: "shape", detail: "requiredOrder must be a non-empty list" }]
    };
  }
  /** @type {RoleFinding[]} */
  const findings = unknownFields(value, ["requiredOrder"], GRAPH_PATH);
  /** @type {unknown[]} */
  const order = value.requiredOrder;
  if (new Set(order).size !== order.length) {
    findings.push({ path: GRAPH_PATH, kind: "duplicate-role", detail: "requiredOrder contains duplicates" });
  }
  for (const role of order) {
    if (typeof role !== "string" || !ROLE_ID.test(role)) {
      findings.push({ path: GRAPH_PATH, kind: "role-id", detail: `invalid role '${String(role)}'` });
    }
  }
  return { ok: findings.length === 0, findings };
}

/**
 * Validate the profile: one local adapter command per role id and nothing else.
 * @param {unknown} profile
 * @returns {{ok: boolean, findings: RoleFinding[]}}
 */
export function runProfileContractCheck(profile) {
  const value = /** @type {any} */ (profile);
  if (!isPlainObject(value) || !isPlainObject(value.adapters)) {
    return { ok: false, findings: [{ path: PROFILE_PATH, kind: "shape", detail: "adapters must be an object" }] };
  }
  /** @type {RoleFinding[]} */
  const findings = unknownFields(value, ["adapters"], PROFILE_PATH);
  for (const [role, command] of Object.entries(value.adapters)) {
    if (!ROLE_ID.test(role) || !isCommand(command)) {
      findings.push({ path: PROFILE_PATH, kind: "command", detail: `invalid adapter '${role}'` });
    }
  }
  return { ok: findings.length === 0, findings };
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} filePath @returns {RoleFinding[]} */
function unknownFields(value, allowed, filePath) {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => ({
      path: filePath,
      kind: "unknown-field",
      detail: `field '${key}' is not read by the orchestrator`
    }));
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value @returns {boolean} */
function isCommand(value) {
  return typeof value === "string" && value.length > 0 && COMMAND.test(value);
}

/** @param {string} filePath @returns {unknown} */
export function readPortableRoleGraph(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** @param {string} filePath @returns {unknown} */
export function readProjectProfile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** @param {string} root @returns {{graph: any, profile: any}} */
export function readQualityBoundary(root = process.cwd()) {
  return {
    graph: readPortableRoleGraph(path.join(root, GRAPH_PATH)),
    profile: readProjectProfile(path.join(root, PROFILE_PATH))
  };
}

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

import {
  readQualityBoundary,
  runGateRoleGraphCheck,
  runProfileContractCheck
} from "../../tools/portable-core/gate-role-engine.mjs";
import { runQualityRoleGraph } from "../../tools/portable-core/gate-orchestrator.mjs";

const ROOT = process.cwd();

test("the checked-in role graph and local profile satisfy the portable boundary", function () {
  const { graph, profile } = readQualityBoundary(ROOT);
  expect(runGateRoleGraphCheck(graph)).toMatchObject({ ok: true, findings: [] });
  expect(runProfileContractCheck(profile)).toMatchObject({ ok: true, findings: [] });
  expect(graph.requiredOrder).toHaveLength(17);
  expect(profile.portableCore.roleGraph).toBe("tools/quality-policy/portable-role-graph.json");
});

test("the role graph rejects duplicates, unknown roles, and weak failure policy", function () {
  const graph = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/quality-policy/portable-role-graph.json"), "utf8"));
  graph.requiredOrder.push("standard");
  graph.roles.unlisted = { required: true, exactlyOnce: true, portable: false };
  graph.extensionPolicy.failure = "continue";
  const result = runGateRoleGraphCheck(graph);
  expect(result.ok).toBe(false);
  expect(result.findings.map((finding) => finding.kind)).toEqual(
    expect.arrayContaining(["duplicate-role", "unknown-role", "extension-policy"])
  );
});

test("the profile rejects unsafe paths, recursive commands, and duplicate test projects", function () {
  const { profile } = readQualityBoundary(ROOT);
  const invalid = structuredClone(profile);
  invalid.portableCore.roleGraph = "../outside.json";
  invalid.testProjects[1].id = invalid.testProjects[0].id;
  invalid.testProjects[0].command = "npm run check && /bin/sh";
  invalid.adapters.extra = "node ../outside.mjs";
  const result = runProfileContractCheck(invalid);
  expect(result.ok).toBe(false);
  expect(result.findings.map((finding) => finding.kind)).toEqual(
    expect.arrayContaining(["path", "test-project", "command"])
  );
});

test("the orchestrator executes canonical roles once and stops at the first failure", function () {
  const { graph, profile } = readQualityBoundary(ROOT);
  /** @type {string[]} */
  const commands = [];
  const result = runQualityRoleGraph({
    graph,
    profile: {
      ...profile,
      adapters: {
        ...profile.adapters,
        standard: "node first",
        "portable-core": "node second",
        "generic-surface": "node third"
      }
    },
    roles: ["standard", "portable-core", "generic-surface"],
    runCommand(command) {
      commands.push(command);
      return command === "node second" ? 1 : 0;
    }
  });
  expect(result.ok).toBe(false);
  expect(commands).toEqual(["node first", "node second"]);
  expect(result.failedRole).toBe("portable-core");
});

test("the orchestrator rejects reordered, duplicate, and recursive role selections", function () {
  const { graph, profile } = readQualityBoundary(ROOT);
  const reordered = runQualityRoleGraph({ graph, profile, roles: ["standalone", "standard"] });
  expect(reordered.findings.some((finding) => finding.kind === "reordered-role")).toBe(true);
  const duplicate = runQualityRoleGraph({ graph, profile, roles: ["standard", "standard"] });
  expect(duplicate.findings.some((finding) => finding.kind === "duplicate-role")).toBe(true);
  const recursive = runQualityRoleGraph({
    graph,
    profile: { ...profile, adapters: { ...profile.adapters, standard: "npm run check:core" } },
    roles: ["standard"]
  });
  expect(recursive.findings.some((finding) => finding.kind === "recursive-command")).toBe(true);
});

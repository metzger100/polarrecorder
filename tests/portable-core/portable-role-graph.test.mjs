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

test("the checked-in role graph and local profile hold only the fields the orchestrator reads", function () {
  const { graph, profile } = readQualityBoundary(ROOT);
  expect(runGateRoleGraphCheck(graph)).toMatchObject({ ok: true, findings: [] });
  expect(runProfileContractCheck(profile)).toMatchObject({ ok: true, findings: [] });
  expect(Object.keys(graph)).toEqual(["requiredOrder"]);
  expect(Object.keys(profile)).toEqual(["adapters"]);
  expect(Object.keys(profile.adapters).sort()).toEqual([...graph.requiredOrder].sort());
});

test("the role graph rejects duplicate and malformed roles and unread fields", function () {
  const graph = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/quality-policy/portable-role-graph.json"), "utf8"));
  graph.requiredOrder.push("standard", "Not A Role");
  graph.extensionPolicy = { failure: "stop" };
  const result = runGateRoleGraphCheck(graph);
  expect(result.ok).toBe(false);
  expect(result.findings.map((finding) => finding.kind)).toEqual(
    expect.arrayContaining(["duplicate-role", "role-id", "unknown-field"])
  );
  expect(runGateRoleGraphCheck({ requiredOrder: [] }).findings[0].kind).toBe("shape");
});

test("the profile rejects non-local adapter commands, malformed roles, and unread fields", function () {
  const { profile } = readQualityBoundary(ROOT);
  const invalid = structuredClone(profile);
  invalid.adapters.extra = "node ../outside.mjs";
  invalid.adapters["Not A Role"] = "node local.mjs";
  invalid.testProjects = [{ id: "python", command: "npm run test:python" }];
  const result = runProfileContractCheck(invalid);
  expect(result.ok).toBe(false);
  expect(result.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(["command", "unknown-field"]));
  expect(result.findings.filter((finding) => finding.kind === "command")).toHaveLength(2);
  expect(runProfileContractCheck({}).findings[0].kind).toBe("shape");
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
        suppressions: "node second",
        typing: "node third"
      }
    },
    roles: ["standard", "suppressions", "typing"],
    runCommand(command) {
      commands.push(command);
      return command === "node second" ? 1 : 0;
    }
  });
  expect(result.ok).toBe(false);
  expect(commands).toEqual(["node first", "node second"]);
  expect(result.failedRole).toBe("suppressions");
});

test("every check:core role stops the graph at its own failure", function () {
  const { graph, profile } = readQualityBoundary(ROOT);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  /** @type {string[]} */
  const roles = pkg.scripts["check:core"].split("--roles ")[1].split(/\s+/)[0].split(",");
  const adapters = Object.fromEntries(roles.map((role) => [role, `node ${role}`]));
  for (const [index, failing] of roles.entries()) {
    /** @type {string[]} */
    const commands = [];
    const result = runQualityRoleGraph({
      graph,
      profile: { ...profile, adapters: { ...profile.adapters, ...adapters } },
      roles,
      runCommand(command) {
        commands.push(command);
        return command === `node ${failing}` ? 1 : 0;
      }
    });
    expect(result.ok).toBe(false);
    expect(result.failedRole).toBe(failing);
    expect(result.executed).toEqual(roles.slice(0, index + 1));
    expect(commands).toEqual(roles.slice(0, index + 1).map((role) => `node ${role}`));
  }
});

test("the orchestrator rejects reordered, duplicate, and recursive role selections", function () {
  const { graph, profile } = readQualityBoundary(ROOT);
  const reordered = runQualityRoleGraph({ graph, profile, roles: ["typing", "standard"] });
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

#!/bin/bash
set -euo pipefail

node <<'NODE'
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const requiredAgents = [
  "plan-controller",
  "context-scout",
  "implementation-worker",
  "test-worker",
  "docs-worker",
  "pro-requirements-verifier",
  "pro-quality-verifier",
];

const subagents = requiredAgents.filter((name) => name !== "plan-controller");
const requiredCommands = ["exec-plan", "verify-phase"];
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function parseSimpleYaml(source, filePath) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const match = line.match(/^(\s*)(?:"([^"]+)"|'([^']+)'|([^:#][^:]*?)):\s*(.*)$/);
    if (!match) {
      fail(`${filePath}:${index + 1}: unsupported or invalid YAML frontmatter line`);
      continue;
    }

    const indent = match[1].length;
    const key = (match[2] ?? match[3] ?? match[4]).trim();
    const rawValue = match[5] ?? "";

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;
    if (Object.prototype.hasOwnProperty.call(parent, key)) {
      fail(`${filePath}:${index + 1}: duplicate YAML key: ${key}`);
      continue;
    }

    if (rawValue.trim() === "") {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
      continue;
    }

    parent[key] = parseScalar(rawValue);
  }

  return root;
}

function frontmatter(filePath) {
  const text = readRequired(filePath);
  if (!text) {
    return {};
  }
  if (!text.startsWith("---\n")) {
    fail(`${filePath}: missing opening YAML frontmatter marker`);
    return {};
  }

  const endMarker = text.indexOf("\n---", 4);
  if (endMarker === -1) {
    fail(`${filePath}: missing closing YAML frontmatter marker`);
    return {};
  }

  return parseSimpleYaml(text.slice(4, endMarker), filePath);
}

function stripJsonc(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function parseJsonc(filePath) {
  const text = readRequired(filePath);
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(stripJsonc(text));
  } catch (error) {
    fail(`${filePath}: invalid JSONC: ${error.message}`);
    return {};
  }
}

function get(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) {
      return value[key];
    }
    return undefined;
  }, object);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function listedMarkdownNames(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => entry.slice(0, -3));
}

function checkPrimaryTools(config, label) {
  const value = get(config, "tools.primary_tools");
  if (Array.isArray(value)) {
    fail(`${label} tools.primary_tools: arrays are invalid for the installed Kilo schema`);
    return;
  }
  if (value !== undefined && typeof value !== "boolean") {
    fail(`${label} tools.primary_tools: expected absent or boolean, got ${JSON.stringify(value)}`);
  }
}

function checkAgentManagerToolKeyCount(filePath) {
  const text = readRequired(filePath);
  const count = (text.match(/"agent_manager_tool"\s*:/g) ?? []).length;
  if (count > 1) {
    fail(`${filePath}: duplicate agent_manager_tool keys`);
  }
}

for (const name of requiredAgents) {
  const filePath = path.join(".kilo", "agents", `${name}.md`);
  const config = frontmatter(filePath);

  assertEqual(config.description ? "present" : "missing", "present", `${filePath} description`);
  assertEqual(config.model ? "present" : "missing", "present", `${filePath} model`);

  if (name === "plan-controller") {
    assertEqual(config.mode, "primary", `${filePath} mode`);
    for (const subagent of subagents) {
      assertEqual(get(config, `permission.task.${subagent}`), "allow", `${filePath} permission.task.${subagent}`);
    }
    assertEqual(get(config, "permission.task.*"), "deny", `${filePath} permission.task.*`);
    assertEqual(get(config, "permission.agent_manager"), "ask", `${filePath} permission.agent_manager`);
    continue;
  }

  assertEqual(config.mode, "subagent", `${filePath} mode`);
  assertEqual(get(config, "permission.task"), "deny", `${filePath} permission.task`);

  if (["context-scout", "pro-requirements-verifier", "pro-quality-verifier"].includes(name)) {
    assertEqual(get(config, "permission.edit"), "deny", `${filePath} permission.edit`);
  }
}

const agentNames = listedMarkdownNames(path.join(".kilo", "agents"));
for (const name of requiredAgents) {
  if (!agentNames.includes(name)) {
    fail(`Missing required agent definition: .kilo/agents/${name}.md`);
  }
}
for (const name of agentNames) {
  if (!requiredAgents.includes(name)) {
    warn(`Extra project agent present: .kilo/agents/${name}.md`);
  }
}

const singularAgentNames = listedMarkdownNames(path.join(".kilo", "agent"));
for (const name of singularAgentNames) {
  if (agentNames.includes(name)) {
    fail(`Conflicting duplicate agent definition in .kilo/agent/${name}.md and .kilo/agents/${name}.md`);
  }
}

for (const name of requiredCommands) {
  const filePath = path.join(".kilo", "commands", `${name}.md`);
  const config = frontmatter(filePath);
  assertEqual(config.description ? "present" : "missing", "present", `${filePath} description`);
  assertEqual(config.agent, "plan-controller", `${filePath} agent`);
}

const dotKiloConfig = parseJsonc(path.join(".kilo", "kilo.jsonc"));
const rootConfig = parseJsonc("kilo.jsonc");

checkAgentManagerToolKeyCount(path.join(".kilo", "kilo.jsonc"));
checkAgentManagerToolKeyCount("kilo.jsonc");

for (const [label, config] of [
  [".kilo/kilo.jsonc", dotKiloConfig],
  ["kilo.jsonc", rootConfig],
]) {
  assertEqual(config.$schema, "https://app.kilo.ai/config.json", `${label} $schema`);
  assertEqual(config.model, "openrouter/deepseek/deepseek-v4-pro", `${label} model`);
  assertEqual(config.small_model, "openrouter/deepseek/deepseek-v4-flash", `${label} small_model`);
  assertEqual(config.default_agent, "plan-controller", `${label} default_agent`);
  assertEqual(get(config, "tools.agent_manager_tool"), true, `${label} tools.agent_manager_tool`);
  checkPrimaryTools(config, label);
}

for (const key of ["$schema", "model", "small_model", "default_agent"]) {
  assertEqual(rootConfig[key], dotKiloConfig[key], `root/.kilo config mirror ${key}`);
}

if (fs.existsSync(".kilocode")) {
  fail("Legacy .kilocode directory exists; migrate workflows to .kilo/commands/");
}
if (fs.existsSync(".kilocodemodes")) {
  fail("Legacy .kilocodemodes file exists; migrate modes to .kilo/agents/");
}
if (fs.existsSync("custom_modes.yaml")) {
  fail("Legacy custom_modes.yaml exists; migrate modes to .kilo/agents/");
}

const kiloCheck = childProcess.spawnSync("kilo", ["agent", "list"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (kiloCheck.error && kiloCheck.error.code === "ENOENT") {
  warn("Kilo CLI not found on PATH; skipped optional `kilo agent list` check.");
} else if (kiloCheck.status !== 0) {
  warn("`kilo agent list` was available but did not exit 0; inspect Kilo authentication/runtime manually.");
} else {
  const output = `${kiloCheck.stdout}\n${kiloCheck.stderr}`;
  for (const name of requiredAgents) {
    if (!output.includes(name)) {
      warn(`Optional Kilo CLI listing did not include ${name}; confirm in VS Code agent picker.`);
    }
  }
}

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

console.log("Kilo agent setup checks passed.");
NODE

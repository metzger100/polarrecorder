/**
 * Local drift proof for the portable `.codex/config.toml`: required portable keys
 * are present, and no OS-specific command/environment or MCP server declaration has crept
 * back in. Dependency-free by design (no TOML parser for this small fixed configuration).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "vitest";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, ".codex", "config.toml");
const CONFIG = fs.readFileSync(CONFIG_PATH, "utf8");

const FORBIDDEN_TOKENS = [
  "@latest",
  "mcp_servers",
  'command = "cmd"',
  'command = "powershell"',
  "SystemRoot",
  "PROGRAMFILES",
  "C:\\\\",
  "/home/",
  "/Users/"
];

test(".codex is a directory containing config.toml, not the retired empty marker file", () => {
  assert.equal(fs.existsSync(path.join(ROOT, ".codex")), true);
  assert.equal(fs.statSync(path.join(ROOT, ".codex")).isDirectory(), true);
  assert.equal(fs.existsSync(CONFIG_PATH), true);
});

test("required portable keys are present", () => {
  for (const requiredLine of [
    'project_doc_fallback_filenames = ["CLAUDE.md"]',
    "project_doc_max_bytes = 65536",
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
    'web_search = "cached"'
  ]) {
    assert.ok(CONFIG.includes(requiredLine), `missing required key: ${requiredLine}`);
  }
});

test("no OS-specific command/environment or MCP server declaration is present", () => {
  for (const forbidden of FORBIDDEN_TOKENS) {
    assert.ok(!CONFIG.includes(forbidden), `forbidden token present: ${forbidden}`);
  }
});

test("a deliberate forbidden-token fixture is rejected by the same check", () => {
  const fixture = `${CONFIG}\n\n[mcp_servers.chrome-devtools]\ncommand = "cmd"\n`;
  const violated = FORBIDDEN_TOKENS.filter((token) => fixture.includes(token));
  assert.ok(violated.length > 0, "fixture must trip at least one forbidden token");
});

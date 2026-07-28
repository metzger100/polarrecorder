/**
 * Contract test for the converged AI-instruction pointer rule: CLAUDE.md must stay a
 * short pointer to AGENTS.md and the mandatory preflight files, never drift back into a
 * duplicate copy, and never point at a file that has gone missing. This is the Vitest
 * contract replacement for the retired tools/check-agents-pointer.mjs; every assertion it
 * made is preserved below, one negative case per failure mode.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

const MAX_POINTER_LINES = 40;
const MANDATORY_PREFLIGHT_FILES = [
  "documentation/TABLEOFCONTENTS.md",
  "documentation/conventions/coding-standards.md",
  "documentation/conventions/smell-prevention.md"
];

/**
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
function runAgentsPointerCheck(options = {}) {
  const root = options.root || process.cwd();
  /** @type {string[]} */
  const failures = [];

  const agentsPath = path.join(root, "AGENTS.md");
  const claudePath = path.join(root, "CLAUDE.md");

  if (!fs.existsSync(agentsPath)) {
    failures.push("AGENTS.md is missing; it is the canonical instruction owner.");
  }
  if (!fs.existsSync(claudePath)) {
    failures.push("CLAUDE.md is missing; it must remain a pointer to AGENTS.md.");
    return { ok: false, failures };
  }

  const claude = fs.readFileSync(claudePath, "utf8");

  if (/BEGIN SHARED_INSTRUCTIONS/.test(claude)) {
    failures.push("CLAUDE.md still carries a duplicated shared-instruction block; it must be a pointer only.");
  }

  const nonEmptyLines = claude.split("\n").filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length > MAX_POINTER_LINES) {
    failures.push(
      `CLAUDE.md has ${nonEmptyLines.length} non-empty lines; a pointer must stay at or under ${MAX_POINTER_LINES}.`
    );
  }

  if (!/\[AGENTS\.md\]\(AGENTS\.md\)/.test(claude)) {
    failures.push("CLAUDE.md must link to AGENTS.md via '[AGENTS.md](AGENTS.md)'.");
  }

  for (const preflightFile of MANDATORY_PREFLIGHT_FILES) {
    if (!claude.includes(preflightFile)) {
      failures.push(`CLAUDE.md must name the mandatory preflight file '${preflightFile}'.`);
      continue;
    }
    if (!fs.existsSync(path.join(root, preflightFile))) {
      failures.push(`CLAUDE.md points at '${preflightFile}', which does not exist.`);
    }
  }

  return { ok: failures.length === 0, failures };
}

const ROOT = process.cwd();
const REAL_CLAUDE = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");

/** @returns {string} */
function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-agents-pointer-"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# AGENTS.md\n\ncanonical content\n");
  fs.mkdirSync(path.join(root, "documentation", "conventions"), { recursive: true });
  fs.writeFileSync(path.join(root, "documentation", "TABLEOFCONTENTS.md"), "# TOC\n");
  fs.writeFileSync(path.join(root, "documentation", "conventions", "coding-standards.md"), "# Coding standards\n");
  fs.writeFileSync(path.join(root, "documentation", "conventions", "smell-prevention.md"), "# Smell prevention\n");
  return root;
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("the real repo CLAUDE.md is a valid pointer", () => {
  const result = runAgentsPointerCheck({ root: ROOT });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("passes for a clean fixture root", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(path.join(root, "CLAUDE.md"), REAL_CLAUDE);
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

test("fails when AGENTS.md is missing", () => {
  const root = makeFakeRoot();
  fs.rmSync(path.join(root, "AGENTS.md"));
  fs.writeFileSync(path.join(root, "CLAUDE.md"), REAL_CLAUDE);
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("AGENTS.md is missing")));
  cleanup(root);
});

test("fails when CLAUDE.md is missing", () => {
  const root = makeFakeRoot();
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("CLAUDE.md is missing")));
  cleanup(root);
});

test("fails when CLAUDE.md drifts back into a duplicated shared-instruction block", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(root + "/CLAUDE.md", `${REAL_CLAUDE}\n<!-- BEGIN SHARED_INSTRUCTIONS -->\nduplicated content\n`);
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("duplicated shared-instruction block")));
  cleanup(root);
});

test("fails when CLAUDE.md exceeds the short-pointer line budget", () => {
  const root = makeFakeRoot();
  const bloated = REAL_CLAUDE + Array.from({ length: 60 }, (_, i) => `line ${i}`).join("\n");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), bloated);
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("non-empty lines")));
  cleanup(root);
});

test("fails when CLAUDE.md does not link to AGENTS.md", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(path.join(root, "CLAUDE.md"), REAL_CLAUDE.replace(/\[AGENTS\.md\]\(AGENTS\.md\)/g, "AGENTS.md"));
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("must link to AGENTS.md")));
  cleanup(root);
});

test("fails when CLAUDE.md points at a mandatory preflight file that does not exist", () => {
  const root = makeFakeRoot();
  fs.rmSync(path.join(root, "documentation", "conventions", "smell-prevention.md"));
  fs.writeFileSync(path.join(root, "CLAUDE.md"), REAL_CLAUDE);
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("does not exist")));
  cleanup(root);
});

test("fails when CLAUDE.md no longer names a mandatory preflight file", () => {
  const root = makeFakeRoot();
  fs.writeFileSync(
    path.join(root, "CLAUDE.md"),
    REAL_CLAUDE.replace("documentation/conventions/smell-prevention.md", "some/other/file.md")
  );
  const result = runAgentsPointerCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("must name the mandatory preflight file")));
  cleanup(root);
});

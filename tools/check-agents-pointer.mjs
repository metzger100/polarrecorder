#!/usr/bin/env node

/**
 * Replacement for a retired byte-sync contract between AGENTS.md and CLAUDE.md: AGENTS.md
 * is the sole canonical instruction owner, and CLAUDE.md must remain a short pointer to it
 * plus the mandatory preflight files, never a re-expanded duplicate.
 */

import fs from "node:fs";
import path from "node:path";

const MAX_POINTER_LINES = 40;
const MANDATORY_PREFLIGHT_FILES = [
  "documentation/TABLEOFCONTENTS.md",
  "documentation/conventions/coding-standards.md",
  "documentation/conventions/smell-prevention.md"
];

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runAgentsPointerCheck(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];

  const agentsPath = path.join(root, "AGENTS.md");
  const claudePath = path.join(root, "CLAUDE.md");

  if (!fs.existsSync(agentsPath)) {
    failures.push("AGENTS.md is missing; it is the canonical instruction owner.");
  }
  if (!fs.existsSync(claudePath)) {
    failures.push("CLAUDE.md is missing; it must remain a pointer to AGENTS.md.");
    return finish(failures, print);
  }

  const claude = fs.readFileSync(claudePath, "utf8");

  if (/BEGIN SHARED_INSTRUCTIONS/.test(claude)) {
    failures.push(
      "CLAUDE.md still carries a duplicated shared-instruction block; it must be a pointer only."
    );
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

  return finish(failures, print);
}

/**
 * @param {string[]} failures
 * @param {boolean} print
 * @returns {{ok: boolean, failures: string[]}}
 */
function finish(failures, print) {
  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[agents-pointer] ${failure}`);
    } else {
      console.log(
        "CLAUDE.md is a valid, short pointer to AGENTS.md and the mandatory preflight files."
      );
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runAgentsPointerCheck();
  process.exit(result.ok ? 0 : 1);
}

#!/usr/bin/env node

/**
 * Hook doctor (`npm run hooks:doctor`).
 *
 * Verifies the pre-push gate is actually installed: `npm run check:all` (via
 * `.githooks/pre-push`) only runs on push if `core.hooksPath` points at `.githooks` and
 * the hook is executable; without this doctor, the gate silently never fires for a
 * fresh clone. Named to pair consistently with `hooks-install.mjs` (`hooks-*.mjs` <->
 * `hooks:*`).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runHookPolicy } from "./portable-core/hook-engine.mjs";

const EXPECTED_HOOKS_PATH = ".githooks";

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runHooksDoctor(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];

  if (!fs.existsSync(path.join(root, ".git"))) {
    failures.push("Not a git repository root: .git directory is missing.");
  } else {
    /** @type {string} */
    let configured;
    try {
      configured = String(
        execFileSync("git", ["config", "--get", "core.hooksPath"], {
          cwd: root,
          stdio: ["ignore", "pipe", "ignore"]
        })
      ).trim();
    } catch {
      configured = "";
    }

    if (configured !== EXPECTED_HOOKS_PATH) {
      failures.push(
        `git core.hooksPath is '${configured || "<unset>"}' (expected '${EXPECTED_HOOKS_PATH}'). Run: npm run hooks:install`
      );
    }
  }

  const hookResult = runHookPolicy({ root, paths: [".githooks/pre-push"] });
  for (const failure of hookResult.failures) {
    failures.push(failure.includes("missing hook") ? "Missing .githooks/pre-push" : failure);
  }

  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[hooks-doctor] ${failure}`);
    } else {
      console.log("Git hooks are correctly configured.");
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runHooksDoctor();
  process.exit(result.ok ? 0 : 1);
}

#!/usr/bin/env node

/**
 * Hook doctor (`npm run hooks:doctor`).
 *
 * Verifies the pre-push gate is actually installed: `tools/check-all.sh` (via
 * `.githooks/pre-push`) only runs on push if `core.hooksPath` points at `.githooks` and
 * the hook is executable; without this doctor, the gate silently never fires for a
 * fresh clone. Named to pair consistently with `hooks-install.mjs` (`hooks-*.mjs` <->
 * `hooks:*`).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const EXPECTED_HOOKS_PATH = ".githooks";

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function checkHooksDoctor(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];
  const prePush = path.join(root, ".githooks", "pre-push");

  if (!fs.existsSync(path.join(root, ".git"))) {
    failures.push("Not a git repository root: .git directory is missing.");
  } else {
    let configured = "";
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

  if (!fs.existsSync(prePush)) {
    failures.push("Missing .githooks/pre-push");
  } else if ((fs.statSync(prePush).mode & 0o111) === 0) {
    failures.push(".githooks/pre-push is not executable. Run: npm run hooks:install");
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
  const result = checkHooksDoctor();
  process.exit(result.ok ? 0 : 1);
}

#!/usr/bin/env node

/**
 * Hook installer (`npm run hooks:install`).
 *
 * Sets only `core.hooksPath=.githooks` and ensures `.githooks/pre-push` is executable
 * (`0o755`) -- the two conditions `hooks-doctor.mjs` verifies. Named to pair consistently
 * with `hooks-doctor.mjs` (`hooks-*.mjs` <-> `hooks:*`).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function installHooks(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];
  const hookDir = path.join(root, ".githooks");
  const prePush = path.join(hookDir, "pre-push");

  if (!fs.existsSync(path.join(root, ".git"))) {
    failures.push("Not a git repository root: .git directory is missing.");
  } else if (!fs.existsSync(prePush)) {
    failures.push("Missing required hook file: .githooks/pre-push");
  } else {
    try {
      execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
        cwd: root,
        stdio: "ignore"
      });
      fs.chmodSync(prePush, 0o755);
    } catch (error) {
      failures.push(`Failed to install git hooks: ${/** @type {Error} */ (error).message}`);
    }
  }

  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(failure);
    } else {
      console.log("Installed git hooks path (.githooks) and ensured pre-push is executable.");
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = installHooks();
  process.exit(result.ok ? 0 : 1);
}

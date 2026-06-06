#!/usr/bin/env node

// Verify the pre-push gate is actually installed. tools/check-all.sh only runs
// on push if core.hooksPath points at .githooks and the hook is executable;
// without this doctor, the gate silently never fires for a fresh clone.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const hookPathExpected = ".githooks";
const prePush = path.join(ROOT, ".githooks", "pre-push");
const failures = [];

if (!fs.existsSync(path.join(ROOT, ".git"))) {
  failures.push("Not a git repository root: .git directory is missing.");
} else {
  let configured = "";
  try {
    configured = String(execFileSync("git", ["config", "--get", "core.hooksPath"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"]
    })).trim();
  } catch {
    configured = "";
  }

  if (configured !== hookPathExpected) {
    failures.push(`git core.hooksPath is '${configured || "<unset>"}' (expected '${hookPathExpected}'). Run: npm run hooks:install`);
  }
}

if (!fs.existsSync(prePush)) {
  failures.push("Missing .githooks/pre-push");
} else if ((fs.statSync(prePush).mode & 0o111) === 0) {
  failures.push(".githooks/pre-push is not executable. Run: npm run hooks:install");
}

if (failures.length) {
  for (const line of failures) console.error("[hooks-doctor] " + line);
  process.exit(1);
}

console.log("Git hooks are correctly configured.");

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const hookDir = path.join(ROOT, ".githooks");
const prePush = path.join(hookDir, "pre-push");

if (!fs.existsSync(path.join(ROOT, ".git"))) {
  console.error("Not a git repository root: .git directory is missing.");
  process.exit(1);
}

if (!fs.existsSync(prePush)) {
  console.error("Missing required hook file: .githooks/pre-push");
  process.exit(1);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: ROOT, stdio: "inherit" });
  fs.chmodSync(prePush, 0o755);
  console.log("Installed git hooks path (.githooks) and ensured pre-push is executable.");
} catch (error) {
  console.error("Failed to install git hooks:", error.message);
  process.exit(1);
}

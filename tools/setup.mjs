#!/usr/bin/env node

/**
 * `npm run setup` -- the only routine command allowed to touch the network.
 *
 * Runs, in order: `npm ci` (already done by npm itself before this script executes, so
 * this script only re-asserts it ran), locked Python developer-environment provisioning
 * (venv create/update + hash-required install against the frozen developer-Python
 * contract), and checksum-verified actionlint provisioning. Never mutates `.git/config`;
 * hook activation stays the explicit `npm run hooks:install` step.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEV_PYTHON_CONTRACT = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tools", "quality-policy", "developer-python.json"), "utf8")
);

function resolveInterpreter() {
  return process.env.POLARRECORDER_PYTHON || DEV_PYTHON_CONTRACT.preferredInterpreter;
}

function resolveVenvDir() {
  return process.env.POLARRECORDER_VENV || path.join(ROOT, "venv");
}

function run(command, args, options = {}) {
  console.log(`+ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", cwd: ROOT, ...options });
}

function provisionPython() {
  const interpreter = resolveInterpreter();
  const venvDir = resolveVenvDir();
  const versionOutput = execFileSync(interpreter, ["--version"], { encoding: "utf8" }).trim();
  const versionMatch = /Python (\d+)\.(\d+)/.exec(versionOutput);
  if (!versionMatch) {
    throw new Error(`setup: could not parse Python version from "${versionOutput}"`);
  }
  const [, major, minor] = versionMatch;
  const supported = DEV_PYTHON_CONTRACT.supportedVersionRange;
  const isSupportedRange = supported === ">=3.14,<3.15";
  if (!(isSupportedRange && major === "3" && minor === "14")) {
    throw new Error(
      `setup: ${interpreter} reports ${versionOutput}, outside the frozen contract ` +
        `${supported} (tools/quality-policy/developer-python.json). Set ` +
        "POLARRECORDER_PYTHON to a supported interpreter, or re-verify and widen the " +
        "contract with recorded evidence."
    );
  }

  if (!fs.existsSync(path.join(venvDir, "bin", "python"))) {
    run(interpreter, ["-m", "venv", venvDir]);
  }
  const venvPython = path.join(venvDir, "bin", "python");
  run(venvPython, ["-m", "pip", "install", `pip==${DEV_PYTHON_CONTRACT.pipBootstrapVersion}`]);
  run(venvPython, [
    "-m",
    "pip",
    "install",
    "--require-hashes",
    "-r",
    path.join(ROOT, "requirements-dev.txt")
  ]);
}

function provisionActionlint() {
  run("bash", [path.join(ROOT, "tools", "actionlint.sh"), "--install"]);
}

console.log("setup: npm ci already ran via the npm lifecycle that invoked this script.");
provisionPython();
provisionActionlint();
console.log("setup: done.");

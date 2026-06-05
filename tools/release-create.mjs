import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildReleaseManifest,
  validateManifest
} from "./release-runtime.mjs";

const VERSION_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parseReleaseCreateArgs(argv) {
  const out = { version: "" };

  for (const arg of argv) {
    if (arg.startsWith("--version=")) {
      out.version = arg.slice("--version=".length).trim();
    }
  }

  return out;
}

export function createRelease(options) {
  const rootDir = options.rootDir || process.cwd();
  const version = String(options.version || "").trim();

  const runCommand = options.runCommand || defaultRunCommand;
  const manifestBuilder = options.manifestBuilder || buildReleaseManifest;
  const manifestValidator = options.manifestValidator || validateManifest;
  const output = options.output || {
    log: (message) => console.log(message)
  };

  const notesAbs = validateInputs({ rootDir, version, runCommand });
  ensureCleanWorktreeOutsideReleases(runCommand, rootDir);

  runRequiredCheck(runCommand, rootDir, ["tools/check-all.sh"], "tools/check-all.sh");

  const manifestFiles = manifestBuilder(rootDir);
  const manifestValidation = manifestValidator(rootDir, manifestFiles);
  if (!manifestValidation.valid) {
    throw new Error(
      "release:create aborted: manifest contains missing files:\n" +
      manifestValidation.missing.map((relPath) => `- ${relPath}`).join("\n")
    );
  }

  const releasesDir = path.join(rootDir, "releases");
  fs.mkdirSync(releasesDir, { recursive: true });

  const zipName = `polarrecorder-${version}.zip`;
  const zipAbs = path.join(releasesDir, zipName);
  const releaseNotesAbs = notesAbs;

  runRequiredCheck(
    runCommand,
    rootDir,
    ["python", "tools/release-zip.py", "--version", version],
    `python tools/release-zip.py --version ${version}`
  );
  runRequiredCheck(
    runCommand,
    rootDir,
    ["python", "tools/check-release.py", `releases/${zipName}`],
    `python tools/check-release.py releases/${zipName}`
  );

  const tag = `v${version}`;
  runGit(runCommand, rootDir, [
    "add",
    `releases/${zipName}`,
    path.relative(rootDir, releaseNotesAbs).replace(/\\/g, "/")
  ]);
  runGit(runCommand, rootDir, ["commit", "-m", `release: ${tag}`]);
  runGit(runCommand, rootDir, ["tag", "-a", tag, "-m", `Release ${tag}`]);

  const totalSizeBytes = manifestFiles.reduce((sum, relPath) => {
    const absPath = path.join(rootDir, relPath);
    return sum + fs.statSync(absPath).size;
  }, 0);

  output.log("release:create completed");
  output.log(`included files: ${manifestFiles.length} (${totalSizeBytes} bytes)`);
  output.log(`zip: ${path.relative(rootDir, zipAbs).replace(/\\/g, "/")}`);
  output.log(`notes: ${path.relative(rootDir, releaseNotesAbs).replace(/\\/g, "/")}`);
  output.log(`commit: release: ${tag}`);
  output.log(`tag: ${tag}`);
  output.log(`next: git push origin main && git push origin ${tag}`);

  return {
    version,
    tag,
    zipPath: zipAbs,
    notesFile: releaseNotesAbs,
    filesIncluded: manifestFiles.length,
    totalSizeBytes
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseReleaseCreateArgs(argv);
    createRelease({ version: args.version });
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

function validateInputs({ rootDir, version, runCommand }) {
  if (!VERSION_REGEX.test(version)) {
    throw new Error("release:create aborted: --version must be a valid SemVer string without 'v' prefix");
  }

  const notesAbs = getCanonicalReleaseNotesPath(rootDir, version);
  if (!fs.existsSync(notesAbs)) {
    throw new Error(`release:create aborted: notes file not found: ${path.relative(rootDir, notesAbs).replace(/\\/g, "/")}`);
  }

  const notesText = fs.readFileSync(notesAbs, "utf8");
  if (!notesText.trim()) {
    throw new Error(`release:create aborted: notes file is empty: ${path.relative(rootDir, notesAbs).replace(/\\/g, "/")}`);
  }

  const tag = `v${version}`;
  const existingTag = runGit(runCommand, rootDir, ["tag", "-l", tag]).trim();
  if (existingTag) {
    throw new Error(`release:create aborted: git tag already exists: ${tag}`);
  }

  return notesAbs;
}

function ensureCleanWorktreeOutsideReleases(runCommand, rootDir) {
  const statusOutput = runGit(runCommand, rootDir, ["status", "--porcelain", "--untracked-files=all"]);
  const dirtyOutsideReleases = statusOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .some((line) => {
      const pathText = line.slice(3);
      const targetPath = pathText.includes(" -> ") ? pathText.split(" -> ").pop() : pathText;
      const normalized = normalizeRepoRelativePath(targetPath);
      return !normalized.startsWith("releases/");
    });

  if (dirtyOutsideReleases) {
    throw new Error("release:create aborted: working tree has uncommitted changes outside releases/");
  }
}

function runRequiredCheck(runCommand, rootDir, commandWithArgs, label) {
  const [command, ...args] = commandWithArgs;
  const result = runCommand(command, args, { cwd: rootDir });
  if (result.status !== 0) {
    throw new Error(`release:create aborted: required gate failed (${label})`);
  }
}

function runGit(runCommand, rootDir, args) {
  const result = runCommand("git", args, { cwd: rootDir });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter((value) => typeof value === "string" && value.trim() !== "")
      .join("\n")
      .trim();
    throw new Error(`release:create aborted: git ${args.join(" ")} failed${detail ? `\n${detail}` : ""}`);
  }
  return result.stdout || "";
}

function normalizeRepoRelativePath(rawPath) {
  return String(rawPath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function getCanonicalReleaseNotesPath(rootDir, version) {
  return path.join(rootDir, "releases", `polarrecorder-${version}.md`);
}

export function defaultRunCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: withProjectVenv(process.env, options.cwd)
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error || null
  };
}

// Prepend the project-local venv's bin directory to PATH so spawned `python`/dev
// tooling resolves to the project venv by default, matching tools/check-all.sh and
// the pre-push hook. Honors POLARRECORDER_VENV; falls back to system PATH if absent.
function withProjectVenv(env, cwd) {
  const venvDir = env.POLARRECORDER_VENV || path.join(cwd || process.cwd(), "venv");
  const binDir = path.join(venvDir, "bin");
  if (!fs.existsSync(binDir)) {
    return env;
  }
  const sep = path.delimiter;
  return { ...env, PATH: `${binDir}${sep}${env.PATH || ""}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

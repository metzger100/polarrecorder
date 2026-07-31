import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { isDirtyOutsidePrefix, parsePorcelainStatusZ } from "./release-git.mjs";
import { isValidSemver, tagFor } from "./release-version.mjs";
import { createReleaseArchive } from "./release-archive.mjs";
import { runReleasePolicy } from "./portable-core/release-engine.mjs";

/** @typedef {{status: number | null, stdout: string, stderr: string, error?: Error | null}} CommandResult */
/** @typedef {(command: string, args: string[], options: {cwd?: string}) => CommandResult} RunCommand */
/** @typedef {{log: (message: string) => void}} Output */
/**
 * @typedef {{
 *   rootDir?: string,
 *   version?: string,
 *   runCommand?: RunCommand,
 *   archiveBuilder?: (root: string, version: string, output: string) => {filesIncluded: number, totalSizeBytes: number},
 *   output?: Output
 * }} CreateReleaseOptions
 */
/**
 * @typedef {{
 *   version: string,
 *   tag: string,
 *   zipPath: string,
 *   notesFile: string,
 *   filesIncluded: number,
 *   totalSizeBytes: number
 * }} CreateReleaseSummary
 */

/**
 * @param {string[]} argv
 * @returns {{version: string}}
 */
export function parseReleaseCreateArgs(argv) {
  const out = { version: "" };

  for (const arg of argv) {
    if (arg.startsWith("--version=")) {
      out.version = arg.slice("--version=".length).trim();
    }
  }

  return out;
}

/**
 * @param {CreateReleaseOptions} options
 * @returns {CreateReleaseSummary}
 */
export function createRelease(options) {
  const rootDir = options.rootDir || process.cwd();
  const version = String(options.version || "").trim();

  const runCommand = options.runCommand || defaultRunCommand;
  const archiveBuilder = options.archiveBuilder || createReleaseArchive;
  const output = options.output || {
    log: (/** @type {string} */ message) => console.log(message)
  };

  const notesAbs = validateInputs({ rootDir, version, runCommand });
  ensureCleanWorktreeOutsideReleases(runCommand, rootDir);

  runRequiredCheck(runCommand, rootDir, ["npm", "run", "check:all"], "npm run check:all");

  const releasesDir = path.join(rootDir, "releases");
  fs.mkdirSync(releasesDir, { recursive: true });

  const zipName = `polarrecorder-${version}.zip`;
  const zipAbs = path.join(releasesDir, zipName);
  const releaseNotesAbs = notesAbs;

  const { filesIncluded, totalSizeBytes } = archiveBuilder(rootDir, version, zipAbs);

  const tag = tagFor(version);
  runGit(runCommand, rootDir, [
    "add",
    `releases/${zipName}`,
    path.relative(rootDir, releaseNotesAbs).replace(/\\/g, "/")
  ]);
  runGit(runCommand, rootDir, ["commit", "-m", `release: ${tag}`]);
  runGit(runCommand, rootDir, ["tag", "-a", tag, "-m", `Release ${tag}`]);

  output.log("release:create completed");
  output.log(`included files: ${filesIncluded} (${totalSizeBytes} bytes)`);
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
    filesIncluded,
    totalSizeBytes
  };
}

/**
 * @param {string[]} [argv]
 * @returns {void}
 */
export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseReleaseCreateArgs(argv);
    createRelease({ version: args.version });
  } catch (error) {
    console.error(/** @type {Error} */ (error).message || String(error));
    process.exit(1);
  }
}

/**
 * Canonical release-creation entry point for tests and local adapters.
 * @param {string[]} [argv]
 * @returns {void}
 */
export function runReleaseCreate(argv = process.argv.slice(2)) {
  main(argv);
}

/**
 * @param {{rootDir: string, version: string, runCommand: RunCommand}} params
 * @returns {string}
 */
function validateInputs({ rootDir, version, runCommand }) {
  if (!isValidSemver(version) || !runReleasePolicy({ version, payload: [] }).ok) {
    throw new Error("release:create aborted: --version must be a valid SemVer string without 'v' prefix");
  }

  const notesAbs = getCanonicalReleaseNotesPath(rootDir, version);
  if (!fs.existsSync(notesAbs)) {
    throw new Error(
      `release:create aborted: notes file not found: ${path.relative(rootDir, notesAbs).replace(/\\/g, "/")}`
    );
  }

  const notesText = fs.readFileSync(notesAbs, "utf8");
  if (!notesText.trim()) {
    throw new Error(
      `release:create aborted: notes file is empty: ${path.relative(rootDir, notesAbs).replace(/\\/g, "/")}`
    );
  }

  const tag = tagFor(version);
  const existingTag = runGit(runCommand, rootDir, ["tag", "-l", tag]).trim();
  if (existingTag) {
    throw new Error(`release:create aborted: git tag already exists: ${tag}`);
  }

  return notesAbs;
}

/**
 * @param {RunCommand} runCommand
 * @param {string} rootDir
 * @returns {void}
 */
function ensureCleanWorktreeOutsideReleases(runCommand, rootDir) {
  const statusOutput = runGit(runCommand, rootDir, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const entries = parsePorcelainStatusZ(statusOutput);

  if (isDirtyOutsidePrefix(entries, "releases/")) {
    throw new Error("release:create aborted: working tree has uncommitted changes outside releases/");
  }
}

/**
 * @param {RunCommand} runCommand
 * @param {string} rootDir
 * @param {string[]} commandWithArgs
 * @param {string} label
 * @returns {CommandResult}
 */
function runRequiredCheck(runCommand, rootDir, commandWithArgs, label) {
  const [command, ...args] = commandWithArgs;
  const result = runCommand(command, args, { cwd: rootDir });
  if (result.status !== 0) {
    throw new Error(`release:create aborted: required gate failed (${label})`);
  }
  return result;
}

/**
 * @param {RunCommand} runCommand
 * @param {string} rootDir
 * @param {string[]} args
 * @returns {string}
 */
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

/**
 * @param {string} rootDir
 * @param {string} version
 * @returns {string}
 */
function getCanonicalReleaseNotesPath(rootDir, version) {
  return path.join(rootDir, "releases", `polarrecorder-${version}.md`);
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?: string}} [options]
 * @returns {CommandResult}
 */
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
// tooling resolves to the project venv by default, matching the pre-push gate and
// the pre-push hook. Honors POLARRECORDER_VENV; falls back to system PATH if absent.
/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} [cwd]
 * @returns {NodeJS.ProcessEnv}
 */
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

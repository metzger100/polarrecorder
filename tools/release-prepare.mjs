import { spawnSync } from "node:child_process";

import { isRuntimePath } from "./release-runtime.mjs";
import { parsePorcelainStatusZ } from "./release-git.mjs";

/** @typedef {(args: string[]) => string} RunGit */
/** @typedef {{status: string, path: string}} ChangedFileEntry */
/** @typedef {{tag: string, date: string} | null} LastRelease */
/** @typedef {{mode: string, range: string, automaticSuggestion: null, decisionInputs: string[], reviewCommands: string[]}} SemverReview */
/**
 * @typedef {{
 *   plugin: string,
 *   lastRelease: LastRelease,
 *   commitsSinceLastRelease: string[],
 *   changeSummary: {runtimeFilesChanged: number, devOnlyFilesChanged: number, newFiles: number, deletedFiles: number},
 *   runtimeChangedPaths: string[],
 *   changedPaths: string[],
 *   semverReview: SemverReview
 * }} ReleasePreparePayload
 */

const LIVE_CHECKLIST_PATH = "documentation/guides/live-avnav-checklist.md";

const HELP_TEXT = `Usage: npm run release:prepare

Reports manual SemVer review evidence for the changes since the last release tag.
Requires a completely clean working tree (git status --porcelain=v1 -z) and takes no
other arguments.

Before publishing, run the manual live-AvNav validation checklist at
${LIVE_CHECKLIST_PATH} against a real AvNav host and record the filled-in result;
this tool only prints its location and never claims that checklist passed.

Options:
  -h, --help  Print this help and exit (side-effect free).
`;

/**
 * @param {{runGit?: RunGit, pluginName?: string}} [options]
 * @returns {ReleasePreparePayload}
 */
export function buildReleasePreparePayload(options = {}) {
  const runGit = options.runGit || defaultRunGit;
  const pluginName = options.pluginName || "polarrecorder";

  const lastTag = readLatestTag(runGit);
  const lastRelease = lastTag
    ? {
        tag: lastTag,
        date: readTagDate(runGit, lastTag)
      }
    : null;

  const commitLines = readCommits(runGit, lastTag);
  const changedFiles = readChangedFiles(runGit, lastTag);

  /** @type {string[]} */
  const runtimeChangedPaths = [];
  /** @type {string[]} */
  const changedPaths = [];
  let runtimeFilesChanged = 0;
  let devOnlyFilesChanged = 0;
  let newFiles = 0;
  let deletedFiles = 0;

  for (const entry of changedFiles) {
    const normalizedPath = normalizeChangedPath(entry.path);
    changedPaths.push(normalizedPath);
    const runtime = isRuntimePath(normalizedPath);

    if (runtime) {
      runtimeFilesChanged += 1;
      runtimeChangedPaths.push(normalizedPath);
    } else {
      devOnlyFilesChanged += 1;
    }

    if (entry.status === "A") newFiles += 1;
    if (entry.status === "D") deletedFiles += 1;
  }

  const uniqueRuntimePaths = Array.from(new Set(runtimeChangedPaths)).sort((a, b) =>
    a.localeCompare(b)
  );
  const uniqueChangedPaths = Array.from(new Set(changedPaths)).sort((a, b) => a.localeCompare(b));

  return {
    plugin: pluginName,
    lastRelease,
    commitsSinceLastRelease: commitLines,
    changeSummary: {
      runtimeFilesChanged,
      devOnlyFilesChanged,
      newFiles,
      deletedFiles
    },
    runtimeChangedPaths: uniqueRuntimePaths,
    changedPaths: uniqueChangedPaths,
    semverReview: buildSemverReview(lastTag)
  };
}

/**
 * @param {string[]} argv
 * @returns {{help: boolean}}
 */
export function parseReleasePrepareArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }
  if (argv.length > 0) {
    throw new Error(`release:prepare: unknown argument(s): ${argv.join(", ")}`);
  }
  return { help: false };
}

/**
 * @param {(args: string[]) => string} runGit
 * @returns {void}
 */
export function requireCleanTree(runGit) {
  const statusOutput = runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (parsePorcelainStatusZ(statusOutput).length > 0) {
    throw new Error(
      "release:prepare aborted: working tree must be completely clean (commit or stash first)."
    );
  }
}

/**
 * @param {string[]} [argv]
 * @returns {void}
 */
export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseReleasePrepareArgs(argv);
    if (args.help) {
      process.stdout.write(HELP_TEXT);
      return;
    }
    requireCleanTree(defaultRunGit);
    const payload = buildReleasePreparePayload();
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    console.error(
      `\nBefore publishing, run the live-AvNav validation checklist at ${LIVE_CHECKLIST_PATH} ` +
        "against a real AvNav host and record the filled-in result. This command does not run " +
        "that checklist and does not claim it passed."
    );
  } catch (error) {
    console.error(/** @type {Error} */ (error).message || String(error));
    process.exit(1);
  }
}

/**
 * @param {RunGit} runGit
 * @returns {string | null}
 */
function readLatestTag(runGit) {
  try {
    const out = runGit(["describe", "--tags", "--abbrev=0", "--match", "v*"]).trim();
    return out || null;
  } catch (_err) {
    return null;
  }
}

/**
 * @param {RunGit} runGit
 * @param {string} tag
 * @returns {string}
 */
function readTagDate(runGit, tag) {
  return runGit(["log", "-1", "--format=%cs", tag]).trim();
}

/**
 * @param {RunGit} runGit
 * @param {string | null} lastTag
 * @returns {string[]}
 */
function readCommits(runGit, lastTag) {
  const args = ["log", "--reverse", "--oneline"];
  if (lastTag) {
    args.push(`${lastTag}..HEAD`);
  } else {
    args.push("--root");
  }
  const out = runGit(args).trim();
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean);
}

/**
 * @param {RunGit} runGit
 * @param {string | null} lastTag
 * @returns {ChangedFileEntry[]}
 */
function readChangedFiles(runGit, lastTag) {
  const args = ["diff", "--name-status", "--find-renames"];
  if (lastTag) {
    args.push(`${lastTag}..HEAD`);
  } else {
    args.push("--root", "HEAD");
  }

  const out = runGit(args).trim();
  if (!out) return [];

  return /** @type {ChangedFileEntry[]} */ (
    out.split(/\r?\n/).filter(Boolean).map(parseNameStatusLine).filter(Boolean)
  );
}

/**
 * @param {string} line
 * @returns {ChangedFileEntry | null}
 */
function parseNameStatusLine(line) {
  const parts = line.split("\t");
  if (parts.length < 2) return null;

  const statusCode = parts[0];
  const status = statusCode.charAt(0);

  if (status === "R" || status === "C") {
    return {
      status,
      path: parts[parts.length - 1]
    };
  }

  return {
    status,
    path: parts[1]
  };
}

/**
 * @param {string | null} lastTag
 * @returns {SemverReview}
 */
function buildSemverReview(lastTag) {
  const range = lastTag ? `${lastTag}..HEAD` : "repository history";
  const reviewCommands = lastTag
    ? [
        `git log --reverse --oneline ${range}`,
        `git diff --stat --find-renames ${range}`,
        `git diff --name-status --find-renames ${range}`,
        `git diff --find-renames ${range}`
      ]
    : [
        "git log --reverse --oneline --root",
        "git diff --stat --find-renames --root HEAD",
        "git diff --name-status --find-renames --root HEAD",
        "git diff --find-renames --root HEAD"
      ];

  return {
    mode: "manual-codebase-review",
    range,
    automaticSuggestion: null,
    decisionInputs: [
      "Read commit messages as natural-language descriptions, not Conventional Commit syntax.",
      "Inspect changed files and relevant diffs.",
      "Research touched runtime/config/viewer/documentation areas in the codebase.",
      "Classify SemVer from actual user-facing impact and compatibility."
    ],
    reviewCommands
  };
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function normalizeChangedPath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

/**
 * @param {string[]} args
 * @returns {string}
 */
function defaultRunGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status === 0) {
    return result.stdout || "";
  }

  const detail = [result.stdout, result.stderr]
    .filter((value) => typeof value === "string" && value.trim() !== "")
    .join("\n")
    .trim();
  throw new Error(`git ${args.join(" ")} failed${detail ? `\n${detail}` : ""}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

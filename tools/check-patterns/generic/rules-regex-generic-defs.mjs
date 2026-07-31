import { getFileData, scopeFor } from "../shared.mjs";
import { stripStrings } from "../ast-utils.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").Finding} Finding
 */

// Machine-local home paths must never be committed in source or docs; they
// break on every other machine and leak the author's username.
const HOME_PATH = /(?:\/home\/[A-Za-z0-9_.-]+\/|\/Users\/[A-Za-z0-9_.-]+\/)/;
// A bare "PLANx.md" is a legitimate reference to a real historical exec-plan file; anything
// else naming a plan or phase number is a citation that will go stale once the plan is
// archived, and must describe the code/config standalone instead.
const EXEC_PLAN_CITATION_PATTERN = /\bPLAN\d+\b(?!\.md)/;
const EXEC_PLAN_PHASE_PATTERN = /\bPhase\s?\d+[A-Za-z]?\b/;

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runAbsoluteHomePath(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const match = HOME_PATH.exec(lines[index]);
      if (!match) continue;
      out.push({
        file,
        line: index + 1,
        message: `absolute home path '${match[0]}' is forbidden; use a project-relative or redacted placeholder`
      });
    }
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runExecPlanReference(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = EXEC_PLAN_CITATION_PATTERN.exec(line) || EXEC_PLAN_PHASE_PATTERN.exec(line);
      if (!match) continue;
      out.push({
        file,
        line: index + 1,
        message: `'${match[0]}' cites a historical exec-plan/phase; describe the code or config standalone instead`
      });
    }
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runNoNulByte(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const index = text.indexOf("\u0000");
    if (index === -1) continue;
    const line = text.slice(0, index).split(/\r?\n/).length;
    out.push({ file, line, message: "file contains a literal NUL byte" });
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runInnerHtmlAssignment(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const code = stripStrings(lines[index]);
      if (/\.innerHTML\s*=/.test(code)) {
        out.push({ file, line: index + 1, message: "innerHTML assignment is forbidden" });
      }
    }
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runCommentedOutCode(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    let commentedCodeRun = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*\/\//.test(line) && /[={}(]|\b(function|return)\b/.test(line)) {
        commentedCodeRun += 1;
        if (commentedCodeRun === 3) {
          out.push({ file, line: index + 1, message: "three or more consecutive commented-out code lines" });
        }
      } else {
        commentedCodeRun = 0;
      }
    }
  }
  return out;
}

/** @type {Rule[]} */
export const LINE_GENERIC_RULES = [
  {
    id: "absolute-home-path",
    name: "absolute-home-path",
    severity: "block",
    scope: scopeFor("absolute-home-path"),
    run: (_rule, files) => runAbsoluteHomePath(files)
  },
  {
    id: "exec-plan-reference",
    name: "exec-plan-reference",
    severity: "block",
    scope: scopeFor("exec-plan-reference"),
    run: (_rule, files) => runExecPlanReference(files)
  },
  {
    id: "no-nul-byte",
    name: "no-nul-byte",
    severity: "block",
    scope: scopeFor("no-nul-byte"),
    run: (_rule, files) => runNoNulByte(files)
  },
  {
    id: "unsafe-html-dom-sink",
    name: "unsafe-html-dom-sink",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runInnerHtmlAssignment(files)
  },
  {
    id: "dead-code",
    name: "dead-code",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runCommentedOutCode(files)
  },
  {
    id: "console-in-runtime",
    name: "console-in-runtime",
    severity: "block",
    scope: scopeFor("console-in-runtime"),
    detect: /\bconsole\.(?:log|info|warn|error|debug)\s*\(/g,
    message: () => "console call in shipped runtime is forbidden; use the owned boundary reporting path"
  }
];

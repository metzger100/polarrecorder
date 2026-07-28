import { fail } from "../shared.mjs";
import { getFileData } from "../file-cache.mjs";
import { stripStrings } from "../source-scan.mjs";
import {
  collectAbsolutePathTargets,
  collectExecPlanReferenceTargets,
  collectJavaScriptPatternFiles
} from "../discovery.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").PatternFile} PatternFile
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
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runAbsoluteHomePath(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      const match = HOME_PATH.exec(lines[index]);
      if (match) {
        fail(
          file.rel,
          index,
          `absolute home path '${match[0]}' is forbidden; use a project-relative or redacted placeholder`,
          "absolute-home-path",
          lines
        );
      }
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runExecPlanReference(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = EXEC_PLAN_CITATION_PATTERN.exec(line) || EXEC_PLAN_PHASE_PATTERN.exec(line);
      if (match) {
        fail(
          file.rel,
          index,
          `'${match[0]}' cites a historical exec-plan/phase; describe the code or config standalone instead`,
          "exec-plan-reference",
          lines
        );
      }
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runNoNulByte(files) {
  for (const file of files) {
    const { content } = getFileData(file);
    const index = content.indexOf("\u0000");
    if (index === -1) continue;
    const zeroBasedLine = content.slice(0, index).split(/\r?\n/).length - 1;
    fail(file.rel, zeroBasedLine, "file contains a literal NUL byte", "no-nul-byte");
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runInnerHtmlAssignment(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      const code = stripStrings(lines[index]);
      if (/\.innerHTML\s*=/.test(code)) {
        fail(file.rel, index, "innerHTML assignment is forbidden", "inner-html-assignment", lines);
      }
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runCommentedOutCode(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    let commentedCodeRun = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*\/\//.test(line) && /[={}(]|\b(function|return)\b/.test(line)) {
        commentedCodeRun += 1;
        if (commentedCodeRun === 3) {
          fail(file.rel, index, "three or more consecutive commented-out code lines", "commented-out-code", lines);
        }
      } else {
        commentedCodeRun = 0;
      }
    }
  }
}

const JS_SCOPE = { key: "js-all", collect: collectJavaScriptPatternFiles };

/** @type {Rule[]} */
export const LINE_GENERIC_RULES = [
  {
    id: "absolute-home-path",
    name: "absolute-home-path",
    severity: "block",
    scope: { key: "absolute-path", collect: collectAbsolutePathTargets },
    run: (_rule, files) => runAbsoluteHomePath(files)
  },
  {
    id: "exec-plan-reference",
    name: "exec-plan-reference",
    severity: "block",
    scope: { key: "exec-plan-reference", collect: collectExecPlanReferenceTargets },
    run: (_rule, files) => runExecPlanReference(files)
  },
  {
    id: "no-nul-byte",
    name: "no-nul-byte",
    severity: "block",
    scope: { key: "exec-plan-reference", collect: collectExecPlanReferenceTargets },
    run: (_rule, files) => runNoNulByte(files)
  },
  {
    id: "inner-html-assignment",
    name: "inner-html-assignment",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runInnerHtmlAssignment(files)
  },
  {
    id: "commented-out-code",
    name: "commented-out-code",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runCommentedOutCode(files)
  }
];

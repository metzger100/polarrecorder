import fs from "node:fs";

import { fail } from "./shared.mjs";
import { stripMarkdownCode } from "./source-scan.mjs";

// Machine-local home paths must never be committed in source or docs; they
// break on every other machine and leak the author's username.
const HOME_PATH = /(?:\/home\/[A-Za-z0-9_.-]+\/|\/Users\/[A-Za-z0-9_.-]+\/)/;
// A bare "PLANx.md" is a legitimate reference to a real historical exec-plan file (e.g.
// documenting that Ruff once wanted to reformat exec-plans/completed/PLAN1.md); anything
// else naming a plan or phase number is a citation that will go stale once the plan is
// archived, and must describe the code/config standalone instead.
const EXEC_PLAN_CITATION_PATTERN = /\bPLAN\d+\b(?!\.md)/;
const EXEC_PLAN_PHASE_PATTERN = /\bPhase\s?\d+[A-Za-z]?\b/;

/**
 * @param {import("./shared.mjs").PatternFile} file Python file under `server/polarrecorder/`
 *   being scanned.
 * @returns {void}
 */
export function checkPython(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(import|from)\s+avnav/.test(line))
      fail(file.rel, index, "AvNav import forbidden", "avnav-import");
    if (/^\s*import\s+pluginhandler\b/.test(line))
      fail(file.rel, index, "pluginhandler import forbidden", "pluginhandler-import");
    if (/^\s*from\s+plugin\s+import\b|^\s*import\s+plugin\b/.test(line)) {
      fail(file.rel, index, "plugin.py import forbidden", "reverse-plugin-import");
    }
    if (/\bthreading\.(Lock|RLock|Condition)\s*\(/.test(line)) {
      fail(
        file.rel,
        index,
        "threading lock acquisition forbidden in server/polarrecorder/",
        "domain-lock-acquisition"
      );
    }
    if (/\btime\.sleep\s*\(/.test(line))
      fail(file.rel, index, "time.sleep forbidden", "domain-time-sleep");
    checkPythonSuppression(file.rel, index, line);
    checkTodo(file.rel, index, line);
  }
}

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} index Zero-based line index.
 * @param {string} line Raw source line.
 * @returns {void}
 */
function checkPythonSuppression(file, index, line) {
  const noqa = /#\s*noqa\b/i.exec(line);
  if (noqa) {
    const after = line.slice(noqa.index);
    const coded = /#\s*noqa\s*:\s*[A-Z]+[0-9]+(?:[,\s]+[A-Z]+[0-9]+)*/i.exec(after);
    if (!coded) {
      fail(
        file,
        index,
        "blanket '# noqa' is forbidden; use '# noqa: <CODES>  # <reason>'",
        "python-suppression"
      );
    } else if (!/#\s*\S/.test(after.slice(coded[0].length))) {
      fail(
        file,
        index,
        "'# noqa' must be justified with a trailing '# <reason>' comment",
        "python-suppression"
      );
    }
  }

  const typeIgnore = /#\s*type:\s*ignore\b/i.exec(line);
  if (typeIgnore) {
    const after = line.slice(typeIgnore.index);
    const coded = /#\s*type:\s*ignore\[[^\]]+\]/i.exec(after);
    if (!coded) {
      fail(
        file,
        index,
        "blanket '# type: ignore' is forbidden; use '# type: ignore[<code>]  # <reason>'",
        "python-suppression"
      );
    } else if (!/#\s*\S/.test(after.slice(coded.index + coded[0].length))) {
      fail(
        file,
        index,
        "'# type: ignore' must be justified with a trailing '# <reason>' comment",
        "python-suppression"
      );
    }
  }

  if (
    /#\s*ruff\s*:\s*noqa(?!\s*:)/i.test(line) ||
    /#\s*flake8\s*:\s*noqa\b/i.test(line) ||
    /#\s*mypy\s*:\s*ignore-errors\b/i.test(line)
  ) {
    fail(
      file,
      index,
      "file-level blanket suppression is forbidden; suppress specific codes with a reason",
      "python-suppression"
    );
  }
}

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} index Zero-based line index.
 * @param {string} code Source line (or code with strings masked) to inspect.
 * @returns {void}
 */
export function checkTodo(file, index, code) {
  const marker = /\b(TODO|FIXME)\b/.exec(code);
  if (!marker) return;
  if (!/\b(TODO|FIXME)\([A-Za-z][\w.-]*,\s*\d{4}-\d{2}-\d{2}\)\s*:/.test(code)) {
    fail(
      file,
      index,
      `${marker[1]} must use the format '${marker[1]}(owner, YYYY-MM-DD): ...'`,
      "unowned-todo"
    );
  }
}

/**
 * @param {import("./shared.mjs").PatternFile} file File being scanned for committed
 *   machine-local home paths.
 * @returns {void}
 */
export function checkAbsolutePath(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = HOME_PATH.exec(lines[index]);
    if (match) {
      fail(
        file.rel,
        index,
        `absolute home path '${match[0]}' is forbidden; use a project-relative or redacted placeholder`,
        "absolute-home-path"
      );
    }
  }
}

/**
 * @param {import("./shared.mjs").PatternFile} file File being scanned for stale
 *   exec-plan/phase citations.
 * @returns {void}
 */
export function checkExecPlanReference(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = EXEC_PLAN_CITATION_PATTERN.exec(line) || EXEC_PLAN_PHASE_PATTERN.exec(line);
    if (match) {
      fail(
        file.rel,
        index,
        `'${match[0]}' cites a historical exec-plan/phase; describe the code or config standalone instead`,
        "exec-plan-reference"
      );
    }
  }
}

/**
 * @param {import("./shared.mjs").PatternFile} file File being scanned for a literal NUL
 *   byte anywhere in its text, including inside comments and strings where a parser would
 *   not itself reject one.
 * @returns {void}
 */
export function checkNoNulByte(file) {
  const content = fs.readFileSync(file.abs, "utf8");
  const index = content.indexOf("\u0000");
  if (index === -1) return;
  const zeroBasedLine = content.slice(0, index).split(/\r?\n/).length - 1;
  fail(file.rel, zeroBasedLine, "file contains a literal NUL byte", "no-nul-byte");
}

/**
 * @param {import("./shared.mjs").PatternFile} file Markdown file being scanned for unowned
 *   TODO/FIXME markers.
 * @returns {void}
 */
export function checkMarkdownTodos(file) {
  const content = stripMarkdownCode(fs.readFileSync(file.abs, "utf8"));
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const marker = /\b(TODO|FIXME)(?:\([^)]*\))?\s*:/.exec(lines[index]);
    if (!marker) continue;
    checkTodo(file.rel, index, lines[index]);
  }
}

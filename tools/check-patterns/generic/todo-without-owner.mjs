import { fail } from "../shared.mjs";
import { getFileData } from "../file-cache.mjs";
import { stripMarkdownCode, stripStrings } from "../source-scan.mjs";
import { collectJavaScriptPatternFiles, collectMarkdownTodoTargets, collectPythonFiles } from "../discovery.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").PatternFile} PatternFile
 */

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} index Zero-based line index.
 * @param {string} code Source line (or code with strings masked) to inspect.
 * @param {string[]} [lines] File split into lines, for suppression checks.
 * @returns {void}
 */
export function checkTodo(file, index, code, lines) {
  const marker = /\b(TODO|FIXME)\b/.exec(code);
  if (!marker) return;
  if (!/\b(TODO|FIXME)\([A-Za-z][\w.-]*,\s*\d{4}-\d{2}-\d{2}\)\s*:/.test(code)) {
    fail(
      file,
      index,
      `${marker[1]} must use the format '${marker[1]}(owner, YYYY-MM-DD): ...'`,
      "todo-without-owner",
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runTodoJs(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      checkTodo(file.rel, index, stripStrings(lines[index]), lines);
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runTodoPython(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      checkTodo(file.rel, index, lines[index], lines);
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runTodoMarkdown(files) {
  for (const file of files) {
    const { content } = getFileData(file);
    const strippedLines = stripMarkdownCode(content).split(/\r?\n/);
    for (let index = 0; index < strippedLines.length; index += 1) {
      const marker = /\b(TODO|FIXME)(?:\([^)]*\))?\s*:/.exec(strippedLines[index]);
      if (!marker) continue;
      checkTodo(file.rel, index, strippedLines[index], strippedLines);
    }
  }
}

/** @type {Rule[]} */
export const TODO_WITHOUT_OWNER_GENERIC_RULES = [
  {
    id: "todo-without-owner:js",
    name: "todo-without-owner",
    severity: "block",
    scope: { key: "js-all", collect: collectJavaScriptPatternFiles },
    run: (_rule, files) => runTodoJs(files)
  },
  {
    id: "todo-without-owner:python",
    name: "todo-without-owner",
    severity: "block",
    scope: { key: "python", collect: collectPythonFiles },
    run: (_rule, files) => runTodoPython(files)
  },
  {
    id: "todo-without-owner:markdown",
    name: "todo-without-owner",
    severity: "block",
    scope: { key: "markdown-todo", collect: collectMarkdownTodoTargets },
    run: (_rule, files) => runTodoMarkdown(files)
  }
];

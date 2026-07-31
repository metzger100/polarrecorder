import { getFileData, scopeFor } from "../shared.mjs";
import { stripMarkdownCode, stripStrings } from "../ast-utils.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").Finding} Finding
 */

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} line 1-based line number.
 * @param {string} code Source line (or code with strings masked) to inspect.
 * @returns {Finding | null}
 */
function checkTodo(file, line, code) {
  const marker = /\b(TODO|FIXME)\b/.exec(code);
  if (!marker) return null;
  if (/\b(TODO|FIXME)\([A-Za-z][\w.-]*,\s*\d{4}-\d{2}-\d{2}\)\s*:/.test(code)) return null;
  return { file, line, message: `${marker[1]} must use the format '${marker[1]}(owner, YYYY-MM-DD): ...'` };
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runTodoJs(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const finding = checkTodo(file, index + 1, stripStrings(lines[index]));
      if (finding) out.push(finding);
    }
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runTodoPython(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const finding = checkTodo(file, index + 1, lines[index]);
      if (finding) out.push(finding);
    }
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runTodoMarkdown(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const strippedLines = stripMarkdownCode(text).split(/\r?\n/);
    for (let index = 0; index < strippedLines.length; index += 1) {
      const marker = /\b(TODO|FIXME)(?:\([^)]*\))?\s*:/.exec(strippedLines[index]);
      if (!marker) continue;
      const finding = checkTodo(file, index + 1, strippedLines[index]);
      if (finding) out.push(finding);
    }
  }
  return out;
}

/**
 * Run the one canonical work-marker rule over its combined project-owned scope.
 * @param {Rule} _rule
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runTodoWithoutOwner(_rule, files) {
  const jsFiles = files.filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));
  const pythonFiles = files.filter((file) => file.endsWith(".py"));
  const markdownFiles = files.filter((file) => file.endsWith(".md"));
  return [...runTodoJs(jsFiles), ...runTodoPython(pythonFiles), ...runTodoMarkdown(markdownFiles)];
}

/** @type {Rule[]} */
export const TODO_WITHOUT_OWNER_GENERIC_RULES = [
  {
    id: "todo-without-owner",
    name: "todo-without-owner",
    severity: "block",
    scope: scopeFor("todo-without-owner"),
    run: runTodoWithoutOwner
  }
];

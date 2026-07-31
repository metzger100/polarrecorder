import { getFileData, scopeFor } from "../shared.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").Finding} Finding
 */

/**
 * @param {string[]} files
 * @param {RegExp} pattern
 * @param {string} message
 * @returns {Finding[]}
 */
function runLinePattern(files, pattern, message) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (pattern.test(lines[index])) out.push({ file, line: index + 1, message });
    }
  }
  return out;
}

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} line 1-based line number.
 * @param {string} line_ Raw source line.
 * @returns {Finding[]}
 */
function checkPythonSuppression(file, line, line_) {
  /** @type {Finding[]} */
  const out = [];
  const noqa = /#\s*noqa\b/i.exec(line_);
  if (noqa) {
    const after = line_.slice(noqa.index);
    const coded = /#\s*noqa\s*:\s*[A-Z]+[0-9]+(?:[,\s]+[A-Z]+[0-9]+)*/i.exec(after);
    if (!coded) {
      out.push({ file, line, message: "blanket '# noqa' is forbidden; use '# noqa: <CODES>  # <reason>'" });
    } else if (!/#\s*\S/.test(after.slice(coded[0].length))) {
      out.push({ file, line, message: "'# noqa' must be justified with a trailing '# <reason>' comment" });
    }
  }

  const typeIgnore = /#\s*type:\s*ignore\b/i.exec(line_);
  if (typeIgnore) {
    const after = line_.slice(typeIgnore.index);
    const coded = /#\s*type:\s*ignore\[[^\]]+\]/i.exec(after);
    if (!coded) {
      out.push({
        file,
        line,
        message: "blanket '# type: ignore' is forbidden; use '# type: ignore[<code>]  # <reason>'"
      });
    } else if (!/#\s*\S/.test(after.slice(coded.index + coded[0].length))) {
      out.push({ file, line, message: "'# type: ignore' must be justified with a trailing '# <reason>' comment" });
    }
  }

  if (
    /#\s*ruff\s*:\s*noqa(?!\s*:)/i.test(line_) ||
    /#\s*flake8\s*:\s*noqa\b/i.test(line_) ||
    /#\s*mypy\s*:\s*ignore-errors\b/i.test(line_)
  ) {
    out.push({
      file,
      line,
      message: "file-level blanket suppression is forbidden; suppress specific codes with a reason"
    });
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runInvalidLintSuppression(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      out.push(...checkPythonSuppression(file, index + 1, lines[index]));
    }
  }
  return out;
}

/** @type {Rule[]} */
export const PYTHON_PROJECT_RULES = [
  {
    id: "avnav-import",
    name: "avnav-import",
    severity: "block",
    scope: scopeFor("python-domain"),
    run: (_rule, files) => runLinePattern(files, /^\s*(import|from)\s+avnav/, "AvNav import forbidden")
  },
  {
    id: "pluginhandler-import",
    name: "pluginhandler-import",
    severity: "block",
    scope: scopeFor("python-domain"),
    run: (_rule, files) => runLinePattern(files, /^\s*import\s+pluginhandler\b/, "pluginhandler import forbidden")
  },
  {
    id: "reverse-plugin-import",
    name: "reverse-plugin-import",
    severity: "block",
    scope: scopeFor("python-domain"),
    run: (_rule, files) =>
      runLinePattern(files, /^\s*from\s+plugin\s+import\b|^\s*import\s+plugin\b/, "plugin.py import forbidden")
  },
  {
    id: "domain-lock-acquisition",
    name: "domain-lock-acquisition",
    severity: "block",
    scope: scopeFor("python-domain"),
    run: (_rule, files) =>
      runLinePattern(
        files,
        /\bthreading\.(Lock|RLock|Condition)\s*\(/,
        "threading lock acquisition forbidden in server/polarrecorder/"
      )
  },
  {
    id: "domain-time-sleep",
    name: "domain-time-sleep",
    severity: "block",
    scope: scopeFor("python-domain"),
    run: (_rule, files) => runLinePattern(files, /\btime\.sleep\s*\(/, "time.sleep forbidden")
  },
  {
    id: "invalid-lint-suppression",
    name: "invalid-lint-suppression",
    severity: "block",
    scope: scopeFor("python-domain"),
    run: (_rule, files) => runInvalidLintSuppression(files)
  }
];

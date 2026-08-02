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
  }
];

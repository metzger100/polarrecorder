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

/** @param {string[]} files @returns {Finding[]} */
function runPluginLockOwnership(files) {
  if (files.length === 0) return [];
  const file = files[0];
  const { text } = getFileData(file);
  const ordinaryLocks = text.match(/\bthreading\.Lock\s*\(/g) || [];
  const forbiddenLocks = text.match(/\bthreading\.(RLock|Condition)\s*\(/g) || [];
  /** @type {Finding[]} */
  const findings = forbiddenLocks.map(() => ({
    file,
    line: 1,
    message: "plugin.py must not use RLock or Condition"
  }));
  if (ordinaryLocks.length !== 1) {
    findings.push({
      file,
      line: 1,
      message: `plugin.py must create exactly one threading.Lock (found ${ordinaryLocks.length})`
    });
  }
  return findings;
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
    id: "plugin-lock-ownership",
    name: "plugin-lock-ownership",
    severity: "block",
    scope: scopeFor("plugin-shell"),
    run: (_rule, files) => runPluginLockOwnership(files)
  },
  {
    id: "domain-time-sleep",
    name: "domain-time-sleep",
    severity: "block",
    scope: scopeFor("python-domain"),
    run: (_rule, files) => runLinePattern(files, /\btime\.sleep\s*\(/, "time.sleep forbidden")
  }
];

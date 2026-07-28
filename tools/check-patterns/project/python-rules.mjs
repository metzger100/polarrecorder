import { fail } from "../shared.mjs";
import { getFileData } from "../file-cache.mjs";
import { collectPythonFiles } from "../discovery.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").PatternFile} PatternFile
 */

const PYTHON_SCOPE = { key: "python", collect: collectPythonFiles };

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runAvnavImport(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      if (/^\s*(import|from)\s+avnav/.test(lines[index])) {
        fail(file.rel, index, "AvNav import forbidden", "avnav-import", lines);
      }
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runPluginhandlerImport(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      if (/^\s*import\s+pluginhandler\b/.test(lines[index])) {
        fail(file.rel, index, "pluginhandler import forbidden", "pluginhandler-import", lines);
      }
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runReversePluginImport(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      if (/^\s*from\s+plugin\s+import\b|^\s*import\s+plugin\b/.test(lines[index])) {
        fail(file.rel, index, "plugin.py import forbidden", "reverse-plugin-import", lines);
      }
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runDomainLockAcquisition(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      if (/\bthreading\.(Lock|RLock|Condition)\s*\(/.test(lines[index])) {
        fail(
          file.rel,
          index,
          "threading lock acquisition forbidden in server/polarrecorder/",
          "domain-lock-acquisition",
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
function runDomainTimeSleep(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      if (/\btime\.sleep\s*\(/.test(lines[index])) {
        fail(file.rel, index, "time.sleep forbidden", "domain-time-sleep", lines);
      }
    }
  }
}

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} index Zero-based line index.
 * @param {string} line Raw source line.
 * @param {string[]} lines File split into lines.
 * @returns {void}
 */
function checkPythonSuppression(file, index, line, lines) {
  const noqa = /#\s*noqa\b/i.exec(line);
  if (noqa) {
    const after = line.slice(noqa.index);
    const coded = /#\s*noqa\s*:\s*[A-Z]+[0-9]+(?:[,\s]+[A-Z]+[0-9]+)*/i.exec(after);
    if (!coded) {
      fail(
        file,
        index,
        "blanket '# noqa' is forbidden; use '# noqa: <CODES>  # <reason>'",
        "invalid-lint-suppression",
        lines
      );
    } else if (!/#\s*\S/.test(after.slice(coded[0].length))) {
      fail(
        file,
        index,
        "'# noqa' must be justified with a trailing '# <reason>' comment",
        "invalid-lint-suppression",
        lines
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
        "invalid-lint-suppression",
        lines
      );
    } else if (!/#\s*\S/.test(after.slice(coded.index + coded[0].length))) {
      fail(
        file,
        index,
        "'# type: ignore' must be justified with a trailing '# <reason>' comment",
        "invalid-lint-suppression",
        lines
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
      "invalid-lint-suppression",
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runInvalidLintSuppression(files) {
  for (const file of files) {
    const { lines } = getFileData(file);
    for (let index = 0; index < lines.length; index += 1) {
      checkPythonSuppression(file.rel, index, lines[index], lines);
    }
  }
}

/** @type {Rule[]} */
export const PYTHON_PROJECT_RULES = [
  {
    id: "avnav-import",
    name: "avnav-import",
    severity: "block",
    scope: PYTHON_SCOPE,
    run: (_rule, files) => runAvnavImport(files)
  },
  {
    id: "pluginhandler-import",
    name: "pluginhandler-import",
    severity: "block",
    scope: PYTHON_SCOPE,
    run: (_rule, files) => runPluginhandlerImport(files)
  },
  {
    id: "reverse-plugin-import",
    name: "reverse-plugin-import",
    severity: "block",
    scope: PYTHON_SCOPE,
    run: (_rule, files) => runReversePluginImport(files)
  },
  {
    id: "domain-lock-acquisition",
    name: "domain-lock-acquisition",
    severity: "block",
    scope: PYTHON_SCOPE,
    run: (_rule, files) => runDomainLockAcquisition(files)
  },
  {
    id: "domain-time-sleep",
    name: "domain-time-sleep",
    severity: "block",
    scope: PYTHON_SCOPE,
    run: (_rule, files) => runDomainTimeSleep(files)
  },
  {
    id: "invalid-lint-suppression",
    name: "invalid-lint-suppression",
    severity: "block",
    scope: PYTHON_SCOPE,
    run: (_rule, files) => runInvalidLintSuppression(files)
  }
];

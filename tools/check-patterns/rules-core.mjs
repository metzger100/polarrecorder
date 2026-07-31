import { asGlobal, getFileData, lineAt } from "./shared.mjs";

/** @typedef {import("./shared.mjs").Rule} Rule */
/** @typedef {import("./shared.mjs").Finding} Finding */

/**
 * Default rule runner for any rule that supplies a single `detect` regex and a `message`
 * builder: every non-overlapping match becomes one finding at its own line, deduplicated per
 * line so a regex matching more than once on one line does not multiply findings.
 * @param {Rule} rule
 * @param {string[]} files
 * @returns {Finding[]}
 */
export function runRegexRule(rule, files) {
  /** @type {Finding[]} */
  const out = [];
  const detect = asGlobal(/** @type {RegExp} */ (rule.detect));
  for (const file of files) {
    const data = getFileData(file);
    const seenLines = new Set();
    detect.lastIndex = 0;
    let match;
    while ((match = detect.exec(data.text))) {
      const line = lineAt(match.index, data.lineStarts);
      const key = `${file}:${line}`;
      if (seenLines.has(key)) {
        if (match[0].length === 0) detect.lastIndex += 1;
        continue;
      }
      seenLines.add(key);
      const message = /** @type {(context: any) => string} */ (rule.message)({ file, line, match });
      if (message !== null) out.push({ file, line, message });
      if (match[0].length === 0) detect.lastIndex += 1;
    }
  }
  return out;
}

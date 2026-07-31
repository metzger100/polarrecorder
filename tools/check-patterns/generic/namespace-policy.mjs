import { getFileData } from "../shared.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").Finding} Finding
 */

const KEBAB_CASE_FILENAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.js$/;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;

/**
 * @param {string} relPath Root-relative file path.
 * @returns {string} The final path segment.
 */
function basename(relPath) {
  const parts = relPath.split("/");
  return parts[parts.length - 1];
}

/**
 * Generic, configurable namespace/naming policy: requires every file in scope
 * to expose functionality only through `window.<jsGlobalPrefix>` (no other
 * global assignment) and, when the matching case option is set, enforces
 * kebab-case filenames, PascalCase `<jsGlobalPrefix>.<Member>` exports, and
 * camelCase function declarations. Contains no project-specific token itself;
 * a project rule instance supplies `jsGlobalPrefix` and the case options as
 * plain configuration.
 * @param {Rule} rule Rule instance carrying the configuration above.
 * @param {string[]} files Files in scope.
 * @returns {Finding[]}
 */
export function runNamespacePolicyRule(rule, files) {
  /** @type {Finding[]} */
  const out = [];
  const prefix = rule.jsGlobalPrefix;
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    if (rule.filenameCase === "kebab" && !KEBAB_CASE_FILENAME.test(basename(file))) {
      out.push({ file, line: 1, message: "JS filenames must be kebab-case" });
    }
    if (!text.includes(`window.${prefix}`)) {
      out.push({ file, line: 1, message: `missing window.${prefix} namespace usage` });
    }
    for (let index = 0; index < lines.length; index += 1) {
      for (const match of lines[index].matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) {
        if (match[1] !== prefix) {
          out.push({ file, line: index + 1, message: `illegal global window.${match[1]} assignment` });
        }
      }
    }
    if (rule.memberCase === "pascal") {
      for (const match of text.matchAll(new RegExp(`${prefix}\\.([A-Za-z_$][\\w$]*)\\s*=`, "g"))) {
        if (!PASCAL_CASE.test(match[1])) {
          out.push({ file, line: 1, message: `exported namespace member '${match[1]}' must be PascalCase` });
        }
      }
    }
    if (rule.functionCase === "camel") {
      for (const match of text.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (!CAMEL_CASE.test(match[1])) {
          out.push({ file, line: 1, message: `function '${match[1]}' must be camelCase` });
        }
      }
    }
  }
  return out;
}

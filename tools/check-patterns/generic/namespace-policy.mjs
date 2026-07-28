import { fail } from "../shared.mjs";
import { getFileData } from "../file-cache.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").PatternFile} PatternFile
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
 * plain configuration. `cssCustomPropertyPrefix` is carried for parity/
 * documentation only — CSS custom-property naming is a stylelint concern
 * (`custom-property-pattern`), not this rule's.
 * @param {Rule} rule Rule instance carrying the configuration above.
 * @param {PatternFile[]} files Files in scope.
 * @returns {void}
 */
export function runNamespacePolicyRule(rule, files) {
  const prefix = rule.jsGlobalPrefix;
  for (const file of files) {
    const { content, lines } = getFileData(file);
    if (rule.filenameCase === "kebab" && !KEBAB_CASE_FILENAME.test(basename(file.rel))) {
      fail(file.rel, 0, "JS filenames must be kebab-case", rule.name, lines);
    }
    if (!content.includes(`window.${prefix}`)) {
      fail(file.rel, 0, `missing window.${prefix} namespace usage`, rule.name, lines);
    }
    for (let index = 0; index < lines.length; index += 1) {
      for (const match of lines[index].matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) {
        if (match[1] !== prefix) {
          fail(file.rel, index, `illegal global window.${match[1]} assignment`, rule.name, lines);
        }
      }
    }
    if (rule.memberCase === "pascal") {
      for (const match of content.matchAll(new RegExp(`${prefix}\\.([A-Za-z_$][\\w$]*)\\s*=`, "g"))) {
        if (!PASCAL_CASE.test(match[1])) {
          fail(file.rel, 0, `exported namespace member '${match[1]}' must be PascalCase`, rule.name, lines);
        }
      }
    }
    if (rule.functionCase === "camel") {
      for (const match of content.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (!CAMEL_CASE.test(match[1])) {
          fail(file.rel, 0, `function '${match[1]}' must be camelCase`, rule.name, lines);
        }
      }
    }
  }
}

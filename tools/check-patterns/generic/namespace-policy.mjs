/**
 * @file Generic, configurable namespace-policy runner: flags a global-object property
 * assignment or a CSS custom-property declaration that does not use the repo-registered
 * namespace prefix. The prefixes themselves are supplied by the rule definition (see
 * `rule.jsGlobalPrefix` / `rule.cssCustomPropertyPrefix`), so this file contains no
 * project-specific token and is liftable verbatim into another repository that
 * registers its own prefix.
 */

import { getFileData, lineAt } from "../shared.mjs";

const GLOBAL_ASSIGNMENT_RE = /\b(?:window|root|global|self)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
const CSS_CUSTOM_PROPERTY_RE = /(?:^|[^\w-])(--[A-Za-z0-9-]+)\s*:/g;
const KEBAB_CASE_FILENAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.js$/;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;

/**
 * @param {any} rule
 * @param {string[]} files
 * @returns {import("../shared.mjs").Finding[]}
 */
export function runNamespacePolicyRule(rule, files) {
  const out = [];
  for (const file of files) {
    const data = getFileData(file);
    if (file.endsWith(".css")) {
      out.push(...scanCss(rule, file, data));
    } else {
      out.push(...scanJs(rule, file, data));
    }
    out.push(...scanNaming(rule, file, data));
  }
  return out;
}

/**
 * @param {{jsGlobalPrefix: string, message: Function}} rule
 * @param {string} file
 * @param {import("../shared.mjs").FileData} data
 */
function scanJs(rule, file, data) {
  const out = [];
  let match;
  GLOBAL_ASSIGNMENT_RE.lastIndex = 0;
  const sourceData = /** @type {any} */ (data);
  const masked = sourceData.maskedText ?? sourceData.masked ?? sourceData.text;
  while ((match = GLOBAL_ASSIGNMENT_RE.exec(masked))) {
    const globalName = match[1];
    if (globalName.startsWith(rule.jsGlobalPrefix)) continue;
    const line = lineAt(match.index, data.lineStarts);
    out.push({ file, line, message: messageFor(rule, { file, line, kind: "js-global", token: globalName }) });
  }
  return out;
}

/**
 * @param {{cssCustomPropertyPrefix: string, message: Function}} rule
 * @param {string} file
 * @param {import("../shared.mjs").FileData} data
 */
function scanCss(rule, file, data) {
  const out = [];
  let match;
  CSS_CUSTOM_PROPERTY_RE.lastIndex = 0;
  while ((match = CSS_CUSTOM_PROPERTY_RE.exec(data.text))) {
    const propertyName = match[1];
    if (propertyName.startsWith(rule.cssCustomPropertyPrefix)) continue;
    const line = lineAt(match.index, data.lineStarts);
    out.push({
      file,
      line,
      message: messageFor(rule, {
        file,
        line,
        kind: "css-custom-property",
        token: propertyName
      })
    });
  }
  return out;
}

/** @param {any} rule @param {string} file @param {any} data @returns {import("../shared.mjs").Finding[]} */
function scanNaming(rule, file, data) {
  const out = [];
  const text = data.text;
  const base = file.split("/").pop() || file;
  if (rule.filenameCase === "kebab" && !KEBAB_CASE_FILENAME.test(base)) {
    out.push({ file, line: 1, message: "JS filenames must be kebab-case" });
  }
  if (rule.memberCase === "pascal") {
    for (const match of text.matchAll(new RegExp(`${rule.jsGlobalPrefix}\\.([A-Za-z_$][\\w$]*)\\s*=`, "g"))) {
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
  return out;
}

/** @param {any} rule @param {{file: string, line: number, kind: string, token: string}} finding @returns {string} */
function messageFor(rule, finding) {
  if (rule.message) return rule.message(finding);
  return finding.kind === "js-global"
    ? `illegal global window.${finding.token} assignment`
    : `CSS custom property '${finding.token}' does not use the registered namespace prefix`;
}

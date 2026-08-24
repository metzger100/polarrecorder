import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

export const SMELL_CONTRACT_RULE_IDS = ["viewer-script-contract", "viewer-dependency-header-contract"];

/**
 * @typedef {Object} SmellContractContext
 * @property {string} root
 * @property {string} viewerRoot
 * @property {string[]} failures
 */

/**
 * @typedef {Object} ViewerSourceFile
 * @property {string} content
 * @property {string} name
 * @property {string} rel
 */

/**
 * @typedef {Object} SmellContractOptions
 * @property {string} [root]
 * @property {boolean} [print]
 */

/**
 * @typedef {Object} SmellContractSummary
 * @property {boolean} ok
 * @property {number} checkedRules
 * @property {number} failures
 */

/**
 * @typedef {Object} SmellContractResult
 * @property {boolean} ok
 * @property {string[]} failures
 * @property {SmellContractSummary} summary
 */

/**
 * @param {SmellContractOptions} [options]
 * @returns {SmellContractResult}
 */
export function runSmellContracts({ root = process.cwd(), print = true } = {}) {
  /** @type {SmellContractContext} */
  const ctx = { root, viewerRoot: path.join(root, "viewer"), failures: [] };
  checkViewerScriptContract(ctx);
  checkViewerDependencyHeaders(ctx);

  const summary = {
    ok: ctx.failures.length === 0,
    checkedRules: 2,
    failures: ctx.failures.length
  };

  if (print) reportSmellContracts(ctx.failures, summary);
  return { ok: summary.ok, failures: ctx.failures, summary };
}

/**
 * @param {string[]} failures
 * @param {SmellContractSummary} summary
 */
function reportSmellContracts(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[smell-contracts] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Smell contract check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

/** @param {SmellContractContext} ctx */
function checkViewerScriptContract(ctx) {
  const expected = [
    "theme.js",
    "placeholders.js",
    "viewer.js",
    "dom.js",
    "enhanced-rule-display.js",
    "status-ui.js",
    "presets.js",
    "polar-chart-geometry.js",
    "polar-chart.js",
    "timeline-chart.js",
    "grid-editor.js",
    "export-fields.js",
    "export-presets.js",
    "export-ui.js",
    "import-upload.js",
    "enhanced-settings.js",
    "advanced-settings.js",
    "settings-ui.js",
    "engine-warning.js"
  ];
  const html = read(ctx, "viewer/viewer.html");
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+\.js)"/g)).map(function (match) {
    return match[1];
  });
  if (scripts.join("\n") !== expected.join("\n")) {
    ctx.failures.push(
      "viewer-script-contract: viewer.html script order must be " +
        expected.join(", ") +
        "; found " +
        scripts.join(", ")
    );
  }
  const files = collectViewerJsNames(ctx);
  for (const file of files) {
    if (!scripts.includes(file)) {
      ctx.failures.push(`viewer-script-contract: ${file} is not loaded by viewer/viewer.html`);
    }
  }
}

/** @param {SmellContractContext} ctx */
function checkViewerDependencyHeaders(ctx) {
  const files = collectViewerFiles(ctx);
  const definitions = mapDefinitions(files);
  for (const file of files) {
    const declared = declaredDepends(file.content);
    const actual = actualDepends(file, definitions);
    for (const missing of difference(actual, declared)) {
      ctx.failures.push(
        `viewer-dependency-header-contract: ${file.name} references ${missing} but the Depends header omits it`
      );
    }
    for (const stale of difference(declared, actual)) {
      ctx.failures.push(`viewer-dependency-header-contract: ${file.name} lists ${stale} but does not reference it`);
    }
  }
}

/**
 * @param {ViewerSourceFile[]} files
 * @returns {Map<string, string>}
 */
function mapDefinitions(files) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const file of files) {
    for (const match of file.content.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)\s*=/g)) {
      out.set(match[1], file.name);
    }
  }
  return out;
}

/**
 * @param {ViewerSourceFile} file
 * @param {Map<string, string>} definitions
 * @returns {Set<string>}
 */
function actualDepends(file, definitions) {
  if (file.name === "viewer.js") return new Set();
  /** @type {Set<string>} */
  const out = new Set();
  for (const match of file.content.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)/g)) {
    const owner = definitions.get(match[1]);
    if (owner && owner !== file.name) out.add(owner);
  }
  for (const match of file.content.matchAll(/Polarrecorder\["([A-Za-z_$][\w$]*)"]/g)) {
    const owner = definitions.get(match[1]);
    if (owner && owner !== file.name) out.add(owner);
  }
  return out;
}

/**
 * @param {string} content
 * @returns {Set<string>}
 */
function declaredDepends(content) {
  const match = content.match(/^\s*\*\s*Depends:\s*(.+?)\s*$/m);
  if (!match) return new Set();
  const raw = match[1].trim();
  if (raw === "none" || raw === "(none)") return new Set();
  return new Set(
    raw
      .split(",")
      .map(function (item) {
        return item.trim().replace(/^viewer\//, "");
      })
      .filter(Boolean)
  );
}

/**
 * @param {Set<string>} left
 * @param {Set<string>} right
 * @returns {string[]}
 */
function difference(left, right) {
  return Array.from(left)
    .filter(function (item) {
      return !right.has(item);
    })
    .sort();
}

/**
 * @param {SmellContractContext} ctx
 * @returns {string[]}
 */
function collectViewerJsNames(ctx) {
  return collectViewerFiles(ctx).map(function (file) {
    return file.name;
  });
}

/**
 * @param {SmellContractContext} ctx
 * @returns {ViewerSourceFile[]}
 */
function collectViewerFiles(ctx) {
  if (!fs.existsSync(ctx.viewerRoot)) return [];
  return fs
    .readdirSync(ctx.viewerRoot)
    .filter(function (name) {
      return name.endsWith(".js");
    })
    .sort()
    .map(function (name) {
      const rel = `viewer/${name}`;
      return { content: read(ctx, rel), name, rel };
    });
}

/**
 * @param {SmellContractContext} ctx
 * @param {string} rel
 * @returns {string}
 */
function read(ctx, rel) {
  return fs.readFileSync(path.join(ctx.root, rel), "utf8");
}

test("viewer script and dependency-header contracts hold", () => {
  const result = runSmellContracts({ print: false });
  if (!result.ok) throw new Error(result.failures.join("\n"));
});

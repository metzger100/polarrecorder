import fs from "node:fs";
import path from "node:path";

import { discoverExecutableTestHelpers } from "../test-inventory.mjs";
import { requireAtLeast } from "./shared.mjs";

/**
 * @param {string} root
 * @returns {string[]}
 */
export function listViewerJsFiles(root) {
  return fs
    .readdirSync(path.join(root, "viewer"), { encoding: "utf8" })
    .filter((name) => name.endsWith(".js"))
    .map((name) => `viewer/${name}`)
    .sort();
}

/**
 * @param {string} root
 * @param {Record<string, any>} viewerReport
 * @returns {Array<[{rel: string}, any]>}
 */
function viewerReportEntries(root, viewerReport) {
  /** @type {Array<[{rel: string}, any]>} */
  const entries = [];
  for (const [absolute, entry] of Object.entries(viewerReport)) {
    if (absolute === "total") continue;
    const rel = path.relative(root, absolute).split(path.sep).join("/");
    entries.push([{ rel }, entry]);
  }
  return entries;
}

/**
 * @param {string} root
 * @param {Record<string, any>} viewerReport
 * @param {string[]} files
 * @returns {{lines: number, functions: number, statements: number, branches: number}}
 */
function aggregateJsFamily(root, viewerReport, files) {
  let linesTotal = 0;
  let linesCovered = 0;
  let functionsTotal = 0;
  let functionsCovered = 0;
  let statementsTotal = 0;
  let statementsCovered = 0;
  let branchesTotal = 0;
  let branchesCovered = 0;
  for (const [absolute, entry] of viewerReportEntries(root, viewerReport)) {
    if (!files.includes(absolute.rel)) continue;
    linesTotal += entry.lines.total;
    linesCovered += entry.lines.covered;
    functionsTotal += entry.functions.total;
    functionsCovered += entry.functions.covered;
    statementsTotal += entry.statements.total;
    statementsCovered += entry.statements.covered;
    branchesTotal += entry.branches.total;
    branchesCovered += entry.branches.covered;
  }
  return {
    lines: linesTotal === 0 ? 100 : (100 * linesCovered) / linesTotal,
    functions: functionsTotal === 0 ? 100 : (100 * functionsCovered) / functionsTotal,
    statements: statementsTotal === 0 ? 100 : (100 * statementsCovered) / statementsTotal,
    branches: branchesTotal === 0 ? 100 : (100 * branchesCovered) / branchesTotal
  };
}

/**
 * @param {string} root
 * @param {any} floors
 * @param {Record<string, any>} viewerReport
 * @returns {string[]}
 */
export function checkViewerCoverage(root, floors, viewerReport) {
  /** @type {string[]} */
  const failures = [];
  const viewerFiles = listViewerJsFiles(root);
  const pluginFiles = ["plugin.js", "plugin.mjs"];
  const allFiles = [...viewerFiles, ...pluginFiles];
  const allFileSet = new Set(allFiles);
  const reportedByRel = new Map(viewerReportEntries(root, viewerReport).map(([id, entry]) => [id.rel, entry]));
  const contractOwned = floors.contractOwned?.javascript || {};
  const discovered = new Set(discoverExecutableTestHelpers(root));

  for (const file of allFiles) {
    const owned = contractOwned[file];
    if (owned) {
      if (!discovered.has(owned.ownerTest)) {
        failures.push(
          `coverage-floors.json contractOwned.javascript["${file}"].ownerTest "${owned.ownerTest}" is not a runner-discovered test`
        );
      }
      if (reportedByRel.has(file)) {
        failures.push(`${file}: classified contract-owned but has measured executable coverage data`);
      }
      continue;
    }
    if (!reportedByRel.has(file)) {
      failures.push(`${file}: not measured and not contract-owned; run test:coverage:viewer or classify it`);
      continue;
    }
    if (viewerFiles.includes(file)) {
      const explicitFloor = floors.viewerPerFileLinePercent[file];
      const linePercent = reportedByRel.get(file).lines.pct;
      if (typeof explicitFloor === "number") {
        requireAtLeast(failures, file, linePercent, explicitFloor);
      } else {
        requireAtLeast(failures, `${file} lines`, linePercent, floors.defaultNewFileLinePercent);
        requireAtLeast(
          failures,
          `${file} branches`,
          reportedByRel.get(file).branches.pct,
          floors.defaultNewFileBranchPercent
        );
      }
    }
  }
  for (const file of Object.keys(contractOwned)) {
    if (!allFileSet.has(file)) {
      failures.push(`coverage-floors.json contractOwned.javascript["${file}"]: file no longer exists`);
    }
  }

  const viewerFamily = aggregateJsFamily(root, viewerReport, viewerFiles);
  requireAtLeast(failures, "viewer family lines", viewerFamily.lines, floors.families.viewerFamilyLinePercent);
  requireAtLeast(
    failures,
    "viewer family functions",
    viewerFamily.functions,
    floors.families.viewerFamilyFunctionPercent
  );
  requireAtLeast(
    failures,
    "viewer family statements",
    viewerFamily.statements,
    floors.families.viewerFamilyStatementPercent
  );
  requireAtLeast(failures, "viewer family branches", viewerFamily.branches, floors.families.viewerFamilyBranchPercent);

  const pluginFamily = aggregateJsFamily(root, viewerReport, pluginFiles);
  requireAtLeast(
    failures,
    "plugin entrypoint family lines",
    pluginFamily.lines,
    floors.families.pluginEntrypointFamilyLinePercent
  );
  requireAtLeast(
    failures,
    "plugin entrypoint family functions",
    pluginFamily.functions,
    floors.families.pluginEntrypointFamilyFunctionPercent
  );
  requireAtLeast(
    failures,
    "plugin entrypoint family statements",
    pluginFamily.statements,
    floors.families.pluginEntrypointFamilyStatementPercent
  );
  requireAtLeast(
    failures,
    "plugin entrypoint family branches",
    pluginFamily.branches,
    floors.families.pluginEntrypointFamilyBranchPercent
  );
  return failures;
}

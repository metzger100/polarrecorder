#!/usr/bin/env node

/**
 * Combined Python + viewer/plugin JS coverage inventory and ratchet.
 *
 * Reads the two reports `test:coverage:python`/`test:coverage:viewer` produce
 * (`coverage/python/coverage.json`, `coverage/viewer/coverage-summary.json`), then:
 *
 * - proves every shipped `server/polarrecorder/**\/*.py`, `plugin.py`, `viewer/*.js`,
 *   `plugin.js`, and `plugin.mjs` file is classified `measured` (present in a report) or
 *   `contract-owned` (named, runner-discovered owner test, never a partially-measured
 *   file);
 * - enforces the family floors (validation package, histogram core, Python aggregate,
 *   viewer family, plugin-entrypoint family) and the per-file `plugin.py`/viewer line
 *   floors recorded in `coverage-floors.json`;
 * - proves `coverage-floors.json` never regresses below `coverage-floor-baseline.json`,
 *   and that the baseline itself is exactly what `baseline-coverage-capture.json` derives
 *   (so the two cannot be edited together to silently lower the floor without a visible
 *   diff to this file's own self-test, which independently anchors the capture's digest).
 *
 * Supersedes `check-js-coverage.mjs` (deleted; c8 now attributes viewer/plugin VM
 * coverage directly) and `check-coverage.py` (deleted; its validation/histogram family
 * rules are folded in here so one tool owns the whole inventory).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { discoverExecutableTestHelpers } from "./test-inventory.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

const VALIDATION_PREFIX = "server/polarrecorder/validation/";
const HISTOGRAM_EXACT = "server/polarrecorder/histogram.py";

/**
 * Maps each pre-migration `preMigrationConfiguredFloors` viewer key to its real path.
 * @type {Record<string, string>}
 */
const BASELINE_VIEWER_FLOOR_KEY_TO_PATH = {
  viewerAdvancedSettingsJsLinePercent: "viewer/advanced-settings.js",
  viewerDomJsLinePercent: "viewer/dom.js",
  viewerEnhancedSettingsJsLinePercent: "viewer/enhanced-settings.js",
  viewerExportUiJsLinePercent: "viewer/export-ui.js",
  viewerGridEditorJsLinePercent: "viewer/grid-editor.js",
  viewerImportUploadJsLinePercent: "viewer/import-upload.js",
  viewerPlaceholdersJsLinePercent: "viewer/placeholders.js",
  viewerPolarChartJsLinePercent: "viewer/polar-chart.js",
  viewerPresetsJsLinePercent: "viewer/presets.js",
  viewerSettingsUiJsLinePercent: "viewer/settings-ui.js",
  viewerThemeJsLinePercent: "viewer/theme.js",
  viewerTimelineChartJsLinePercent: "viewer/timeline-chart.js",
  viewerViewerJsLinePercent: "viewer/viewer.js"
};

/** @param {string} root @returns {string} */
export function pythonReportPath(root) {
  return path.join(root, "coverage", "python", "coverage.json");
}

/** @param {string} root @returns {string} */
export function viewerReportPath(root) {
  return path.join(root, "coverage", "viewer", "coverage-summary.json");
}

/** @param {string} root @returns {string} */
export function floorsPath(root) {
  return path.join(root, "tools", "quality-policy", "coverage-floors.json");
}

/** @param {string} root @returns {string} */
export function baselinePath(root) {
  return path.join(root, "tools", "quality-policy", "coverage-floor-baseline.json");
}

/** @param {string} root @returns {string} */
function baselineCoverageCapturePath(root) {
  return path.join(root, "tools", "quality-policy", "baseline-coverage-capture.json");
}

/** @param {string} filePath @returns {any} */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * @param {string} root
 * @returns {any}
 */
export function loadPythonReport(root) {
  const reportPath = pythonReportPath(root);
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `coverage-inventory: missing ${path.relative(root, reportPath)}; run "npm run test:coverage:python" first`
    );
  }
  return readJson(reportPath);
}

/**
 * @param {string} root
 * @returns {Record<string, any>}
 */
export function loadViewerReport(root) {
  const reportPath = viewerReportPath(root);
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `coverage-inventory: missing ${path.relative(root, reportPath)}; run "npm run test:coverage:viewer" first`
    );
  }
  return readJson(reportPath);
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function listPythonPackageFiles(root) {
  /** @type {string[]} */
  const found = [];
  const packageDir = path.join(root, "server", "polarrecorder");
  for (const entry of fs.readdirSync(packageDir, { recursive: true, encoding: "utf8" })) {
    if (entry.endsWith(".py")) {
      found.push(path.join("server", "polarrecorder", entry).split(path.sep).join("/"));
    }
  }
  found.push("plugin.py");
  return found.sort();
}

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
 * @returns {{capturedCommit: string, minimumFloors: Record<string, any>}}
 */
export function deriveCoverageFloorBaseline(root) {
  const capture = readJson(baselineCoverageCapturePath(root));
  const configured = capture.preMigrationConfiguredFloors;
  const families = {
    histogramCoreBranchPercent: configured.histogramCoreBranchPercent,
    histogramCoreLinePercent: configured.histogramCoreLinePercent,
    pythonAggregateCombinedPercent: configured.pythonAggregateCombinedPercent,
    validationPackageBranchPercent: configured.validationPackageBranchPercent,
    validationPackageLinePercent: configured.validationPackageLinePercent
  };
  /** @type {Record<string, number>} */
  const viewerPerFileLinePercent = {};
  for (const key of Object.keys(BASELINE_VIEWER_FLOOR_KEY_TO_PATH).sort()) {
    viewerPerFileLinePercent[BASELINE_VIEWER_FLOOR_KEY_TO_PATH[key]] = configured[key];
  }
  return {
    capturedCommit: capture.capturedCommit,
    minimumFloors: {
      families,
      pluginPy: {
        combinedLineAndBranchPercent: capture.pluginPyCoverage.combinedLineAndBranchPercent
      },
      viewerPerFileLinePercent
    }
  };
}

/**
 * @param {string} root
 * @returns {{ok: boolean, failures: string[]}}
 */
export function diffCoverageFloorBaseline(root) {
  const derived = deriveCoverageFloorBaseline(root);
  const committed = readJson(baselinePath(root));
  const derivedJson = JSON.stringify(derived, Object.keys(derived).sort(), 2);
  const committedJson = JSON.stringify(committed, Object.keys(committed).sort(), 2);
  if (derivedJson === committedJson && JSON.stringify(derived) === JSON.stringify(committed)) {
    return { ok: true, failures: [] };
  }
  return {
    ok: false,
    failures: [
      "coverage-floor-baseline.json no longer matches the value mechanically derived from " +
        "baseline-coverage-capture.json; regenerate it from the capture instead of hand-editing"
    ]
  };
}

/**
 * @param {string} root
 * @returns {{ok: boolean, failures: string[]}}
 */
export function checkFloorRatchet(root) {
  const floors = readJson(floorsPath(root));
  const baseline = readJson(baselinePath(root));
  /** @type {string[]} */
  const failures = [];
  for (const key of Object.keys(baseline.minimumFloors.families)) {
    const active = floors.families?.[key];
    const min = baseline.minimumFloors.families[key];
    if (typeof active !== "number" || active < min) {
      failures.push(
        `coverage-floors.json families.${key} (${active}) is below its baseline floor ${min}`
      );
    }
  }
  const pluginMin = baseline.minimumFloors.pluginPy.combinedLineAndBranchPercent;
  const pluginActive = floors.pluginPy?.combinedLineAndBranchPercent;
  if (typeof pluginActive !== "number" || pluginActive < pluginMin) {
    failures.push(
      `coverage-floors.json pluginPy.combinedLineAndBranchPercent (${pluginActive}) is below its baseline floor ${pluginMin}`
    );
  }
  for (const [file, min] of Object.entries(baseline.minimumFloors.viewerPerFileLinePercent)) {
    const active = floors.viewerPerFileLinePercent?.[file];
    if (typeof active !== "number" || active < /** @type {number} */ (min)) {
      failures.push(
        `coverage-floors.json viewerPerFileLinePercent["${file}"] (${active}) is below its baseline floor ${min}`
      );
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * @param {any} pythonReport
 * @param {{prefixes?: string[], exact?: string[]}} selector
 * @returns {{linePercent: number, branchPercent: number}}
 */
function aggregatePythonFamily(pythonReport, selector) {
  const prefixes = selector.prefixes || [];
  const exact = selector.exact || [];
  let coveredLines = 0;
  let numStatements = 0;
  let coveredBranches = 0;
  let numBranches = 0;
  for (const [file, info] of Object.entries(pythonReport.files)) {
    const matches = exact.includes(file) || prefixes.some((prefix) => file.startsWith(prefix));
    if (!matches) continue;
    const summary = /** @type {any} */ (info).summary;
    coveredLines += summary.covered_lines;
    numStatements += summary.num_statements;
    coveredBranches += summary.covered_branches;
    numBranches += summary.num_branches;
  }
  return {
    linePercent: numStatements === 0 ? 100 : (100 * coveredLines) / numStatements,
    branchPercent: numBranches === 0 ? 100 : (100 * coveredBranches) / numBranches
  };
}

/**
 * @param {string} filePath repository-relative Python file path
 * @returns {string} dotted module name
 */
function dottedModuleName(filePath) {
  const withoutInit = filePath.replace(/\/__init__\.py$/, "");
  const withoutExt = withoutInit.endsWith(".py") ? withoutInit.slice(0, -3) : withoutInit;
  return withoutExt
    .replace(/^server\//, "")
    .split("/")
    .join(".");
}

/**
 * @param {string} root
 * @param {string} ownerTest "tests/test_x.py::test_name"
 * @param {string} targetFile repository-relative Python file the owner must cover
 * @returns {string[]} failures, empty when the owner is valid
 */
function verifyPythonContractOwner(root, ownerTest, targetFile) {
  const [testFile, testName] = String(ownerTest).split("::");
  if (!testFile || !testName || !/^tests\/test_[^/]+\.py$/.test(testFile)) {
    return [`contract owner "${ownerTest}" must be "tests/test_<name>.py::test_<name>"`];
  }
  const absoluteTestFile = path.join(root, testFile);
  if (!fs.existsSync(absoluteTestFile)) {
    return [`contract owner "${ownerTest}" points at a missing test file`];
  }
  const script = [
    "import ast, sys",
    'tree = ast.parse(open(sys.argv[1], encoding="utf-8").read())',
    "target = sys.argv[2]",
    "test_name = sys.argv[3]",
    "has_test = any(",
    "    isinstance(node, ast.FunctionDef) and node.name == test_name for node in ast.walk(tree)",
    ")",
    "imports_target = False",
    "for node in ast.walk(tree):",
    "    if isinstance(node, ast.Import):",
    "        if any(alias.name == target or alias.name.startswith(target + '.') for alias in node.names):",
    "            imports_target = True",
    "    elif isinstance(node, ast.ImportFrom):",
    "        module = node.module or ''",
    "        if module == target or module.startswith(target + '.'):",
    "            imports_target = True",
    "print('1' if has_test else '0', '1' if imports_target else '0')"
  ].join("\n");
  const venvPython = path.join(root, "venv", "bin", "python3");
  const python = fs.existsSync(venvPython) ? venvPython : "python3";
  const result = spawnSync(
    python,
    ["-c", script, absoluteTestFile, dottedModuleName(targetFile), testName],
    {
      encoding: "utf8"
    }
  );
  const [hasTest, importsTarget] = (result.stdout || "").trim().split(" ");
  /** @type {string[]} */
  const failures = [];
  if (hasTest !== "1") {
    failures.push(`contract owner "${ownerTest}" defines no function named "${testName}"`);
  }
  if (importsTarget !== "1") {
    failures.push(`contract owner "${ownerTest}" does not import ${dottedModuleName(targetFile)}`);
  }
  return failures;
}

/**
 * @param {string} root
 * @param {any} floors
 * @param {any} pythonReport
 * @returns {string[]}
 */
function checkPythonCoverage(root, floors, pythonReport) {
  /** @type {string[]} */
  const failures = [];
  const allFiles = listPythonPackageFiles(root);
  const allFileSet = new Set(allFiles);
  const reportedFiles = new Set(Object.keys(pythonReport.files));
  const contractOwned = floors.contractOwned?.python || {};

  for (const file of allFiles) {
    const owned = contractOwned[file];
    if (owned) {
      failures.push(...verifyPythonContractOwner(root, owned.ownerTest, file));
      const summary = pythonReport.files[file]?.summary;
      if (summary && summary.num_statements > 0) {
        failures.push(
          `${file}: classified contract-owned but has measured executable coverage data`
        );
      }
      continue;
    }
    if (!reportedFiles.has(file)) {
      failures.push(
        `${file}: not measured and not contract-owned; run test:coverage:python or classify it`
      );
    }
  }
  for (const file of Object.keys(contractOwned)) {
    if (!allFileSet.has(file)) {
      failures.push(`coverage-floors.json contractOwned.python["${file}"]: file no longer exists`);
    }
  }

  const validation = aggregatePythonFamily(pythonReport, { prefixes: [VALIDATION_PREFIX] });
  requireAtLeast(
    failures,
    "validation package lines",
    validation.linePercent,
    floors.families.validationPackageLinePercent
  );
  requireAtLeast(
    failures,
    "validation package branches",
    validation.branchPercent,
    floors.families.validationPackageBranchPercent
  );

  const histogram = aggregatePythonFamily(pythonReport, { exact: [HISTOGRAM_EXACT] });
  requireAtLeast(
    failures,
    "histogram core lines",
    histogram.linePercent,
    floors.families.histogramCoreLinePercent
  );
  requireAtLeast(
    failures,
    "histogram core branches",
    histogram.branchPercent,
    floors.families.histogramCoreBranchPercent
  );

  requireAtLeast(
    failures,
    "python aggregate",
    pythonReport.totals.percent_covered,
    floors.families.pythonAggregateCombinedPercent
  );

  const pluginSummary = pythonReport.files["plugin.py"]?.summary;
  if (pluginSummary) {
    requireAtLeast(
      failures,
      "plugin.py combined",
      pluginSummary.percent_covered,
      floors.pluginPy.combinedLineAndBranchPercent
    );
  }
  return failures;
}

/**
 * @param {string[]} failures
 * @param {string} label
 * @param {number} actual
 * @param {number} floor
 */
function requireAtLeast(failures, label, actual, floor) {
  // Floors are captured rounded to 2 decimals (matching the baseline capture generator's
  // convention); round the live measurement the same way so genuine no-op reruns never
  // fail on sub-hundredth floating noise (coverage.py/c8 percentages carry more digits).
  const rounded = Math.round(actual * 100) / 100;
  if (rounded + 1e-9 < floor) {
    failures.push(`${label}: ${rounded.toFixed(2)}% is below the ${floor}% floor`);
  }
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
 * @param {any} floors
 * @param {Record<string, any>} viewerReport
 * @returns {string[]}
 */
function checkViewerCoverage(root, floors, viewerReport) {
  /** @type {string[]} */
  const failures = [];
  const viewerFiles = listViewerJsFiles(root);
  const pluginFiles = ["plugin.js", "plugin.mjs"];
  const allFiles = [...viewerFiles, ...pluginFiles];
  const allFileSet = new Set(allFiles);
  const reportedByRel = new Map(
    viewerReportEntries(root, viewerReport).map(([id, entry]) => [id.rel, entry])
  );
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
        failures.push(
          `${file}: classified contract-owned but has measured executable coverage data`
        );
      }
      continue;
    }
    if (!reportedByRel.has(file)) {
      failures.push(
        `${file}: not measured and not contract-owned; run test:coverage:viewer or classify it`
      );
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
      failures.push(
        `coverage-floors.json contractOwned.javascript["${file}"]: file no longer exists`
      );
    }
  }

  const viewerFamily = aggregateJsFamily(root, viewerReport, viewerFiles);
  requireAtLeast(
    failures,
    "viewer family lines",
    viewerFamily.lines,
    floors.families.viewerFamilyLinePercent
  );
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
  requireAtLeast(
    failures,
    "viewer family branches",
    viewerFamily.branches,
    floors.families.viewerFamilyBranchPercent
  );

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

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runCoverageInventoryCheck(options = {}) {
  const root = options.root || ROOT;
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];

  failures.push(...diffCoverageFloorBaseline(root).failures);
  failures.push(...checkFloorRatchet(root).failures);

  const floors = readJson(floorsPath(root));
  try {
    const pythonReport = loadPythonReport(root);
    failures.push(...checkPythonCoverage(root, floors, pythonReport));
  } catch (error) {
    failures.push(/** @type {Error} */ (error).message);
  }
  try {
    const viewerReport = loadViewerReport(root);
    failures.push(...checkViewerCoverage(root, floors, viewerReport));
  } catch (error) {
    failures.push(/** @type {Error} */ (error).message);
  }

  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[coverage-inventory] ${failure}`);
    } else {
      console.log("Coverage inventory check passed.");
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runCoverageInventoryCheck();
  process.exit(result.ok ? 0 : 1);
}

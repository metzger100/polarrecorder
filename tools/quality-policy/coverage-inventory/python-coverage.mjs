import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { requireAtLeast } from "./shared.mjs";

const VALIDATION_PREFIX = "server/polarrecorder/validation/";
const HISTOGRAM_EXACT = "server/polarrecorder/histogram.py";

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
export function checkPythonCoverage(root, floors, pythonReport) {
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

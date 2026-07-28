import path from "node:path";

import { baselinePath, floorsPath, readJson } from "./shared.mjs";

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
function baselineCoverageCapturePath(root) {
  return path.join(root, "tools", "quality-policy", "baseline-coverage-capture.json");
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
      failures.push(`coverage-floors.json families.${key} (${active}) is below its baseline floor ${min}`);
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

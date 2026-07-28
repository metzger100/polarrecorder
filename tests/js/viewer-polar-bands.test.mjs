/**
 * Band-selection tests for viewer/polar-chart.js.
 *
 * The chip click and double-click handlers, and the three-way band-set dispatch a
 * re-render runs through (select-all on a format change, merge on a changed band set,
 * reconcile on an unchanged one), were reached by no existing viewer test. They are
 * driven here through the shared fake-DOM harness, whose element() records
 * addEventListener handlers so the chips are genuinely clickable -- unlike the minimal
 * local fake in viewer-polar.test.mjs.
 *
 * These renders deliberately pass no presetTwa, which is also the only path that
 * exercises the chart's full-curve (non-preset) index walk.
 */

import assert from "node:assert/strict";
import { test } from "vitest";

import { createEnvironment, loadViewerFile } from "../../tools/viewer-harness.mjs";

/** @typedef {import("../../tools/viewer-harness.mjs").FakeElement} FakeElement */
/** @typedef {{stw: number, samples: number}} CurveEntry */
/**
 * @typedef {{
 *   chart: {Render: (data: unknown, options: unknown) => void},
 *   chips: FakeElement,
 *   host: FakeElement
 * }} BandEnvironment
 */

/** @returns {BandEnvironment} */
function loadChart() {
  const env = createEnvironment();
  loadViewerFile(env, "placeholders.js");
  loadViewerFile(env, "dom.js");
  loadViewerFile(env, "polar-chart-geometry.js");
  loadViewerFile(env, "polar-chart.js");
  const namespace = /** @type {{PolarChart: {Render: (data: unknown, options: unknown) => void}}} */ (
    /** @type {unknown} */ (env.window.Polarrecorder)
  );
  return {
    chart: namespace.PolarChart,
    chips: env.elements["polar-chips"],
    host: env.elements["polar-chart"]
  };
}

/**
 * A curve with one usable reading, so a band renders rather than falling through to
 * the empty overlay.
 * @returns {Array<CurveEntry | undefined>}
 */
function curve() {
  /** @type {Array<CurveEntry | undefined>} */
  const values = [];
  values[90] = { stw: 6.2, samples: 12 };
  return values;
}

/**
 * @param {number[]} bands
 * @param {string} [format]
 * @returns {Record<string, unknown>}
 */
function polarData(bands, format = "windy") {
  /** @type {Record<string, Array<CurveEntry | undefined>>} */
  const curves = {};
  for (const band of bands) curves[String(band)] = curve();
  return { curves, format, generation: 1, percentile: 65, tws_bands: bands };
}

/**
 * @param {BandEnvironment} env
 * @returns {boolean[]}
 */
function activeChips(env) {
  return env.chips.children.map(function (chip) {
    return chip.classList.contains("is-active");
  });
}

test("every band starts selected on the first render", () => {
  const env = loadChart();

  env.chart.Render(polarData([12, 16]), { force: true });

  assert.deepEqual(activeChips(env), [true, true]);
});

test("clicking a band chip deselects just that band", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16]), { force: true });

  const chip = env.chips.children[0];
  chip.click();

  assert.deepEqual(activeChips(env), [false, true], "only the clicked band is deselected");
});

test("clicking a band chip again reselects it", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16]), { force: true });

  env.chips.children[0].click();
  env.chips.children[0].click();

  assert.deepEqual(activeChips(env), [true, true]);
});

test("the only band cannot be deselected into an empty selection", () => {
  const env = loadChart();
  env.chart.Render(polarData([12]), { force: true });

  env.chips.children[0].click();

  // Deselecting the last band empties the selection, which the unchanged-band-set
  // reconcile path immediately refills, so the chart never renders with no bands.
  assert.deepEqual(activeChips(env), [true]);
});

test("double-clicking a band chip isolates that band", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16, 20]), { force: true });

  const chip = env.chips.children[2];
  assert.ok(chip.ondblclick, "expected a dblclick handler on the chip");
  chip.ondblclick();

  assert.deepEqual(activeChips(env), [false, false, true]);
});

test("a newly added band is selected while existing selections are kept", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16]), { force: true });
  env.chips.children[0].click();
  assert.deepEqual(activeChips(env), [false, true], "band 12 deselected before the merge");

  env.chart.Render(polarData([12, 16, 20]), { force: true });

  assert.deepEqual(activeChips(env), [false, true, true], "12 stays off, 20 arrives selected");
});

test("a band that disappears is dropped from the selection", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16]), { force: true });

  env.chart.Render(polarData([16]), { force: true });

  assert.deepEqual(activeChips(env), [true]);
  assert.equal(env.chips.children.length, 1);
});

test("a band set that loses every selected band falls back to selecting all", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16]), { force: true });
  env.chips.children[0].ondblclick?.();
  assert.deepEqual(activeChips(env), [true, false], "only band 12 is selected");

  // 16 was present in the previous band set, so the merge does not re-add it; the
  // selection empties and the all-bands fallback takes over.
  env.chart.Render(polarData([16]), { force: true });

  assert.deepEqual(activeChips(env), [true]);
});

test("a format change reselects every band", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16]), { force: true });
  env.chips.children[0].click();
  assert.deepEqual(activeChips(env), [false, true]);

  env.chart.Render(polarData([12, 16], "Default180"), { force: true });

  assert.deepEqual(activeChips(env), [true, true]);
});

test("deselecting a band removes its curve from the chart", () => {
  const env = loadChart();
  env.chart.Render(polarData([12, 16]), { force: true });
  const before = env.host.children[0].children.length;

  env.chips.children[0].click();

  const after = env.host.children[0].children.length;
  assert.ok(after < before, `expected fewer svg nodes after deselecting (${before} -> ${after})`);
});

test("unusable preset angles are ignored", () => {
  const env = loadChart();

  env.chart.Render(polarData([12]), { force: true, presetTwa: [90, Number.NaN, -5, 400, 90] });

  // Only 90 survives normalization, so the band still renders.
  assert.deepEqual(activeChips(env), [true]);
  assert.equal(env.host.children[0].tagName, "svg");
});

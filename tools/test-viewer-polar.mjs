#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const POLAR_SOURCE = fs.readFileSync(path.join(ROOT, "viewer", "polar-chart.js"), "utf8");

testEmptyPolarShowsCenteredOverlay();
testPolarWithDataDoesNotShowEmptyOverlay();
testZeroTwaAnchorRendersAtFullConfidence();
testMissingGridColumnBreaksLine();
testCircularPresetDrawsPortLabelsAndClosesCurve();
testCircularPresetWithoutPortDataLeavesSeamOpen();
testPortHalfPresetDrawsMirroredGrid();
testNonCircularPresetKeepsStarboardOnlyGrid();

console.log("Viewer polar chart tests passed.");

function testEmptyPolarShowsCenteredOverlay() {
  const env = loadPolarChart();

  env.chart.Render({ format: "windy", generation: 1, percentile: 65, tws_bands: [], curves: {} }, { force: true });

  assert.equal(env.host.children.length, 2);
  assert.equal(env.host.children[0].tagName, "svg");
  assert.equal(env.host.children[0].attributes.get("aria-hidden"), "true");
  assert.equal(env.host.children[1].className, "chart-empty-overlay");
  assert.equal(env.host.children[1].attributes.get("role"), "status");
  assert.equal(env.host.children[1].textContent, "No Data available yet!");
  assert.equal(textTree(env.host).includes("No data yet"), false);
}

function testPolarWithDataDoesNotShowEmptyOverlay() {
  const env = loadPolarChart();
  const curve = [];
  curve[90] = { stw: 6.2, samples: 12 };

  env.chart.Render({
    curves: { "12": curve },
    format: "windy",
    generation: 2,
    percentile: 65,
    tws_bands: [12]
  }, { force: true, presetTwa: [90] });

  assert.equal(env.host.children.length, 1);
  assert.equal(env.host.children[0].tagName, "svg");
  assert.equal(env.chips.children.length, 1);
  assert.equal(env.host.children.some(function (node) {
    return node.className === "chart-empty-overlay";
  }), false);
}

function testZeroTwaAnchorRendersAtFullConfidence() {
  const env = loadPolarChart();
  const curve = [];
  curve[0] = { stw: 0.0, samples: 0 };
  curve[30] = { stw: 5.0, samples: 12 };

  env.chart.Render({
    curves: { "12": curve },
    format: "windy",
    generation: 3,
    percentile: 65,
    tws_bands: [12]
  }, { force: true, presetTwa: [0, 30, 60, 90] });

  const svg = env.host.children[0];
  const dots = svg.children.filter(function (node) {
    return node.attributes.get("class") === "chart-point";
  });
  assert.equal(dots.length, 2);
  // The server-prefilled 0 deg / 0 STW anchor sits at the center and is rendered
  // at full confidence despite 0 samples, so it never dims the curve.
  const anchor = dots.find(function (node) {
    return node.attributes.get("cx") === "280.0" && node.attributes.get("cy") === "280.0";
  });
  assert.ok(anchor, "expected a 0 deg anchor dot at the center");
  assert.equal(anchor.attributes.get("r"), "5.1");
  assert.equal(anchor.attributes.get("opacity"), "1");
  const connector = svg.children.find(function (node) {
    return node.attributes.get("class") === "chart-line";
  });
  assert.equal(connector.attributes.get("opacity"), "1");
}

function testMissingGridColumnBreaksLine() {
  const env = loadPolarChart();
  const curve = [];
  curve[30] = { stw: 5.0, samples: 12 };
  curve[52] = { stw: 6.0, samples: 12 };

  env.chart.Render({
    curves: { "12": curve },
    format: "windy",
    generation: 4,
    percentile: 65,
    tws_bands: [12]
  }, { force: true, presetTwa: [30, 40, 52] });

  const svg = env.host.children[0];
  const dots = svg.children.filter(function (node) {
    return node.attributes.get("class") === "chart-point";
  });
  assert.equal(dots.length, 2);
  // The 40 deg grid column has no data, so 30 deg and 52 deg are not adjacent
  // columns and must not be joined by a connecting line.
  const lines = svg.children.filter(function (node) {
    return node.attributes.get("class") === "chart-line";
  });
  assert.equal(lines.length, 0, "expected no connector across a missing grid column");
}

function testCircularPresetDrawsPortLabelsAndClosesCurve() {
  const env = loadPolarChart();
  const curve = [];
  curve[0] = { stw: 0.0, samples: 0 };
  curve[90] = { stw: 6.0, samples: 12 };
  curve[270] = { stw: 5.0, samples: 12 };

  env.chart.Render({
    curves: { "12": curve },
    format: "Default360",
    generation: 9,
    percentile: 65,
    tws_bands: [12]
  }, { force: true, presetTwa: [0, 90, 180, 270] });

  const svg = env.host.children[0];
  const labels = angleLabels(svg);
  // Port-half spokes carry absolute degree labels (210 deg .. 330 deg).
  assert.ok(labels.includes("210°"), "expected absolute port spoke label 210°");
  assert.ok(labels.includes("270°"), "expected absolute port spoke label 270°");
  // The full-circle curve closes: a wrap connector joins the last port point
  // (270 deg) back to the 0 deg origin, so two connectors are drawn.
  const lines = svg.children.filter(function (node) {
    return node.attributes.get("class") === "chart-line";
  });
  assert.equal(lines.length, 2, "expected a closing wrap connector for a circular preset");
}

function testCircularPresetWithoutPortDataLeavesSeamOpen() {
  const env = loadPolarChart();
  const curve = [];
  curve[0] = { stw: 0.0, samples: 0 };
  curve[90] = { stw: 6.0, samples: 12 };
  curve[180] = { stw: 4.0, samples: 12 };

  env.chart.Render({
    curves: { "12": curve },
    format: "Default360",
    generation: 11,
    percentile: 65,
    tws_bands: [12]
  }, { force: true, presetTwa: [0, 90, 180, 270] });

  const svg = env.host.children[0];
  // Data ends at the 180 deg column while the grid's port-most column (270 deg)
  // stays empty, so the wrap seam to 0 deg must not be drawn: only the single
  // adjacent run 0 -> 90 -> 180 connects, leaving the curve open.
  const lines = svg.children.filter(function (node) {
    return node.attributes.get("class") === "chart-line";
  });
  assert.equal(lines.length, 1, "starboard-only circular curve must not close to 0 deg");
}

function testPortHalfPresetDrawsMirroredGrid() {
  const env = loadPolarChart();
  const curve = [];
  curve[180] = { stw: 4.0, samples: 12 };
  curve[270] = { stw: 5.0, samples: 12 };
  curve[345] = { stw: 3.0, samples: 12 };

  env.chart.Render({
    curves: { "12": curve },
    format: "DefaultPort180",
    generation: 12,
    percentile: 65,
    tws_bands: [12]
  }, { force: true, presetTwa: [180, 270, 345] });

  const svg = env.host.children[0];
  const labels = angleLabels(svg);
  // A port-only grid mirrors the starboard half: it draws the 180 deg .. 360 deg
  // spokes and omits the starboard interior spokes and the 0 deg head label.
  assert.ok(labels.includes("270°"), "expected mirrored port spoke label 270°");
  assert.ok(labels.includes("360°"), "expected head label 360° on the port half");
  assert.equal(labels.includes("90°"), false, "port half must not draw starboard spokes");
  assert.equal(labels.includes("0°"), false, "port half labels the head as 360°, not 0°");
  // The half curve stays open: the three adjacent columns form one run with no
  // wrap connector back across the dial.
  const lines = svg.children.filter(function (node) {
    return node.attributes.get("class") === "chart-line";
  });
  assert.equal(lines.length, 1, "port half must not close across the dial");
}

function testNonCircularPresetKeepsStarboardOnlyGrid() {
  const env = loadPolarChart();
  const curve = [];
  curve[0] = { stw: 0.0, samples: 0 };
  curve[90] = { stw: 6.0, samples: 12 };

  env.chart.Render({
    curves: { "12": curve },
    format: "Default180",
    generation: 10,
    percentile: 65,
    tws_bands: [12]
  }, { force: true, presetTwa: [0, 90, 180] });

  const labels = angleLabels(env.host.children[0]);
  // A 180 deg preset draws only the starboard spokes and no port-half labels.
  assert.ok(labels.includes("180°"));
  assert.equal(labels.includes("210°"), false, "180 deg preset must not draw port spokes");
}

function angleLabels(svg) {
  return svg.children.filter(function (node) {
    return node.attributes.get("class") === "chart-angle-label";
  }).map(function (node) {
    return node.textContent;
  });
}

function loadPolarChart() {
  const elements = {
    "polar-chart": makeElement("div"),
    "polar-chips": makeElement("div")
  };
  const context = {
    document: {
      createElement(tag) {
        return makeElement(tag);
      },
      createElementNS(_namespace, tag) {
        return makeElement(tag);
      },
      getElementById(id) {
        return elements[id] || null;
      }
    },
    window: { Polarrecorder: {} }
  };

  vm.runInNewContext(POLAR_SOURCE, context);
  return {
    chart: context.window.Polarrecorder.PolarChart,
    chips: elements["polar-chips"],
    host: elements["polar-chart"]
  };
}

function makeElement(tagName) {
  return {
    attributes: new Map(),
    children: [],
    className: "",
    style: {
      setProperty() {}
    },
    tagName,
    textContent: "",
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren() {
      this.children = [];
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }
  };
}

function textTree(node) {
  return node.textContent + node.children.map(textTree).join("");
}

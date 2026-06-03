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
  assert.equal(anchor.attributes.get("r"), "3.4");
  assert.equal(anchor.attributes.get("opacity"), "1");
  const connector = svg.children.find(function (node) {
    return node.attributes.get("class") === "chart-line";
  });
  assert.equal(connector.attributes.get("opacity"), "1");
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

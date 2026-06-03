/**
 * Module: Polar Chart
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const CENTER_X = 280;
  const CENTER_Y = 280;
  const PLOT_RADIUS = 220;
  const ANGLE_LABEL_OFFSET = 18;
  const LOW_CONFIDENCE = 10;
  const SOLID_GAP_LIMIT = 2;
  const SPARSE_GAP_LIMIT = 35;
  const selectedBands = new Set();
  let lastKey = "";
  let lastData = null;
  let lastBandsKey = "";
  let lastFormat = "";
  let lastPresetTwa = [];

  function render(data, options) {
    options = options || {};
    const host = document.getElementById("polar-chart");
    const chips = document.getElementById("polar-chips");
    const requested = options.requestedFormat || data.format;
    const presetTwa = normalizeTwa(options.presetTwa);
    const key = requested + "|" + data.format + "|" + String(data.generation)
      + "|" + String(data.percentile) + "|" + bandsKey(data.tws_bands)
      + "|" + presetTwa.join(",");
    if (!options.force && key === lastKey && lastData) return;
    lastKey = key;
    lastData = data;
    lastPresetTwa = presetTwa;
    const nextBandsKey = bandsKey(data.tws_bands);
    if (lastFormat !== data.format || options.resetBands) {
      selectAllBands(data.tws_bands);
    } else if (lastBandsKey !== nextBandsKey) {
      mergeBands(data.tws_bands, lastBandsKey);
    } else {
      reconcileBands(data.tws_bands);
    }
    lastBandsKey = nextBandsKey;
    lastFormat = data.format;
    host.replaceChildren();
    chips.replaceChildren();
    data.tws_bands.forEach(function (band, index) {
      chips.appendChild(chipForBand(data, band, index));
    });
    if (!hasRenderableData(data, lastPresetTwa)) {
      host.appendChild(emptySvg());
      host.appendChild(emptyOverlay());
      return;
    }
    host.appendChild(buildSvg(data, lastPresetTwa));
  }

  function chipForBand(data, band, index) {
    const text = String(band);
    const chip = document.createElement("button");
    chip.className = "chip state-layer" + (selectedBands.has(text) ? " is-active" : "");
    chip.type = "button";
    chip.textContent = text + " kt";
    chip.style.setProperty("--chip-color", bandColor(index, data.tws_bands.length));
    chip.addEventListener("click", function () {
      if (selectedBands.has(text)) selectedBands.delete(text);
      else selectedBands.add(text);
      lastKey = "";
      render(data, { force: true, presetTwa: lastPresetTwa });
    });
    chip.addEventListener("dblclick", function () {
      selectedBands.clear();
      selectedBands.add(text);
      lastKey = "";
      render(data, { force: true, presetTwa: lastPresetTwa });
    });
    return chip;
  }

  function buildSvg(data, presetTwa) {
    const svg = svgNode("svg");
    svg.setAttribute("viewBox", "0 0 560 560");
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Polar diagram");
    const max = radiusMax(data);
    addGrid(svg, max);
    data.tws_bands.forEach(function (band, index) {
      const key = String(band);
      if (selectedBands.has(key)) addCurve(svg, data.curves[key] || [], presetTwa, band, index, data.tws_bands.length, max);
    });
    return svg;
  }

  function emptySvg() {
    const svg = svgNode("svg");
    svg.setAttribute("viewBox", "0 0 560 560");
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("aria-hidden", "true");
    addGrid(svg, 4);
    return svg;
  }

  function emptyOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "chart-empty-overlay";
    overlay.setAttribute("role", "status");
    overlay.textContent = "No Data available yet!";
    return overlay;
  }

  function radiusMax(data) {
    let max = 0;
    data.tws_bands.forEach(function (band) {
      const curve = data.curves[String(band)] || [];
      if (!selectedBands.has(String(band))) return;
      renderIndexes(curve, lastPresetTwa).forEach(function (twa) {
        const entry = curve[twa];
        if (entry && entry.stw > max) max = entry.stw;
      });
    });
    if (max < 4) return 4;
    return Math.ceil(max / 2) * 2;
  }

  function addGrid(svg, max) {
    const step = 1;
    for (let speed = step; speed <= max; speed += step) {
      const radius = speed / max * PLOT_RADIUS;
      const circle = svgNode("circle");
      circle.setAttribute("cx", String(CENTER_X));
      circle.setAttribute("cy", String(CENTER_Y));
      circle.setAttribute("r", String(radius));
      circle.setAttribute("fill", "none");
      circle.setAttribute("class", "chart-grid-line");
      svg.appendChild(circle);
      const label = svgText(CENTER_X + 8, CENTER_Y - radius + 4, String(speed) + " kn");
      label.setAttribute("class", "chart-axis-label");
      label.setAttribute("text-anchor", "start");
      svg.appendChild(label);
    }
    [0, 30, 60, 90, 120, 150, 180].forEach(function (angle) {
      const point = mapPoint(angle, max, max);
      const line = svgNode("line");
      line.setAttribute("x1", String(CENTER_X));
      line.setAttribute("y1", String(CENTER_Y));
      line.setAttribute("x2", String(point.x));
      line.setAttribute("y2", String(point.y));
      line.setAttribute("class", "chart-grid-line");
      svg.appendChild(line);
      const labelPoint = anglePoint(angle, PLOT_RADIUS + ANGLE_LABEL_OFFSET);
      const label = svgText(labelPoint.x, labelPoint.y, String(angle) + "°");
      label.setAttribute("class", "chart-angle-label");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      svg.appendChild(label);
    });
  }

  function addCurve(svg, curve, presetTwa, band, index, count, max) {
    const color = bandColor(index, count);
    const points = [];
    renderIndexes(curve, presetTwa).forEach(function (twa) {
      const entry = curve[twa];
      if (!entry) return;
      const point = mapPoint(twa, entry.stw, max);
      point.twa = twa;
      point.entry = entry;
      points.push(point);
    });
    addConnectors(svg, points, color);
    points.forEach(function (point) {
      addPoint(svg, point, band, point.twa, point.entry, color);
    });
  }

  function addConnectors(svg, points, color) {
    const limit = gapLimit(points);
    let run = [];
    points.forEach(function (point) {
      const previous = run[run.length - 1];
      if (!previous || point.twa - previous.twa <= limit) {
        run.push(point);
        return;
      }
      addRun(svg, run, color);
      addGap(svg, previous, point, color);
      run = [point];
    });
    addRun(svg, run, color);
  }

  function addRun(svg, points, color) {
    if (points.length < 2) return;
    const line = svgNode("polyline");
    line.setAttribute("points", points.map(function (point) {
      return point.x.toFixed(1) + "," + point.y.toFixed(1);
    }).join(" "));
    line.setAttribute("class", "chart-line");
    line.setAttribute("stroke", color);
    line.setAttribute("opacity", runOpacity(points));
    svg.appendChild(line);
  }

  function addGap(svg, a, b, color) {
    const line = svgNode("line");
    line.setAttribute("x1", a.x.toFixed(1));
    line.setAttribute("y1", a.y.toFixed(1));
    line.setAttribute("x2", b.x.toFixed(1));
    line.setAttribute("y2", b.y.toFixed(1));
    line.setAttribute("class", "chart-line");
    line.setAttribute("stroke", color);
    line.setAttribute("opacity", runOpacity([a, b]));
    svg.appendChild(line);
  }

  function runOpacity(points) {
    return points.some(function (point) {
      return isLowConfidence(point.twa, point.entry);
    }) ? "0.65" : "1";
  }

  function isLowConfidence(twa, entry) {
    return twa !== 0 && entry.samples < LOW_CONFIDENCE;
  }

  function addPoint(svg, point, band, twa, entry, color) {
    const lowConfidence = isLowConfidence(twa, entry);
    const dot = svgNode("circle");
    dot.setAttribute("cx", point.x.toFixed(1));
    dot.setAttribute("cy", point.y.toFixed(1));
    dot.setAttribute("r", lowConfidence ? "2.4" : "3.4");
    dot.setAttribute("class", "chart-point");
    dot.setAttribute("fill", color);
    dot.setAttribute("opacity", lowConfidence ? "0.5" : "1");
    const message = String(twa) + "° TWA · " + String(band) + " kt TWS · " + entry.stw.toFixed(1) + " kt STW · " + String(entry.samples) + " samples";
    const hit = svgNode("circle");
    hit.setAttribute("cx", point.x.toFixed(1));
    hit.setAttribute("cy", point.y.toFixed(1));
    hit.setAttribute("r", "8");
    hit.setAttribute("class", "chart-hit-point");
    hit.addEventListener("pointerenter", function (event) {
      showTooltip(message, event.clientX, event.clientY);
    });
    hit.addEventListener("click", function (event) {
      showTooltip(message, event.clientX, event.clientY);
    });
    svg.appendChild(dot);
    svg.appendChild(hit);
  }

  function mapPoint(twa, stw, max) {
    return anglePoint(twa, stw / max * PLOT_RADIUS);
  }

  function anglePoint(angle, radius) {
    const radians = angle * Math.PI / 180;
    return {
      x: CENTER_X + radius * Math.sin(radians),
      y: CENTER_Y - radius * Math.cos(radians)
    };
  }

  function bandColor(index, count) {
    const hue = count <= 1 ? 190 : 210 - index / Math.max(1, count - 1) * 185;
    return "hsl(" + hue.toFixed(0) + " 70% 50%)";
  }

  function gapLimit(points) {
    return points.length > 30 ? SOLID_GAP_LIMIT : SPARSE_GAP_LIMIT;
  }

  function bandsKey(bands) {
    return (bands || []).map(String).join(",");
  }

  function normalizeTwa(values) {
    const seen = new Set();
    const out = [];
    (values || []).forEach(function (value) {
      const twa = Number(value);
      if (!Number.isFinite(twa)) return;
      const rounded = Math.round(twa);
      if (rounded < 0 || rounded > 180 || seen.has(rounded)) return;
      seen.add(rounded);
      out.push(rounded);
    });
    return out.sort(function (a, b) {
      return a - b;
    });
  }

  function hasRenderableData(data, presetTwa) {
    return (data.tws_bands || []).some(function (band) {
      const curve = data.curves[String(band)] || [];
      return renderIndexes(curve, presetTwa).some(function (twa) {
        return !!curve[twa];
      });
    });
  }

  function renderIndexes(curve, presetTwa) {
    if (presetTwa.length > 0) return presetTwa;
    return curve.map(function (_entry, index) {
      return index;
    });
  }

  function selectAllBands(bands) {
    selectedBands.clear();
    bands.forEach(function (band) {
      selectedBands.add(String(band));
    });
  }

  function mergeBands(bands, previousKey) {
    const previous = new Set(previousKey ? previousKey.split(",") : []);
    const next = new Set(bands.map(String));
    selectedBands.forEach(function (band) {
      if (!next.has(band)) selectedBands.delete(band);
    });
    bands.forEach(function (band) {
      const key = String(band);
      if (!previous.has(key)) selectedBands.add(key);
    });
    if (selectedBands.size === 0) selectAllBands(bands);
  }

  function reconcileBands(bands) {
    const next = new Set(bands.map(String));
    selectedBands.forEach(function (band) {
      if (!next.has(band)) selectedBands.delete(band);
    });
    if (selectedBands.size === 0) {
      bands.forEach(function (band) {
        selectedBands.add(String(band));
      });
    }
  }

  function svgNode(tag) {
    return document.createElementNS(SVG_NS, tag);
  }

  function svgText(x, y, textValue) {
    const text = svgNode("text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("fill", "var(--polarrecorder-fore-color)");
    text.setAttribute("font-size", "11");
    text.textContent = textValue;
    return text;
  }

  function showTooltip(text, x, y) {
    const fn = Polarrecorder["ShowTooltip"];
    if (fn) fn(text, x, y);
  }

  Polarrecorder.PolarChart = { Render: render };
}());

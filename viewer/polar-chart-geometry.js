/**
 * Module: Polar Chart Geometry
 * Documentation: documentation/architecture/ui.md
 * Depends: dom.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  /** @type {"http://www.w3.org/2000/svg"} */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const CENTER_X = 280;
  const CENTER_Y = 280;
  const PLOT_RADIUS = 220;
  const ANGLE_LABEL_OFFSET = 18;
  const LOW_CONFIDENCE = 10;
  const STARBOARD_SPOKES = [0, 30, 60, 90, 120, 150, 180];
  const PORT_SPOKES = [210, 240, 270, 300, 330];
  const PORT_HALF_SPOKES = [180, 210, 240, 270, 300, 330, 360];

  /** @typedef {{stw: number, samples: number}} CurveEntry */
  /** @typedef {{x: number, y: number}} Point2D */
  /**
   * @typedef {{x: number, y: number, twa: number, entry: CurveEntry, gridIndex: number}} ChartPoint
   */
  /** @typedef {"starboard" | "port" | "full"} GridMode */

  /**
   * @param {GridMode} mode
   * @returns {number[]}
   */
  function spokesForMode(mode) {
    if (mode === "full") return STARBOARD_SPOKES.concat(PORT_SPOKES);
    if (mode === "port") return PORT_HALF_SPOKES;
    return STARBOARD_SPOKES;
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {number} max
   * @param {GridMode} mode
   */
  function addGrid(svg, max, mode) {
    const step = 1;
    for (let speed = step; speed <= max; speed += step) {
      const radius = (speed / max) * PLOT_RADIUS;
      const circle = svgNode("circle");
      circle.setAttribute("cx", String(CENTER_X));
      circle.setAttribute("cy", String(CENTER_Y));
      circle.setAttribute("r", String(radius));
      circle.setAttribute("fill", "none");
      circle.setAttribute("class", "chart-grid-line");
      svg.appendChild(circle);
      const label = Polarrecorder.Dom.SvgText(
        CENTER_X + 8,
        CENTER_Y - radius + 4,
        String(speed) + " kn",
        "11"
      );
      label.setAttribute("class", "chart-axis-label");
      label.setAttribute("text-anchor", "start");
      svg.appendChild(label);
    }
    const spokes = spokesForMode(mode);
    spokes.forEach(function (angle) {
      const point = mapPoint(angle, max, max);
      const line = svgNode("line");
      line.setAttribute("x1", String(CENTER_X));
      line.setAttribute("y1", String(CENTER_Y));
      line.setAttribute("x2", String(point.x));
      line.setAttribute("y2", String(point.y));
      line.setAttribute("class", "chart-grid-line");
      svg.appendChild(line);
      const labelPoint = anglePoint(angle, PLOT_RADIUS + ANGLE_LABEL_OFFSET);
      const label = Polarrecorder.Dom.SvgText(
        labelPoint.x,
        labelPoint.y,
        String(angle) + "°",
        "11"
      );
      label.setAttribute("class", "chart-angle-label");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      svg.appendChild(label);
    });
  }

  /** @typedef {{band: number, index: number, count: number}} BandInfo */

  /**
   * @param {SVGSVGElement} svg
   * @param {Array<CurveEntry | undefined>} curve
   * @param {number[]} presetTwa
   * @param {BandInfo} bandInfo
   * @param {number} max
   * @param {boolean} circular
   */
  function addCurve(svg, curve, presetTwa, bandInfo, max, circular) {
    const color = bandColor(bandInfo.index, bandInfo.count);
    /** @type {ChartPoint[]} */
    const points = [];
    renderIndexes(curve, presetTwa).forEach(function (twa, gridIndex) {
      const entry = curve[twa];
      if (!entry) return;
      const mapped = mapPoint(twa, entry.stw, max);
      points.push({
        x: mapped.x,
        y: mapped.y,
        twa: twa,
        entry: entry,
        gridIndex: gridIndex
      });
    });
    addConnectors(svg, points, color, circular, presetTwa.length);
    points.forEach(function (point) {
      addPoint(svg, point, bandInfo.band, point.twa, point.entry, color);
    });
  }

  /**
   * @param {Array<CurveEntry | undefined>} curve
   * @param {number[]} presetTwa
   * @returns {number[]}
   */
  function renderIndexes(curve, presetTwa) {
    if (presetTwa.length > 0) return presetTwa;
    return curve.map(function (_entry, index) {
      return index;
    });
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {ChartPoint[]} points
   * @param {string} color
   * @param {boolean} circular
   * @param {number} gridCount
   */
  function addConnectors(svg, points, color, circular, gridCount) {
    /** @type {ChartPoint[]} */
    let run = [];
    points.forEach(function (point) {
      const previous = run[run.length - 1];
      if (!previous || point.gridIndex - previous.gridIndex === 1) {
        run.push(point);
        return;
      }
      addRun(svg, run, color);
      run = [point];
    });
    addRun(svg, run, color);
    // A circular preset closes the full-circle curve by joining the last grid
    // column back to the first (the 0 deg/360 deg head-to-wind origin). This
    // wrap seam is only drawn when both columns adjacent to that origin hold
    // data; otherwise (for example a starboard-only curve ending at 180 deg)
    // the gap stays open instead of cutting straight across to 0 deg.
    if (
      circular &&
      points.length >= 2 &&
      points[0].gridIndex === 0 &&
      points[points.length - 1].gridIndex === gridCount - 1
    ) {
      addRun(svg, [points[points.length - 1], points[0]], color);
    }
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {ChartPoint[]} points
   * @param {string} color
   */
  function addRun(svg, points, color) {
    if (points.length < 2) return;
    const line = svgNode("polyline");
    line.setAttribute(
      "points",
      points
        .map(function (point) {
          return point.x.toFixed(1) + "," + point.y.toFixed(1);
        })
        .join(" ")
    );
    line.setAttribute("class", "chart-line");
    line.setAttribute("stroke", color);
    line.setAttribute("opacity", runOpacity(points));
    svg.appendChild(line);
  }

  /**
   * @param {ChartPoint[]} points
   * @returns {string}
   */
  function runOpacity(points) {
    return points.some(function (point) {
      return isLowConfidence(point.twa, point.entry);
    })
      ? "0.65"
      : "1";
  }

  /**
   * @param {number} twa
   * @param {CurveEntry} entry
   * @returns {boolean}
   */
  function isLowConfidence(twa, entry) {
    return twa !== 0 && entry.samples < LOW_CONFIDENCE;
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {ChartPoint} point
   * @param {number} band
   * @param {number} twa
   * @param {CurveEntry} entry
   * @param {string} color
   */
  function addPoint(svg, point, band, twa, entry, color) {
    const lowConfidence = isLowConfidence(twa, entry);
    const dot = svgNode("circle");
    dot.setAttribute("cx", point.x.toFixed(1));
    dot.setAttribute("cy", point.y.toFixed(1));
    dot.setAttribute("r", lowConfidence ? "3.6" : "5.1");
    dot.setAttribute("class", "chart-point");
    dot.setAttribute("fill", color);
    dot.setAttribute("opacity", lowConfidence ? "0.5" : "1");
    const message =
      String(twa) +
      "° TWA · " +
      String(band) +
      " kt TWS · " +
      entry.stw.toFixed(1) +
      " kt STW · " +
      String(entry.samples) +
      " samples";
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

  /**
   * @param {number} twa
   * @param {number} stw
   * @param {number} max
   * @returns {Point2D}
   */
  function mapPoint(twa, stw, max) {
    return anglePoint(twa, (stw / max) * PLOT_RADIUS);
  }

  /**
   * @param {number} angle
   * @param {number} radius
   * @returns {Point2D}
   */
  function anglePoint(angle, radius) {
    const radians = (angle * Math.PI) / 180;
    return {
      x: CENTER_X + radius * Math.sin(radians),
      y: CENTER_Y - radius * Math.cos(radians)
    };
  }

  /**
   * @param {number} index
   * @param {number} count
   * @returns {string}
   */
  function bandColor(index, count) {
    const hue = count <= 1 ? 190 : 210 - (index / Math.max(1, count - 1)) * 185;
    return "hsl(" + hue.toFixed(0) + " 70% 50%)";
  }

  /**
   * @template {keyof SVGElementTagNameMap} K
   * @param {K} tag
   * @returns {SVGElementTagNameMap[K]}
   */
  function svgNode(tag) {
    return document.createElementNS(SVG_NS, tag);
  }

  /**
   * @param {string} text
   * @param {number} x
   * @param {number} y
   */
  function showTooltip(text, x, y) {
    Polarrecorder.Dom.ShowTooltip(text, x, y);
  }

  Polarrecorder.PolarChartGeometry = {
    SvgNode: svgNode,
    AddGrid: addGrid,
    AddCurve: addCurve,
    BandColor: bandColor
  };
})();

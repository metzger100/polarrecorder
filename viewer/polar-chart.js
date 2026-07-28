/**
 * @file Polar Chart
 * Documentation: documentation/architecture/ui.md
 * Depends: placeholders.js, dom.js, polar-chart-geometry.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const CIRCULAR_MIN_TWA = 180;

  /** @typedef {{stw: number, samples: number}} CurveEntry */
  /**
   * @typedef {{
   *   format: string,
   *   generation: number,
   *   percentile: number,
   *   tws_bands: number[],
   *   curves: Record<string, Array<CurveEntry | undefined>>
   * }} PolarData
   */
  /**
   * @typedef {{
   *   force?: boolean,
   *   requestedFormat?: string,
   *   presetTwa?: number[],
   *   resetBands?: boolean
   * }} PolarRenderOptions
   */
  /** @typedef {"starboard" | "port" | "full"} GridMode */

  /** @type {Set<string>} */
  const selectedBands = new Set();
  let lastKey = "";
  /** @type {PolarData | null} */
  let lastData = null;
  let lastBandsKey = "";
  let lastFormat = "";
  /** @type {number[]} */
  let lastPresetTwa = [];

  /**
   * @param {PolarData} data
   * @param {PolarRenderOptions} [options]
   */
  function render(data, options) {
    options = options || {};
    const host = Polarrecorder.Dom.RequireById("polar-chart");
    const chips = Polarrecorder.Dom.RequireById("polar-chips");
    const requested = options.requestedFormat || data.format;
    const presetTwa = normalizeTwa(options.presetTwa);
    const key =
      requested +
      "|" +
      data.format +
      "|" +
      String(data.generation) +
      "|" +
      String(data.percentile) +
      "|" +
      bandsKey(data.tws_bands) +
      "|" +
      presetTwa.join(",");
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
    Polarrecorder.Dom.Clear(host);
    Polarrecorder.Dom.Clear(chips);
    data.tws_bands.forEach(function (band, index) {
      chips.appendChild(chipForBand(data, band, index));
    });
    if (!hasRenderableData(data, lastPresetTwa)) {
      host.appendChild(emptySvg(gridMode(lastPresetTwa)));
      host.appendChild(emptyOverlay());
      return;
    }
    host.appendChild(buildSvg(data, lastPresetTwa));
  }

  /**
   * @param {PolarData} data
   * @param {number} band
   * @param {number} index
   * @returns {HTMLButtonElement}
   */
  function chipForBand(data, band, index) {
    const text = String(band);
    const chip = document.createElement("button");
    chip.className = "chip state-layer" + (selectedBands.has(text) ? " is-active" : "");
    chip.type = "button";
    chip.textContent = text + " kt";
    chip.style.setProperty(
      "--polarrecorder-chip-color",
      Polarrecorder.PolarChartGeometry.BandColor(index, data.tws_bands.length)
    );
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

  /**
   * @param {PolarData} data
   * @param {number[]} presetTwa
   * @returns {SVGSVGElement}
   */
  function buildSvg(data, presetTwa) {
    const svg = Polarrecorder.PolarChartGeometry.SvgNode("svg");
    svg.setAttribute("viewBox", "0 0 560 560");
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Polar diagram");
    const max = radiusMax(data);
    const mode = gridMode(presetTwa);
    Polarrecorder.PolarChartGeometry.AddGrid(svg, max, mode);
    data.tws_bands.forEach(function (band, index) {
      const key = String(band);
      if (!selectedBands.has(key)) return;
      const curve = data.curves[key] || [];
      Polarrecorder.PolarChartGeometry.AddCurve(
        svg,
        curve,
        presetTwa,
        { band: band, index: index, count: data.tws_bands.length },
        max,
        mode === "full"
      );
    });
    return svg;
  }

  /**
   * @param {GridMode} mode
   * @returns {SVGSVGElement}
   */
  function emptySvg(mode) {
    const svg = Polarrecorder.PolarChartGeometry.SvgNode("svg");
    svg.setAttribute("viewBox", "0 0 560 560");
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("aria-hidden", "true");
    Polarrecorder.PolarChartGeometry.AddGrid(svg, 4, mode || "starboard");
    return svg;
  }

  // A preset spanning both sides of the centerline (some column below 180 deg and
  // some above) is a full circle. A preset whose only off-centerline columns sit
  // above 180 deg is a mirrored port half (180 deg .. 360 deg); anything else is
  // the default starboard half (0 deg .. 180 deg).
  /**
   * @param {number[]} presetTwa
   * @returns {GridMode}
   */
  function gridMode(presetTwa) {
    const hasStarboard = presetTwa.some(function (twa) {
      return twa > 0 && twa < CIRCULAR_MIN_TWA;
    });
    const hasPort = presetTwa.some(function (twa) {
      return twa > CIRCULAR_MIN_TWA;
    });
    if (hasStarboard && hasPort) return "full";
    if (hasPort) return "port";
    return "starboard";
  }

  /** @returns {HTMLDivElement} */
  function emptyOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "chart-empty-overlay";
    overlay.setAttribute("role", "status");
    overlay.textContent = Polarrecorder.Placeholders.NoData + " available yet!";
    return overlay;
  }

  /**
   * @param {PolarData} data
   * @returns {number}
   */
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

  /**
   * @param {number[]} bands
   * @returns {string}
   */
  function bandsKey(bands) {
    return (bands || []).map(String).join(",");
  }

  /**
   * @param {number[] | undefined} values
   * @returns {number[]}
   */
  function normalizeTwa(values) {
    /** @type {Set<number>} */
    const seen = new Set();
    /** @type {number[]} */
    const out = [];
    (values || []).forEach(function (value) {
      const twa = Number(value);
      if (!Number.isFinite(twa)) return;
      const rounded = Math.round(twa);
      if (rounded < 0 || rounded > 359 || seen.has(rounded)) return;
      seen.add(rounded);
      out.push(rounded);
    });
    return out.sort(function (a, b) {
      return a - b;
    });
  }

  /**
   * @param {PolarData} data
   * @param {number[]} presetTwa
   * @returns {boolean}
   */
  function hasRenderableData(data, presetTwa) {
    return (data.tws_bands || []).some(function (band) {
      const curve = data.curves[String(band)] || [];
      return renderIndexes(curve, presetTwa).some(function (twa) {
        return !!curve[twa];
      });
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

  /** @param {number[]} bands */
  function selectAllBands(bands) {
    selectedBands.clear();
    bands.forEach(function (band) {
      selectedBands.add(String(band));
    });
  }

  /**
   * @param {number[]} bands
   * @param {string} previousKey
   */
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

  /** @param {number[]} bands */
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

  Polarrecorder.PolarChart = { Render: render };
})();

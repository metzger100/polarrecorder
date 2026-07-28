/**
 * @file Timeline Chart
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  /** @type {"http://www.w3.org/2000/svg"} */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const HEIGHT = 150;
  const PAD = 18;
  const WIDTH = 684;

  /** @typedef {{t: number, accepted: number, rejected: number, quarantined: number, reasons?: Record<string, number>}} TimelineBucket */
  /** @typedef {{buckets: TimelineBucket[]}} TimelineData */

  /**
   * @param {TimelineData} data
   * @param {number} minutes
   */
  function render(data, minutes) {
    renderButtons(minutes);
    const host = Polarrecorder.Dom.RequireById("timeline-chart");
    Polarrecorder.Dom.Clear(host);
    const buckets = (data && data.buckets) || [];
    const svg = svgNode("svg");
    svg.setAttribute("viewBox", "0 0 720 250");
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Decision timeline");
    addFrame(svg);
    if (buckets.length === 0) {
      svg.appendChild(Polarrecorder.Dom.SvgText(360, 95, "No timeline data yet", "12", "middle"));
      host.appendChild(svg);
      return;
    }
    drawBuckets(svg, buckets, minutes);
    addScale(svg, minutes, timelineNow(buckets));
    addLegend(svg);
    host.appendChild(svg);
  }

  /** @param {number} activeMinutes */
  function renderButtons(activeMinutes) {
    const host = Polarrecorder.Dom.RequireById("timeline-ranges");
    Polarrecorder.Dom.Clear(host);
    /** @type {Array<[number, string]>} */
    const ranges = [
      [30, "30 min"],
      [60, "1 h"],
      [240, "4 h"]
    ];
    ranges.forEach(function (item) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "state-layer" + (item[0] === activeMinutes ? " is-active" : "");
      button.textContent = item[1];
      button.addEventListener("click", function () {
        const fn = Polarrecorder["FetchTimeline"];
        if (fn) fn(item[0]);
      });
      host.appendChild(button);
    });
  }

  /** @param {SVGSVGElement} svg */
  function addFrame(svg) {
    const bg = svgNode("rect");
    bg.setAttribute("x", String(PAD));
    bg.setAttribute("y", String(PAD));
    bg.setAttribute("width", String(WIDTH));
    bg.setAttribute("height", String(HEIGHT));
    bg.setAttribute("fill", "var(--polarrecorder-surface-variant)");
    svg.appendChild(bg);
  }

  /** @param {SVGSVGElement} svg */
  function addLegend(svg) {
    [
      ["Accepted", "accepted"],
      ["Rejected", "rejected"],
      ["Quarantined", "quarantined"]
    ].forEach(function (item, index) {
      const x = 26 + index * 145;
      const dot = svgNode("circle");
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", "228");
      dot.setAttribute("r", "6");
      dot.setAttribute("fill", decisionColor(item[1]));
      svg.appendChild(dot);
      const text = Polarrecorder.Dom.SvgText(x + 12, 232, item[0], "12", "middle");
      text.setAttribute("text-anchor", "start");
      svg.appendChild(text);
    });
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {number} minutes
   * @param {number} now
   */
  function addScale(svg, minutes, now) {
    const marks = [0, 0.25, 0.5, 0.75, 1];
    marks.forEach(function (mark) {
      const x = PAD + WIDTH * mark;
      const line = svgNode("line");
      line.setAttribute("x1", x.toFixed(1));
      line.setAttribute("x2", x.toFixed(1));
      line.setAttribute("y1", String(PAD + HEIGHT + 4));
      line.setAttribute("y2", String(PAD + HEIGHT + 14));
      line.setAttribute("stroke", "var(--polarrecorder-border-color)");
      svg.appendChild(line);
      svg.appendChild(Polarrecorder.Dom.SvgText(x, PAD + HEIGHT + 32, scaleLabel(mark, minutes, now), "12", "middle"));
    });
  }

  /**
   * @param {number} mark
   * @param {number} minutes
   * @param {number} now
   * @returns {string}
   */
  function scaleLabel(mark, minutes, now) {
    const seconds = now - minutes * 60 * (1 - mark);
    return new Date(seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {TimelineBucket[]} buckets
   * @param {number} minutes
   */
  function drawBuckets(svg, buckets, minutes) {
    const now = timelineNow(buckets);
    const start = now - minutes * 60;
    const width = WIDTH / minutes;
    buckets.forEach(function (bucket) {
      const minute = Math.round((bucket.t - start) / 60);
      if (minute < 0 || minute >= minutes) return;
      const x = PAD + minute * width;
      addBucket(svg, bucket, x, Math.max(1, width - 1));
    });
  }

  /**
   * @param {TimelineBucket[]} buckets
   * @returns {number}
   */
  function timelineNow(buckets) {
    return (
      Math.max.apply(
        null,
        buckets.map(function (bucket) {
          return bucket.t;
        })
      ) + 60
    );
  }

  /**
   * @param {SVGSVGElement} svg
   * @param {TimelineBucket} bucket
   * @param {number} x
   * @param {number} width
   */
  function addBucket(svg, bucket, x, width) {
    const total = bucket.accepted + bucket.rejected + bucket.quarantined;
    if (total <= 0) return;
    let y = PAD;
    /** @type {Array<[string, number]>} */
    const parts = [
      ["accepted", bucket.accepted],
      ["rejected", bucket.rejected],
      ["quarantined", bucket.quarantined]
    ];
    parts.forEach(function (part) {
      if (part[1] <= 0) return;
      const height = (HEIGHT * part[1]) / total;
      const rect = svgNode("rect");
      rect.setAttribute("x", x.toFixed(1));
      rect.setAttribute("y", y.toFixed(1));
      rect.setAttribute("width", width.toFixed(1));
      rect.setAttribute("height", Math.max(1, height).toFixed(1));
      rect.setAttribute("fill", decisionColor(part[0]));
      rect.addEventListener("click", function (event) {
        showTooltip(bucketText(bucket), event.clientX, event.clientY);
      });
      svg.appendChild(rect);
      y += height;
    });
  }

  /**
   * @param {TimelineBucket} bucket
   * @returns {string}
   */
  function bucketText(bucket) {
    const date = new Date(bucket.t * 1000);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const reasonCounts = bucket.reasons || {};
    const reasons = Object.keys(reasonCounts)
      .sort(function (a, b) {
        return reasonCounts[b] - reasonCounts[a];
      })
      .slice(0, 3)
      .map(function (reason) {
        return reason + " ×" + String(reasonCounts[reason]);
      })
      .join(", ");
    const counts =
      String(bucket.accepted) +
      " accepted · " +
      String(bucket.rejected) +
      " rejected · " +
      String(bucket.quarantined) +
      " quarantined";
    return time + " · " + counts + (reasons ? " · " + reasons : "");
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  function decisionColor(name) {
    if (name === "accepted") return "var(--polarrecorder-accepted-color)";
    if (name === "rejected") return "var(--polarrecorder-rejected-color)";
    return "var(--polarrecorder-quarantined-color)";
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

  Polarrecorder.TimelineChart = { Render: render };
})();

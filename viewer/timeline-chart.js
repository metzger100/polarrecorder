/**
 * Module: Timeline Chart
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const HEIGHT = 150;
  const PAD = 18;
  const WIDTH = 684;

  function render(data, minutes) {
    renderButtons(minutes);
    const host = document.getElementById("timeline-chart");
    host.replaceChildren();
    const buckets = (data && data.buckets) || [];
    const svg = svgNode("svg");
    svg.setAttribute("viewBox", "0 0 720 250");
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Decision timeline");
    addFrame(svg);
    if (buckets.length === 0) {
      svg.appendChild(label(360, 95, "No timeline data yet"));
      host.appendChild(svg);
      return;
    }
    drawBuckets(svg, buckets, minutes);
    addScale(svg, minutes, timelineNow(buckets));
    addLegend(svg);
    host.appendChild(svg);
  }

  function renderButtons(activeMinutes) {
    const host = document.getElementById("timeline-ranges");
    host.replaceChildren();
    [[30, "30 min"], [60, "1 h"], [240, "4 h"]].forEach(function (item) {
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

  function addFrame(svg) {
    const bg = svgNode("rect");
    bg.setAttribute("x", String(PAD));
    bg.setAttribute("y", String(PAD));
    bg.setAttribute("width", String(WIDTH));
    bg.setAttribute("height", String(HEIGHT));
    bg.setAttribute("fill", "var(--polarrecorder-surface-variant)");
    svg.appendChild(bg);
  }

  function addLegend(svg) {
    [["Accepted", "accepted"], ["Rejected", "rejected"], ["Quarantined", "quarantined"]].forEach(function (item, index) {
      const x = 26 + index * 145;
      const dot = svgNode("circle");
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", "228");
      dot.setAttribute("r", "6");
      dot.setAttribute("fill", decisionColor(item[1]));
      svg.appendChild(dot);
      const text = label(x + 12, 232, item[0]);
      text.setAttribute("text-anchor", "start");
      svg.appendChild(text);
    });
  }

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
      svg.appendChild(label(x, PAD + HEIGHT + 32, scaleLabel(mark, minutes, now)));
    });
  }

  function scaleLabel(mark, minutes, now) {
    const seconds = now - minutes * 60 * (1 - mark);
    return new Date(seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

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

  function timelineNow(buckets) {
    return Math.max.apply(null, buckets.map(function (bucket) {
      return bucket.t;
    })) + 60;
  }

  function addBucket(svg, bucket, x, width) {
    const total = bucket.accepted + bucket.rejected + bucket.quarantined;
    if (total <= 0) return;
    let y = PAD;
    [
      ["accepted", bucket.accepted],
      ["rejected", bucket.rejected],
      ["quarantined", bucket.quarantined]
    ].forEach(function (part) {
      if (part[1] <= 0) return;
      const height = HEIGHT * part[1] / total;
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

  function bucketText(bucket) {
    const date = new Date(bucket.t * 1000);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const reasons = Object.keys(bucket.reasons || {}).sort(function (a, b) {
      return bucket.reasons[b] - bucket.reasons[a];
    }).slice(0, 3).map(function (reason) {
      return reason + " ×" + String(bucket.reasons[reason]);
    }).join(", ");
    const counts = String(bucket.accepted) + " accepted · "
      + String(bucket.rejected) + " rejected · "
      + String(bucket.quarantined) + " quarantined";
    return time + " · " + counts + (reasons ? " · " + reasons : "");
  }

  function decisionColor(name) {
    if (name === "accepted") return "var(--polarrecorder-accepted-color)";
    if (name === "rejected") return "var(--polarrecorder-rejected-color)";
    return "var(--polarrecorder-quarantined-color)";
  }

  function svgNode(tag) {
    return document.createElementNS(SVG_NS, tag);
  }

  function label(x, y, textValue) {
    const text = svgNode("text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("fill", "var(--polarrecorder-fore-color)");
    text.setAttribute("font-size", "12");
    text.setAttribute("text-anchor", "middle");
    text.textContent = textValue;
    return text;
  }

  function showTooltip(text, x, y) {
    const fn = Polarrecorder["ShowTooltip"];
    if (fn) fn(text, x, y);
  }

  Polarrecorder.TimelineChart = { Render: render };
}());

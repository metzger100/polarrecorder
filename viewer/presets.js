/**
 * Module: Presets
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const SHARED_TWS = [4, 6, 8, 10, 12, 14, 16, 20, 25];
  const WINDY_TWA = [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
  const LABELS = {
    Default180: "Default (180°)",
    Default360: "Default (360°)",
    windy: "Windy Passage Planner"
  };

  function fallbackPresets() {
    return [
      { name: "Default180", builtin: true, twa: range(180), tws: SHARED_TWS },
      { name: "Default360", builtin: true, twa: range(345), tws: SHARED_TWS },
      { name: "windy", builtin: true, twa: WINDY_TWA.slice(), tws: SHARED_TWS }
    ];
  }

  function range(max) {
    const values = [];
    for (let angle = 0; angle <= max; angle += 15) {
      values.push(angle);
    }
    return values;
  }

  function presetLabel(preset) {
    if (!preset.builtin) return preset.name;
    return LABELS[preset.name] || preset.name;
  }

  Polarrecorder.Presets = { Fallback: fallbackPresets, Label: presetLabel };
}());

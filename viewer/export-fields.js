/**
 * Module: Export Fields
 * Documentation: documentation/architecture/ui.md
 * Depends: none
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  /**
   * @param {string} title
   * @returns {HTMLElement}
   */
  function section(title) {
    const card = document.createElement("section");
    card.className = "card export-card";
    card.appendChild(header(title));
    return card;
  }

  /**
   * @param {string} title
   * @returns {HTMLDivElement}
   */
  function header(title) {
    const head = document.createElement("div");
    head.className = "section-head";
    head.appendChild(document.createElement("h2")).textContent = title;
    return head;
  }

  /**
   * @template {keyof HTMLElementTagNameMap} K
   * @param {string} labelText
   * @param {K} type
   * @returns {{wrap: HTMLLabelElement, control: HTMLElementTagNameMap[K]}}
   */
  function field(labelText, type) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const label = document.createElement("span");
    label.textContent = labelText;
    const control = document.createElement(type);
    wrap.appendChild(label);
    wrap.appendChild(control);
    return { wrap: wrap, control: control };
  }

  /**
   * @param {boolean} highConfidence
   * @param {string} minSamplesText
   * @param {(checked: boolean) => void} onChange
   * @returns {HTMLLabelElement}
   */
  function confidenceField(highConfidence, minSamplesText, onChange) {
    const label = document.createElement("label");
    label.className = "switch-field";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = highConfidence;
    box.addEventListener("change", function () {
      onChange(box.checked);
    });
    const track = document.createElement("span");
    track.className = "switch-track";
    const text = document.createElement("span");
    text.className = "switch-copy";
    text.textContent = "High-confidence cells only (≥ " + minSamplesText + " samples)";
    const helper = document.createElement("p");
    helper.className = "helper";
    helper.textContent =
      "Off: export cells once they meet the normal display sample floor. " +
      "On: leave cells blank unless they meet the stricter high-confidence sample floor.";
    label.appendChild(box);
    label.appendChild(track);
    label.appendChild(text);
    label.appendChild(helper);
    return label;
  }

  /** @returns {HTMLParagraphElement} */
  function percentileHelp() {
    const node = document.createElement("p");
    node.className = "helper";
    node.textContent =
      "The percentile chooses the speed written for each polar cell from its accepted-sample histogram. " +
      "Default 65 means about 65% of accepted samples in that cell were at or below the exported speed. " +
      "Lower values export a more conservative, slower table; higher values export a more optimistic, faster table. " +
      "Leave blank unless you intentionally want an alternate export.";
    return node;
  }

  window.Polarrecorder.ExportFields = {
    Section: section,
    Header: header,
    Field: field,
    ConfidenceField: confidenceField,
    PercentileHelp: percentileHelp
  };
})();

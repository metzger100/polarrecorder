/**
 * Module: Export UI
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, grid-editor.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const state = {
    host: null,
    selected: "windy",
    twaEditor: null,
    twsEditor: null,
    percentile: "",
    highConfidence: false,
    message: "",
    messageKind: "info",
    saveOpen: false,
    hooks: {}
  };

  function init(hooks) {
    state.host = document.getElementById("export-panel");
    state.hooks = hooks || {};
    state.host.classList.add("has-data");
    if (!state.selected) state.selected = "windy";
    render();
  }

  function refreshPresets() {
    if (state.host) render();
  }

  function render() {
    state.host.replaceChildren();
    state.host.appendChild(configCard());
    applyValidity();
  }

  function configCard() {
    const card = section("Export Configurator");
    const preset = field("Preset", "select");
    fillPresets(preset.control);
    preset.control.value = state.selected;
    preset.control.addEventListener("change", function () {
      state.selected = preset.control.value;
      loadSelectedPreset();
    });
    card.appendChild(preset.wrap);
    ensureEditors();
    card.appendChild(state.twaEditor.Element);
    card.appendChild(state.twsEditor.Element);
    const percentile = field("Percentile override", "input");
    percentile.control.type = "number";
    percentile.control.min = "1";
    percentile.control.max = "99";
    percentile.control.inputMode = "numeric";
    percentile.control.placeholder = "Default " + defaultPercentile();
    percentile.control.value = state.percentile;
    percentile.control.addEventListener("input", function () {
      state.percentile = percentile.control.value;
    });
    card.appendChild(percentile.wrap);
    card.appendChild(percentileHelp());
    card.appendChild(confidenceField());
    card.appendChild(actionRow([
      button("Preview", previewCsv, "primary-action preview-button"),
      button("Download CSV", downloadCsv, "primary-action download-button"),
      button("Save as Preset", showSaveBox, "secondary-action save-button"),
      button("Delete", deletePreset, "danger-action delete-button")
    ]));
    if (state.saveOpen) card.appendChild(saveBox());
    card.appendChild(messageNode());
    const preview = document.createElement("textarea");
    preview.id = "csv-preview";
    preview.readOnly = true;
    preview.placeholder = "CSV preview";
    card.appendChild(preview);
    return card;
  }

  function confidenceField() {
    const label = document.createElement("label");
    label.className = "switch-field";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = state.highConfidence;
    box.addEventListener("change", function () {
      state.highConfidence = box.checked;
    });
    const track = document.createElement("span");
    track.className = "switch-track";
    const text = document.createElement("span");
    text.className = "switch-copy";
    text.textContent = "High-confidence cells only (≥ " + minSamples() + " samples)";
    const helper = document.createElement("p");
    helper.className = "helper";
    helper.textContent = "Off: export cells once they meet the normal display sample floor. "
      + "On: leave cells blank unless they meet the stricter high-confidence sample floor.";
    label.appendChild(box);
    label.appendChild(track);
    label.appendChild(text);
    label.appendChild(helper);
    return label;
  }

  function percentileHelp() {
    const node = document.createElement("p");
    node.className = "helper";
    node.textContent = "The percentile chooses the speed written for each polar cell from its accepted-sample histogram. "
      + "Default 65 means about 65% of accepted samples in that cell were at or below the exported speed. "
      + "Lower values export a more conservative, slower table; higher values export a more optimistic, faster table. "
      + "Leave blank unless you intentionally want an alternate export.";
    return node;
  }

  function section(title) {
    const card = document.createElement("section");
    card.className = "card export-card";
    card.appendChild(header(title));
    return card;
  }

  function header(title) {
    const head = document.createElement("div");
    head.className = "section-head";
    head.appendChild(document.createElement("h2")).textContent = title;
    return head;
  }

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

  function button(text, handler, className) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className + " state-layer";
    node.textContent = text;
    node.addEventListener("click", handler);
    return node;
  }

  function actionRow(buttons) {
    const row = document.createElement("div");
    row.className = "action-row";
    buttons.forEach(function (item) {
      row.appendChild(item);
    });
    return row;
  }

  function fillPresets(select) {
    select.replaceChildren();
    sortedPresets().forEach(function (preset) {
      const option = document.createElement("option");
      option.value = preset.name;
      option.textContent = preset.builtin ? "Windy Passage Planner" : preset.name;
      select.appendChild(option);
    });
  }

  function sortedPresets() {
    const presets = Polarrecorder["PresetsCache"].slice();
    return presets.sort(function (a, b) {
      if (a.builtin) return -1;
      if (b.builtin) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function ensureEditors() {
    const preset = selectedPreset();
    if (!state.twaEditor) {
      state.twaEditor = Polarrecorder.GridEditor.Create({
        label: "TWA grid",
        min: 0,
        max: 180,
        step: 10,
        values: preset.twa,
        onChange: applyValidity
      });
      state.twsEditor = Polarrecorder.GridEditor.Create({
        label: "TWS grid",
        min: 1,
        max: 60,
        step: 2,
        values: preset.tws,
        onChange: applyValidity
      });
    }
  }

  function loadSelectedPreset() {
    const preset = selectedPreset();
    state.twaEditor.SetValues(preset.twa);
    state.twsEditor.SetValues(preset.tws);
    render();
  }

  function selectedPreset() {
    return Polarrecorder["PresetsCache"].find(function (preset) {
      return preset.name === state.selected;
    }) || Polarrecorder["PresetsCache"][0];
  }

  function currentParams() {
    const params = new URLSearchParams();
    params.set("twa", state.twaEditor.Values().join(","));
    params.set("tws", state.twsEditor.Values().join(","));
    if (state.percentile) params.set("percentile", state.percentile);
    if (state.highConfidence) params.set("high_confidence", "yes");
    return params;
  }

  function previewCsv() {
    requestCsv().then(function (csv) {
      const rows = csv.split(/\r?\n/).slice(0, 11).join("\n");
      document.getElementById("csv-preview").value = rows;
      setMessage("Preview updated.", "info");
    }).catch(function (error) {
      setMessage(error.message, "error");
    });
  }

  function downloadCsv() {
    requestCsv().then(function (csv) {
      download("polarrecorder-custom.csv", csv, "text/csv");
      setMessage("CSV downloaded.", "info");
    }).catch(function (error) {
      setMessage(error.message, "error");
    });
  }

  function requestCsv() {
    if (!isValid()) return Promise.reject(new Error("Fix invalid grid values first."));
    return fetchJson("export?" + currentParams().toString(), true).then(function (data) {
      return data.csv || "";
    });
  }

  function showSaveBox() {
    state.saveOpen = true;
    render();
  }

  function saveBox() {
    const box = document.createElement("div");
    box.className = "value-tile";
    const nameField = field("Preset name", "input");
    nameField.control.type = "text";
    nameField.control.value = selectedPreset().name;
    const save = button("Confirm Save", function () {
      savePreset(nameField.control.value);
    }, "primary-action");
    const cancel = button("Cancel", function () {
      state.saveOpen = false;
      render();
    }, "secondary-action");
    box.appendChild(nameField.wrap);
    box.appendChild(actionRow([save, cancel]));
    return box;
  }

  function savePreset(rawName) {
    const name = rawName.trim();
    if (!name) {
      setMessage("Enter a preset name.", "error");
      return;
    }
    const existing = Polarrecorder["PresetsCache"].find(function (preset) {
      return preset.name === name && !preset.builtin;
    });
    if (existing && !window.confirm("Overwrite preset '" + name + "'?")) return;
    const params = currentParams();
    params.set("name", name);
    action("presets/save?" + params.toString(), "Preset saved.", function () {
      state.selected = name;
      state.saveOpen = false;
      if (state.hooks.refreshPresets) state.hooks.refreshPresets();
    });
  }

  function deletePreset() {
    const preset = selectedPreset();
    if (preset.builtin) {
      setMessage("Windy cannot be deleted.", "error");
      return;
    }
    if (!window.confirm("Delete preset '" + preset.name + "'?")) return;
    const params = new URLSearchParams();
    params.set("name", preset.name);
    params.set("confirm", "yes");
    action("presets/delete?" + params.toString(), "Preset deleted.", function () {
      state.selected = "windy";
      if (state.hooks.refreshPresets) state.hooks.refreshPresets();
    });
  }

  function action(endpoint, success, done) {
    fetchJson(endpoint, true).then(function () {
      setMessage(success, "info");
      if (done) done();
    }).catch(function (error) {
      setMessage(error.message, "error");
    });
  }

  function fetchJson(endpoint, isAction) {
    const fn = Polarrecorder["FetchJson"];
    return fn(endpoint, { action: isAction });
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function applyValidity() {
    if (!state.host || !state.twaEditor || !state.twsEditor) return;
    const valid = isValid();
    state.host.querySelectorAll(".preview-button, .download-button, .save-button").forEach(function (buttonNode) {
      buttonNode.disabled = !valid;
    });
    const deleteButton = state.host.querySelector(".delete-button");
    if (deleteButton) deleteButton.hidden = selectedPreset().builtin;
  }

  function isValid() {
    return state.twaEditor.IsValid() && state.twsEditor.IsValid();
  }

  function minSamples() {
    const config = Polarrecorder["ConfigCache"] || {};
    return String(config.min_samples_for_export || 10);
  }

  function defaultPercentile() {
    const config = Polarrecorder["ConfigCache"] || {};
    return String(config.percentile || 65);
  }

  function messageNode() {
    const node = document.createElement("p");
    node.className = messageClass();
    node.id = "export-message";
    node.textContent = state.message;
    return node;
  }

  function messageClass() {
    return state.message && state.messageKind === "error" ? "error-text" : "helper";
  }

  function setMessage(text, kind) {
    state.message = text;
    state.messageKind = kind || "info";
    const node = document.getElementById("export-message");
    if (node) {
      node.className = messageClass();
      node.textContent = text;
    }
  }

  Polarrecorder.ExportUI = {
    Init: init,
    RefreshPresets: refreshPresets
  };
}());

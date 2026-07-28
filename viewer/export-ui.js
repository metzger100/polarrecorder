/**
 * @file Export UI
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js, presets.js, export-fields.js, export-presets.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  /** @typedef {{name: string, builtin: boolean, twa: number[], tws: number[]}} Preset */
  /** @typedef {{refreshPresets?: () => void}} ExportHooks */
  /**
   * @typedef {{
   *   host: HTMLElement | null,
   *   percentile: string,
   *   highConfidence: boolean,
   *   message: string,
   *   messageKind: "info" | "error",
   *   saveOpen: boolean,
   *   previewActive: boolean,
   *   hooks: ExportHooks
   * }} ExportState
   */

  /** @type {ExportState} */
  const state = {
    host: null,
    percentile: "",
    highConfidence: false,
    message: "",
    messageKind: "info",
    saveOpen: false,
    previewActive: false,
    hooks: {}
  };

  /** @param {ExportHooks} [hooks] */
  function init(hooks) {
    const host = Polarrecorder.Dom.RequireById("export-panel");
    state.host = host;
    state.hooks = hooks || {};
    Polarrecorder.ExportPresets.Configure(applyValidity);
    host.classList.add("has-data");
    render();
  }

  function refreshPresets() {
    if (state.host) render();
  }

  function render() {
    if (!state.host) return;
    const host = state.host;
    state.previewActive = false;
    Polarrecorder.Dom.Clear(host);
    host.appendChild(configCard());
    applyValidity();
  }

  /** @returns {HTMLElement} */
  function configCard() {
    const card = Polarrecorder.ExportFields.Section("Export Configurator");
    const preset = Polarrecorder.ExportFields.Field("Preset", "select");
    fillPresets(preset.control);
    preset.control.value = Polarrecorder.ExportPresets.Selected();
    preset.control.addEventListener("change", function () {
      Polarrecorder.ExportPresets.SetSelected(preset.control.value);
      Polarrecorder.ExportPresets.LoadSelected();
      render();
    });
    card.appendChild(preset.wrap);
    const editors = Polarrecorder.ExportPresets.Editors();
    card.appendChild(editors.twa.Element);
    card.appendChild(editors.tws.Element);
    const percentile = Polarrecorder.ExportFields.Field("Percentile override", "input");
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
    card.appendChild(Polarrecorder.ExportFields.PercentileHelp());
    card.appendChild(
      Polarrecorder.ExportFields.ConfidenceField(
        state.highConfidence,
        minSamples(),
        /** @param {boolean} checked */
        function (checked) {
          state.highConfidence = checked;
        }
      )
    );
    card.appendChild(
      Polarrecorder.Dom.ActionRow([
        Polarrecorder.Dom.Button("Preview", previewCsv, "primary-action preview-button"),
        Polarrecorder.Dom.Button("Download CSV", downloadCsv, "primary-action download-button"),
        Polarrecorder.Dom.Button("Save as Preset", showSaveBox, "secondary-action save-button"),
        Polarrecorder.Dom.Button("Delete", deletePreset, "danger-action delete-button")
      ])
    );
    if (state.saveOpen) card.appendChild(saveBox());
    card.appendChild(messageNode());
    const preview = document.createElement("textarea");
    preview.id = "csv-preview";
    preview.readOnly = true;
    preview.placeholder = "CSV preview";
    card.appendChild(preview);
    return card;
  }

  /** @param {HTMLSelectElement} select */
  function fillPresets(select) {
    Polarrecorder.Dom.Clear(select);
    Polarrecorder.ExportPresets.Sorted().forEach(function (/** @type {Preset} */ preset) {
      const option = document.createElement("option");
      option.value = preset.name;
      option.textContent = Polarrecorder.Presets.Label(preset);
      select.appendChild(option);
    });
  }

  /** @returns {URLSearchParams} */
  function currentParams() {
    const editors = Polarrecorder.ExportPresets.Editors();
    const params = new URLSearchParams();
    params.set("twa", editors.twa.Values().join(","));
    params.set("tws", editors.tws.Values().join(","));
    if (state.percentile) params.set("percentile", state.percentile);
    if (state.highConfidence) params.set("high_confidence", "yes");
    return params;
  }

  function previewCsv() {
    requestCsv()
      .then(function (csv) {
        state.previewActive = true;
        const preview = /** @type {HTMLTextAreaElement} */ (Polarrecorder.Dom.RequireById("csv-preview"));
        preview.value = previewRows(csv);
        setMessage("Preview updated.", "info");
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  function refreshPreview() {
    if (!state.previewActive || !Polarrecorder.ExportPresets.IsValid()) return;
    requestCsv()
      .then(function (csv) {
        const preview = /** @type {HTMLTextAreaElement} */ (Polarrecorder.Dom.RequireById("csv-preview"));
        preview.value = previewRows(csv);
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  /**
   * @param {string} csv
   * @returns {string}
   */
  function previewRows(csv) {
    return csv.split(/\r?\n/).slice(0, 11).join("\n");
  }

  function downloadCsv() {
    requestCsv()
      .then(function (csv) {
        Polarrecorder.Dom.Download("polarrecorder-custom.csv", csv, "text/csv");
        setMessage("CSV downloaded.", "info");
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  /** @returns {Promise<string>} */
  function requestCsv() {
    if (!Polarrecorder.ExportPresets.IsValid()) {
      return Promise.reject(new Error("Fix invalid grid values first."));
    }
    return fetchJson("export?" + currentParams().toString(), true).then(function (data) {
      return data.csv;
    });
  }

  function showSaveBox() {
    state.saveOpen = true;
    render();
  }

  /** @returns {HTMLDivElement} */
  function saveBox() {
    const box = document.createElement("div");
    box.className = "value-tile";
    const nameField = Polarrecorder.ExportFields.Field("Preset name", "input");
    nameField.control.type = "text";
    nameField.control.value = Polarrecorder.ExportPresets.SelectedPreset().name;
    const save = Polarrecorder.Dom.Button(
      "Confirm Save",
      function () {
        savePreset(nameField.control.value);
      },
      "primary-action"
    );
    const cancel = Polarrecorder.Dom.Button(
      "Cancel",
      function () {
        state.saveOpen = false;
        render();
      },
      "secondary-action"
    );
    box.appendChild(nameField.wrap);
    box.appendChild(Polarrecorder.Dom.ActionRow([save, cancel]));
    return box;
  }

  /** @param {string} rawName */
  function savePreset(rawName) {
    const name = rawName.trim();
    if (!name) {
      setMessage("Enter a preset name.", "error");
      return;
    }
    const existing = Polarrecorder.ExportPresets.All().find(function (/** @type {Preset} */ preset) {
      return preset.name === name && !preset.builtin;
    });
    if (existing && !window.confirm("Overwrite preset '" + name + "'?")) return;
    const params = currentParams();
    params.set("name", name);
    action("presets/save?" + params.toString(), "Preset saved.", function () {
      Polarrecorder.ExportPresets.SetSelected(name);
      state.saveOpen = false;
      if (state.hooks.refreshPresets) state.hooks.refreshPresets();
    });
  }

  function deletePreset() {
    const preset = Polarrecorder.ExportPresets.SelectedPreset();
    if (preset.builtin) {
      setMessage("Built-in presets cannot be deleted.", "error");
      return;
    }
    if (!window.confirm("Delete preset '" + preset.name + "'?")) return;
    const params = new URLSearchParams();
    params.set("name", preset.name);
    params.set("confirm", "yes");
    action("presets/delete?" + params.toString(), "Preset deleted.", function () {
      Polarrecorder.ExportPresets.SetSelected("DefaultStarboard180");
      if (state.hooks.refreshPresets) state.hooks.refreshPresets();
    });
  }

  /**
   * @param {string} endpoint
   * @param {string} success
   * @param {() => void} [done]
   */
  function action(endpoint, success, done) {
    fetchJson(endpoint, true)
      .then(function () {
        setMessage(success, "info");
        if (done) done();
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  /**
   * @param {string} endpoint
   * @param {boolean} isAction
   * @returns {Promise<any>}
   */
  function fetchJson(endpoint, isAction) {
    const fn = Polarrecorder["FetchJson"];
    return fn(endpoint, { action: isAction });
  }

  function applyValidity() {
    if (!state.host) return;
    const host = state.host;
    const valid = Polarrecorder.ExportPresets.IsValid();
    const buttons = /** @type {NodeListOf<HTMLButtonElement>} */ (
      host.querySelectorAll(".preview-button, .download-button, .save-button")
    );
    buttons.forEach(function (buttonNode) {
      buttonNode.disabled = !valid;
    });
    const deleteButton = /** @type {HTMLElement | null} */ (host.querySelector(".delete-button"));
    if (deleteButton) deleteButton.hidden = Polarrecorder.ExportPresets.SelectedPreset().builtin;
  }

  /** @returns {string} */
  function minSamples() {
    return String(Polarrecorder["ConfigCache"].min_samples_for_export);
  }

  /** @returns {string} */
  function defaultPercentile() {
    return String(Polarrecorder["ConfigCache"].percentile);
  }

  /** @returns {HTMLParagraphElement} */
  function messageNode() {
    const node = document.createElement("p");
    node.className = messageClass();
    node.id = "export-message";
    node.textContent = state.message;
    return node;
  }

  /** @returns {string} */
  function messageClass() {
    return state.message && state.messageKind === "error" ? "error-text" : "helper";
  }

  /**
   * @param {string} text
   * @param {"info" | "error"} [kind]
   */
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
    RefreshPresets: refreshPresets,
    RefreshPreview: refreshPreview
  };
})();

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
   *   messageId: string,
   *   percentile: string,
   *   highConfidence: boolean,
   *   message: string,
   *   messageKind: "info" | "error"
   * }} FormatState
   */
  /**
   * @typedef {{
   *   host: HTMLElement | null,
   *   pol: FormatState,
   *   csv: FormatState,
   *   saveOpen: boolean,
   *   previewActive: boolean,
   *   hooks: ExportHooks
   * }} ExportState
   */

  /**
   * @param {string} messageId
   * @returns {FormatState}
   */
  function formatState(messageId) {
    return {
      messageId: messageId,
      percentile: "",
      highConfidence: false,
      message: "",
      messageKind: "info"
    };
  }

  /** @type {ExportState} */
  const state = {
    host: null,
    pol: formatState("export-pol-message"),
    csv: formatState("export-csv-message"),
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
    host.appendChild(routingCard());
    host.appendChild(configCard());
    applyValidity();
  }

  /** @returns {HTMLElement} */
  function routingCard() {
    const card = Polarrecorder.ExportFields.Section("Routing POL (.pol)");
    card.appendChild(
      Polarrecorder.Dom.Node(
        "p",
        "helper",
        "Tab-separated table for NavimetriX and other routing apps that read .pol. The grid is fixed at TWA " +
          "30-180° and TWS 4-25 kn, trimmed to your maximum-true-wind setting, and port and starboard " +
          "observations are merged onto each absolute angle before the percentile is taken. The settings " +
          "below apply to the POL download only."
      )
    );
    appendQualityControls(card, state.pol);
    card.appendChild(
      Polarrecorder.Dom.ActionRow([
        Polarrecorder.Dom.Button("Download Routing POL", downloadPol, "primary-action pol-download-button")
      ])
    );
    card.appendChild(Polarrecorder.ExportFields.MessageNode(state.pol));
    return card;
  }

  /**
   * @param {HTMLElement} card
   * @param {FormatState} format
   */
  function appendQualityControls(card, format) {
    const controls = Polarrecorder.ExportFields.QualityControls(format, defaultPercentile(), minSamples());
    controls.forEach(function (/** @type {HTMLElement} */ control) {
      card.appendChild(control);
    });
  }

  /** @returns {HTMLElement} */
  function configCard() {
    const card = Polarrecorder.ExportFields.Section("Tack-aware CSV (.csv)");
    card.appendChild(
      Polarrecorder.Dom.Node(
        "p",
        "helper",
        "Semicolon-separated table for spreadsheets, Windy, and tack-by-tack inspection. You pick the TWA/TWS grid, " +
          "and port and starboard stay separate with no folding. The settings below apply to the CSV preview and " +
          "download only."
      )
    );
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
    appendQualityControls(card, state.csv);
    card.appendChild(
      Polarrecorder.Dom.ActionRow([
        Polarrecorder.Dom.Button("Preview", previewCsv, "primary-action preview-button"),
        Polarrecorder.Dom.Button("Download CSV", downloadCsv, "primary-action download-button"),
        Polarrecorder.Dom.Button("Save as Preset", showSaveBox, "secondary-action save-button"),
        Polarrecorder.Dom.Button("Delete", deletePreset, "danger-action delete-button")
      ])
    );
    if (state.saveOpen) card.appendChild(saveBox());
    card.appendChild(Polarrecorder.ExportFields.MessageNode(state.csv));
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
    addQualityParams(params, state.csv);
    return params;
  }

  /**
   * @param {URLSearchParams} params
   * @param {FormatState} format
   */
  function addQualityParams(params, format) {
    if (format.percentile) params.set("percentile", format.percentile);
    if (format.highConfidence) params.set("high_confidence", "yes");
  }

  function previewCsv() {
    requestCsv()
      .then(function (csv) {
        state.previewActive = true;
        const preview = /** @type {HTMLTextAreaElement} */ (Polarrecorder.Dom.RequireById("csv-preview"));
        preview.value = previewRows(csv);
        Polarrecorder.ExportFields.SetMessage(state.csv, "Preview updated.", "info");
      })
      .catch(function (error) {
        Polarrecorder.ExportFields.SetMessage(state.csv, error.message, "error");
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
        Polarrecorder.ExportFields.SetMessage(state.csv, error.message, "error");
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
        Polarrecorder.ExportFields.SetMessage(state.csv, "CSV downloaded.", "info");
      })
      .catch(function (error) {
        Polarrecorder.ExportFields.SetMessage(state.csv, error.message, "error");
      });
  }

  function downloadPol() {
    const params = new URLSearchParams();
    addQualityParams(params, state.pol);
    fetchJson("export/pol?" + params.toString(), true)
      .then(function (data) {
        Polarrecorder.Dom.Download("polarrecorder-routing.pol", data.pol, "text/plain;charset=utf-8");
        Polarrecorder.ExportFields.SetMessage(state.pol, "Routing POL downloaded.", "info");
      })
      .catch(function (error) {
        Polarrecorder.ExportFields.SetMessage(state.pol, error.message, "error");
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
      Polarrecorder.ExportFields.SetMessage(state.csv, "Enter a preset name.", "error");
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
      Polarrecorder.ExportFields.SetMessage(state.csv, "Built-in presets cannot be deleted.", "error");
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
        Polarrecorder.ExportFields.SetMessage(state.csv, success, "info");
        if (done) done();
      })
      .catch(function (error) {
        Polarrecorder.ExportFields.SetMessage(state.csv, error.message, "error");
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

  Polarrecorder.ExportUI = {
    Init: init,
    RefreshPresets: refreshPresets,
    RefreshPreview: refreshPreview
  };
})();

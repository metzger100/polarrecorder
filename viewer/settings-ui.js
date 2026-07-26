/**
 * Module: Settings UI
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js, import-upload.js, enhanced-settings.js, advanced-settings.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  /** @typedef {{wrap: HTMLLabelElement, control: HTMLInputElement}} FieldResult */
  /**
   * @typedef {{
   *   host: HTMLElement | null,
   *   message: string,
   *   messageKind: "info" | "error"
   * }} SettingsState
   */

  /** @type {SettingsState} */
  const state = { host: null, message: "", messageKind: "info" };

  function init() {
    const host = Polarrecorder.Dom.RequireById("settings-panel");
    state.host = host;
    host.classList.add("has-data");
    render();
  }

  function render() {
    if (!state.host) return;
    const host = state.host;
    Polarrecorder.Dom.Clear(host);
    host.appendChild(learnedDataCard());
    host.appendChild(presetsCard());
    host.appendChild(Polarrecorder.EnhancedSettings.Render());
    host.appendChild(Polarrecorder.AdvancedSettings.Render());
    host.appendChild(messageNode());
  }

  /** @returns {HTMLElement} */
  function learnedDataCard() {
    const card = section("Learned Data");
    card.appendChild(
      downloadGroup(
        "Download all learned data as a JSON file for backup and inspection.",
        [
          "learned bins and histograms",
          "counters and rejection summaries",
          "metadata and configuration snapshot"
        ],
        "Download Learned Data",
        downloadJson
      )
    );
    card.appendChild(
      restoreGroup(
        "Replace all learned data with a previously downloaded backup. This overwrites all learned bins and counters.",
        "learned-data",
        "Restore Learned Data"
      )
    );
    card.appendChild(resetGroup());
    return card;
  }

  /** @returns {HTMLElement} */
  function presetsCard() {
    const card = section("Presets");
    card.appendChild(
      downloadGroup(
        "Download your saved export presets as a JSON backup you can restore later.",
        null,
        "Download Presets",
        downloadPresets
      )
    );
    card.appendChild(
      restoreGroup(
        "Replace your saved export presets with a previously downloaded presets backup. Built-in presets are never affected.",
        "presets",
        "Restore Presets"
      )
    );
    return card;
  }

  /**
   * @param {string} helperText
   * @param {string[] | null} bullets
   * @param {string} buttonLabel
   * @param {() => void} handler
   * @returns {HTMLDivElement}
   */
  function downloadGroup(helperText, bullets, buttonLabel, handler) {
    const group = subsection("Download");
    group.appendChild(paragraph(helperText));
    if (bullets) {
      group.appendChild(bulletList(bullets));
    }
    group.appendChild(
      Polarrecorder.Dom.ActionRow([
        Polarrecorder.Dom.Button(buttonLabel, handler, "primary-action")
      ])
    );
    return group;
  }

  /**
   * @param {string} helperText
   * @param {string} kind
   * @param {string} buttonLabel
   * @returns {HTMLDivElement}
   */
  function restoreGroup(helperText, kind, buttonLabel) {
    const group = subsection("Restore");
    group.appendChild(paragraph(helperText));
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.hidden = true;
    const chosen = paragraph("No file chosen.");
    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      chosen.textContent = file ? file.name : "No file chosen.";
    });
    const choose = Polarrecorder.Dom.Button(
      "Choose Backup File",
      function () {
        fileInput.click();
      },
      "secondary-action"
    );
    const field = inputField("Type RESTORE to confirm");
    const confirmButton = Polarrecorder.Dom.Button(
      buttonLabel,
      function () {
        startRestore(kind, field, fileInput);
      },
      "danger-action"
    );
    group.appendChild(fileInput);
    group.appendChild(Polarrecorder.Dom.ActionRow([choose]));
    group.appendChild(chosen);
    group.appendChild(field.wrap);
    group.appendChild(Polarrecorder.Dom.ActionRow([confirmButton]));
    return group;
  }

  /**
   * @param {string} kind
   * @param {FieldResult} field
   * @param {HTMLInputElement} fileInput
   */
  function startRestore(kind, field, fileInput) {
    if (field.control.value.toLowerCase() !== "restore") {
      setMessage("Type RESTORE before confirming.", "error");
      return;
    }
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setMessage("Choose a backup file first.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      runUpload(kind, String(reader.result), field);
    };
    reader.readAsText(file);
  }

  /**
   * @param {string} kind
   * @param {string} text
   * @param {FieldResult} field
   */
  function runUpload(kind, text, field) {
    Polarrecorder.ImportUpload.UploadBackup(
      kind,
      text,
      /** @param {string} summary */
      function (summary) {
        field.control.value = "";
        setMessage(summary, "info");
      },
      /** @param {string} error */
      function (error) {
        setMessage(error, "error");
      }
    );
  }

  /** @returns {HTMLDivElement} */
  function resetGroup() {
    const group = subsection("Reset");
    group.classList.add("settings-group-danger");
    group.appendChild(
      paragraph(
        "This permanently clears all learned data and counters. Timeline diagnostics remain on the plugin side."
      )
    );
    const field = inputField("Type RESET to confirm");
    const reset = Polarrecorder.Dom.Button(
      "Reset Learned Data",
      function () {
        if (field.control.value.toLowerCase() !== "reset") {
          setMessage("Type RESET before confirming.", "error");
          return;
        }
        fetchJson("reset?confirm=yes")
          .then(function () {
            field.control.value = "";
            setMessage("Reset complete.", "info");
          })
          .catch(function (error) {
            setMessage(error.message, "error");
          });
      },
      "danger-action"
    );
    group.appendChild(field.wrap);
    group.appendChild(Polarrecorder.Dom.ActionRow([reset]));
    return group;
  }

  /**
   * @param {string} title
   * @returns {HTMLElement}
   */
  function section(title) {
    const card = document.createElement("section");
    card.className = "card export-card";
    const head = document.createElement("div");
    head.className = "section-head";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    head.appendChild(h2);
    card.appendChild(head);
    return card;
  }

  /**
   * @param {string} title
   * @returns {HTMLDivElement}
   */
  function subsection(title) {
    const group = document.createElement("div");
    group.className = "settings-group";
    const heading = document.createElement("h3");
    heading.className = "settings-group-title";
    heading.textContent = title;
    group.appendChild(heading);
    return group;
  }

  /**
   * @param {string} text
   * @returns {HTMLParagraphElement}
   */
  function paragraph(text) {
    const node = document.createElement("p");
    node.className = "helper";
    node.textContent = text;
    return node;
  }

  /**
   * @param {string[]} items
   * @returns {HTMLUListElement}
   */
  function bulletList(items) {
    const list = document.createElement("ul");
    list.className = "settings-list";
    items.forEach(function (item) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    return list;
  }

  /**
   * @param {string} labelText
   * @returns {FieldResult}
   */
  function inputField(labelText) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const label = document.createElement("span");
    label.textContent = labelText;
    const control = document.createElement("input");
    control.type = "text";
    wrap.appendChild(label);
    wrap.appendChild(control);
    return { wrap: wrap, control: control };
  }

  function downloadJson() {
    fetchJson("export/json")
      .then(function (data) {
        Polarrecorder.Dom.Download(
          "polarrecorder-backup.json",
          JSON.stringify(data, null, 2),
          "application/json"
        );
        setMessage("Backup downloaded.", "info");
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  function downloadPresets() {
    fetchJson("export/presets")
      .then(function (data) {
        Polarrecorder.Dom.Download(
          "polarrecorder-presets.json",
          JSON.stringify(data, null, 2),
          "application/json"
        );
        setMessage("Presets downloaded.", "info");
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  /**
   * @param {string} endpoint
   * @returns {Promise<any>}
   */
  function fetchJson(endpoint) {
    const fn = Polarrecorder["FetchJson"];
    return fn(endpoint, { action: true });
  }

  /** @returns {HTMLParagraphElement} */
  function messageNode() {
    const node = document.createElement("p");
    node.className = state.message && state.messageKind === "error" ? "error-text" : "helper";
    node.textContent = state.message;
    return node;
  }

  /**
   * @param {string} text
   * @param {"info" | "error"} [kind]
   */
  function setMessage(text, kind) {
    state.message = text;
    state.messageKind = kind || "info";
    render();
  }

  Polarrecorder.SettingsUI = { Init: init };
})();

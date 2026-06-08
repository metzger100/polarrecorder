/**
 * Module: Settings UI
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js, import-upload.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const button = Polarrecorder.Dom.Button;
  const actionRow = Polarrecorder.Dom.ActionRow;
  const download = Polarrecorder.Dom.Download;
  const state = { host: null, message: "", messageKind: "info" };

  function init() {
    state.host = document.getElementById("settings-panel");
    state.host.classList.add("has-data");
    render();
  }

  function render() {
    state.host.replaceChildren();
    state.host.appendChild(backupCard());
    state.host.appendChild(restoreCard(
      "Restore Polar Backup",
      "Replace the learned polar with a previously downloaded JSON backup. This overwrites all learned bins and counters.",
      "polar",
      "Restore Polar"
    ));
    state.host.appendChild(presetsBackupCard());
    state.host.appendChild(restoreCard(
      "Restore Presets Backup",
      "Replace your saved export presets with a previously downloaded presets backup. Built-in presets are never affected.",
      "presets",
      "Restore Presets"
    ));
    state.host.appendChild(resetCard());
    state.host.appendChild(messageNode());
  }

  function backupCard() {
    const card = section("JSON Backup");
    card.appendChild(paragraph("Download the full persistence-schema JSON for backup and inspection."));
    card.appendChild(bulletList([
      "learned polar bins and histograms",
      "counters and rejection summaries",
      "metadata and configuration snapshot"
    ]));
    card.appendChild(actionRow([button("Download JSON Backup", downloadJson, "primary-action")]));
    return card;
  }

  function presetsBackupCard() {
    const card = section("Presets Backup");
    card.appendChild(paragraph("Download your saved export presets as a JSON backup you can restore later."));
    card.appendChild(actionRow([button("Download Presets", downloadPresets, "primary-action")]));
    return card;
  }

  function restoreCard(title, helperText, kind, buttonLabel) {
    const card = section(title);
    card.classList.add("reset-card");
    card.appendChild(paragraph(helperText));
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.hidden = true;
    const chosen = paragraph("No file chosen.");
    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      chosen.textContent = file ? file.name : "No file chosen.";
    });
    const choose = button("Choose Backup File", function () {
      fileInput.click();
    }, "secondary-action");
    const field = inputField("Type RESTORE to confirm");
    const confirmButton = button(buttonLabel, function () {
      startRestore(kind, field, fileInput);
    }, "danger-action");
    card.appendChild(fileInput);
    card.appendChild(actionRow([choose]));
    card.appendChild(chosen);
    card.appendChild(field.wrap);
    card.appendChild(actionRow([confirmButton]));
    return card;
  }

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

  function runUpload(kind, text, field) {
    Polarrecorder.ImportUpload.UploadBackup(kind, text, function (summary) {
      field.control.value = "";
      setMessage(summary, "info");
    }, function (error) {
      setMessage(error, "error");
    });
  }

  function resetCard() {
    const card = section("Reset Learned Polar");
    card.classList.add("reset-card");
    card.appendChild(paragraph("This permanently clears learned polar data and counters. Timeline diagnostics remain on the plugin side."));
    const field = inputField("Type RESET to confirm");
    const reset = button("Reset Learned Polar", function () {
      if (field.control.value.toLowerCase() !== "reset") {
        setMessage("Type RESET before confirming.", "error");
        return;
      }
      fetchJson("reset?confirm=yes").then(function () {
        field.control.value = "";
        setMessage("Reset complete.", "info");
      }).catch(function (error) {
        setMessage(error.message, "error");
      });
    }, "danger-action");
    card.appendChild(field.wrap);
    card.appendChild(actionRow([reset]));
    return card;
  }

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

  function paragraph(text) {
    const node = document.createElement("p");
    node.className = "helper";
    node.textContent = text;
    return node;
  }

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
    fetchJson("export/json").then(function (data) {
      download("polarrecorder-backup.json", JSON.stringify(data, null, 2), "application/json");
      setMessage("Backup downloaded.", "info");
    }).catch(function (error) {
      setMessage(error.message, "error");
    });
  }

  function downloadPresets() {
    fetchJson("export/presets").then(function (data) {
      download("polarrecorder-presets.json", JSON.stringify(data, null, 2), "application/json");
      setMessage("Presets downloaded.", "info");
    }).catch(function (error) {
      setMessage(error.message, "error");
    });
  }

  function fetchJson(endpoint) {
    const fn = Polarrecorder["FetchJson"];
    return fn(endpoint, { action: true });
  }

  function messageNode() {
    const node = document.createElement("p");
    node.className = state.message && state.messageKind === "error" ? "error-text" : "helper";
    node.textContent = state.message;
    return node;
  }

  function setMessage(text, kind) {
    state.message = text;
    state.messageKind = kind || "info";
    render();
  }

  Polarrecorder.SettingsUI = { Init: init };
}());

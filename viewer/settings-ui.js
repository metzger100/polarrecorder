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
    state.host.appendChild(learnedDataCard());
    state.host.appendChild(presetsCard());
    state.host.appendChild(messageNode());
  }

  function learnedDataCard() {
    const card = section("Learned Data");
    card.appendChild(downloadGroup(
      "Download all learned data as a JSON file for backup and inspection.",
      [
        "learned bins and histograms",
        "counters and rejection summaries",
        "metadata and configuration snapshot"
      ],
      "Download Learned Data",
      downloadJson
    ));
    card.appendChild(restoreGroup(
      "Replace all learned data with a previously downloaded backup. This overwrites all learned bins and counters.",
      "learned-data",
      "Restore Learned Data"
    ));
    card.appendChild(resetGroup());
    return card;
  }

  function presetsCard() {
    const card = section("Presets");
    card.appendChild(downloadGroup(
      "Download your saved export presets as a JSON backup you can restore later.",
      null,
      "Download Presets",
      downloadPresets
    ));
    card.appendChild(restoreGroup(
      "Replace your saved export presets with a previously downloaded presets backup. Built-in presets are never affected.",
      "presets",
      "Restore Presets"
    ));
    return card;
  }

  function downloadGroup(helperText, bullets, buttonLabel, handler) {
    const group = subsection("Download");
    group.appendChild(paragraph(helperText));
    if (bullets) {
      group.appendChild(bulletList(bullets));
    }
    group.appendChild(actionRow([button(buttonLabel, handler, "primary-action")]));
    return group;
  }

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
    const choose = button("Choose Backup File", function () {
      fileInput.click();
    }, "secondary-action");
    const field = inputField("Type RESTORE to confirm");
    const confirmButton = button(buttonLabel, function () {
      startRestore(kind, field, fileInput);
    }, "danger-action");
    group.appendChild(fileInput);
    group.appendChild(actionRow([choose]));
    group.appendChild(chosen);
    group.appendChild(field.wrap);
    group.appendChild(actionRow([confirmButton]));
    return group;
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

  function resetGroup() {
    const group = subsection("Reset");
    group.classList.add("settings-group-danger");
    group.appendChild(paragraph("This permanently clears all learned data and counters. Timeline diagnostics remain on the plugin side."));
    const field = inputField("Type RESET to confirm");
    const reset = button("Reset Learned Data", function () {
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
    group.appendChild(field.wrap);
    group.appendChild(actionRow([reset]));
    return group;
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

  function subsection(title) {
    const group = document.createElement("div");
    group.className = "settings-group";
    const heading = document.createElement("h3");
    heading.className = "settings-group-title";
    heading.textContent = title;
    group.appendChild(heading);
    return group;
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

/**
 * Module: Settings UI
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js
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
    state.host.appendChild(restoreCard());
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

  function restoreCard() {
    const card = section("Restore JSON (Post-MVP)");
    card.appendChild(paragraph("Import is not implemented in Phase 9. No file is selected and no recorder state can change."));
    const placeholder = document.createElement("button");
    placeholder.type = "button";
    placeholder.className = "secondary-action";
    placeholder.disabled = true;
    placeholder.textContent = "Choose Backup File (Post-MVP)";
    card.appendChild(actionRow([placeholder]));
    return card;
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

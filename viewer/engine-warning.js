/**
 * @file Engine Protection Warning
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const SUPPRESSION_KEY = "polarrecorder.engine-warning.v1";
  /** @type {HTMLElement} */
  let storageMessage;
  let storageOperation = "";
  let warningChecked = false;

  document.addEventListener("DOMContentLoaded", start);
  window.addEventListener("error", reportStorageFailure);

  function start() {
    if (isSuppressed()) return;
    requestWarning();
  }

  function requestWarning() {
    if (warningChecked) return;
    warningChecked = true;
    Polarrecorder.FetchJson("enhanced/status", { action: true }).then(
      function (/** @type {{rules?: Array<{availability: string, rule: string}>}} */ data) {
        if (!hasActiveEngineRule(data.rules || [])) renderWarning();
      },
      function () {
        return undefined;
      }
    );
  }

  /** @param {Array<{availability: string, rule: string}>} rules */
  function hasActiveEngineRule(rules) {
    return rules.some(function (rule) {
      return rule.availability === "active" && (rule.rule === "reject_engine_rpm" || rule.rule === "reject_engine_on");
    });
  }

  function isSuppressed() {
    storageOperation = "read";
    const value = window.localStorage.getItem(SUPPRESSION_KEY);
    if (storageOperation !== "read") return true;
    storageOperation = "";
    return value === "hidden";
  }

  function renderWarning() {
    const modal = Polarrecorder.Dom.Node("section", "engine-warning", undefined);
    modal.appendChild(Polarrecorder.Dom.Node("h2", "", "Engine protection unavailable"));
    modal.appendChild(
      Polarrecorder.Dom.Node(
        "p",
        "",
        "Without an active RPM or engine-state signal, Polar Recorder cannot reliably distinguish motoring from good sailing in ordinary wind. Pause recording while motoring or configure an engine rule in Settings > Enhanced Rules."
      )
    );
    const message = Polarrecorder.Dom.Node("p", "error-text", "");
    const close = Polarrecorder.Dom.Button(
      "Close",
      function () {
        modal.remove();
      },
      "secondary-action"
    );
    const never = Polarrecorder.Dom.Button(
      "Never show again",
      function () {
        saveSuppression(modal, message);
      },
      "primary-action"
    );
    modal.appendChild(Polarrecorder.Dom.ActionRow([close, never]));
    modal.appendChild(message);
    document.body.appendChild(modal);
  }

  /**
   * @param {HTMLElement} modal
   * @param {HTMLElement} message
   */
  function saveSuppression(modal, message) {
    storageMessage = message;
    storageOperation = "write";
    window.localStorage.setItem(SUPPRESSION_KEY, "hidden");
    if (storageOperation !== "write") return;
    storageOperation = "";
    modal.remove();
  }

  /** @param {ErrorEvent} event */
  function reportStorageFailure(event) {
    if (!storageOperation) return;
    const operation = storageOperation;
    storageOperation = "";
    event.preventDefault();
    if (operation === "read") {
      requestWarning();
      return;
    }
    storageMessage.textContent = "The preference could not be saved. Close this warning to dismiss it for now.";
  }

  Polarrecorder.EngineWarning = { Start: start };
})();

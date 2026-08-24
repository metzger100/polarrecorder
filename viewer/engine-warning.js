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
  let warningChecked = false;

  document.addEventListener("DOMContentLoaded", start);

  function start() {
    const stored = readSuppression();
    if (stored.ok && stored.value === "hidden") return;
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

  /** @returns {{ok: true, value: string|null}|{ok: false, error: unknown}} */
  function readSuppression() {
    try {
      return { ok: true, value: window.localStorage.getItem(SUPPRESSION_KEY) };
    } catch (error) {
      return { ok: false, error: error };
    }
  }

  /** @returns {{ok: true}|{ok: false, error: unknown}} */
  function writeSuppression() {
    try {
      window.localStorage.setItem(SUPPRESSION_KEY, "hidden");
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error };
    }
  }

  function renderWarning() {
    const previousFocus = document.activeElement;
    const background = document.getElementById("polarrecorder-app");
    const backdrop = Polarrecorder.Dom.Node("div", "engine-warning-backdrop");
    const modal = Polarrecorder.Dom.Node("section", "engine-warning");
    const heading = Polarrecorder.Dom.Node("h2", "", "Engine protection unavailable");
    heading.id = "engine-warning-title";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", heading.id);
    modal.appendChild(heading);
    modal.appendChild(
      Polarrecorder.Dom.Node(
        "p",
        "",
        "Without an active RPM or engine-state signal, Polar Recorder cannot reliably distinguish motoring from good sailing in ordinary wind. Pause recording while motoring or configure an engine rule in Settings > Enhanced Rules."
      )
    );
    const message = Polarrecorder.Dom.Node("p", "error-text", "");
    message.setAttribute("aria-live", "polite");
    const close = Polarrecorder.Dom.Button("Close", dismiss, "secondary-action");
    const never = Polarrecorder.Dom.Button(
      "Never show again",
      function () {
        const saved = writeSuppression();
        if (saved.ok) dismiss();
        else message.textContent = "The preference could not be saved. Close this warning to dismiss it for now.";
      },
      "primary-action"
    );
    modal.appendChild(Polarrecorder.Dom.ActionRow([close, never]));
    modal.appendChild(message);
    if (background) {
      background.inert = true;
      background.setAttribute("aria-hidden", "true");
    }
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    document.addEventListener("keydown", containFocus);
    close.focus();

    function dismiss() {
      document.removeEventListener("keydown", containFocus);
      modal.remove();
      backdrop.remove();
      if (background) {
        background.inert = false;
        background.removeAttribute("aria-hidden");
      }
      if (previousFocus) /** @type {HTMLElement} */ (previousFocus).focus();
    }

    /** @param {KeyboardEvent} event */
    function containFocus(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === close) {
        event.preventDefault();
        never.focus();
      } else if (!event.shiftKey && document.activeElement === never) {
        event.preventDefault();
        close.focus();
      }
    }
  }

  Polarrecorder.EngineWarning = { Start: start };
})();

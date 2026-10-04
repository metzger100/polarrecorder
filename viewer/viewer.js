/**
 * @file Viewer Shell
 * Documentation: documentation/architecture/ui.md
 * Depends: none
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const HEARTBEAT_MS = 2000;
  const TIMELINE_TICKS = 30;
  const CONNECTION_LOST_TEXT = "Connection lost — retrying...";

  /** An `ERROR` body returned by the plugin API, as opposed to a transport or HTTP failure. */
  class ApiError extends Error {}

  /** @typedef {{name: string, builtin: boolean, twa: number[], tws: number[]}} Preset */
  /**
   * @typedef {{
   *   activeTab: string,
   *   heartbeat: number | null,
   *   tick: number,
   *   lastTimelineTick: number,
   *   polarGen: number | undefined,
   *   csvGen: number | undefined,
   *   statusData: any,
   *   timelineMinutes: number,
   *   polarFormat: string,
   *   initializedExport: boolean,
   *   initializedSettings: boolean,
   *   statusInFlight: boolean,
   *   pendingAction: string | null
   * }} ViewerState
   */

  /** @type {ViewerState} */
  const state = {
    activeTab: "polar",
    heartbeat: null,
    tick: 0,
    lastTimelineTick: 0,
    polarGen: undefined,
    csvGen: undefined,
    statusData: null,
    timelineMinutes: 240,
    polarFormat: "DefaultStarboard180",
    initializedExport: false,
    initializedSettings: false,
    statusInFlight: false,
    pendingAction: null
  };

  Polarrecorder.ApiBase = "";
  Polarrecorder.PresetsCache = [];
  Polarrecorder.ConfigCache = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    Polarrecorder.ApiBase = readApiBase();
    Object.defineProperty(Polarrecorder, "fetchJson", { value: fetchJson });
    Polarrecorder.FetchJson = fetchJson;
    wireTabs();
    wirePolarPreset();
    fetchPresets().then(function () {
      populatePresetSelects();
      activateTab("polar");
    });
  }

  /** @returns {string} */
  function readApiBase() {
    const base = document.body.dataset.apiBase || "../api/";
    return base.endsWith("/") ? base : base + "/";
  }

  /**
   * @param {string} id
   * @returns {HTMLElement}
   */
  function byId(id) {
    return Polarrecorder.Dom.RequireById(id);
  }

  function wirePolarPreset() {
    const polar = /** @type {HTMLSelectElement} */ (byId("polar-preset"));
    polar.addEventListener("change", function () {
      state.polarFormat = polar.value;
      fetchPolar(true);
    });
  }

  function wireTabs() {
    const buttons = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-tab]"));
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        activateTab(button.dataset.tab || "polar");
      });
    });
  }

  /** @param {string} tab */
  function activateTab(tab) {
    state.activeTab = tab;
    const buttons = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-tab]"));
    buttons.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    });
    const panels = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-tab-panel]"));
    panels.forEach(function (panel) {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === tab);
    });
    fetchActiveTab();
    startHeartbeat();
  }

  function startHeartbeat() {
    if (state.heartbeat) return;
    state.heartbeat = window.setInterval(heartbeat, HEARTBEAT_MS);
  }

  function heartbeat() {
    state.tick += 1;
    if (!state.statusInFlight) fetchStatus();
    if (state.activeTab === "export" && !state.initializedExport) initExport();
    if (state.activeTab === "timeline" && state.tick - state.lastTimelineTick >= TIMELINE_TICKS) {
      fetchTimeline(state.timelineMinutes);
    }
  }

  function fetchActiveTab() {
    if (state.activeTab === "polar") fetchPolar();
    if (state.activeTab === "status") fetchStatus();
    if (state.activeTab === "timeline") fetchTimeline(state.timelineMinutes);
    if (state.activeTab === "export") initExport();
    if (state.activeTab === "settings") initSettings();
  }

  /**
   * @param {string} endpoint
   * @param {{action?: boolean}} [options]
   * @returns {Promise<any>}
   */
  function fetchJson(endpoint, options) {
    const action = options && options.action;
    return fetch(Polarrecorder.ApiBase + endpoint, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + String(response.status));
        return response.json();
      })
      .then(function (body) {
        if (!body) throw new Error("Request failed");
        if (body.status === "ERROR") throw new ApiError(body.error);
        hideBanner();
        return body.data;
      })
      .catch(function (error) {
        if (!action) showBanner(error);
        throw error;
      });
  }

  /**
   * Shows the server message for an API error and the connection text for transport or HTTP failures.
   * @param {unknown} [error]
   */
  function showBanner(error) {
    const banner = byId("connection-banner");
    banner.textContent = error instanceof ApiError ? "Polar Recorder error: " + error.message : CONNECTION_LOST_TEXT;
    banner.hidden = false;
  }

  function hideBanner() {
    const banner = byId("connection-banner");
    banner.textContent = CONNECTION_LOST_TEXT;
    banner.hidden = true;
  }

  /** @returns {Promise<void>} */
  function fetchPresets() {
    return fetchJson("presets")
      .then(function (data) {
        Polarrecorder.PresetsCache = (data && data.presets) || Polarrecorder.Presets.Fallback();
      })
      .catch(function () {
        Polarrecorder.PresetsCache = Polarrecorder.Presets.Fallback();
      });
  }

  /** @returns {Promise<void>} */
  function refreshPresets() {
    return fetchPresets().then(populatePresetSelects);
  }

  /** Rebuilds the polar preset options; a selection that no longer exists falls back to the first preset. */
  function populatePresetSelects() {
    const polar = /** @type {HTMLSelectElement} */ (byId("polar-preset"));
    const presets = Polarrecorder.PresetsCache;
    const known = presets.some(function (/** @type {Preset} */ preset) {
      return preset.name === state.polarFormat;
    });
    if (!known) state.polarFormat = presets[0].name;
    Polarrecorder.Dom.Clear(polar);
    presets.forEach(function (/** @type {Preset} */ preset) {
      const option = /** @type {HTMLOptionElement} */ (
        Polarrecorder.Dom.Node("option", "", Polarrecorder.Presets.Label(preset))
      );
      option.value = preset.name;
      polar.appendChild(option);
    });
    polar.value = state.polarFormat;
    if (Polarrecorder.ExportUI) Polarrecorder.ExportUI.RefreshPresets();
  }

  /** @param {boolean} [force] */
  function fetchPolar(force) {
    const params = new URLSearchParams();
    params.set("format", state.polarFormat);
    const endpoint = "polar?" + params.toString();
    fetchJson(endpoint)
      .then(function (data) {
        if (data.format !== state.polarFormat) return;
        state.polarGen = data.generation;
        byId("polar-chart").classList.add("has-data");
        Polarrecorder.PolarChart.Render(data, {
          presetTwa: selectedPolarPreset().twa,
          requestedFormat: state.polarFormat,
          resetBands: Boolean(force),
          force: Boolean(force)
        });
      })
      .catch(showBanner);
  }

  /** @returns {Preset} */
  function selectedPolarPreset() {
    return (
      Polarrecorder.PresetsCache.find(function (/** @type {Preset} */ preset) {
        return preset.name === state.polarFormat;
      }) || Polarrecorder.Presets.Fallback()[0]
    );
  }

  function fetchStatus() {
    state.statusInFlight = true;
    fetchJson("status")
      .then(function (data) {
        state.statusData = data;
        Polarrecorder.StatusUI.AppendRecentDecision(data);
        if (state.activeTab === "status") fetchStatusPanel(data);
        if (state.activeTab === "polar" && data.generation !== state.polarGen) fetchPolar();
        if (state.activeTab === "export" && data.generation !== state.csvGen) refreshPreview(data.generation);
      })
      .catch(showBanner)
      .finally(function () {
        state.statusInFlight = false;
      });
  }

  /** @param {any} data */
  function fetchStatusPanel(data) {
    fetchJson("enhanced/status")
      .then(function (enhanced) {
        data.enhanced_rules = enhanced.rules;
        renderStatusPanel(data);
      })
      .catch(function () {
        renderStatusPanel(data);
      });
  }

  /** @param {any} data */
  function renderStatusPanel(data) {
    Polarrecorder.StatusUI.Render(byId("status-panel"), data, {
      runAction: runAction,
      fetchStatus: fetchStatus,
      pendingAction: state.pendingAction
    });
  }

  /** @param {number} generation */
  function refreshPreview(generation) {
    state.csvGen = generation;
    const ui = Polarrecorder.ExportUI;
    if (ui && ui.RefreshPreview) ui.RefreshPreview();
  }

  /** @param {number} minutes */
  function fetchTimeline(minutes) {
    state.timelineMinutes = minutes;
    state.lastTimelineTick = state.tick;
    fetchJson("timeline?minutes=" + encodeURIComponent(String(minutes)))
      .then(function (data) {
        byId("timeline-chart").classList.add("has-data");
        Polarrecorder.TimelineChart.Render(data, minutes);
      })
      .catch(showBanner);
  }

  function initExport() {
    const finish = function () {
      if (!state.initializedExport) {
        state.initializedExport = true;
        Polarrecorder.ExportUI.Init({
          refreshPresets: refreshPresets,
          showBanner: showBanner
        });
      }
    };
    if (Polarrecorder.ConfigCache) {
      finish();
      return;
    }
    fetchJson("config")
      .then(function (data) {
        Polarrecorder.ConfigCache = data;
        finish();
      })
      .catch(showBanner);
  }

  function initSettings() {
    if (!state.initializedSettings) {
      state.initializedSettings = true;
      Polarrecorder.SettingsUI.Init();
    }
  }

  /**
   * @param {string} endpoint
   * @param {HTMLButtonElement} button
   * @param {() => void} done
   */
  function runAction(endpoint, button, done) {
    const oldText = button.textContent;
    state.pendingAction = endpoint;
    button.disabled = true;
    button.textContent = "Working";
    fetchJson(endpoint, { action: true })
      .then(done)
      .catch(showBanner)
      .finally(function () {
        state.pendingAction = null;
        button.disabled = false;
        button.textContent = oldText;
      });
  }

  /**
   * Merges a saved settings subset into the loaded ConfigCache, then re-renders an initialized Export tab.
   * @param {Record<string, unknown>} saved
   */
  function applySavedConfig(saved) {
    if (!Polarrecorder.ConfigCache) return;
    Object.assign(Polarrecorder.ConfigCache, saved);
    if (state.initializedExport) Polarrecorder.ExportUI.RefreshPresets();
  }

  Polarrecorder.RefreshPresets = refreshPresets;
  Polarrecorder.ApplySavedConfig = applySavedConfig;
  Polarrecorder.FetchTimeline = fetchTimeline;
})();

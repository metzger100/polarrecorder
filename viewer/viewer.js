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
   *   initializedSettings: boolean
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
    initializedSettings: false
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

  /**
   * @template {keyof HTMLElementTagNameMap} K
   * @param {K} tag
   * @param {string} [className]
   * @param {string} [text]
   * @returns {HTMLElementTagNameMap[K]}
   */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** @param {HTMLElement} node */
  function clear(node) {
    Polarrecorder.Dom.Clear(node);
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
    fetchStatus();
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
        if (!body || body.status === "ERROR") {
          throw new Error((body && body.error) || "Request failed");
        }
        hideBanner();
        return body.data;
      })
      .catch(function (error) {
        if (!action) showBanner();
        throw error;
      });
  }

  function showBanner() {
    byId("connection-banner").hidden = false;
  }

  function hideBanner() {
    byId("connection-banner").hidden = true;
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

  function populatePresetSelects() {
    const polar = /** @type {HTMLSelectElement} */ (byId("polar-preset"));
    clear(polar);
    Polarrecorder.PresetsCache.forEach(function (/** @type {Preset} */ preset) {
      const option = el("option", "", Polarrecorder.Presets.Label(preset));
      option.value = preset.name;
      polar.appendChild(option);
    });
    polar.value = state.polarFormat;
    polar.addEventListener("change", function () {
      state.polarFormat = polar.value;
      fetchPolar(true);
    });
    if (Polarrecorder.ExportUI) Polarrecorder.ExportUI.RefreshPresets();
  }

  /** @param {boolean} [force] */
  function fetchPolar(force) {
    const params = new URLSearchParams();
    params.set("format", state.polarFormat);
    const endpoint = "polar?" + params.toString();
    fetchJson(endpoint)
      .then(function (data) {
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
    fetchJson("status")
      .then(function (data) {
        state.statusData = data;
        Polarrecorder.StatusUI.AppendRecentDecision(data);
        if (state.activeTab === "status") {
          Polarrecorder.StatusUI.Render(byId("status-panel"), data, {
            runAction: runAction,
            fetchStatus: fetchStatus
          });
        }
        if (state.activeTab === "polar" && data.generation !== state.polarGen) fetchPolar();
        if (state.activeTab === "export" && data.generation !== state.csvGen) refreshPreview(data.generation);
      })
      .catch(showBanner);
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
      .catch(function () {
        showBanner();
      });
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
    button.disabled = true;
    button.textContent = "Working";
    fetchJson(endpoint, { action: true })
      .then(done)
      .catch(showBanner)
      .finally(function () {
        button.disabled = false;
        button.textContent = oldText;
      });
  }

  Polarrecorder.RefreshPresets = refreshPresets;
  Polarrecorder.FetchTimeline = fetchTimeline;
})();

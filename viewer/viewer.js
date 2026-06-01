/**
 * Module: Viewer Shell
 * Documentation: documentation/architecture/ui.md
 * Depends: none
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const POLL_MS = { polar: 30000, status: 2000, timeline: 10000 };
  const state = {
    activeTab: "polar",
    timers: {},
    statusData: null,
    timelineMinutes: 240,
    polarFormat: "windy",
    polarPercentile: "",
    initializedExport: false,
    initializedSettings: false
  };

  Polarrecorder.ApiBase = "";
  Polarrecorder.PresetsCache = [];
  Polarrecorder.ConfigCache = null;
  Polarrecorder.RecentDecisions = [];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    Polarrecorder.ApiBase = readApiBase();
    Object.defineProperty(Polarrecorder, "fetchJson", { value: fetchJson });
    Polarrecorder.FetchJson = fetchJson;
    wireTabs();
    wireNightMode();
    fetchPresets().then(function () {
      populatePresetSelects();
      activateTab("polar");
    });
  }

  function readApiBase() {
    const base = document.body.dataset.apiBase || "../api/";
    return base.endsWith("/") ? base : base + "/";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    node.replaceChildren();
  }

  function wireTabs() {
    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        activateTab(button.dataset.tab || "polar");
      });
    });
  }

  function wireNightMode() {
    const enabled = localStorage.getItem("polarrecorder-night") === "yes";
    document.body.classList.toggle("nightMode", enabled);
    byId("night-toggle").addEventListener("click", function () {
      const next = !document.body.classList.contains("nightMode");
      document.body.classList.toggle("nightMode", next);
      localStorage.setItem("polarrecorder-night", next ? "yes" : "no");
    });
  }

  function activateTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    });
    document.querySelectorAll("[data-tab-panel]").forEach(function (panel) {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === tab);
    });
    stopPolling();
    fetchActiveTab();
    if (POLL_MS[tab]) {
      state.timers[tab] = window.setInterval(fetchActiveTab, POLL_MS[tab]);
    }
  }

  function stopPolling() {
    Object.keys(state.timers).forEach(function (key) {
      window.clearInterval(state.timers[key]);
      delete state.timers[key];
    });
  }

  function fetchActiveTab() {
    if (state.activeTab === "polar") fetchPolar();
    if (state.activeTab === "status") fetchStatus();
    if (state.activeTab === "timeline") fetchTimeline(state.timelineMinutes);
    if (state.activeTab === "export") initExport();
    if (state.activeTab === "settings") initSettings();
  }

  function fetchJson(endpoint, options) {
    const action = options && options.action;
    return fetch(Polarrecorder.ApiBase + endpoint, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + String(response.status));
      return response.json();
    }).then(function (body) {
      if (!body || body.status === "ERROR") {
        throw new Error((body && body.error) || "Request failed");
      }
      hideBanner();
      return body.data;
    }).catch(function (error) {
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

  function fetchPresets() {
    return fetchJson("presets").then(function (data) {
      Polarrecorder.PresetsCache = (data && data.presets) || fallbackPresets();
    }).catch(function () {
      Polarrecorder.PresetsCache = fallbackPresets();
    });
  }

  function refreshPresets() {
    return fetchPresets().then(populatePresetSelects);
  }

  function fallbackPresets() {
    return [{ name: "windy", builtin: true, twa: [0, 30, 60, 90, 120, 150, 180], tws: [4, 6, 8, 10, 12, 14, 16, 20, 25] }];
  }

  function presetLabel(preset) {
    return preset.builtin ? "Windy Passage Planner" : preset.name;
  }

  function populatePresetSelects() {
    const polar = byId("polar-preset");
    clear(polar);
    Polarrecorder.PresetsCache.forEach(function (preset) {
      const option = el("option", "", presetLabel(preset));
      option.value = preset.name;
      polar.appendChild(option);
    });
    polar.value = state.polarFormat;
    polar.onchange = function () {
      state.polarFormat = polar.value;
      fetchPolar(true);
    };
    if (Polarrecorder.ExportUI) Polarrecorder.ExportUI.RefreshPresets();
  }

  function fetchPolar(force) {
    const params = new URLSearchParams();
    params.set("format", state.polarFormat);
    const endpoint = "polar?" + params.toString();
    fetchJson(endpoint).then(function (data) {
      byId("polar-chart").classList.add("has-data");
      Polarrecorder.PolarChart.Render(data, {
        presetTwa: selectedPolarPreset().twa,
        requestedFormat: state.polarFormat,
        resetBands: Boolean(force),
        force: Boolean(force)
      });
    }).catch(function () {});
  }

  function selectedPolarPreset() {
    return Polarrecorder.PresetsCache.find(function (preset) {
      return preset.name === state.polarFormat;
    }) || fallbackPresets()[0];
  }

  function fetchStatus() {
    fetchJson("status").then(function (data) {
      state.statusData = data;
      appendRecentDecision(data);
      renderStatus(data);
    }).catch(function () {});
  }

  function fetchTimeline(minutes) {
    state.timelineMinutes = minutes;
    fetchJson("timeline?minutes=" + encodeURIComponent(String(minutes))).then(function (data) {
      byId("timeline-chart").classList.add("has-data");
      Polarrecorder.TimelineChart.Render(data, minutes);
    }).catch(function () {});
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
    fetchJson("config").then(function (data) {
      Polarrecorder.ConfigCache = data;
      finish();
    }).catch(function () {
      Polarrecorder.ConfigCache = { min_samples_for_export: 10 };
      finish();
    });
  }

  function initSettings() {
    if (!state.initializedSettings) {
      state.initializedSettings = true;
      Polarrecorder.SettingsUI.Init();
    }
  }

  function appendRecentDecision(data) {
    const item = deriveDecision(data);
    Polarrecorder.RecentDecisions.push(item);
    while (Polarrecorder.RecentDecisions.length > 60) {
      Polarrecorder.RecentDecisions.shift();
    }
  }

  function deriveDecision(data) {
    if (!data.record_enabled) {
      return { state: "disabled", label: "Disabled" };
    }
    if (!data.recording) {
      return { state: "paused", label: "Paused" };
    }
    if (data.data_status !== "receiving") {
      return { state: "no_data", label: "No Data" };
    }
    const decision = data.current_decision || { state: "rejected", reason_codes: ["pending"] };
    const reasons = decision.reason_codes || [];
    return {
      state: decision.state,
      label: decision.state + (reasons.length > 0 ? ": " + reasons.join(", ") : "")
    };
  }

  function renderStatus(data) {
    const host = byId("status-panel");
    host.classList.add("has-data");
    clear(host);
    host.appendChild(renderStateCard(data));
    host.appendChild(renderValuesCard(data));
    host.appendChild(renderCountersCard(data));
    host.appendChild(renderPersistenceCard(data));
  }

  function renderStateCard(data) {
    const card = el("section", "card status-state wide-span");
    const label = stateLabel(data);
    const title = el("div", "state-title");
    title.appendChild(el("span", "dot " + label.className));
    title.appendChild(el("span", "", label.text));
    const meta = el("p", "helper", label.helper + " · Uptime " + formatDuration(data.uptime_seconds || 0));
    const action = el("button", "primary-action state-layer", data.recording ? "Pause" : "Resume");
    action.hidden = !data.record_enabled;
    action.addEventListener("click", function () {
      const endpoint = data.recording ? "pause" : "resume";
      runAction(endpoint, action, fetchStatus);
    });
    const left = el("div");
    left.appendChild(title);
    left.appendChild(meta);
    card.appendChild(left);
    card.appendChild(action);
    return card;
  }

  function stateLabel(data) {
    if (!data.record_enabled) {
      return { text: "Disabled", className: "", helper: "Enable recording in AvNav settings" };
    }
    if (!data.recording) {
      return { text: "Paused", className: "quarantined", helper: "Recording is paused" };
    }
    if (data.data_status !== "receiving") {
      return { text: "No Data", className: "", helper: "Waiting for instrument data" };
    }
    if (data.warming_up) {
      return { text: "Recording", className: "quarantined", helper: "Warming up stability checks" };
    }
    return { text: "Recording", className: "accepted", helper: "Collecting sailing samples" };
  }

  function renderValuesCard(data) {
    const card = el("section", "card wide-span");
    const head = el("div", "section-head");
    head.appendChild(el("h2", "", "Current Values"));
    card.appendChild(head);
    const grid = el("div", "value-grid");
    const values = data.current_values;
    [["TWA", "twa_deg", "°", "twa"], ["TWS", "tws_kt", " kt", "tws"], ["STW", "stw_kt", " kt", "stw"]].forEach(function (item) {
      grid.appendChild(valueTile(item, values));
    });
    card.appendChild(grid);
    if (data.recording && data.current_decision) card.appendChild(decisionBadge(data.current_decision));
    card.appendChild(renderDecisionStrip());
    return card;
  }

  function valueTile(item, values) {
    const tile = el("div", "value-tile");
    const value = values ? Number(values[item[1]]).toFixed(1) + item[2] : "No Data";
    tile.appendChild(el("span", "helper", item[0]));
    tile.appendChild(el("span", "value-number", value));
    const stale = values && values[item[3] + "_stale"];
    const age = values ? Number(values[item[3] + "_age_s"]).toFixed(1) + "s ago" : "";
    const line = el("p", "helper");
    line.appendChild(el("span", "dot " + (stale ? "stale" : "accepted")));
    line.appendChild(document.createTextNode(" " + age));
    tile.appendChild(line);
    return tile;
  }

  function decisionBadge(decision) {
    const stateName = decision.state || "rejected";
    const reasons = decision.reason_codes || [];
    return el("p", "value-tile decision-" + stateName, stateName + (reasons.length > 0 ? ": " + reasons.join(", ") : ""));
  }

  function renderDecisionStrip() {
    const row = el("div", "decision-strip");
    Polarrecorder.RecentDecisions.forEach(function (decision) {
      const cell = el("button", "decision-cell");
      cell.title = decision.label;
      cell.style.background = decisionColor(decision.state);
      cell.addEventListener("click", function (event) {
        Polarrecorder.ShowTooltip(decision.label, event.clientX, event.clientY);
      });
      row.appendChild(cell);
    });
    return row;
  }

  function renderCountersCard(data) {
    const card = el("section", "card");
    const counters = data.counters || {};
    const grid = el("div", "stat-grid");
    [["Seen", counters.total_seen], ["Accepted", counters.total_accepted], ["Rejected", counters.total_rejected], ["Quarantined", counters.total_quarantined]].forEach(function (item) {
      const tile = el("div", "stat-tile");
      tile.appendChild(el("span", "helper", item[0]));
      tile.appendChild(el("span", "stat-number", String(item[1] || 0)));
      grid.appendChild(tile);
    });
    card.appendChild(grid);
    card.appendChild(el("p", "helper", "Acceptance rate " + Math.round((counters.acceptance_rate || 0) * 100) + "%"));
    (data.top_rejections || []).forEach(function (entry) {
      card.appendChild(el("p", "helper", entry.reason + " ×" + String(entry.count)));
    });
    return card;
  }

  function renderPersistenceCard(data) {
    const card = el("section", "card");
    const box = el("div", "export-card");
    const persistence = data.persistence || {};
    box.appendChild(el("h2", "", "Persistence"));
    box.appendChild(el("p", "helper", "Last flush " + lastFlushText(persistence.last_flush_wall)));
    box.appendChild(el("p", "helper", "File size " + String(persistence.file_size_bytes || 0) + " bytes"));
    box.appendChild(el("p", "helper", "Bins " + String(persistence.bins_with_data || 0) + " / " + String(persistence.bins_total || 0)));
    card.appendChild(box);
    return card;
  }

  function runAction(endpoint, button, done) {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Working";
    fetchJson(endpoint, { action: true }).then(done).catch(showBanner).finally(function () {
      button.disabled = false;
      button.textContent = oldText;
    });
  }

  function decisionColor(name) {
    if (name === "accepted") return "var(--polarrecorder-accepted-color)";
    if (name === "rejected") return "var(--polarrecorder-rejected-color)";
    if (name === "quarantined") return "var(--polarrecorder-quarantined-color)";
    return "var(--polarrecorder-second-color)";
  }

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return String(hours) + "h " + String(minutes % 60) + "m";
    return String(minutes) + "m";
  }

  function lastFlushText(wall) {
    if (!wall) return "never";
    const seconds = Math.max(0, Math.round(Date.now() / 1000 - wall));
    return formatDuration(seconds) + " ago";
  }

  Polarrecorder.RefreshPresets = refreshPresets;
  Polarrecorder.FetchTimeline = fetchTimeline;
  Polarrecorder.ShowTooltip = function (text, x, y) {
    const existing = document.querySelector(".tooltip");
    if (existing) existing.remove();
    const tip = el("div", "tooltip", text);
    tip.style.left = String(Math.min(x + 12, window.innerWidth - 300)) + "px";
    tip.style.top = String(Math.max(12, y - 12)) + "px";
    document.body.appendChild(tip);
    window.setTimeout(function () {
      tip.remove();
    }, 2400);
  };
}());

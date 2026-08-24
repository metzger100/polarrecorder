/**
 * @file Status UI
 * Documentation: documentation/architecture/ui.md
 * Depends: dom.js, placeholders.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  Polarrecorder.RecentDecisions = [];

  /**
   * @param {string} tag
   * @param {string} [className]
   * @param {string} [text]
   * @returns {HTMLElement}
   */
  function el(tag, className, text) {
    return Polarrecorder.Dom.Node(tag, className, text);
  }

  /** @param {any} data */
  function appendRecentDecision(data) {
    const item = deriveDecision(data);
    Polarrecorder.RecentDecisions.push(item);
    while (Polarrecorder.RecentDecisions.length > 60) {
      Polarrecorder.RecentDecisions.shift();
    }
  }

  /**
   * @param {any} data
   * @returns {{state: string, label: string}}
   */
  function deriveDecision(data) {
    if (!data.recording) {
      return { state: "paused", label: "Paused" };
    }
    if (data.data_status !== "receiving") {
      return { state: "no_data", label: Polarrecorder.Placeholders.NoData };
    }
    const decision = data.current_decision || { state: "rejected", reason_codes: ["pending"] };
    const reasons = decision.reason_codes || [];
    return {
      state: decision.state,
      label: decision.state + (reasons.length > 0 ? ": " + reasons.join(", ") : "")
    };
  }

  /**
   * @param {HTMLElement} host
   * @param {any} data
   * @param {{runAction: (endpoint: string, button: HTMLElement, done: () => void) => void, fetchStatus: () => void}} callbacks
   */
  function render(host, data, callbacks) {
    host.classList.add("has-data");
    Polarrecorder.Dom.Clear(host);
    host.appendChild(renderStateCard(data, callbacks));
    host.appendChild(renderValuesCard(data));
    host.appendChild(renderCountersCard(data));
    host.appendChild(renderEnhancedAvailability(data.enhanced_rules || []));
    host.appendChild(renderPersistenceCard(data));
  }

  /**
   * @param {any} data
   * @param {{runAction: (endpoint: string, button: HTMLElement, done: () => void) => void, fetchStatus: () => void}} callbacks
   * @returns {HTMLElement}
   */
  function renderStateCard(data, callbacks) {
    const card = el("section", "card status-state wide-span");
    const label = stateLabel(data);
    const title = el("div", "state-title");
    title.appendChild(el("span", "dot " + label.className));
    title.appendChild(el("span", "", label.text));
    const meta = el("p", "helper", label.helper + " · Uptime " + formatDuration(data.uptime_seconds || 0));
    const action = el("button", "primary-action state-layer", data.recording ? "Pause" : "Resume");
    action.addEventListener("click", function () {
      const endpoint = data.recording ? "pause" : "resume";
      callbacks.runAction(endpoint, action, callbacks.fetchStatus);
    });
    const left = el("div");
    left.appendChild(title);
    left.appendChild(meta);
    card.appendChild(left);
    card.appendChild(action);
    return card;
  }

  /**
   * @param {any} data
   * @returns {{text: string, className: string, helper: string}}
   */
  function stateLabel(data) {
    if (!data.recording) {
      return { text: "Paused", className: "quarantined", helper: "Recording is paused" };
    }
    if (data.data_status !== "receiving") {
      return {
        text: Polarrecorder.Placeholders.NoData,
        className: "",
        helper: "Waiting for instrument data"
      };
    }
    if (data.warming_up) {
      return { text: "Recording", className: "quarantined", helper: "Warming up stability checks" };
    }
    return { text: "Recording", className: "accepted", helper: "Collecting sailing samples" };
  }

  /**
   * @param {any} data
   * @returns {HTMLElement}
   */
  function renderValuesCard(data) {
    const card = el("section", "card wide-span");
    const head = el("div", "section-head");
    head.appendChild(el("h2", "", "Current Values"));
    card.appendChild(head);
    const grid = el("div", "value-grid");
    const values = data.current_values;
    [
      ["TWA", "twa_deg", "°", "twa"],
      ["TWS", "tws_kt", " kt", "tws"],
      ["STW", "stw_kt", " kt", "stw"]
    ].forEach(function (item) {
      grid.appendChild(valueTile(item, values));
    });
    card.appendChild(grid);
    if (data.recording && data.current_decision) card.appendChild(decisionBadge(data.current_decision));
    card.appendChild(renderDecisionStrip());
    return card;
  }

  /**
   * @param {string[]} item
   * @param {any} values
   * @returns {HTMLElement}
   */
  function valueTile(item, values) {
    const tile = el("div", "value-tile");
    const value = values ? Number(values[item[1]]).toFixed(1) + item[2] : Polarrecorder.Placeholders.NoData;
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

  /**
   * @param {any} decision
   * @returns {HTMLElement}
   */
  function decisionBadge(decision) {
    const stateName = decision.state || "rejected";
    const reasons = decision.reason_codes || [];
    return el(
      "p",
      "value-tile decision-" + stateName,
      stateName + (reasons.length > 0 ? ": " + reasons.join(", ") : "")
    );
  }

  /**
   * @param {{state: string, label: string}} decision
   * @returns {HTMLElement}
   */
  function decisionCell(decision) {
    const cell = el("button", "decision-cell");
    cell.title = decision.label;
    cell.style.background = decisionColor(decision.state);
    cell.addEventListener("click", function (event) {
      Polarrecorder.Dom.ShowTooltip(decision.label, event.clientX, event.clientY);
    });
    return cell;
  }

  /** @returns {HTMLElement} */
  function renderDecisionStrip() {
    const row = el("div", "decision-strip");
    Polarrecorder.RecentDecisions.forEach(
      /** @param {{state: string, label: string}} decision */
      function (decision) {
        row.appendChild(decisionCell(decision));
      }
    );
    return row;
  }

  /**
   * @param {any} data
   * @returns {HTMLElement}
   */
  function renderCountersCard(data) {
    const card = el("section", "card");
    const counters = data.counters || {};
    const grid = el("div", "stat-grid");
    [
      ["Candidates", counters.total_seen],
      ["Accepted", counters.total_accepted],
      ["Rejected", counters.total_rejected],
      ["Quarantined", counters.total_quarantined]
    ].forEach(function (item) {
      const tile = el("div", "stat-tile");
      tile.appendChild(el("span", "helper", item[0]));
      tile.appendChild(el("span", "stat-number", String(item[1] || 0)));
      grid.appendChild(tile);
    });
    card.appendChild(grid);
    card.appendChild(
      el("p", "helper", "Candidate acceptance rate " + Math.round((counters.acceptance_rate || 0) * 100) + "%")
    );
    card.appendChild(
      el(
        "p",
        "helper",
        "Decision reasons include non-candidate input and sailing exclusions, so counts can exceed Candidates."
      )
    );
    card.appendChild(el("h2", "", "Diagnostic decision reasons"));
    (data.top_rejections || []).forEach(
      /** @param {{reason: string, count: number}} entry */
      function (entry) {
        card.appendChild(el("p", "helper", entry.reason + " ×" + String(entry.count)));
      }
    );
    card.appendChild(el("h2", "", "Triggered predicates"));
    (data.top_predicates || []).forEach(
      /** @param {{predicate: string, count: number}} entry */
      function (entry) {
        card.appendChild(el("p", "helper", entry.predicate + " ×" + String(entry.count)));
      }
    );
    return card;
  }

  /**
   * @param {any} data
   * @returns {HTMLElement}
   */
  function renderPersistenceCard(data) {
    const card = el("section", "card");
    const box = el("div", "export-card");
    const persistence = data.persistence || {};
    box.appendChild(el("h2", "", "Persistence"));
    box.appendChild(el("p", "helper", "Last flush " + lastFlushText(persistence.last_flush_wall)));
    box.appendChild(el("p", "helper", "File size " + String(persistence.file_size_bytes || 0) + " bytes"));
    box.appendChild(
      el("p", "helper", "Bins " + String(persistence.bins_with_data || 0) + " / " + String(persistence.bins_total || 0))
    );
    card.appendChild(box);
    return card;
  }

  /**
   * @param {Array<{availability: string, rule: string, status: string}>} rules
   * @returns {HTMLElement}
   */
  function renderEnhancedAvailability(rules) {
    const card = el("section", "card");
    card.appendChild(el("h2", "", "Enhanced Rule Availability"));
    rules.forEach(function (rule) {
      card.appendChild(el("p", "helper", rule.rule + ": " + rule.availability + " (" + rule.status + ")"));
    });
    return card;
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  function decisionColor(name) {
    if (name === "accepted") return "var(--polarrecorder-accepted-color)";
    if (name === "rejected") return "var(--polarrecorder-rejected-color)";
    if (name === "quarantined") return "var(--polarrecorder-quarantined-color)";
    return "var(--polarrecorder-second-color)";
  }

  /**
   * @param {number} seconds
   * @returns {string}
   */
  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return String(hours) + "h " + String(minutes % 60) + "m";
    return String(minutes) + "m";
  }

  /**
   * @param {number} wall
   * @returns {string}
   */
  function lastFlushText(wall) {
    if (!wall) return "never";
    const seconds = Math.max(0, Math.round(Date.now() / 1000 - wall));
    return formatDuration(seconds) + " ago";
  }

  Polarrecorder.StatusUI = {
    AppendRecentDecision: appendRecentDecision,
    Render: render
  };
})();

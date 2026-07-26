/**
 * Module: Enhanced Settings
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  /** @typedef {{field: string, key?: string}} EnhancedKeyEntry */
  /**
   * @typedef {{
   *   rule: string,
   *   status: string,
   *   enabled: boolean,
   *   enable_field: string,
   *   keys?: EnhancedKeyEntry[],
   *   thresholds?: Record<string, number>
   * }} EnhancedRule
   */
  /** @typedef {{field: string, kind: "bool", control: HTMLInputElement}} BoolControlItem */
  /** @typedef {{field: string, kind: "text", control: HTMLSelectElement}} TextControlItem */
  /** @typedef {{field: string, kind: "number", control: HTMLInputElement}} NumberControlItem */
  /** @typedef {BoolControlItem | TextControlItem | NumberControlItem} ControlItem */
  /**
   * @typedef {{
   *   body: HTMLElement,
   *   messageNode: HTMLElement,
   *   keys: string[],
   *   controls: ControlItem[],
   *   keySelects: HTMLSelectElement[],
   *   keysLoading: boolean
   * }} EnhancedState
   */

  /** @type {Record<string, string>} */
  const RULE_LABELS = {
    reject_engine_rpm: "Engine RPM",
    reject_engine_on: "Engine on/off",
    reject_shallow: "Shallow water",
    reject_sog_stw_mismatch: "Speed-log sanity (SOG vs STW)",
    reject_true_wind_crosscheck: "Wind sensor cross-check",
    reject_heel_out_of_band: "Heel angle",
    turn_confirm: "Turn vs. wind-shift detection"
  };
  /** @type {Record<string, string>} */
  const FIELD_LABELS = {
    enh_rpm_key: "Engine RPM source",
    enh_rpm_idle_max: "Reject above RPM",
    enh_engine_state_key: "Engine on/off source",
    enh_engine_state_on_threshold: "Engine-on threshold",
    enh_depth_key: "Depth source",
    enh_depth_floor_m: "Minimum depth (m)",
    enh_sog_key: "Speed over ground source",
    enh_current_drift_key: "Current drift source",
    enh_slip_sog_floor_kt: "Only check above (kn)",
    enh_slip_ratio: "Slip ratio (STW ÷ SOG)",
    enh_awa_key: "Apparent wind angle source",
    enh_aws_key: "Apparent wind speed source",
    enh_tw_twa_tol_deg: "Wind angle tolerance (°)",
    enh_tw_tws_tol_kt: "Wind speed tolerance (kn)",
    enh_heel_key: "Heel / roll source",
    enh_heel_min_deg: "Minimum heel (°)",
    enh_heel_max_deg: "Maximum heel (°)",
    enh_heading_key: "Heading source",
    enh_cog_key: "Course over ground source",
    enh_turn_min_roc: "Turn rate threshold (°/s)"
  };
  /** @type {Record<string, string>} */
  const STATUS_LABELS = {
    active: "active",
    disabled: "disabled",
    inactive_key_not_configured: "no key set",
    inactive_key_missing: "key not in store",
    inactive_value_missing: "value stale"
  };

  /** @type {EnhancedState} */
  const state = {
    body: document.createElement("div"),
    messageNode: document.createElement("p"),
    keys: [],
    controls: [],
    keySelects: [],
    keysLoading: false
  };

  /** @returns {HTMLElement} */
  function render() {
    const card = Polarrecorder.Dom.Node("section", "card export-card");
    const head = Polarrecorder.Dom.Node("div", "section-head");
    head.appendChild(Polarrecorder.Dom.Node("h2", null, "Enhanced Rules"));
    card.appendChild(head);
    card.appendChild(
      Polarrecorder.Dom.Node(
        "p",
        "helper",
        "Optional boat signals that reject unrepresentative samples. Each rule defaults on; clear its key or switch it off to opt out."
      )
    );
    state.body = Polarrecorder.Dom.Node("div", "enhanced-rules");
    card.appendChild(state.body);
    card.appendChild(
      Polarrecorder.Dom.ActionRow([
        Polarrecorder.Dom.Button("Save Enhanced Settings", save, "primary-action")
      ])
    );
    state.messageNode = Polarrecorder.Dom.Node("p", "helper");
    card.appendChild(state.messageNode);
    reload();
    return card;
  }

  function reload() {
    Promise.all([action("enhanced/keys"), action("enhanced/status")])
      .then(function (results) {
        state.keys = (results[0] && results[0].keys) || [];
        renderRules((results[1] && results[1].rules) || []);
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  /** @param {EnhancedRule[]} rules */
  function renderRules(rules) {
    state.controls = [];
    state.keySelects = [];
    Polarrecorder.Dom.Clear(state.body);
    if (!rules.length) {
      state.body.appendChild(
        Polarrecorder.Dom.Node("p", "helper", "Enhanced status is unavailable.")
      );
      return;
    }
    rules.forEach(function (rule) {
      state.body.appendChild(ruleBlock(rule));
    });
  }

  /**
   * @param {EnhancedRule} rule
   * @returns {HTMLElement}
   */
  function ruleBlock(rule) {
    const wrap = Polarrecorder.Dom.Node("div", "enhanced-rule");
    const header = Polarrecorder.Dom.Node("div", "enhanced-rule-head");
    header.appendChild(
      Polarrecorder.Dom.Node("h3", "settings-group-title", RULE_LABELS[rule.rule] || rule.rule)
    );
    header.appendChild(badge(String(rule.status)));
    wrap.appendChild(header);
    wrap.appendChild(toggleField(rule));
    (rule.keys || []).forEach(function (entry) {
      wrap.appendChild(keyField(entry));
    });
    const thresholds = rule.thresholds || {};
    Object.keys(thresholds).forEach(function (field) {
      wrap.appendChild(thresholdField(field, thresholds[field]));
    });
    return wrap;
  }

  /**
   * @param {EnhancedRule} rule
   * @returns {HTMLElement}
   */
  function toggleField(rule) {
    const wrap = Polarrecorder.Dom.Node("label", "switch-field");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = rule.enabled === true;
    wrap.appendChild(box);
    wrap.appendChild(Polarrecorder.Dom.Node("span", "switch-track"));
    wrap.appendChild(Polarrecorder.Dom.Node("span", "switch-copy", "Enabled"));
    state.controls.push({ field: rule.enable_field, kind: "bool", control: box });
    return wrap;
  }

  /**
   * @param {EnhancedKeyEntry} entry
   * @returns {HTMLElement}
   */
  function keyField(entry) {
    const wrap = Polarrecorder.Dom.Node("label", "field enhanced-key");
    wrap.appendChild(Polarrecorder.Dom.Node("span", null, fieldLabel(entry.field)));
    const select = keySelect(entry.key || "");
    wrap.appendChild(select);
    state.controls.push({ field: entry.field, kind: "text", control: select });
    return wrap;
  }

  /**
   * @param {string} current
   * @returns {HTMLSelectElement}
   */
  function keySelect(current) {
    const select = document.createElement("select");
    populateSelect(select, current);
    select.addEventListener("focus", refreshKeys);
    state.keySelects.push(select);
    return select;
  }

  /**
   * @param {HTMLSelectElement} select
   * @param {string} current
   */
  function populateSelect(select, current) {
    Polarrecorder.Dom.Clear(select);
    appendOption(select, "", "— none —");
    const options = state.keys.slice();
    if (current && options.indexOf(current) === -1) {
      options.push(current);
    }
    options.forEach(function (key) {
      appendOption(select, key, key);
    });
    select.value = current;
  }

  function refreshKeys() {
    if (state.keysLoading) {
      return;
    }
    state.keysLoading = true;
    action("enhanced/keys")
      .then(function (data) {
        state.keys = (data && data.keys) || [];
        state.keySelects.forEach(function (select) {
          populateSelect(select, select.value);
        });
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      })
      .then(function () {
        state.keysLoading = false;
      });
  }

  /**
   * @param {HTMLSelectElement} select
   * @param {string} value
   * @param {string} label
   */
  function appendOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  /**
   * @param {string} field
   * @param {number} value
   * @returns {HTMLElement}
   */
  function thresholdField(field, value) {
    const wrap = Polarrecorder.Dom.Node("label", "field enhanced-threshold");
    wrap.appendChild(Polarrecorder.Dom.Node("span", null, fieldLabel(field)));
    const control = document.createElement("input");
    control.type = "number";
    control.value = String(value);
    wrap.appendChild(control);
    state.controls.push({ field: field, kind: "number", control: control });
    return wrap;
  }

  /**
   * @param {string} status
   * @returns {HTMLElement}
   */
  function badge(status) {
    const cssStatus = status.replace(/_/g, "-");
    return Polarrecorder.Dom.Node(
      "span",
      "enhanced-badge enhanced-badge-" + cssStatus,
      STATUS_LABELS[status] || status
    );
  }

  /**
   * @param {ControlItem} item
   * @returns {string}
   */
  function controlValue(item) {
    if (item.kind === "bool") {
      return item.control.checked ? "true" : "false";
    }
    return String(item.control.value);
  }

  /**
   * @param {ControlItem} item
   * @returns {boolean}
   */
  function isInvalidNumber(item) {
    if (item.kind !== "number") {
      return false;
    }
    const raw = String(item.control.value).trim();
    return raw === "" || !Number.isFinite(Number(raw));
  }

  function save() {
    if (state.controls.some(isInvalidNumber)) {
      setMessage("Enter a valid number for every threshold before saving.", "error");
      return;
    }
    const params = state.controls.map(function (item) {
      return encodeURIComponent(item.field) + "=" + encodeURIComponent(controlValue(item));
    });
    action("enhanced/save?" + params.join("&"))
      .then(function () {
        setMessage("Enhanced settings saved.", "info");
        reload();
      })
      .catch(function (error) {
        setMessage(error.message, "error");
      });
  }

  /**
   * @param {string} text
   * @param {"error" | "info"} kind
   */
  function setMessage(text, kind) {
    state.messageNode.className = kind === "error" ? "error-text" : "helper";
    state.messageNode.textContent = text;
  }

  /**
   * @param {string} field
   * @returns {string}
   */
  function fieldLabel(field) {
    return FIELD_LABELS[field] || field;
  }

  /**
   * @param {string} endpoint
   * @returns {Promise<any>}
   */
  function action(endpoint) {
    return Polarrecorder["FetchJson"](endpoint, { action: true });
  }

  Polarrecorder.EnhancedSettings = { Render: render };
})();

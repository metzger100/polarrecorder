/**
 * @file Enhanced Settings
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js, enhanced-rule-display.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  /** @typedef {{field: string, key?: string}} EnhancedKeyEntry */
  /**
   * @typedef {{
   *   rule: string,
   *   availability: string,
   *   status: string,
   *   enabled: boolean,
   *   enable_field: string,
   *   keys?: EnhancedKeyEntry[],
   *   thresholds?: Record<string, number>
   * }} EnhancedRule
   */
  /** @typedef {{field: string, kind: "bool", control: HTMLInputElement}} BoolControlItem */
  /** @typedef {{field: string, kind: "text", control: HTMLInputElement}} TextControlItem */
  /** @typedef {{field: string, kind: "number", control: HTMLInputElement}} NumberControlItem */
  /** @typedef {BoolControlItem | TextControlItem | NumberControlItem} ControlItem */
  /** @typedef {{control: HTMLInputElement, suggestions: HTMLDataListElement}} KeyControl */
  /**
   * @typedef {{
   *   body: HTMLElement,
   *   messageNode: HTMLElement,
   *   keys: string[],
   *   controls: ControlItem[],
   *   keyControls: KeyControl[],
   *   keysLoading: boolean
   * }} EnhancedState
   */

  /** @type {Record<string, string>} */
  const FIELD_LABELS = {
    enh_rpm_key: "Engine RPM source",
    enh_rpm_idle_max: "Reject above RPM",
    enh_engine_state_key: "Engine on/off source",
    enh_engine_state_on_threshold: "Engine-on threshold",
    enh_depth_key: "Depth source",
    enh_depth_floor_m: "Minimum depth (m)",
    enh_sog_key: "Shared SOG source (anchoring and consistency)",
    enh_current_drift_key: "Current drift source",
    enh_slip_sog_floor_kt: "Only check faster speed above (kn)",
    enh_slip_ratio: "SOG/STW consistency ratio",
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

  /** @type {EnhancedState} */
  const state = {
    body: document.createElement("div"),
    messageNode: document.createElement("p"),
    keys: [],
    controls: [],
    keyControls: [],
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
        "Optional boat signals that reject unrepresentative samples. Each rule defaults on; clear its key or switch it off to opt out. The SOG source also remains active for anchored detection when the SOG/STW consistency rule is off."
      )
    );
    state.body = Polarrecorder.Dom.Node("div", "enhanced-rules");
    card.appendChild(state.body);
    card.appendChild(
      Polarrecorder.Dom.ActionRow([Polarrecorder.Dom.Button("Save Enhanced Settings", save, "primary-action")])
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
    state.keyControls = [];
    Polarrecorder.Dom.Clear(state.body);
    if (!rules.length) {
      state.body.appendChild(Polarrecorder.Dom.Node("p", "helper", "Enhanced status is unavailable."));
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
      Polarrecorder.Dom.Node("h3", "settings-group-title", Polarrecorder.EnhancedRuleDisplay.RuleLabel(rule.rule))
    );
    header.appendChild(badge(String(rule.availability)));
    wrap.appendChild(header);
    wrap.appendChild(Polarrecorder.Dom.Node("p", "helper", detailedStatus(String(rule.status))));
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
    const control = keyInput(entry.field, entry.key || "");
    wrap.appendChild(control.input);
    wrap.appendChild(control.suggestions);
    state.controls.push({ field: entry.field, kind: "text", control: control.input });
    return wrap;
  }

  /**
   * @param {string} field
   * @param {string} current
   * @returns {{input: HTMLInputElement, suggestions: HTMLDataListElement}}
   */
  function keyInput(field, current) {
    const input = document.createElement("input");
    const suggestions = document.createElement("datalist");
    suggestions.id = "enhanced-key-options-" + field;
    input.type = "text";
    input.value = current;
    input.setAttribute("list", suggestions.id);
    populateSuggestions(suggestions, current);
    input.addEventListener("focus", refreshKeys);
    state.keyControls.push({ control: input, suggestions: suggestions });
    return { input: input, suggestions: suggestions };
  }

  /**
   * @param {HTMLDataListElement} suggestions
   * @param {string} current
   */
  function populateSuggestions(suggestions, current) {
    Polarrecorder.Dom.Clear(suggestions);
    const options = state.keys.slice();
    if (current && options.indexOf(current) === -1) {
      options.push(current);
    }
    options.forEach(function (key) {
      appendOption(suggestions, key);
    });
  }

  function refreshKeys() {
    if (state.keysLoading) {
      return;
    }
    state.keysLoading = true;
    action("enhanced/keys")
      .then(function (data) {
        state.keys = (data && data.keys) || [];
        state.keyControls.forEach(function (item) {
          populateSuggestions(item.suggestions, item.control.value);
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
   * @param {HTMLDataListElement} suggestions
   * @param {string} value
   */
  function appendOption(suggestions, value) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    suggestions.appendChild(option);
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
      Polarrecorder.EnhancedRuleDisplay.AvailabilityLabel(status)
    );
  }

  /**
   * @param {string} status
   * @returns {string}
   */
  function detailedStatus(status) {
    return Polarrecorder.EnhancedRuleDisplay.StatusLabel(status);
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

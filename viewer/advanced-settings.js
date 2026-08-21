/**
 * @file Data Source and Advanced Settings
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  /**
   * @typedef {{
   *   field: string,
   *   label: string,
   *   type: string,
   *   description: string,
   *   value: unknown,
   *   min?: number,
   *   max?: number,
   *   step?: number
   * }} AdvancedField
   */
  /** @typedef {{label: string, description: string, fields: AdvancedField[]}} AdvancedGroup */
  /** @typedef {{control: HTMLInputElement, field: string, kind: "bool", label: string}} BoolControlItem */
  /**
   * @typedef {{
   *   control: HTMLInputElement,
   *   field: string,
   *   kind: "number",
   *   label: string,
   *   max: number,
   *   min: number
   * }} NumberControlItem
   */
  /** @typedef {BoolControlItem | NumberControlItem} ControlItem */
  /** @typedef {{field: string, label: string, description: string}} SourceField */
  /** @typedef {{field: string, control: HTMLSelectElement}} SourceControl */
  /**
   * @typedef {{
   *   body: HTMLElement,
   *   messageNode: HTMLElement,
   *   controls: ControlItem[]
   * }} AdvancedState
   */

  /** @type {AdvancedState} */
  const state = {
    body: document.createElement("div"),
    messageNode: document.createElement("p"),
    controls: []
  };
  /** @type {{body: HTMLElement, messageNode: HTMLElement, controls: SourceControl[]}} */
  const sourceState = {
    body: document.createElement("div"),
    messageNode: document.createElement("p"),
    controls: []
  };
  /** @type {SourceField[]} */
  const SOURCE_FIELDS = [
    {
      field: "twa_key",
      label: "True wind angle (TWA)",
      description: "AvNav store key providing degrees relative to the boat."
    },
    {
      field: "tws_key",
      label: "True wind speed (TWS)",
      description: "AvNav store key providing meters per second."
    },
    {
      field: "stw_key",
      label: "Speed through water (STW)",
      description: "AvNav store key providing meters per second."
    }
  ];

  /** @returns {HTMLElement} */
  function renderSources() {
    const card = Polarrecorder.Dom.Node("section", "card export-card");
    const head = Polarrecorder.Dom.Node("div", "section-head");
    head.appendChild(Polarrecorder.Dom.Node("h2", null, "Data Sources"));
    card.appendChild(head);
    card.appendChild(
      Polarrecorder.Dom.Node(
        "p",
        "helper",
        "Choose the AvNav store values used to learn the polar. The standard AvNav keys are selected by default."
      )
    );
    sourceState.body = Polarrecorder.Dom.Node("div", "advanced-fields");
    card.appendChild(sourceState.body);
    card.appendChild(
      Polarrecorder.Dom.ActionRow([Polarrecorder.Dom.Button("Save Data Sources", saveSources, "primary-action")])
    );
    sourceState.messageNode = Polarrecorder.Dom.Node("p", "helper");
    card.appendChild(sourceState.messageNode);
    reloadSources();
    return card;
  }

  function reloadSources() {
    Promise.all([action("config"), action("enhanced/keys")])
      .then(function (results) {
        renderSourceFields(results[0], results[1].keys);
      })
      .catch(function (error) {
        setMessage(sourceState.messageNode, error.message, "error");
      });
  }

  /**
   * @param {Record<string, string>} config
   * @param {string[]} keys
   */
  function renderSourceFields(config, keys) {
    sourceState.controls = [];
    Polarrecorder.Dom.Clear(sourceState.body);
    SOURCE_FIELDS.forEach(function (field) {
      const wrap = Polarrecorder.Dom.Node("label", "field source-key");
      wrap.appendChild(Polarrecorder.Dom.Node("span", null, field.label));
      wrap.appendChild(Polarrecorder.Dom.Node("span", "helper", field.description));
      const select = document.createElement("select");
      const current = config[field.field];
      const options = keys.filter(function (key) {
        return key !== current;
      });
      options.unshift(current);
      options.forEach(function (key) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        select.appendChild(option);
      });
      select.value = current;
      wrap.appendChild(select);
      sourceState.controls.push({ field: field.field, control: select });
      sourceState.body.appendChild(wrap);
    });
  }

  function saveSources() {
    if (
      sourceState.controls.some(function (item) {
        return String(item.control.value).trim() === "";
      })
    ) {
      setMessage(sourceState.messageNode, "Select a store key for TWA, TWS, and STW.", "error");
      return;
    }
    const params = sourceState.controls.map(function (item) {
      return encodeURIComponent(item.field) + "=" + encodeURIComponent(item.control.value);
    });
    action("advanced/save?" + params.join("&"))
      .then(function () {
        setMessage(sourceState.messageNode, "Data sources saved.", "info");
      })
      .catch(function (error) {
        setMessage(sourceState.messageNode, error.message, "error");
      });
  }

  /** @returns {HTMLElement} */
  function render() {
    const card = Polarrecorder.Dom.Node("section", "card export-card");
    const head = Polarrecorder.Dom.Node("div", "section-head");
    head.appendChild(Polarrecorder.Dom.Node("h2", null, "Advanced Settings"));
    card.appendChild(head);
    card.appendChild(
      Polarrecorder.Dom.Node(
        "p",
        "helper",
        "Fine-tune the recording filters when your boat or sensors need different thresholds."
      )
    );
    state.body = Polarrecorder.Dom.Node("div", "advanced-settings");
    card.appendChild(state.body);
    card.appendChild(
      Polarrecorder.Dom.ActionRow([Polarrecorder.Dom.Button("Save Advanced Settings", save, "primary-action")])
    );
    state.messageNode = Polarrecorder.Dom.Node("p", "helper");
    card.appendChild(state.messageNode);
    reload();
    return card;
  }

  function reload() {
    action("advanced/settings")
      .then(function (data) {
        renderGroups(data.groups);
      })
      .catch(function (error) {
        setMessage(state.messageNode, error.message, "error");
      });
  }

  /** @param {AdvancedGroup[]} groups */
  function renderGroups(groups) {
    state.controls = [];
    Polarrecorder.Dom.Clear(state.body);
    groups.forEach(function (group) {
      state.body.appendChild(groupBlock(group));
    });
  }

  /**
   * @param {AdvancedGroup} group
   * @returns {HTMLElement}
   */
  function groupBlock(group) {
    const wrap = Polarrecorder.Dom.Node("div", "settings-group advanced-group");
    wrap.appendChild(Polarrecorder.Dom.Node("h3", "settings-group-title", group.label));
    wrap.appendChild(Polarrecorder.Dom.Node("p", "helper", group.description));
    const fields = Polarrecorder.Dom.Node("div", "advanced-fields");
    group.fields.forEach(function (field) {
      fields.appendChild(fieldControl(field));
    });
    wrap.appendChild(fields);
    return wrap;
  }

  /**
   * @param {AdvancedField} field
   * @returns {HTMLElement}
   */
  function fieldControl(field) {
    if (field.type === "BOOLEAN") {
      return booleanField(field);
    }
    return numberField(field);
  }

  /**
   * @param {AdvancedField} field
   * @returns {HTMLElement}
   */
  function booleanField(field) {
    const wrap = Polarrecorder.Dom.Node("label", "switch-field advanced-setting");
    const control = document.createElement("input");
    control.type = "checkbox";
    control.checked = field.value === true;
    wrap.appendChild(control);
    wrap.appendChild(Polarrecorder.Dom.Node("span", "switch-track"));
    wrap.appendChild(Polarrecorder.Dom.Node("span", "switch-copy", field.label));
    wrap.appendChild(Polarrecorder.Dom.Node("p", "helper", field.description));
    state.controls.push({
      control: control,
      field: field.field,
      kind: "bool",
      label: field.label
    });
    return wrap;
  }

  /**
   * @param {AdvancedField} field
   * @returns {HTMLElement}
   */
  function numberField(field) {
    const wrap = Polarrecorder.Dom.Node("label", "field advanced-setting");
    wrap.appendChild(Polarrecorder.Dom.Node("span", null, field.label));
    wrap.appendChild(Polarrecorder.Dom.Node("span", "helper", field.description));
    const control = document.createElement("input");
    control.type = "number";
    control.min = String(field.min);
    control.max = String(field.max);
    control.step = String(field.step);
    control.value = String(field.value);
    wrap.appendChild(control);
    state.controls.push({
      control: control,
      field: field.field,
      kind: "number",
      label: field.label,
      max: Number(field.max),
      min: Number(field.min)
    });
    return wrap;
  }

  /**
   * @param {ControlItem} item
   * @returns {string}
   */
  function validationError(item) {
    if (item.kind === "bool") {
      return "";
    }
    const raw = String(item.control.value).trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) {
      return item.label + " must be a number.";
    }
    if (value < item.min || value > item.max) {
      return item.label + " must be between " + item.min + " and " + item.max + ".";
    }
    return "";
  }

  function save() {
    const error = firstError();
    if (error) {
      setMessage(state.messageNode, error, "error");
      return;
    }
    const params = state.controls.map(function (item) {
      return encodeURIComponent(item.field) + "=" + encodeURIComponent(controlValue(item));
    });
    action("advanced/save?" + params.join("&"))
      .then(function () {
        setMessage(state.messageNode, "Advanced settings saved.", "info");
        reload();
      })
      .catch(function (error) {
        setMessage(state.messageNode, error.message, "error");
      });
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

  /** @returns {string} */
  function firstError() {
    for (const item of state.controls) {
      const error = validationError(item);
      if (error) {
        return error;
      }
    }
    return "";
  }

  /**
   * @param {HTMLElement} node
   * @param {string} text
   * @param {"error" | "info"} kind
   */
  function setMessage(node, text, kind) {
    node.className = kind === "error" ? "error-text" : "helper";
    node.textContent = text;
  }

  /**
   * @param {string} endpoint
   * @returns {Promise<any>}
   */
  function action(endpoint) {
    return Polarrecorder["FetchJson"](endpoint, { action: true });
  }

  Polarrecorder.SourceSettings = { Render: renderSources };
  Polarrecorder.AdvancedSettings = { Render: render };
})();

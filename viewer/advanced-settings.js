/**
 * Module: Advanced Settings
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, dom.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;
  const button = Polarrecorder.Dom.Button;
  const actionRow = Polarrecorder.Dom.ActionRow;
  const clear = Polarrecorder.Dom.Clear;
  const node = Polarrecorder.Dom.Node;

  const state = {
    body: null,
    messageNode: null,
    controls: []
  };

  function render() {
    const card = node("section", "card export-card");
    const head = node("div", "section-head");
    head.appendChild(node("h2", null, "Advanced Settings"));
    card.appendChild(head);
    card.appendChild(node(
      "p",
      "helper",
      "Fine-tune the recording filters when your boat or sensors need different thresholds."
    ));
    state.body = node("div", "advanced-settings");
    card.appendChild(state.body);
    card.appendChild(actionRow([button("Save Advanced Settings", save, "primary-action")]));
    state.messageNode = node("p", "helper");
    card.appendChild(state.messageNode);
    reload();
    return card;
  }

  function reload() {
    action("advanced/settings").then(function (data) {
      renderGroups(data.groups);
    }).catch(function (error) {
      setMessage(error.message, "error");
    });
  }

  function renderGroups(groups) {
    state.controls = [];
    clear(state.body);
    groups.forEach(function (group) {
      state.body.appendChild(groupBlock(group));
    });
  }

  function groupBlock(group) {
    const wrap = node("div", "settings-group advanced-group");
    wrap.appendChild(node("h3", "settings-group-title", group.label));
    wrap.appendChild(node("p", "helper", group.description));
    const fields = node("div", "advanced-fields");
    group.fields.forEach(function (field) {
      fields.appendChild(fieldControl(field));
    });
    wrap.appendChild(fields);
    return wrap;
  }

  function fieldControl(field) {
    if (field.type === "BOOLEAN") {
      return booleanField(field);
    }
    return numberField(field);
  }

  function booleanField(field) {
    const wrap = node("label", "switch-field advanced-setting");
    const control = document.createElement("input");
    control.type = "checkbox";
    control.checked = field.value === true;
    wrap.appendChild(control);
    wrap.appendChild(node("span", "switch-track"));
    wrap.appendChild(node("span", "switch-copy", field.label));
    wrap.appendChild(node("p", "helper", field.description));
    state.controls.push({
      control: control,
      field: field.field,
      kind: "bool",
      label: field.label
    });
    return wrap;
  }

  function numberField(field) {
    const wrap = node("label", "field advanced-setting");
    wrap.appendChild(node("span", null, field.label));
    wrap.appendChild(node("span", "helper", field.description));
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
      setMessage(error, "error");
      return;
    }
    const params = state.controls.map(function (item) {
      return encodeURIComponent(item.field)
        + "="
        + encodeURIComponent(controlValue(item));
    });
    action("advanced/save?" + params.join("&")).then(function () {
      setMessage("Advanced settings saved.", "info");
      reload();
    }).catch(function (error) {
      setMessage(error.message, "error");
    });
  }

  function controlValue(item) {
    if (item.kind === "bool") {
      return item.control.checked ? "true" : "false";
    }
    return String(item.control.value);
  }

  function firstError() {
    for (const item of state.controls) {
      const error = validationError(item);
      if (error) {
        return error;
      }
    }
    return "";
  }

  function setMessage(text, kind) {
    state.messageNode.className = kind === "error" ? "error-text" : "helper";
    state.messageNode.textContent = text;
  }

  function action(endpoint) {
    return Polarrecorder["FetchJson"](endpoint, { action: true });
  }

  Polarrecorder.AdvancedSettings = { Render: render };
}());

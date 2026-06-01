/**
 * Module: Grid Editor
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  function create(options) {
    const state = {
      label: options.label,
      min: options.min,
      max: options.max,
      step: options.step,
      values: options.values.slice(),
      onChange: options.onChange
    };
    const host = document.createElement("div");
    host.className = "grid-editor";
    render(host, state);
    return {
      Element: host,
      Values: function () {
        return validValues(state);
      },
      IsValid: function () {
        return validValues(state).length === state.values.length && state.values.length > 0;
      },
      SetValues: function (values) {
        state.values = values.slice();
        render(host, state);
      }
    };
  }

  function render(host, state) {
    host.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = state.label;
    host.appendChild(title);
    const row = document.createElement("div");
    row.className = "grid-row";
    state.values.forEach(function (value, index) {
      row.appendChild(token(state, index, value));
    });
    const add = document.createElement("button");
    add.type = "button";
    add.className = "small-icon state-layer";
    add.textContent = "＋";
    add.setAttribute("aria-label", "Add " + state.label + " value");
    add.addEventListener("click", function () {
      const last = state.values[state.values.length - 1] || state.min;
      state.values.push(Math.min(state.max, last + state.step));
      sortValues(state);
      render(host, state);
      notify(state);
    });
    row.appendChild(add);
    host.appendChild(row);
    const error = document.createElement("p");
    error.className = "error-text";
    error.textContent = errorText(state);
    host.appendChild(error);
  }

  function token(state, index, value) {
    const wrap = document.createElement("div");
    wrap.className = "grid-token";
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.value = String(value);
    input.min = String(state.min);
    input.max = String(state.max);
    input.step = "1";
    input.classList.toggle("is-invalid", !isValidNumber(Number(value), state));
    input.addEventListener("blur", function () {
      state.values[index] = Number(input.value);
      sortValues(state);
      render(wrap.closest(".grid-editor"), state);
      notify(state);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small-icon state-layer";
    remove.textContent = "✕";
    remove.disabled = state.values.length <= 1;
    remove.setAttribute("aria-label", "Remove " + state.label + " value");
    remove.addEventListener("click", function () {
      state.values.splice(index, 1);
      render(wrap.closest(".grid-editor"), state);
      notify(state);
    });
    wrap.appendChild(input);
    wrap.appendChild(remove);
    return wrap;
  }

  function sortValues(state) {
    state.values.sort(function (a, b) {
      return a - b;
    });
  }

  function validValues(state) {
    return state.values.filter(function (value) {
      return isValidNumber(value, state);
    });
  }

  function isValidNumber(value, state) {
    return Number.isInteger(value) && value >= state.min && value <= state.max;
  }

  function errorText(state) {
    if (state.values.length === 0) return "At least one value is required.";
    const invalid = state.values.filter(function (value) {
      return !isValidNumber(value, state);
    });
    if (invalid.length === 0) return "";
    return "Use whole numbers from " + String(state.min) + " to " + String(state.max) + ".";
  }

  function notify(state) {
    if (state.onChange) state.onChange();
  }

  Polarrecorder.GridEditor = { Create: create };
}());

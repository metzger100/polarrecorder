/**
 * @file Export Presets
 * Documentation: documentation/architecture/ui.md
 * Depends: viewer.js, grid-editor.js
 */
window.Polarrecorder = window.Polarrecorder || {};
(function () {
  "use strict";

  const Polarrecorder = window.Polarrecorder;

  /** @typedef {{name: string, builtin: boolean, twa: number[], tws: number[]}} Preset */
  /**
   * @typedef {{
   *   Element: HTMLElement,
   *   Values: () => number[],
   *   IsValid: () => boolean,
   *   SetValues: (values: number[]) => void
   * }} GridEditorHandle
   */
  /** @typedef {{twa: GridEditorHandle, tws: GridEditorHandle}} EditorPair */

  /**
   * @typedef {{
   *   selected: string,
   *   twaEditor: GridEditorHandle | null,
   *   twsEditor: GridEditorHandle | null,
   *   onEditorChange: (() => void) | null
   * }} PresetsState
   */

  /** @type {PresetsState} */
  const state = {
    selected: "DefaultStarboard180",
    twaEditor: null,
    twsEditor: null,
    onEditorChange: null
  };

  /** @param {() => void} onEditorChange */
  function configure(onEditorChange) {
    state.onEditorChange = onEditorChange;
  }

  /** @returns {Preset[]} */
  function all() {
    return Polarrecorder["PresetsCache"];
  }

  /** @returns {Preset[]} */
  function sorted() {
    const presets = all().slice();
    return presets.sort(function (a, b) {
      if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
      if (a.builtin && b.builtin) return 0;
      return a.name.localeCompare(b.name);
    });
  }

  /** @returns {string} */
  function selected() {
    return state.selected;
  }

  /** @param {string} name */
  function setSelected(name) {
    state.selected = name;
  }

  /** @returns {Preset} */
  function selectedPreset() {
    return (
      all().find(function (preset) {
        return preset.name === state.selected;
      }) || all()[0]
    );
  }

  /** @returns {EditorPair} */
  function ensureEditors() {
    if (!state.twaEditor || !state.twsEditor) {
      const preset = selectedPreset();
      const onChange = state.onEditorChange || function () {};
      state.twaEditor = Polarrecorder.GridEditor.Create({
        label: "TWA grid",
        min: 0,
        max: 359,
        step: 10,
        values: preset.twa,
        onChange: onChange
      });
      state.twsEditor = Polarrecorder.GridEditor.Create({
        label: "TWS grid",
        min: 1,
        max: 60,
        step: 2,
        values: preset.tws,
        onChange: onChange
      });
    }
    return {
      twa: /** @type {GridEditorHandle} */ (state.twaEditor),
      tws: /** @type {GridEditorHandle} */ (state.twsEditor)
    };
  }

  function loadSelected() {
    const editors = ensureEditors();
    const preset = selectedPreset();
    editors.twa.SetValues(preset.twa);
    editors.tws.SetValues(preset.tws);
  }

  /** @returns {boolean} */
  function isValid() {
    const editors = ensureEditors();
    return editors.twa.IsValid() && editors.tws.IsValid();
  }

  Polarrecorder.ExportPresets = {
    Configure: configure,
    All: all,
    Sorted: sorted,
    Selected: selected,
    SetSelected: setSelected,
    SelectedPreset: selectedPreset,
    Editors: ensureEditors,
    LoadSelected: loadSelected,
    IsValid: isValid
  };
})();

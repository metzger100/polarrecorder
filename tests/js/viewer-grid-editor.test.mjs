/**
 * Behavioral tests for viewer/grid-editor.js.
 *
 * The editor's interactive handlers -- add, edit-on-blur, and remove -- plus value
 * sorting, change notification, and the empty/invalid error text were previously
 * reached by no viewer test; grid-editor.js was only ever loaded as a dependency of
 * another module's tests. These drive the real script through the shared fake-DOM
 * harness.
 */

import assert from "node:assert/strict";
import { test } from "vitest";

import { createEnvironment, loadViewerFile } from "../../tools/viewer-harness.mjs";

/** @typedef {import("../../tools/viewer-harness.mjs").FakeElement} FakeElement */
/**
 * @typedef {{
 *   Element: FakeElement,
 *   Values: () => number[],
 *   IsValid: () => boolean,
 *   SetValues: (values: number[]) => void
 * }} GridEditor
 */

/**
 * @param {Partial<{label: string, min: number, max: number, step: number, values: number[], onChange: () => void}>} [overrides]
 * @returns {{label: string, min: number, max: number, step: number, values: number[], onChange?: () => void}}
 */
function gridOptions(overrides = {}) {
  return { label: "TWA", min: 0, max: 180, step: 10, values: [30, 60], ...overrides };
}

/**
 * @param {{label: string, min: number, max: number, step: number, values: number[], onChange?: () => void}} options
 * @returns {GridEditor}
 */
function createEditor(options) {
  const env = createEnvironment();
  loadViewerFile(env, "placeholders.js");
  loadViewerFile(env, "dom.js");
  loadViewerFile(env, "grid-editor.js");
  const namespace = /** @type {{GridEditor: {Create: (opts: unknown) => GridEditor}}} */ (
    /** @type {unknown} */ (env.window.Polarrecorder)
  );
  return namespace.GridEditor.Create(options);
}

/**
 * @param {GridEditor} editor
 * @returns {FakeElement[]}
 */
function tokens(editor) {
  return editor.Element.querySelectorAll(".grid-token");
}

/**
 * The add button is the last child of the value row, after every value token.
 * @param {GridEditor} editor
 * @returns {FakeElement}
 */
function addButton(editor) {
  const row = editor.Element.querySelector(".grid-row");
  assert.ok(row, "expected a .grid-row");
  const button = row.children[row.children.length - 1];
  assert.equal(button.tagName, "button", "expected the add button last in the row");
  return button;
}

/**
 * @param {FakeElement} token
 * @param {string} tagName
 * @returns {FakeElement}
 */
function childByTag(token, tagName) {
  const found = token.children.find(function (child) {
    return child.tagName === tagName;
  });
  assert.ok(found, `expected a <${tagName}> inside the token`);
  return found;
}

/**
 * @param {GridEditor} editor
 * @returns {string}
 */
function errorText(editor) {
  const node = editor.Element.querySelector(".error-text");
  assert.ok(node, "expected an .error-text paragraph");
  return node.textContent;
}

test("the add button appends one step past the last value and re-sorts", () => {
  let changes = 0;
  const editor = createEditor(
    gridOptions({
      values: [60, 30],
      onChange() {
        changes += 1;
      }
    })
  );
  assert.deepEqual(editor.Values(), [60, 30], "create must not reorder the caller's values");

  addButton(editor).click();

  assert.deepEqual(editor.Values(), [30, 40, 60], "30 + step, then sorted");
  assert.equal(changes, 1, "adding a value notifies once");
});

test("the add button clamps the new value at the configured maximum", () => {
  const editor = createEditor(gridOptions({ values: [180] }));

  addButton(editor).click();

  assert.deepEqual(editor.Values(), [180, 180], "180 + step clamps back to the max");
});

test("blurring a value input commits the edit and re-sorts", () => {
  let changes = 0;
  const editor = createEditor(
    gridOptions({
      values: [30, 60],
      onChange() {
        changes += 1;
      }
    })
  );
  const input = childByTag(tokens(editor)[0], "input");
  input.value = "90";
  assert.ok(input.onblur, "expected a blur handler on the value input");

  input.onblur();

  assert.deepEqual(editor.Values(), [60, 90], "the edited value sorts to the end");
  assert.equal(changes, 1, "committing an edit notifies once");
});

test("the remove button drops the value at its own index", () => {
  let changes = 0;
  const editor = createEditor(
    gridOptions({
      values: [30, 60, 90],
      onChange() {
        changes += 1;
      }
    })
  );

  childByTag(tokens(editor)[1], "button").click();

  assert.deepEqual(editor.Values(), [30, 90], "only the middle value is removed");
  assert.equal(changes, 1, "removing a value notifies once");
});

test("the last remaining value cannot be removed", () => {
  const editor = createEditor(gridOptions({ values: [30] }));

  assert.equal(childByTag(tokens(editor)[0], "button").disabled, true);
});

test("an emptied grid is invalid and says at least one value is required", () => {
  const editor = createEditor(gridOptions({ values: [30] }));

  editor.SetValues([]);

  assert.equal(editor.IsValid(), false);
  assert.equal(errorText(editor), "At least one value is required.");
});

test("a non-integer value is invalid and reports the accepted range", () => {
  const editor = createEditor(gridOptions({ values: [30] }));

  editor.SetValues([1.5]);

  assert.equal(editor.IsValid(), false);
  assert.deepEqual(editor.Values(), [], "an invalid value is not reported as a value");
  assert.equal(errorText(editor), "Use whole numbers from 0 to 180.");
});

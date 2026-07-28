/**
 * Self-tests for tools/quality-policy/typecheck-tools.mjs, the permanent strict-typing
 * owner for maintained `tools/**\/*.mjs` quality-tool source files.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import { diffToolSourceInventory, runToolsTypecheck } from "../../tools/quality-policy/typecheck-tools.mjs";

const ROOT = process.cwd();

test("inventory matches on the real repo", () => {
  const { missingFromInventory, extraInInventory } = diffToolSourceInventory(ROOT);
  assert.deepEqual(missingFromInventory, []);
  assert.deepEqual(extraInInventory, []);
});

test("detects a tool file missing from the inventory", () => {
  const root = makeFakeToolsRoot(["tools/a.mjs"], ["tools/a.mjs", "tools/b.mjs"]);
  const { missingFromInventory, extraInInventory } = diffToolSourceInventory(root);
  assert.deepEqual(missingFromInventory, ["tools/b.mjs"]);
  assert.deepEqual(extraInInventory, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("detects a stale inventory entry", () => {
  const root = makeFakeToolsRoot(["tools/a.mjs", "tools/removed.mjs"], ["tools/a.mjs"]);
  const { missingFromInventory, extraInInventory } = diffToolSourceInventory(root);
  assert.deepEqual(missingFromInventory, []);
  assert.deepEqual(extraInInventory, ["tools/removed.mjs"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the real repo tool source typechecks clean", () => {
  const result = runToolsTypecheck({ print: false });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingFromInventory, []);
  assert.deepEqual(result.extraInInventory, []);
  assert.ok(result.checkedFiles >= 40);
});

/**
 * @param {string[]} configuredPaths repository-relative paths (e.g. "tools/a.mjs")
 * @param {string[]} livePaths repository-relative paths
 * @returns {string}
 */
function makeFakeToolsRoot(configuredPaths, livePaths) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-typecheck-tools-"));
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  for (const rel of livePaths) {
    fs.writeFileSync(path.join(root, rel), "export const probe = 1;\n");
  }
  fs.writeFileSync(
    path.join(root, "tsconfig.tools.json"),
    JSON.stringify({
      compilerOptions: { allowJs: true, checkJs: true, strict: true, noEmit: true },
      files: configuredPaths
    })
  );
  return root;
}

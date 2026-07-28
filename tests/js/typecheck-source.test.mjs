/**
 * Self-tests for tools/quality-policy/typecheck-source.mjs, the permanent
 * strict-typing owner for shipped JavaScript source files. Covers the inventory-diff
 * mechanism plus the five negative contract fixtures this owner requires: a new
 * viewer file omitted from the inventory, a misspelled namespace method, a nullable DOM
 * value used without narrowing, runtime import/export drift, and an incompatible mock
 * payload -- each proven both to fail on the bad shape and to pass on the clean shape.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import { diffSourceInventory, runSourceTypecheck } from "../../tools/quality-policy/typecheck-source.mjs";

const ROOT = process.cwd();
const TSC_BIN = path.join(ROOT, "node_modules", ".bin", "tsc");

test("inventory matches on the real repo", () => {
  const { missingFromInventory, extraInInventory } = diffSourceInventory(ROOT);
  assert.deepEqual(missingFromInventory, []);
  assert.deepEqual(extraInInventory, []);
});

test("detects a file missing from the inventory", () => {
  const root = makeFakeRepoRoot(["plugin.js", "viewer/a.js"], ["plugin.js", "viewer/a.js", "viewer/b.js"]);
  const { missingFromInventory, extraInInventory } = diffSourceInventory(root);
  assert.deepEqual(missingFromInventory, ["viewer/b.js"]);
  assert.deepEqual(extraInInventory, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("detects a stale inventory entry", () => {
  const root = makeFakeRepoRoot(["plugin.js", "viewer/a.js", "viewer/removed.js"], ["plugin.js", "viewer/a.js"]);
  const { missingFromInventory, extraInInventory } = diffSourceInventory(root);
  assert.deepEqual(missingFromInventory, []);
  assert.deepEqual(extraInInventory, ["viewer/removed.js"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the real repo source typechecks clean", () => {
  const result = runSourceTypecheck({ print: false });
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingFromInventory, []);
  assert.deepEqual(result.extraInInventory, []);
  assert.ok(result.checkedFiles >= 19);
});

/**
 * @param {string[]} configuredPaths repository-relative paths (e.g. "viewer/a.js")
 * @param {string[]} livePaths repository-relative paths
 * @returns {string}
 */
function makeFakeRepoRoot(configuredPaths, livePaths) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-typecheck-source-"));
  fs.mkdirSync(path.join(root, "viewer"), { recursive: true });
  for (const rel of livePaths) {
    fs.writeFileSync(path.join(root, rel), "window.Polarrecorder = {};\n");
  }
  fs.writeFileSync(
    path.join(root, "tsconfig.checkjs.json"),
    JSON.stringify({
      compilerOptions: { allowJs: true, checkJs: true, strict: true, noEmit: true },
      include: configuredPaths
    })
  );
  return root;
}

/**
 * Runs tsc over a single fixture file with strict checkJs, mirroring
 * tsconfig.checkjs.json's key compiler options, and returns whether it exited clean.
 *
 * @param {string} source
 * @param {string} [extension]
 * @returns {boolean}
 */
function typechecksCleanly(source, extension = ".js") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-tsc-fixture-"));
  try {
    const filePath = path.join(dir, "fixture" + extension);
    fs.writeFileSync(filePath, source);
    const tsconfigPath = path.join(dir, "tsconfig.json");
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "es2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          types: [],
          allowJs: true,
          checkJs: true,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          typeRoots: [path.join(ROOT, "node_modules", "@types")]
        },
        include: [filePath]
      })
    );
    execFileSync(TSC_BIN, ["--noEmit", "-p", tsconfigPath], { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Same as typechecksCleanly, but for a pair of files (e.g. a module and its consumer).
 *
 * @param {Record<string, string>} filesByExtension keyed by filename (e.g. "mod.mjs")
 * @returns {boolean}
 */
function pairTypechecksCleanly(filesByExtension) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-tsc-pair-"));
  try {
    const includePaths = [];
    for (const [name, source] of Object.entries(filesByExtension)) {
      const filePath = path.join(dir, name);
      fs.writeFileSync(filePath, source);
      includePaths.push(filePath);
    }
    const tsconfigPath = path.join(dir, "tsconfig.json");
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "es2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          types: [],
          allowJs: true,
          checkJs: true,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          typeRoots: [path.join(ROOT, "node_modules", "@types")]
        },
        include: includePaths
      })
    );
    execFileSync(TSC_BIN, ["--noEmit", "-p", tsconfigPath], { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("a misspelled namespace method is rejected", () => {
  const source =
    "/**\n" +
    " * @param {HTMLElement} node\n" +
    " */\n" +
    "function clear(node) {\n" +
    "  while (node.firstChild) node.removeChild(node.firstChild);\n" +
    "}\n" +
    "/** @type {{Clear: (node: HTMLElement) => void}} */\n" +
    "const Namespace = { Clear: clear };\n" +
    "Namespace.Cler(document.body);\n";
  assert.equal(typechecksCleanly(source), false);

  const fixed = source.replace("Namespace.Cler(", "Namespace.Clear(");
  assert.equal(typechecksCleanly(fixed), true);
});

test("a nullable DOM value used without narrowing is rejected", () => {
  const unnarrowed = 'document.getElementById("csv-preview").textContent = "value";\n';
  assert.equal(typechecksCleanly(unnarrowed), false);

  const narrowed = 'const node = document.getElementById("csv-preview");\n' + 'if (node) node.textContent = "value";\n';
  assert.equal(typechecksCleanly(narrowed), true);
});

test("runtime import/export drift is rejected", () => {
  const moduleSource = "export function realExport() {\n  return 1;\n}\n";
  const driftedConsumer = 'import { missingExport } from "./module.mjs";\nmissingExport();\n';
  assert.equal(pairTypechecksCleanly({ "module.mjs": moduleSource, "consumer.mjs": driftedConsumer }), false);

  const fixedConsumer = 'import { realExport } from "./module.mjs";\nrealExport();\n';
  assert.equal(pairTypechecksCleanly({ "module.mjs": moduleSource, "consumer.mjs": fixedConsumer }), true);
});

test("an incompatible mock payload is rejected", () => {
  const badPayload =
    "/**\n" +
    " * @param {{stw: number, samples: number}} entry\n" +
    " * @returns {number}\n" +
    " */\n" +
    "function stwOf(entry) {\n" +
    "  return entry.stw;\n" +
    "}\n" +
    'stwOf({ stw: "5", samples: 10 });\n';
  assert.equal(typechecksCleanly(badPayload), false);

  const goodPayload = badPayload.replace('stw: "5"', "stw: 5");
  assert.equal(typechecksCleanly(goodPayload), true);
});

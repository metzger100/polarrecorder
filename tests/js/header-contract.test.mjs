/**
 * Contract test for the parts of the viewer module header that ESLint's
 * `jsdoc/require-file-overview` cannot express: the header must also carry
 * `Documentation:` and `Depends:` lines, and the `Documentation:` target must exist on
 * disk. `jsdoc/require-file-overview` (eslint.config.mjs) is the single maintained owner
 * of the `@file` tag's presence; this is the Vitest contract replacement for the rest of
 * the retired tools/check-headers.mjs, so every assertion it made is preserved: presence
 * of a top header, the `Documentation`/`Depends` fields, and a real Documentation target.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

/**
 * @param {string} content
 * @returns {string | null}
 */
function extractTopHeader(content) {
  let index = 0;
  if (content.charCodeAt(0) === 0xfeff) index = 1;
  while (/\s/.test(content[index] || "")) index += 1;
  if (!content.startsWith("/**", index)) return null;
  const end = content.indexOf("*/", index + 3);
  return end >= 0 ? content.slice(index, end + 2) : null;
}

/**
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, failures: string[], checkedJsFiles: number}}
 */
function runViewerHeaderCheck(options = {}) {
  const root = options.root || process.cwd();
  const viewerRoot = path.join(root, "viewer");
  /** @type {string[]} */
  const failures = [];
  if (!fs.existsSync(viewerRoot)) return { ok: true, failures, checkedJsFiles: 0 };

  const files = fs
    .readdirSync(viewerRoot)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(viewerRoot, name), rel: `viewer/${name}` }));

  for (const file of files) {
    const content = fs.readFileSync(file.abs, "utf8");
    const header = extractTopHeader(content);
    if (!header) {
      failures.push(`${file.rel}: missing top /** ... */ header`);
      continue;
    }
    for (const field of ["Documentation", "Depends"]) {
      if (!new RegExp(`^\\s*\\*\\s*${field}:\\s*.+$`, "m").test(header)) {
        failures.push(`${file.rel}: header missing ${field}`);
      }
    }
    const docMatch = header.match(/^\s*\*\s*Documentation:\s*(.+?)\s*$/m);
    if (docMatch) {
      const docPath = docMatch[1].trim().replace(/[?#].*$/, "");
      if (!fs.existsSync(path.join(root, docPath))) {
        failures.push(`${file.rel}: Documentation target does not exist: ${docPath}`);
      }
    }
  }

  return { ok: failures.length === 0, failures, checkedJsFiles: files.length };
}

const ROOT = process.cwd();

/**
 * @param {string} content
 * @returns {string}
 */
function makeFakeRoot(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-viewer-header-"));
  fs.mkdirSync(path.join(root, "viewer"), { recursive: true });
  fs.writeFileSync(path.join(root, "viewer", "probe.js"), content);
  return root;
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("the real repo's viewer headers all pass", () => {
  const result = runViewerHeaderCheck({ root: ROOT });
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.ok(result.checkedJsFiles >= 15);
});

test("a header with Documentation and Depends pointing at a real file passes", () => {
  const root = makeFakeRoot(
    ["/**", " * @file Probe", " * Documentation: docs/probe.md", " * Depends: none", " */", ""].join("\n")
  );
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "probe.md"), "# Probe\n");
  const result = runViewerHeaderCheck({ root });
  assert.equal(result.ok, true, result.failures.join("\n"));
  cleanup(root);
});

test("a missing top header fails", () => {
  const root = makeFakeRoot("window.Polarrecorder = {};\n");
  const result = runViewerHeaderCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("missing top")));
  cleanup(root);
});

test("a header missing the Depends field fails", () => {
  const root = makeFakeRoot(["/**", " * @file Probe", " * Documentation: AGENTS.md", " */", ""].join("\n"));
  const result = runViewerHeaderCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("missing Depends")));
  cleanup(root);
});

test("a Documentation target that does not exist on disk fails", () => {
  const root = makeFakeRoot(
    ["/**", " * @file Probe", " * Documentation: documentation/does-not-exist.md", " * Depends: none", " */", ""].join(
      "\n"
    )
  );
  const result = runViewerHeaderCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("does not exist")));
  cleanup(root);
});

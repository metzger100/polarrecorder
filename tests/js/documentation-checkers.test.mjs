/**
 * Self-tests for the exported `run*` entry points of `tools/check-docs.mjs`,
 * `tools/check-doc-format.mjs`, and `tools/check-doc-reachability.mjs`: real-repo clean
 * cases plus temporary-root failures for a missing TOC registration, a missing required
 * section, a broken file link, a broken fragment (via `check-doc-links.mjs`), and an
 * unreachable document.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runDocsCheck } from "../../tools/check-docs.mjs";
import { runDocFormatCheck } from "../../tools/check-doc-format.mjs";
import { runDocReachabilityCheck } from "../../tools/check-doc-reachability.mjs";
import { discoverSeedMarkdownFiles, runDocLinksCheck } from "../../tools/check-doc-links.mjs";

const ROOT = process.cwd();

test("every Prettier-owned Markdown file is a Linkinator seed", () => {
  const scope = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tools", "quality-policy", "format-scope.json"), "utf8")
  );
  const prettierMarkdown = scope.rows
    .filter(
      (/** @type {{owner: string, path: string}} */ row) =>
        row.owner === "prettier" && row.path.endsWith(".md")
    )
    .map((/** @type {{path: string}} */ row) => row.path)
    .sort();
  assert.deepEqual(discoverSeedMarkdownFiles(ROOT), prettierMarkdown);
});

/** @returns {string} */
function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-doc-checkers-"));
}

/**
 * @param {string} root
 * @returns {void}
 */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

/**
 * A minimal, fully valid doc tree: one doc, linked from a TOC, reachable from AGENTS.md.
 *
 * @param {string} root
 * @returns {void}
 */
function writeValidDocTree(root) {
  fs.mkdirSync(path.join(root, "documentation"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "AGENTS.md"),
    ["# Agents", "", "See [TOC](documentation/TABLEOFCONTENTS.md).", ""].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "documentation", "TABLEOFCONTENTS.md"),
    [
      "# TOC",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "## Key Details",
      "",
      "## Related",
      "",
      "- [Guide](guide.md)",
      ""
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    [
      "# Guide",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "## Key Details",
      "",
      "## Related",
      ""
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "format-scope.json"),
    JSON.stringify({
      rows: [
        { path: "AGENTS.md", owner: "prettier" },
        { path: "documentation/TABLEOFCONTENTS.md", owner: "prettier" },
        { path: "documentation/guide.md", owner: "prettier" }
      ]
    })
  );
}

test("check-docs: real repo passes", () => {
  const result = runDocsCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true);
});

test("check-docs: a valid temp doc tree passes", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  const result = runDocsCheck({ root, print: false });
  assert.equal(result.ok, true);
  cleanup(root);
});

test("check-docs: a doc missing from the TOC fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "orphan.md"),
    [
      "# Orphan",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "## Key Details",
      "",
      "## Related",
      ""
    ].join("\n")
  );
  const result = runDocsCheck({ root, print: false });
  assert.equal(result.ok, false);
  cleanup(root);
});

test("check-doc-format: real repo passes", () => {
  const result = runDocFormatCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true);
});

test("check-doc-format: a valid temp doc tree passes", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  const result = runDocFormatCheck({ root, print: false });
  assert.equal(result.ok, true);
  cleanup(root);
});

test("check-doc-format: a doc missing a required section fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    ["# Guide", "", "**Status:** Current.", "", "## Overview", ""].join("\n")
  );
  const result = runDocFormatCheck({ root, print: false });
  assert.equal(result.ok, false);
  cleanup(root);
});

test("check-doc-reachability: real repo passes", () => {
  const result = runDocReachabilityCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true);
});

test("check-doc-reachability: a valid temp doc tree passes", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  const result = runDocReachabilityCheck({ root, print: false });
  assert.equal(result.ok, true);
  cleanup(root);
});

test("check-doc-reachability: a broken file link fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    [
      "# Guide",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "See [missing](missing.md).",
      "",
      "## Key Details",
      "",
      "## Related",
      ""
    ].join("\n")
  );
  const result = runDocReachabilityCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.brokenLinks >= 1);
  cleanup(root);
});

test("check-doc-reachability: an unreachable document fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "unreachable.md"),
    [
      "# Unreachable",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "## Key Details",
      "",
      "## Related",
      ""
    ].join("\n")
  );
  const result = runDocReachabilityCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.orphans >= 1);
  cleanup(root);
});

test("check-doc-links: a broken fragment fails", () => {
  const root = makeTempRoot();
  writeValidDocTree(root);
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    [
      "# Guide",
      "",
      "**Status:** Current.",
      "",
      "## Overview",
      "",
      "See [missing section](guide.md#does-not-exist).",
      "",
      "## Key Details",
      "",
      "## Related",
      ""
    ].join("\n")
  );
  return runDocLinksCheck({ root, print: false }).then((result) => {
    assert.equal(result.ok, false);
    cleanup(root);
  });
});

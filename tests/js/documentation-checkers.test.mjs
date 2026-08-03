/**
 * Self-tests for the exported `run*` entry points of `tools/check-doc-links.mjs`, the one
 * bespoke documentation checker not yet migrated into a Vitest contract test (Phase F3
 * externalizes its Linkinator options but keeps the seed-selection logic here). The
 * doc-format, doc-TOC, and doc-reachability concerns now live in their own contract
 * tests: doc-format-contract.test.mjs, doc-toc-contract.test.mjs, and
 * doc-reachability-contract.test.mjs.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { discoverSeedMarkdownFiles, runDocLinksCheck } from "../../tools/check-doc-links.mjs";
import { runFormatScopeGeneration } from "../../tools/quality-policy/generate-format-scope.mjs";

const ROOT = process.cwd();

test("every Prettier-owned Markdown file is a Linkinator seed", () => {
  const prettierMarkdown = runFormatScopeGeneration(ROOT)
    .filter((row) => row.owner === "prettier" && row.path.endsWith(".md"))
    .map((row) => row.path)
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
    ["# Guide", "", "**Status:** Current.", "", "## Overview", "", "## Key Details", "", "## Related", ""].join("\n")
  );
}

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

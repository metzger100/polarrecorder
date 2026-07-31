/**
 * Contract test for `docs:check`'s composition: the command name means "every documentation
 * gate" (lint, links, links-proof, TOC, format, reachability, smell-catalog, and the
 * `AGENTS.md`/`CLAUDE.md` pointer contract), not just the three original Linkinator/markdownlint
 * rungs. Each documentation contract test also keeps running inside `test:tools`, so this
 * assertion only needs to prove the *wiring*, not duplicate the contracts themselves.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const ROOT = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const REQUIRED_DOCS_CHECK_TOKENS = [
  "docs:lint",
  "docs:links:proof",
  "docs:links",
  "docs:format",
  "docs:reachability",
  "docs:toc",
  "docs:smell-catalog",
  "docs:pointer"
];

const EXPECTED_TEST_FILE_BY_SCRIPT = {
  "docs:format": "tests/js/doc-format-contract.test.mjs",
  "docs:reachability": "tests/js/doc-reachability-contract.test.mjs",
  "docs:toc": "tests/js/doc-toc-contract.test.mjs",
  "docs:smell-catalog": "tests/js/smell-catalog-contract.test.mjs",
  "docs:pointer": "tests/js/agents-pointer.test.mjs"
};

test("docs:check composes every required documentation gate token", () => {
  const body = PKG.scripts["docs:check"];
  assert.ok(body, "docs:check must be defined");
  const tokens = [...body.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
  for (const required of REQUIRED_DOCS_CHECK_TOKENS) {
    assert.ok(tokens.includes(required), `docs:check must run ${required}`);
  }
});

test("each documentation-contract rung points at the real test file it wires", () => {
  for (const [script, testFile] of Object.entries(EXPECTED_TEST_FILE_BY_SCRIPT)) {
    const body = PKG.scripts[script];
    assert.ok(body, `${script} must be defined`);
    assert.ok(body.includes(testFile), `${script} must invoke ${testFile}`);
    assert.ok(fs.existsSync(path.join(ROOT, testFile)), `${testFile} referenced by ${script} must exist`);
  }
});

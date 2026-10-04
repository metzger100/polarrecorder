/**
 * Contract test for `docs:check`'s composition: it runs exactly the three documentation gates
 * that live outside Vitest (markdownlint, the Linkinator fixture proof, and the root-seeded
 * link check). The five documentation contract tests (TOC, format, reachability,
 * smell-catalog, and the `AGENTS.md`/`CLAUDE.md` pointer contract) run once, inside the
 * `tools` Vitest project of `test:tools`; their `docs:*` convenience scripts stay runnable
 * individually but are not composed into `docs:check`, so no gate runs them twice.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const ROOT = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const DOCS_CHECK_TOKENS = ["docs:lint", "docs:links:proof", "docs:links"];

const EXPECTED_TEST_FILE_BY_SCRIPT = {
  "docs:format": "tests/js/doc-format-contract.test.mjs",
  "docs:reachability": "tests/js/doc-reachability-contract.test.mjs",
  "docs:toc": "tests/js/doc-toc-contract.test.mjs",
  "docs:smell-catalog": "tests/js/smell-catalog-contract.test.mjs",
  "docs:pointer": "tests/js/agents-pointer.test.mjs"
};

test("docs:check runs exactly the non-Vitest documentation gates, in order", () => {
  const body = PKG.scripts["docs:check"];
  assert.ok(body, "docs:check must be defined");
  const steps = body.split(" && ");
  assert.deepEqual(
    steps,
    DOCS_CHECK_TOKENS.map((token) => `npm run ${token}`)
  );
  assert.ok(!body.includes("vitest"), "docs:check must not re-run Vitest contract files");
});

test("each documentation-contract convenience script points at the real test file", () => {
  for (const [script, testFile] of Object.entries(EXPECTED_TEST_FILE_BY_SCRIPT)) {
    const body = PKG.scripts[script];
    assert.ok(body, `${script} must be defined`);
    assert.ok(body.includes(testFile), `${script} must invoke ${testFile}`);
    assert.ok(fs.existsSync(path.join(ROOT, testFile)), `${testFile} referenced by ${script} must exist`);
  }
});

test("every documentation contract test runs inside the tools project of test:tools", () => {
  assert.equal(PKG.scripts["test:tools"], "vitest run --project tools");
  for (const testFile of Object.values(EXPECTED_TEST_FILE_BY_SCRIPT)) {
    const name = path.basename(testFile);
    assert.ok(testFile.startsWith("tests/js/") && name.endsWith(".test.mjs"), testFile);
    assert.ok(!name.startsWith("viewer-") && !name.startsWith("plugin-"), `${testFile} must not be claimed elsewhere`);
  }
});

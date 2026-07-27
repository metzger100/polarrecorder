#!/usr/bin/env node

/**
 * Fixture proof that `tools/check-doc-links.mjs` fails closed: a temporary doc tree with a
 * missing local file link and a missing local Markdown fragment must report broken links,
 * and an otherwise-identical clean fixture must pass. Runs ahead of the real scan in
 * `docs:check` so a Linkinator regression is caught before it can hide behind a clean repo.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDocLinksCheck } from "./check-doc-links.mjs";

/**
 * @param {{broken: boolean}} options
 * @returns {string}
 */
function makeFixtureRoot({ broken }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-doc-links-proof-"));
  fs.mkdirSync(path.join(root, "documentation"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  const fileTarget = broken ? "missing-target.md" : "documentation/other.md";
  const fragmentTarget = broken ? "missing-section" : "real-section";
  fs.writeFileSync(
    path.join(root, "README.md"),
    [
      "# Fixture root",
      "",
      `See [a file link](${fileTarget}) and [a fragment link](README.md#${fragmentTarget}).`,
      "",
      "## Real Section",
      ""
    ].join("\n")
  );
  fs.writeFileSync(path.join(root, "documentation", "other.md"), "# Other\n");
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "format-scope.json"),
    JSON.stringify({
      rows: [
        { path: "README.md", owner: "prettier" },
        { path: "documentation/other.md", owner: "prettier" }
      ]
    })
  );
  return root;
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {Promise<{ok: boolean, failures: string[]}>}
 */
export async function runDocLinksProof(options = {}) {
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];

  const cleanRoot = makeFixtureRoot({ broken: false });
  const cleanResult = await runDocLinksCheck({ root: cleanRoot, print: false });
  if (!cleanResult.ok) {
    failures.push("a clean fixture with real link/fragment targets was reported as broken");
  }
  fs.rmSync(cleanRoot, { recursive: true, force: true });

  const brokenRoot = makeFixtureRoot({ broken: true });
  const brokenResult = await runDocLinksCheck({ root: brokenRoot, print: false });
  if (brokenResult.ok) {
    failures.push(
      "a fixture with a missing file link and a missing fragment was not reported as broken"
    );
  } else if (brokenResult.broken.length < 2) {
    failures.push(
      `expected both the missing file and missing fragment to be reported broken; got ${brokenResult.broken.length}`
    );
  }
  fs.rmSync(brokenRoot, { recursive: true, force: true });

  const ok = failures.length === 0;
  if (print) {
    if (ok) {
      console.log(
        "Documentation link fixture proof passed: clean fixture ok, broken fixture caught."
      );
    } else {
      console.error("Documentation link fixture proof failed:\n");
      for (const failure of failures) console.error(`- ${failure}`);
    }
  }
  return { ok, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDocLinksProof().then((result) => {
    process.exitCode = result.ok ? 0 : 1;
  });
}

#!/usr/bin/env node

/**
 * Root-seeded Linkinator scan over root Markdown, `documentation/**`, and active exec-plans.
 * External `http(s)://` targets are skipped (never fetched); local file links and local
 * Markdown-heading fragments are checked for real. A naive single-file or repo-root
 * Linkinator invocation either checks only its one seed file or, without a host-aware skip
 * pattern, marks every locally-served page `SKIPPED` (Linkinator serves local Markdown
 * through its own ephemeral `http://localhost:<port>` origin, which a bare `/^https?:\/\//`
 * skip pattern also matches) -- both were verified live before this file was written.
 * Fragment/link parsing itself stays fully owned by Linkinator; static options (including the
 * host-aware skip pattern) live in `linkinator.config.json`, the converged owner; this file
 * only selects seeds and merges them into that config at call time.
 */

import fs from "node:fs";
import path from "node:path";
import { check } from "linkinator";
import { runDocumentationLinkPolicy } from "./portable-core/doc-link-engine.mjs";
import { runFormatScopeGeneration } from "./quality-policy/generate-format-scope.mjs";

/**
 * Every maintained Markdown file that Prettier owns, sourced directly from the single
 * in-process `format-scope` classification (not a second hand-rolled directory walk) so the
 * maintained-Markdown set behind `docs:lint`, `format:check`, and this Linkinator scan can
 * never drift apart. Historical files (completed plans, release notes) are already excluded
 * there.
 *
 * @param {string} root
 * @returns {string[]}
 */
export function discoverSeedMarkdownFiles(root) {
  return runFormatScopeGeneration(root)
    .filter((row) => row.owner === "prettier" && row.path.endsWith(".md"))
    .map((row) => row.path)
    .sort();
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {Promise<{ok: boolean, seeds: string[], links: number, broken: {url: string, parent?: string}[]}>}
 */
export async function runDocLinksCheck(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  const seeds = discoverSeedMarkdownFiles(root);
  // linkinator.config.json is a fixed project config, not part of the (possibly fake) scan
  // root under test, so it is always read from the real repository root.
  const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "linkinator.config.json"), "utf8"));

  const result = await check({
    ...config,
    path: seeds,
    serverRoot: root
  });

  const broken = result.links
    .filter((link) => link.state === "BROKEN")
    .map((link) => ({ url: link.url, parent: link.parent }));
  const policy = runDocumentationLinkPolicy({ broken: broken.map((link) => `${link.parent || "seed"}: ${link.url}`) });
  const ok = policy.ok;

  if (print) {
    if (ok) {
      console.log(
        `Documentation link check passed: ${seeds.length} seeded file(s), ${result.links.length} link(s) checked.`
      );
    } else {
      console.error("Documentation link check failed:\n");
      for (const link of broken) {
        console.error(`- ${link.url} (linked from ${link.parent || "a seed file"})`);
      }
    }
  }

  return { ok, seeds, links: result.links.length, broken };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDocLinksCheck().then((result) => {
    process.exitCode = result.ok ? 0 : 1;
  });
}

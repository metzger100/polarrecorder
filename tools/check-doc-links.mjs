#!/usr/bin/env node

/**
 * Root-seeded Linkinator scan over root Markdown, `documentation/**`, and active exec-plans.
 * External `http(s)://` targets are skipped (never fetched); local file links and local
 * Markdown-heading fragments are checked for real. A naive single-file or repo-root
 * Linkinator invocation either checks only its one seed file or, without a host-aware skip
 * predicate, marks every locally-served page `SKIPPED` (Linkinator serves local Markdown
 * through its own ephemeral `http://localhost:<port>` origin, which a bare `/^https?:\/\//`
 * skip pattern also matches) -- both were verified live before this file was written.
 * Fragment/link parsing itself stays fully owned by Linkinator; this file only selects seeds.
 */

import fs from "node:fs";
import path from "node:path";
import { check } from "linkinator";

const LOCAL_LINKINATOR_HOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i;

/**
 * @param {string} link
 * @returns {Promise<boolean>}
 */
async function isExternalLink(link) {
  return /^https?:\/\//i.test(link) && !LOCAL_LINKINATOR_HOST_PATTERN.test(link);
}

/**
 * Every maintained Markdown file that Prettier owns, sourced directly from the single
 * `format-scope.json` inventory (not a second hand-rolled directory walk) so the
 * maintained-Markdown set behind `docs:lint`, `format:check`, and this Linkinator scan can
 * never drift apart. Historical files (completed plans, release notes) are already excluded
 * there.
 *
 * @param {string} root
 * @returns {string[]}
 */
export function discoverSeedMarkdownFiles(root) {
  const scopePath = path.join(root, "tools", "quality-policy", "format-scope.json");
  const scope = JSON.parse(fs.readFileSync(scopePath, "utf8"));
  return scope.rows
    .filter(
      (/** @type {{owner: string, path: string}} */ row) =>
        row.owner === "prettier" && row.path.endsWith(".md")
    )
    .map((/** @type {{path: string}} */ row) => row.path)
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

  const result = await check({
    path: seeds,
    serverRoot: root,
    recurse: true,
    markdown: true,
    checkFragments: true,
    linksToSkip: isExternalLink
  });

  const broken = result.links
    .filter((link) => link.state === "BROKEN")
    .map((link) => ({ url: link.url, parent: link.parent }));
  const ok = broken.length === 0;

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

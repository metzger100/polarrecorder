#!/usr/bin/env node

/**
 * Actionlint-backed parsed-workflow contract for
 * `.github/workflows/publish-release.yml`.
 *
 * actionlint (`npm run actions:lint`) proves the workflow is syntactically valid
 * GitHub Actions YAML; this proves it is *exactly* the reviewed, minimal publisher
 * boundary -- the sole job, its complete ordered step list, every `uses` identity
 * (pinned to a full commit SHA with a readable version comment), the checkout/release
 * step fields, and the two normalized `run` lines must equal this file's allowlist
 * byte-for-byte. Any extra workflow, job, step, `uses`, `run` line, permission,
 * trigger, or artifact fails closed instead of silently passing forbidden-string
 * checks alone.
 */

import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

const WORKFLOWS_DIR = ".github/workflows";
const EXPECTED_FILE = "publish-release.yml";

const FULL_SHA_WITH_COMMENT = /^([\w./-]+)@([0-9a-f]{40})\s*#\s*v[\w.-]+\s*$/;

const EXPECTED_STEPS = [
  {
    name: "Checkout repository at tag ref",
    usesRepo: "actions/checkout",
    with: { ref: "${{ github.ref }}" }
  },
  {
    name: "Validate release tag",
    id: "release_version",
    run: 'node tools/release-version.mjs --github-output "$GITHUB_REF_NAME" >> "$GITHUB_OUTPUT"'
  },
  {
    name: "Verify committed release artifacts",
    id: "release_assets",
    runStartsWith: "set -euo pipefail"
  },
  {
    name: "Create GitHub Release",
    usesRepo: "softprops/action-gh-release",
    with: {
      tag_name: "${{ github.ref_name }}",
      name: "Polar Recorder v${{ steps.release_assets.outputs.version }}",
      body_path: "${{ steps.release_assets.outputs.notes_path }}",
      files: "${{ steps.release_assets.outputs.zip_path }}",
      prerelease: "${{ steps.release_version.outputs.prerelease }}"
    }
  }
];

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runPublisherWorkflowCheck(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];

  const workflowsPath = path.join(root, WORKFLOWS_DIR);
  const files = fs.existsSync(workflowsPath) ? fs.readdirSync(workflowsPath).sort() : [];
  if (files.length !== 1 || files[0] !== EXPECTED_FILE) {
    failures.push(
      `${WORKFLOWS_DIR} must contain exactly one file, '${EXPECTED_FILE}'; found: ${files.join(", ") || "(none)"}`
    );
    return finish(failures, print);
  }

  const filePath = path.join(workflowsPath, EXPECTED_FILE);
  const text = fs.readFileSync(filePath, "utf8");
  const doc = /** @type {any} */ (loadYaml(text));

  checkTriggerAndPermissions(doc, failures);
  checkSingleJob(doc, text, failures);

  return finish(failures, print);
}

/**
 * @param {any} doc
 * @param {string[]} failures
 * @returns {void}
 */
function checkTriggerAndPermissions(doc, failures) {
  const tags = doc?.on?.push?.tags;
  if (!Array.isArray(tags) || tags.length !== 1 || tags[0] !== "v*") {
    failures.push('trigger must be exactly `on.push.tags: ["v*"]`');
  }
  if (Object.keys(doc?.on || {}).length !== 1 || !("push" in (doc?.on || {}))) {
    failures.push("trigger must have no event besides `push`");
  }
  if (doc?.permissions?.contents !== "read" || Object.keys(doc.permissions).length !== 1) {
    failures.push("top-level permissions must be exactly `contents: read`");
  }
  if (!doc?.concurrency?.group?.includes("${{ github.ref }}")) {
    failures.push("concurrency group must be ref-scoped");
  }
  if (doc?.concurrency?.["cancel-in-progress"] !== false) {
    failures.push("concurrency must be non-canceling (`cancel-in-progress: false`)");
  }
}

/**
 * @param {any} doc
 * @param {string} rawText
 * @param {string[]} failures
 * @returns {void}
 */
function checkSingleJob(doc, rawText, failures) {
  const jobs = doc?.jobs || {};
  const jobIds = Object.keys(jobs);
  if (jobIds.length !== 1 || jobIds[0] !== "publish-release") {
    failures.push(
      `jobs must contain exactly one job, 'publish-release'; found: ${jobIds.join(", ")}`
    );
    return;
  }
  const job = jobs["publish-release"];
  if ("needs" in job) {
    failures.push("the job must not declare `needs`");
  }
  if (job["timeout-minutes"] !== 10) {
    failures.push("the job must set `timeout-minutes: 10`");
  }
  if (job.permissions?.contents !== "write" || Object.keys(job.permissions || {}).length !== 1) {
    failures.push("the job must set exactly `permissions.contents: write`");
  }

  const steps = job.steps || [];
  if (steps.length !== EXPECTED_STEPS.length) {
    failures.push(`expected exactly ${EXPECTED_STEPS.length} steps; found ${steps.length}`);
  }
  EXPECTED_STEPS.forEach((expected, index) => {
    checkStep(expected, steps[index], index, rawText, failures);
  });
}

/**
 * @param {any} expected
 * @param {any} actual
 * @param {number} index
 * @param {string} rawText
 * @param {string[]} failures
 * @returns {void}
 */
function checkStep(expected, actual, index, rawText, failures) {
  if (!actual) {
    failures.push(`step ${index + 1} ('${expected.name}') is missing`);
    return;
  }
  if (actual.name !== expected.name) {
    failures.push(`step ${index + 1}: expected name '${expected.name}', got '${actual.name}'`);
  }
  if (expected.id && actual.id !== expected.id) {
    failures.push(`step '${expected.name}': expected id '${expected.id}', got '${actual.id}'`);
  }
  if (expected.usesRepo) {
    checkUses(expected, actual, rawText, failures);
  }
  if (expected.with) {
    for (const [key, value] of Object.entries(expected.with)) {
      if (actual.with?.[key] !== value) {
        failures.push(`step '${expected.name}': with.${key} must be exactly '${value}'`);
      }
    }
    const extraKeys = Object.keys(actual.with || {}).filter((key) => !(key in expected.with));
    if (extraKeys.length > 0) {
      failures.push(`step '${expected.name}': unexpected 'with' keys: ${extraKeys.join(", ")}`);
    }
  }
  if (expected.run) {
    const normalized = String(actual.run || "").trim();
    if (normalized !== expected.run) {
      failures.push(`step '${expected.name}': run line must be exactly '${expected.run}'`);
    }
  }
  if (expected.runStartsWith) {
    const normalized = String(actual.run || "").trim();
    if (!normalized.startsWith(expected.runStartsWith)) {
      failures.push(`step '${expected.name}': run must start with '${expected.runStartsWith}'`);
    }
  }
}

/**
 * @param {any} expected
 * @param {any} actual
 * @param {string} rawText
 * @param {string[]} failures
 * @returns {void}
 */
function checkUses(expected, actual, rawText, failures) {
  const uses = String(actual.uses || "");
  const [repoWithSha] = uses.split("@");
  if (repoWithSha !== expected.usesRepo) {
    failures.push(`step '${expected.name}': uses must be '${expected.usesRepo}@<full SHA>'`);
    return;
  }
  const line = rawText
    .split(/\r?\n/)
    .find((candidate) => candidate.includes(`uses: ${expected.usesRepo}@`));
  const usesValue = line ? line.trim().replace(/^uses:\s*/, "") : "";
  if (!line || !FULL_SHA_WITH_COMMENT.test(usesValue)) {
    failures.push(
      `step '${expected.name}': uses must be pinned to a full 40-character commit SHA with a '# vX.Y.Z' comment`
    );
  }
}

/**
 * @param {string[]} failures
 * @param {boolean} print
 * @returns {{ok: boolean, failures: string[]}}
 */
function finish(failures, print) {
  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[publisher-workflow] ${failure}`);
    } else {
      console.log("Publisher workflow contract check passed.");
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPublisherWorkflowCheck();
  process.exit(result.ok ? 0 : 1);
}

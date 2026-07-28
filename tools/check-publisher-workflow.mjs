#!/usr/bin/env node

/**
 * Actionlint-backed parsed-workflow contract for `.github/workflows/`.
 *
 * actionlint (`npm run actions:lint`) proves each workflow is syntactically valid GitHub
 * Actions YAML; this proves the directory contains *exactly* the two reviewed, minimal
 * workflows -- the transport-only tag publisher and the read-only quality gate -- each
 * matching its own per-file shape contract byte-for-byte: job ids, ordered step lists,
 * every `uses` identity (pinned to a full commit SHA with a readable version comment),
 * step fields, and normalized `run` lines. An unknown third workflow file, an unexpected
 * job id, or an unexpected permission on either file fails closed instead of silently
 * passing forbidden-string checks alone. This is stricter than the retired "exactly one
 * file" contract, never more permissive: any file not named in `ALLOWED_WORKFLOWS` is
 * rejected, and both known files are individually shape-checked when present.
 */

import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

const WORKFLOWS_DIR = ".github/workflows";

const FULL_SHA_WITH_COMMENT = /^([\w./-]+)@([0-9a-f]{40})\s*#\s*v[\w.-]+\s*$/;

const PUBLISH_RELEASE_STEPS = [
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

const QUALITY_STEPS = [
  { name: "Checkout repository", usesRepo: "actions/checkout" },
  { name: "Read Node version", id: "node_version", run: 'echo "version=$(cat .nvmrc)" >> "$GITHUB_OUTPUT"' },
  {
    name: "Set up Node.js",
    usesRepo: "actions/setup-node",
    with: { "node-version": "${{ steps.node_version.outputs.version }}" }
  },
  { name: "Install dependencies", run: "npm ci" },
  { name: "Provision toolchain", run: "npm run setup" },
  { name: "Run quality gate", run: "npm run check:all" }
];

/**
 * @typedef {object} WorkflowContract
 * @property {(doc: any, failures: string[]) => void} checkTriggerAndPermissions
 * @property {string} jobId
 * @property {Record<string, string> | null} jobPermissions
 * @property {number} timeoutMinutes
 * @property {any[]} steps
 */

/** @type {Record<string, WorkflowContract>} */
const ALLOWED_WORKFLOWS = {
  "publish-release.yml": {
    checkTriggerAndPermissions: checkPublishReleaseTriggerAndPermissions,
    jobId: "publish-release",
    jobPermissions: { contents: "write" },
    timeoutMinutes: 10,
    steps: PUBLISH_RELEASE_STEPS
  },
  "quality.yml": {
    checkTriggerAndPermissions: checkQualityTriggerAndPermissions,
    jobId: "quality",
    jobPermissions: null,
    timeoutMinutes: 30,
    steps: QUALITY_STEPS
  }
};

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
  const allowedNames = Object.keys(ALLOWED_WORKFLOWS);
  const unknown = files.filter((name) => !allowedNames.includes(name));
  if (unknown.length > 0) {
    failures.push(`${WORKFLOWS_DIR} contains unknown workflow file(s): ${unknown.join(", ")}`);
  }
  if (!files.includes("publish-release.yml")) {
    failures.push(`${WORKFLOWS_DIR} must contain 'publish-release.yml'`);
  }

  for (const name of allowedNames) {
    if (!files.includes(name)) continue;
    checkWorkflowFile(path.join(workflowsPath, name), ALLOWED_WORKFLOWS[name], failures);
  }

  return finish(failures, print);
}

/**
 * @param {string} filePath
 * @param {WorkflowContract} contract
 * @param {string[]} failures
 * @returns {void}
 */
function checkWorkflowFile(filePath, contract, failures) {
  const text = fs.readFileSync(filePath, "utf8");
  const doc = /** @type {any} */ (loadYaml(text));

  contract.checkTriggerAndPermissions(doc, failures);
  checkSingleJob(doc, text, contract, failures);
}

/**
 * @param {any} doc
 * @param {string[]} failures
 * @returns {void}
 */
function checkPublishReleaseTriggerAndPermissions(doc, failures) {
  const tags = doc?.on?.push?.tags;
  if (!Array.isArray(tags) || tags.length !== 1 || tags[0] !== "v*") {
    failures.push('publish-release.yml: trigger must be exactly `on.push.tags: ["v*"]`');
  }
  if (Object.keys(doc?.on || {}).length !== 1 || !("push" in (doc?.on || {}))) {
    failures.push("publish-release.yml: trigger must have no event besides `push`");
  }
  if (doc?.permissions?.contents !== "read" || Object.keys(doc.permissions).length !== 1) {
    failures.push("publish-release.yml: top-level permissions must be exactly `contents: read`");
  }
  if (!doc?.concurrency?.group?.includes("${{ github.ref }}")) {
    failures.push("publish-release.yml: concurrency group must be ref-scoped");
  }
  if (doc?.concurrency?.["cancel-in-progress"] !== false) {
    failures.push("publish-release.yml: concurrency must be non-canceling (`cancel-in-progress: false`)");
  }
}

/**
 * @param {any} doc
 * @param {string[]} failures
 * @returns {void}
 */
function checkQualityTriggerAndPermissions(doc, failures) {
  if (!("pull_request" in (doc?.on || {}))) {
    failures.push("quality.yml: trigger must include `pull_request`");
  }
  const branches = doc?.on?.push?.branches;
  if (!Array.isArray(branches) || branches.length !== 1 || branches[0] !== "main") {
    failures.push("quality.yml: trigger must push-trigger on exactly `branches: [main]`");
  }
  if (Object.keys(doc?.on || {}).length !== 2) {
    failures.push("quality.yml: trigger must have no event besides `pull_request` and `push`");
  }
  if (doc?.permissions?.contents !== "read" || Object.keys(doc.permissions).length !== 1) {
    failures.push("quality.yml: top-level permissions must be exactly `contents: read`");
  }
  if (!doc?.concurrency?.group?.includes("${{ github.ref }}")) {
    failures.push("quality.yml: concurrency group must be ref-scoped");
  }
  if (doc?.concurrency?.["cancel-in-progress"] !== true) {
    failures.push("quality.yml: concurrency must cancel superseded runs (`cancel-in-progress: true`)");
  }
}

/**
 * @param {any} doc
 * @param {string} rawText
 * @param {Pick<WorkflowContract, "jobId" | "jobPermissions" | "timeoutMinutes" | "steps">} contract
 * @param {string[]} failures
 * @returns {void}
 */
function checkSingleJob(doc, rawText, contract, failures) {
  const jobs = doc?.jobs || {};
  const jobIds = Object.keys(jobs);
  if (jobIds.length !== 1 || jobIds[0] !== contract.jobId) {
    failures.push(`jobs must contain exactly one job, '${contract.jobId}'; found: ${jobIds.join(", ")}`);
    return;
  }
  const job = jobs[contract.jobId];
  if ("needs" in job) {
    failures.push(`${contract.jobId}: the job must not declare 'needs'`);
  }
  if (job["timeout-minutes"] !== contract.timeoutMinutes) {
    failures.push(`${contract.jobId}: the job must set 'timeout-minutes: ${contract.timeoutMinutes}'`);
  }
  if (contract.jobPermissions) {
    const expectedKeys = Object.keys(contract.jobPermissions);
    const actualKeys = Object.keys(job.permissions || {});
    const mismatched = expectedKeys.some((key) => job.permissions?.[key] !== contract.jobPermissions?.[key]);
    if (mismatched || actualKeys.length !== expectedKeys.length) {
      failures.push(`${contract.jobId}: the job must set exactly ${JSON.stringify(contract.jobPermissions)}`);
    }
  } else if (job.permissions) {
    failures.push(`${contract.jobId}: the job must not declare its own 'permissions' (it inherits read-only)`);
  }

  const steps = job.steps || [];
  if (steps.length !== contract.steps.length) {
    failures.push(`${contract.jobId}: expected exactly ${contract.steps.length} steps; found ${steps.length}`);
  }
  contract.steps.forEach((expected, index) => {
    checkStep(contract.jobId, expected, steps[index], index, rawText, failures);
  });
}

/**
 * @param {string} jobId
 * @param {any} expected
 * @param {any} actual
 * @param {number} index
 * @param {string} rawText
 * @param {string[]} failures
 * @returns {void}
 */
function checkStep(jobId, expected, actual, index, rawText, failures) {
  if (!actual) {
    failures.push(`${jobId}: step ${index + 1} ('${expected.name}') is missing`);
    return;
  }
  if (actual.name !== expected.name) {
    failures.push(`${jobId}: step ${index + 1}: expected name '${expected.name}', got '${actual.name}'`);
  }
  if (expected.id && actual.id !== expected.id) {
    failures.push(`${jobId}: step '${expected.name}': expected id '${expected.id}', got '${actual.id}'`);
  }
  if (expected.usesRepo) {
    checkUses(jobId, expected, actual, rawText, failures);
  }
  if (expected.with) {
    for (const [key, value] of Object.entries(expected.with)) {
      if (actual.with?.[key] !== value) {
        failures.push(`${jobId}: step '${expected.name}': with.${key} must be exactly '${value}'`);
      }
    }
    const extraKeys = Object.keys(actual.with || {}).filter((key) => !(key in expected.with));
    if (extraKeys.length > 0) {
      failures.push(`${jobId}: step '${expected.name}': unexpected 'with' keys: ${extraKeys.join(", ")}`);
    }
  }
  if (expected.run) {
    const normalized = String(actual.run || "").trim();
    if (normalized !== expected.run) {
      failures.push(`${jobId}: step '${expected.name}': run line must be exactly '${expected.run}'`);
    }
  }
  if (expected.runStartsWith) {
    const normalized = String(actual.run || "").trim();
    if (!normalized.startsWith(expected.runStartsWith)) {
      failures.push(`${jobId}: step '${expected.name}': run must start with '${expected.runStartsWith}'`);
    }
  }
}

/**
 * @param {string} jobId
 * @param {any} expected
 * @param {any} actual
 * @param {string} rawText
 * @param {string[]} failures
 * @returns {void}
 */
function checkUses(jobId, expected, actual, rawText, failures) {
  const uses = String(actual.uses || "");
  const [repoWithSha] = uses.split("@");
  if (repoWithSha !== expected.usesRepo) {
    failures.push(`${jobId}: step '${expected.name}': uses must be '${expected.usesRepo}@<full SHA>'`);
    return;
  }
  const line = rawText.split(/\r?\n/).find((candidate) => candidate.includes(`uses: ${expected.usesRepo}@`));
  const usesValue = line ? line.trim().replace(/^uses:\s*/, "") : "";
  if (!line || !FULL_SHA_WITH_COMMENT.test(usesValue)) {
    failures.push(
      `${jobId}: step '${expected.name}': uses must be pinned to a full 40-character commit SHA with a '# vX.Y.Z' comment`
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

/** @file Contracts for the local runtime-only release archive. */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import {
  buildReleaseManifest,
  createReleaseArchive,
  isRuntimePath,
  stampPluginJson,
  validateReleaseArchive
} from "../../tools/release-archive.mjs";

const ROOT = process.cwd();

test("the release manifest is sorted, runtime-only, and includes executable plugin assets", () => {
  const manifest = buildReleaseManifest(ROOT);
  assert.deepEqual(manifest, [...manifest].sort());
  assert.ok(manifest.includes("plugin.py"));
  assert.ok(manifest.includes("plugin.js"));
  assert.ok(manifest.includes("viewer/viewer.html"));
  assert.ok(manifest.includes("server/polarrecorder/api_handlers.py"));
  assert.ok(manifest.every(isRuntimePath));
  assert.ok(
    !manifest.some(
      (entry) => entry.startsWith("tests/") || entry.startsWith("tools/") || entry.startsWith("documentation/")
    )
  );
});

test("a local archive has exactly the staged runtime content and stamped version", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-release-archive-"));
  const archive = path.join(temp, "release.zip");
  try {
    const summary = createReleaseArchive(ROOT, "1.2.3", archive);
    assert.equal(summary.filesIncluded, buildReleaseManifest(ROOT).length);
    validateReleaseArchive(ROOT, "1.2.3", archive);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("stamping preserves the development form while placing the release version first", () => {
  const stamped = JSON.parse(stampPluginJson(ROOT, "1.2.3-rc.1"));
  assert.equal(stamped.version, "1.2.3-rc.1");
  assert.equal(Object.keys(stamped)[0], "version");
});

test("the runtime predicate rejects development and documentation paths", () => {
  assert.equal(isRuntimePath("tests/test_release-archive.py"), false);
  assert.equal(isRuntimePath("tools/release-archive.mjs"), false);
  assert.equal(isRuntimePath("documentation/guides/release-workflow.md"), false);
});

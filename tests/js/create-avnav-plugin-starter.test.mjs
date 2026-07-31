import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { createStarter } from "../../tools/create-avnav-plugin-starter.mjs";

test("starter output is deterministic and passes its dependency-free quality check", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-starter-"));
  const output = path.join(root, "sample");
  const files = createStarter({ output, id: "sample-plugin", name: "Sample Plugin" });
  assert.deepEqual(files, [...files].sort());
  assert.ok(files.includes("plugin.js"));
  const result = childProcess.spawnSync(process.execPath, ["tools/check.mjs"], { cwd: output, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Starter quality check passed/);
  assert.throws(() => createStarter({ output, id: "sample-plugin", name: "Sample Plugin" }), /not empty/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("starter rejects an unsafe plugin identifier", () => {
  assert.throws(() => createStarter({ output: "/tmp/unused", id: "../bad", name: "Bad" }), /--id/);
});

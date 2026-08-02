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

test("starter supports both CLI forms and quality profiles", () => {
  const script = path.resolve("tools/create-avnav-plugin-starter.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-starter-cli-"));
  const viewer = path.join(root, "viewer");
  const python = path.join(root, "python");
  const equals = childProcess.spawnSync(
    process.execPath,
    [
      script,
      `--output=${viewer}`,
      "--id",
      "sample-plugin",
      "--name=Sample Plugin",
      "--level",
      "quality",
      "--profile=viewer-only"
    ],
    { encoding: "utf8" }
  );
  const pairs = childProcess.spawnSync(
    process.execPath,
    [
      script,
      "--output",
      python,
      "--id=sample-plugin",
      "--name",
      "Sample Plugin",
      "--level=quality",
      "--profile",
      "python-plus-viewer"
    ],
    { encoding: "utf8" }
  );
  assert.equal(equals.status, 0, equals.stderr);
  assert.equal(pairs.status, 0, pairs.stderr);
  assert.ok(fs.existsSync(path.join(viewer, "tools/quality-policy/portable-role-graph.json")));
  assert.ok(fs.existsSync(path.join(python, "plugin.py")));
  assert.throws(
    () =>
      createStarter({
        output: path.join(root, "bad"),
        id: "sample-plugin",
        name: "Bad",
        level: "quality",
        profile: /** @type {any} */ ("unknown")
      }),
    /--profile/
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("starter rejects a representative quality mutation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-starter-mutation-"));
  const output = path.join(root, "sample");
  createStarter({
    output,
    id: "sample-plugin",
    name: "Sample Plugin",
    level: "quality",
    profile: "viewer-only"
  });
  fs.appendFileSync(path.join(output, "plugin.js"), '\nvar unsafe = eval("1");\n');
  const result = childProcess.spawnSync(process.execPath, ["tools/check.mjs"], { cwd: output, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

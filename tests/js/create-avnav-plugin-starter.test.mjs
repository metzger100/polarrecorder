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
  assert.match(result.stdout + result.stderr, /Starter quality check passed/);
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
  assert.match(fs.readFileSync(path.join(viewer, "plugin.mjs"), "utf8"), /sample-plugin initialized/);
  assert.doesNotMatch(fs.readFileSync(path.join(viewer, "plugin.mjs"), "utf8"), /generated-plugin/);
  assert.ok(fs.existsSync(path.join(viewer, "documentation/TABLEOFCONTENTS.md")));
  assert.match(fs.readFileSync(path.join(python, "plugin.py"), "utf8"), /PLUGIN_ID = "sample-plugin"/);
  assert.match(fs.readFileSync(path.join(python, "tests/test_plugin.py"), "utf8"), /test_plugin_boundary/);
  const workflow = fs.readFileSync(path.join(viewer, ".github/workflows/quality.yml"), "utf8");
  assert.doesNotMatch(workflow, /uses: actions\/(?:checkout|setup-node|setup-python)@v\d/);
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

test("distribution source materialization is deterministic and fail-closed", async () => {
  const { runDistributionMaterialization, validateDistributionSource } =
    await import("../../tools/regenerate-distribution-manifest.mjs");
  const result = runDistributionMaterialization({ print: false });
  assert.equal(result.ok, true);
  assert.equal(result.manifest.sourceOwner, "avnav-plugin-ai-environment");
  assert.throws(() => validateDistributionSource({ ...result.source, paths: ["../escape"] }), /repository-relative/);
  assert.throws(() => validateDistributionSource({ ...result.source, sourceOwner: "product-name" }), /neutral/);
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

  const qualityRoot = path.join(root, "quality");
  createStarter({
    output: qualityRoot,
    id: "sample-plugin",
    name: "Sample Plugin",
    level: "quality",
    profile: "viewer-only"
  });
  /** @param {string} command */
  const generatedCheck = (command) =>
    childProcess.spawnSync(process.execPath, ["tools/check-generated-quality.mjs", command], {
      cwd: qualityRoot,
      encoding: "utf8"
    });
  fs.writeFileSync(path.join(qualityRoot, "helper.js"), 'var unsafe = eval("1");\n');
  assert.notEqual(generatedCheck("standalone").status, 0);
  fs.rmSync(path.join(qualityRoot, "helper.js"));
  fs.appendFileSync(path.join(qualityRoot, "plugin.mjs"), "\nconst broken = config.default || true;\n");
  assert.notEqual(generatedCheck("smells").status, 0);
  assert.equal(
    childProcess.spawnSync(process.execPath, ["tools/check-generated-quality.mjs", "workflow"], {
      cwd: qualityRoot,
      encoding: "utf8"
    }).status,
    0
  );

  const mutations = [
    {
      name: "identity drift",
      file: "plugin.json",
      mutate: /** @param {string} file */ (file) =>
        fs.writeFileSync(
          file,
          fs.readFileSync(file, "utf8").replace('"name": "sample-plugin"', '"name": "other-plugin"')
        ),
      command: ["tools/check-generated-quality.mjs", "inventory"]
    },
    {
      name: "stale profile path",
      file: "tools/quality-policy/project-profile.json",
      mutate: /** @param {string} file */ (file) =>
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('"plugin.js"', '"../escape"')),
      command: ["tools/check-quality-profile.mjs"]
    },
    {
      name: "unpinned action",
      file: ".github/workflows/quality.yml",
      mutate: /** @param {string} file */ (file) =>
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/@[0-9a-f]{40}/, "@v6")),
      command: ["tools/check-generated-quality.mjs", "workflow"]
    },
    {
      name: "write permission",
      file: ".github/workflows/quality.yml",
      mutate: /** @param {string} file */ (file) =>
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("contents: read", "contents: write")),
      command: ["tools/check-generated-quality.mjs", "workflow"]
    },
    {
      name: "suppression text",
      file: "plugin.js",
      mutate: /** @param {string} file */ (file) => fs.appendFileSync(file, "\n/* eslint-disable */\n"),
      command: ["tools/portable-core/suppression-engine.mjs"]
    },
    {
      name: "signed byte tampering",
      file: "tools/quality-policy/shared-core-manifest.sha256",
      mutate: /** @param {string} file */ (file) =>
        fs.writeFileSync(file, "0" + fs.readFileSync(file, "utf8").slice(1)),
      command: ["tools/check-shared-core.mjs"]
    },
    {
      name: "missing package file",
      file: "plugin.json",
      mutate: /** @param {string} file */ (file) => fs.unlinkSync(file),
      command: ["tools/check-generated-quality.mjs", "package"]
    }
  ];
  for (const mutation of mutations) {
    const mutationRoot = path.join(root, mutation.name.replace(/ /g, "-"));
    createStarter({
      output: mutationRoot,
      id: "sample-plugin",
      name: "Sample Plugin",
      level: "quality",
      profile: "viewer-only"
    });
    mutation.mutate(path.join(mutationRoot, mutation.file));
    const result = childProcess.spawnSync(process.execPath, mutation.command, { cwd: mutationRoot, encoding: "utf8" });
    assert.notEqual(result.status, 0, mutation.name);
  }

  const pythonRoot = path.join(root, "python-syntax");
  createStarter({
    output: pythonRoot,
    id: "sample-plugin",
    name: "Sample Plugin",
    level: "quality",
    profile: "python-plus-viewer"
  });
  fs.appendFileSync(path.join(pythonRoot, "plugin.py"), "\ndef broken(:\n    pass\n");
  const pythonSyntax = childProcess.spawnSync("python3", ["-m", "py_compile", "plugin.py"], {
    cwd: pythonRoot,
    encoding: "utf8"
  });
  assert.notEqual(pythonSyntax.status, 0, "invalid Python syntax");
  fs.rmSync(root, { recursive: true, force: true });
});

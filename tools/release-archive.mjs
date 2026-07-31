/** @file Local runtime-release staging, archive creation, and validation. */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_FILES = [
  "plugin.css",
  "plugin.js",
  "plugin.json",
  "plugin.mjs",
  "plugin.py",
  "viewer/icon.svg",
  "viewer/viewer.html"
];
const PREFIX = "polarrecorder/";
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** @param {string} filePath */
export function isRuntimePath(filePath) {
  return (
    ROOT_FILES.includes(filePath) ||
    filePath.startsWith("server/polarrecorder/") ||
    (filePath.startsWith("viewer/") && /\.(js|css)$/.test(filePath))
  );
}

/** @param {string} root */
export function buildReleaseManifest(root = process.cwd()) {
  const names = [...ROOT_FILES];
  collect(path.join(root, "viewer"), root, names, (rel) => rel.endsWith(".js") || rel.endsWith(".css"));
  collect(path.join(root, "server", "polarrecorder"), root, names, (rel) => rel.endsWith(".py"));
  const manifest = [...new Set(names)].sort();
  for (const name of manifest) {
    if (!isRuntimePath(name) || !fs.statSync(path.join(root, name)).isFile())
      throw new Error(`invalid runtime path: ${name}`);
  }
  return manifest;
}

/** @param {string} root @param {string} version */
export function stampPluginJson(root, version) {
  if (!SEMVER.test(version)) throw new Error("release version must be valid SemVer");
  const source = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
  return JSON.stringify({ version, ...source }, null, 2) + "\n";
}

/** @param {string} directory @param {string} root @param {string[]} names @param {(rel: string) => boolean} include */
function collect(directory, root, names, include) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute, root, names, include);
    if (entry.isFile()) {
      const rel = path.relative(root, absolute).split(path.sep).join("/");
      if (include(rel)) names.push(rel);
    }
  }
}

/** @param {string} root @param {string} version @param {string} output */
export function createReleaseArchive(root, version, output) {
  if (!SEMVER.test(version)) throw new Error("release version must be valid SemVer");
  const manifest = buildReleaseManifest(root);
  const stageParent = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-release-"));
  const stageRoot = path.join(stageParent, "polarrecorder");
  try {
    for (const rel of manifest) copyRuntimeFile(root, stageRoot, rel, version);
    run("zip", ["-q", "-X", "-r", output, "polarrecorder"], stageParent);
  } finally {
    fs.rmSync(stageParent, { recursive: true, force: true });
  }
  validateReleaseArchive(root, version, output, manifest);
  return { filesIncluded: manifest.length, totalSizeBytes: fs.statSync(output).size };
}

/** @param {string} root @param {string} stageRoot @param {string} rel @param {string} version */
function copyRuntimeFile(root, stageRoot, rel, version) {
  const target = path.join(stageRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (rel === "plugin.json") {
    fs.writeFileSync(target, stampPluginJson(root, version));
  } else fs.copyFileSync(path.join(root, rel), target);
}

/** @param {string} root @param {string} version @param {string} archive @param {string[]} [manifest] */
export function validateReleaseArchive(root, version, archive, manifest = buildReleaseManifest(root)) {
  const listed = run("unzip", ["-Z", "-1", archive], root).trim().split("\n").filter(Boolean);
  const actual = listed.map((entry) => entry.replace(/\\/g, "/")).filter((entry) => !entry.endsWith("/"));
  const expected = manifest.map((entry) => PREFIX + entry).sort();
  if (new Set(actual).size !== actual.length) throw new Error("release archive contains duplicate entries");
  if (actual.sort().join("\n") !== expected.join("\n"))
    throw new Error("release archive runtime entry set differs from the manifest");
  for (const rel of manifest) {
    const expectedData =
      rel === "plugin.json" ? Buffer.from(stampPluginJson(root, version)) : fs.readFileSync(path.join(root, rel));
    const actualData = Buffer.from(run("unzip", ["-p", archive, PREFIX + rel], root), "binary");
    if (hash(actualData) !== hash(expectedData)) throw new Error(`release archive content drift: ${rel}`);
  }
}

/**
 * Canonical checker entry point for release archive validation.
 * @param {{root?: string, version: string, archive: string, manifest?: string[]}} options
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runReleaseArchive({ root = process.cwd(), version, archive, manifest }) {
  try {
    validateReleaseArchive(root, version, archive, manifest || buildReleaseManifest(root));
    return { ok: true, failures: [] };
  } catch (error) {
    return { ok: false, failures: [error instanceof Error ? error.message : String(error)] };
  }
}

/** @param {Buffer} value */
function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
/** @param {string} command @param {string[]} args @param {string} cwd */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "buffer" });
  if (result.status !== 0) throw new Error(`release archive command failed: ${command} ${args.join(" ")}`);
  return result.stdout.toString("binary");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, value] = process.argv.slice(2);
  try {
    if (mode === "--dry-run") {
      const archive = path.join(os.tmpdir(), `polarrecorder-release-${process.pid}.zip`);
      try {
        const summary = createReleaseArchive(process.cwd(), "0.0.0-dev", archive);
        process.stdout.write(`Release archive dry-run passed: ${summary.filesIncluded} runtime files.\n`);
      } finally {
        fs.rmSync(archive, { force: true });
      }
    } else if (mode === "--version" && value) {
      const archive = path.join(process.cwd(), "releases", `polarrecorder-${value}.zip`);
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      const summary = createReleaseArchive(process.cwd(), value, archive);
      process.stdout.write("SUMMARY_JSON=" + JSON.stringify(summary) + "\n");
    } else throw new Error("usage: release-archive.mjs --dry-run | --version <version>");
  } catch (error) {
    process.stderr.write(/** @type {Error} */ (error).message + "\n");
    process.exitCode = 1;
  }
}

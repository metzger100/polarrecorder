#!/usr/bin/env node

/**
 * @file create-avnav-plugin-starter - Generates minimal or quality-grade AvNav plugin environments.
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildStarterFiles } from "./starter-templates.mjs";

/** @typedef {{output: string, id: string, name: string, level?: "minimal"|"quality", profile?: "viewer-only"|"python-plus-viewer"}} StarterOptions */

const LEVELS = ["minimal", "quality"];
const PROFILES = ["viewer-only", "python-plus-viewer"];
const KEYS = new Set(["output", "id", "name", "level", "profile"]);

/** @param {StarterOptions} options @returns {string[]} */
export function createStarter(options) {
  const normalized = validateOptions(options);
  const output = path.resolve(normalized.output);
  if (fs.existsSync(output) && fs.readdirSync(output).length > 0) {
    throw new Error(`Starter output directory is not empty: ${output}`);
  }
  const files = buildStarterFiles(normalized);
  for (const [relativePath, content] of Object.entries(files)) {
    if (!isSafeRelativePath(relativePath)) throw new Error(`Unsafe generated path: ${relativePath}`);
    const absolutePath = path.join(output, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }
  if (normalized.level === "quality" && normalized.profile === "python-plus-viewer") {
    fs.writeFileSync(path.join(output, "plugin.py"), pythonPluginText(), "utf8");
    fs.writeFileSync(path.join(output, "tests/plugin_python.test.py"), pythonTestText(), "utf8");
  }
  return Object.keys(files)
    .concat(
      normalized.level === "quality" && normalized.profile === "python-plus-viewer"
        ? ["plugin.py", "tests/plugin_python.test.py"]
        : []
    )
    .sort();
}

/** @param {StarterOptions} options @returns {Required<StarterOptions>} */
function validateOptions(options) {
  if (!options || typeof options !== "object") throw new Error("Starter options are required.");
  if (typeof options.output !== "string" || options.output.length === 0 || !path.isAbsolute(options.output)) {
    throw new Error("--output must be an absolute path.");
  }
  if (options.output.split(/[\\/]+/).includes("..")) throw new Error("--output must not contain parent traversal.");
  if (typeof options.id !== "string" || !/^[a-z][a-z0-9-]{2,39}$/.test(options.id)) {
    throw new Error("--id must be 3-40 lowercase letters, digits, or hyphens and start with a letter.");
  }
  if (typeof options.name !== "string" || options.name.trim().length === 0) throw new Error("--name is required.");
  const level = options.level || "minimal";
  const profile = options.profile || "viewer-only";
  if (!LEVELS.includes(level)) throw new Error(`--level must be one of: ${LEVELS.join(", ")}.`);
  if (!PROFILES.includes(profile)) throw new Error(`--profile must be one of: ${PROFILES.join(", ")}.`);
  if (level === "minimal" && options.profile && profile !== "viewer-only") {
    throw new Error("--profile requires --level quality.");
  }
  return {
    output: options.output,
    id: options.id,
    name: options.name,
    level,
    profile
  };
}

/** @param {string} relativePath @returns {boolean} */
function isSafeRelativePath(relativePath) {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    !relativePath.split("/").includes("..") &&
    !relativePath.includes("\\")
  );
}

/** @returns {string} */
function pythonPluginText() {
  return `"""Python-plus-viewer AvNav plugin boundary."""\n\n\ndef plugin_name() -> str:\n    return "generated-plugin"\n`;
}

/** @returns {string} */
function pythonTestText() {
  return `import importlib.util\nfrom pathlib import Path\n\n\ndef test_plugin_boundary() -> None:\n    spec = importlib.util.spec_from_file_location("plugin", Path(__file__).parents[1] / "plugin.py")\n    assert spec is not None\n`;
}

/** @param {string[]} argv @returns {StarterOptions} */
export function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      console.log(helpText());
      process.exitCode = 0;
      return /** @type {StarterOptions} */ ({ output: "", id: "help", name: "help" });
    }
    if (typeof argument !== "string" || !argument.startsWith("--")) throw new Error(helpError());
    const raw = argument.slice(2);
    const equalIndex = raw.indexOf("=");
    const key = equalIndex === -1 ? raw : raw.slice(0, equalIndex);
    const inline = equalIndex === -1 ? undefined : raw.slice(equalIndex + 1);
    if (!KEYS.has(key) || Object.prototype.hasOwnProperty.call(values, key)) throw new Error(helpError());
    const value = inline === undefined ? argv[++index] : inline;
    if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) throw new Error(helpError());
    values[key] = value;
  }
  return /** @type {StarterOptions} */ ({
    output: values.output,
    id: values.id,
    name: values.name,
    level: values.level,
    profile: values.profile
  });
}

/** @returns {string} */
function helpText() {
  return 'Usage: node tools/create-avnav-plugin-starter.mjs --output=/abs/path --id=my-plugin --name="My Plugin" [--level=minimal|quality] [--profile=viewer-only|python-plus-viewer]';
}

/** @returns {string} */
function helpError() {
  return `${helpText()}\nOptions accept both --key=value and --key value forms; unknown or duplicate keys are rejected.`;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const options = parseArgs(process.argv.slice(2));
  if (options.output) {
    const files = createStarter(options);
    console.log(`Created ${files.length} ${options.level || "minimal"} starter files.`);
  }
}

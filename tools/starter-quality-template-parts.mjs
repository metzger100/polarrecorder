/** Shared large starter templates kept separate so every maintained module stays reviewable. */

/** @param {{id: string}} options @returns {string} */
export function packageStarterText(options) {
  return `#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PLUGIN_ID = "${options.id}";
const REQUIRED = ["plugin.json"];
const RUNTIME_ROOTS = ["plugin.json", "plugin.js", "plugin.mjs", "plugin.py", "viewer", "server", "src"];
const checkOnly = process.argv.includes("--check");
const outputArg = process.argv.find((argument) => argument.startsWith("--output="));
const output = outputArg ? path.resolve(outputArg.slice("--output=".length)) : path.resolve("dist", PLUGIN_ID + ".avnav-plugin.zip");

const artifact = checkOnly ? path.join(os.tmpdir(), PLUGIN_ID + "-package-" + process.pid + ".zip") : output;
try {
  createArtifact(artifact);
  console.log("AvNav package contains " + archiveFiles(artifact).length + " runtime files: " + artifact);
} finally {
  if (checkOnly) fs.rmSync(artifact, { force: true });
}

/** @param {string} target */
function createArtifact(target) {
  const files = runtimeFiles();
  for (const required of REQUIRED) if (!files.includes(required)) throw new Error("missing package file: " + required);
  if (!files.includes("plugin.js") && !files.includes("plugin.mjs")) throw new Error("missing browser runtime entrypoint");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "avnav-package-stage-"));
  try {
    for (const file of files) {
      const destination = path.join(stage, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file, destination);
      fs.utimesSync(destination, new Date(0), new Date(0));
    }
    fs.rmSync(target, { force: true });
    execFileSync("zip", ["-X", "-q", target, ...files], { cwd: stage, stdio: "ignore" });
    const archived = archiveFiles(target);
    if (JSON.stringify(archived) !== JSON.stringify(files)) throw new Error("package allowlist mismatch");
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function runtimeFiles() {
  const files = [];
  for (const entry of RUNTIME_ROOTS) {
    if (!fs.existsSync(entry)) continue;
    if (fs.statSync(entry).isFile()) files.push(entry);
    else collect(entry, files);
  }
  return files.sort();
}

/** @param {string} entry @param {string[]} files */
function collect(entry, files) {
  for (const item of fs.readdirSync(entry, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = path.join(entry, item.name).replaceAll(path.sep, "/");
    if (item.isDirectory()) collect(relative, files);
    else if (item.isFile()) files.push(relative);
  }
}

/** @param {string} archive @returns {string[]} */
function archiveFiles(archive) {
  const buffer = fs.readFileSync(archive);
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("invalid ZIP end record");
  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const names = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("invalid ZIP central directory");
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    names.push(buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return names.sort();
}
`;
}

/** @returns {string} */
export function starterQualityChecksText() {
  return [
    'import fs from "node:fs";',
    'import path from "node:path";',
    'import Ajv2020 from "ajv/dist/2020.js";',
    'import { runComplexityPolicy, STRICT_LIMITS } from "./portable-core/complexity-engine.mjs";',
    'import { runFileSizePolicy } from "./portable-core/file-size-engine.mjs";',
    'import { runFocusedTestPolicy } from "./portable-core/focused-test-engine.mjs";',
    "const command = process.argv[2];",
    "/** @type {string[]} */",
    'const files = listFiles(".").filter((file) => !file.startsWith("node_modules/") && !file.startsWith("coverage/") && !file.startsWith("dist/") && !file.startsWith(".venv/") && !file.startsWith(".pytest_cache/") && !file.startsWith(".quality-cache/"));',
    'if (command === "schema") checkSchema();',
    'else if (command === "focus") checkFocus();',
    'else if (command === "filesize") checkFileSize();',
    'else if (command === "standalone") checkStandalone();',
    'else if (command === "complexity") checkComplexity();',
    'else if (command === "scaling") checkScaling();',
    'else if (command === "docs") checkDocs();',
    'else if (command === "workflow") checkWorkflow();',
    'else throw new Error("unknown starter quality check: " + command);',
    "function checkSchema() {",
    '  const schema = JSON.parse(fs.readFileSync("schemas/plugin.schema.json", "utf8"));',
    "  const AjvConstructor = /** @type {any} */ (Ajv2020);",
    "  const validate = new AjvConstructor({ allErrors: true, strict: true }).compile(schema);",
    '  if (!validate(JSON.parse(fs.readFileSync("plugin.json", "utf8")))) throw new Error("plugin.json schema mismatch: " + JSON.stringify(validate.errors));',
    '  console.log("Schema check passed.");',
    "}",
    "function checkFocus() {",
    '  const testFiles = Object.fromEntries(files.filter((file) => /^tests\\/.*\\.(?:js|mjs)$/.test(file)).map((file) => [file, stripLiteralsAndComments(fs.readFileSync(file, "utf8"))]));',
    "  const result = runFocusedTestPolicy({ files: testFiles });",
    '  if (!result.ok) throw new Error(result.failures.join("\\n"));',
    '  console.log("Focused-test check passed.");',
    "}",
    "function checkFileSize() {",
    '  const sourceFiles = Object.fromEntries(files.filter((file) => /\\.(?:js|mjs|md|py)$/.test(file)).map((file) => [file, fs.readFileSync(file, "utf8")]));',
    "  const result = runFileSizePolicy({ files: sourceFiles, limit: 400 });",
    '  if (!result.ok) throw new Error(result.failures.join("\\n"));',
    '  console.log("File-size check passed over " + Object.keys(sourceFiles).length + " files.");',
    "}",
    "function checkStandalone() {",
    '  const runtime = fs.readFileSync("plugin.js", "utf8");',
    '  if (/\\b(?:eval|var)\\b|innerHTML\\s*=|document\\.write|[A-Za-z]:[\\\\/]|(?:^|\\s)\\/(?![/*])/.test(runtime)) throw new Error("runtime boundary violation");',
    '  if (/\\bimport\\s|\\bexport\\s/.test(runtime)) throw new Error("runtime must remain a classic script");',
    '  console.log("Standalone runtime check passed.");',
    "}",
    "function checkComplexity() {",
    "  const result = runComplexityPolicy({ limits: STRICT_LIMITS });",
    '  if (!result.ok) throw new Error(result.failures.join("\\n"));',
    '  console.log("Complexity policy check passed.");',
    "}",
    "function checkScaling() {",
    '  const source = fs.readFileSync("plugin.js", "utf8");',
    '  if (/while\\s*\\(\\s*true\\s*\\)/.test(source)) throw new Error("unbounded runtime loop");',
    '  console.log("Scaling policy check passed.");',
    "}",
    "function checkWorkflow() {",
    '  const workflowFiles = files.filter((file) => file.startsWith(".github/workflows/") && /\\.(?:yml|yaml)$/.test(file));',
    '  if (workflowFiles.length === 0) throw new Error("quality workflow is missing");',
    "  const failures = [];",
    "  for (const file of workflowFiles) {",
    '    const source = fs.readFileSync(file, "utf8");',
    '    if (!/permissions:\\s*\\n(?:[^\\n]*\\n)*?\\s+contents:\\s+read(?:\\s|$)/m.test(source)) failures.push(file + ": contents: read permission is required");',
    '    if (/^\\s+[A-Za-z0-9_-]+:\\s*write\\s*$/m.test(source)) failures.push(file + ": write permissions are forbidden");',
    "    for (const match of source.matchAll(/uses:\\s*actions\\/(?:checkout|setup-node|setup-python)@([^\\s#]+)/g)) {",
    '      if (!/^[0-9a-f]{40}$/.test(match[1])) failures.push(file + ": actions must be SHA pinned");',
    "    }",
    "  }",
    '  if (failures.length > 0) throw new Error(failures.join("\\n"));',
    '  console.log("Workflow policy check passed.");',
    "}",
    "function checkDocs() {",
    '  const markdown = files.filter((file) => file.endsWith(".md"));',
    '  const required = ["README.md", "AGENTS.md", "documentation/TABLEOFCONTENTS.md", "documentation/conventions/coding-standards.md", "documentation/conventions/smell-prevention.md", "documentation/guides/exec-plan-authoring.md"];',
    "  const missing = required.filter((file) => !files.includes(file));",
    '  const failures = missing.map((file) => "missing required document " + file);',
    "  const targets = new Set(files);",
    "  for (const owner of markdown) {",
    '    const source = fs.readFileSync(owner, "utf8");',
    '    if (owner.startsWith("documentation/") && !/^\\*\\*Status:\\*\\* Current\\./m.test(source)) failures.push(owner + ": missing current status");',
    '    if (owner.startsWith("documentation/") && !/^## Overview\\s*$/m.test(source)) failures.push(owner + ": missing Overview section");',
    '    if (owner.startsWith("documentation/") && !/^## Key Details\\s*$/m.test(source)) failures.push(owner + ": missing Key Details section");',
    '    if (owner.startsWith("documentation/") && !/^## Related\\s*$/m.test(source)) failures.push(owner + ": missing Related section");',
    "    for (const match of source.matchAll(/\\[[^]]+\\]\\(([^)#]+)(?:#[^)]+)?\\)/g)) {",
    "      const target = match[1];",
    "      if (/^(?:https?:|mailto:)/i.test(target)) continue;",
    "      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(owner), target));",
    '      if (resolved.startsWith("../") || !targets.has(resolved)) failures.push(owner + ": missing target " + target);',
    "    }",
    "  }",
    '  if (failures.length > 0) throw new Error(failures.join("\\n"));',
    '  console.log("Documentation-link and shape check passed over " + markdown.length + " Markdown files.");',
    "}",
    "/** @param {string} source @returns {string} */",
    "function stripLiteralsAndComments(source) {",
    "  return source.replace(/(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`|\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\r\\n]*)/g, String.fromCharCode(32));",
    "}",
    "/** @param {string} entry @returns {string[]} */",
    "function listFiles(entry) {",
    "  if (!fs.existsSync(entry)) return [];",
    '  if (fs.statSync(entry).isFile()) return [entry.replaceAll(path.sep, "/")];',
    "  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((item) => listFiles(path.join(entry, item.name)));",
    "}",
    ""
  ].join("\n");
}

/** @returns {string} */
export function generatedQualityCheckText() {
  return `#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { runGenericConformance } from "./portable-core/generic-rule-engine.mjs";

const PROFILE = JSON.parse(fs.readFileSync("tools/quality-policy/project-profile.json", "utf8"));
const COMMAND = process.argv[2] || "inventory";
const IGNORED = new Set([".git", "node_modules", "coverage", "dist", ".venv", ".pytest_cache", ".quality-cache"]);
const NON_RUNTIME = new Set(["eslint.config.mjs", "vitest.config.js"]);
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".py", ".md", ".css", ".html", ".json", ".jsonc", ".yml", ".yaml", ".toml", ".sh"]);

/** @type {string[]} */
const files = listFiles(".");
if (COMMAND === "inventory") checkInventory();
else if (COMMAND === "smells") checkSmells();
else if (COMMAND === "standalone") checkStandalone();
else if (COMMAND === "workflow") checkWorkflow();
else if (COMMAND === "coverage") checkCoverage();
else if (COMMAND === "package") checkPackage();
else throw new Error("unknown generated quality command: " + COMMAND);

function checkInventory() {
  const unsupported = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file)) && !isOwned(file));
  if (unsupported.length > 0) fail("unclassified maintained files: " + unsupported.join(", "));
  const runtime = runtimeFiles();
  if (!runtime.some((file) => file === "plugin.js" || file === "plugin.mjs")) fail("runtime entrypoint is missing");
  if (PROFILE.product.id !== JSON.parse(fs.readFileSync("plugin.json", "utf8")).name) fail("profile identity mismatch");
  console.log("Generated inventory check passed over " + files.length + " files.");
}

function checkSmells() {
  checkInventory();
  const descriptors = runtimeFiles().map((file) => ({ path: file, content: fs.readFileSync(file, "utf8") }));
  /** @type {Array<{ruleId: string, path: string, line: number}>} */
  const findings = runGenericConformance(descriptors);
  if (findings.length > 0) fail(findings.map((finding) => finding.ruleId + ":" + finding.path + ":" + finding.line).join("\\n"));
  console.log("Generated generic smell check passed.");
}

function checkStandalone() {
  checkInventory();
  for (const file of runtimeFiles()) {
    const source = fs.readFileSync(file, "utf8");
    if (/\\beval\\s*\\(|\\bnew\\s+Function\\s*\\(|\\bvar\\s+/.test(source)) fail(file + ": unsafe runtime construct");
  }
  console.log("Generated standalone check passed.");
}

function checkWorkflow() {
  checkInventory();
  const workflowFiles = files.filter((file) => file.startsWith(".github/workflows/") && /\\.(?:yml|yaml)$/.test(file));
  if (workflowFiles.length === 0) fail("quality workflow is missing");
  const failures = [];
  for (const file of workflowFiles) {
    const source = fs.readFileSync(file, "utf8");
    if (!/permissions:\\s*\\n(?:[^\\n]*\\n)*?\\s+contents:\\s+read(?:\\s|$)/m.test(source)) {
      failures.push(file + ": contents: read permission is required");
    }
    if (/^\\s+[A-Za-z0-9_-]+:\\s*write\\s*$/m.test(source)) failures.push(file + ": write permissions are forbidden");
    for (const match of source.matchAll(/uses:\\s*actions\\/(?:checkout|setup-node|setup-python)@([^\\s#]+)/g)) {
      if (!/^[0-9a-f]{40}$/.test(match[1])) failures.push(file + ": actions must be SHA pinned");
    }
  }
  if (failures.length > 0) fail(failures.join("\\n"));
  console.log("Generated workflow policy passed.");
}

function checkCoverage() {
  checkInventory();
  const summaryPath = path.join("coverage", "coverage-summary.json");
  if (!fs.existsSync(summaryPath)) fail("coverage summary is missing; run test:coverage first");
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const covered = new Set(Object.keys(summary).map((file) => file.replaceAll("\\\\", "/").split("/").pop()));
  for (const file of runtimeFiles().filter((entry) => /\\.(?:js|mjs)$/.test(entry))) {
    if (!covered.has(path.basename(file))) fail(file + ": missing coverage entry");
  }
  if (PROFILE.languages.python) {
    const pythonSummary = path.join("coverage", "python", "coverage.json");
    if (!fs.existsSync(pythonSummary)) fail("Python coverage summary is missing");
    else {
      const pythonCoverage = JSON.parse(fs.readFileSync(pythonSummary, "utf8")).files || {};
      const entries = Object.entries(pythonCoverage);
      for (const file of files.filter((entry) => entry.endsWith(".py") && !entry.startsWith("tests/"))) {
        const entry = entries.find(([key]) => key === file || key.endsWith("/" + file));
        if (!entry) {
          fail(file + ": missing Python coverage entry");
          continue;
        }
        const percent = entry[1]?.summary?.percent_covered;
        if (typeof percent !== "number" || percent < 80) fail(file + ": Python coverage below 80 percent");
      }
    }
  }
  console.log("Generated coverage inventory passed.");
}

function checkPackage() {
  checkInventory();
  const metadata = JSON.parse(fs.readFileSync("plugin.json", "utf8"));
  if (metadata.name !== PROFILE.product.id) fail("package identity mismatch");
  if (files.some((file) => file === "node_modules" || file.startsWith("coverage/") || file.startsWith(".venv/") || file.startsWith(".quality-cache/"))) fail("generated state must not be packaged");
  console.log("Generated package boundary passed.");
}

/** @returns {string[]} */
function runtimeFiles() {
  return files.filter(
    (file) =>
      /^(?:plugin\\.(?:js|mjs)|[^/]+\\.js|[^/]+\\.mjs|viewer\\/|server\\/)/.test(file) &&
      !NON_RUNTIME.has(file) &&
      TEXT_EXTENSIONS.has(path.extname(file))
  );
}

/** @param {string} file @returns {boolean} */
function isOwned(file) {
  const top = file.split("/")[0];
  return ["AGENTS.md", "README.md", "CONTRIBUTING.md", "plugin.json", "plugin.js", "plugin.mjs", "plugin.py", "package.json", "package-lock.json", "pyproject.toml", "requirements-dev.txt", "tsconfig.json", ".prettierignore", ".prettierrc.json", ".markdownlint-cli2.jsonc", "eslint.config.mjs", "vitest.config.js", "jscpd.config.json", ".github", ".githooks", ".agents", "documentation", "schemas", "tests", "tools"].includes(top);
}

/** @param {string} entry @returns {string[]} */
function listFiles(entry) {
  const absolute = path.resolve(entry);
  if (fs.statSync(absolute).isFile()) return [path.relative(process.cwd(), absolute).replaceAll(path.sep, "/")];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((item) => {
    if (IGNORED.has(item.name)) return [];
    return listFiles(path.join(absolute, item.name));
  });
}

/** @param {string} message */
function fail(message) {
  throw new Error(message);
}
`;
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  eslintConfigText,
  genericNamespaceText,
  genericTokensText,
  jscpdConfigText,
  markdownlintConfigText,
  starterPrettierConfigText,
  starterQualityChecksText,
  qualityVitestTestText,
  tsConfigText,
  vitestConfigText
} from "./starter-quality-templates.mjs";
/** @typedef {{output: string, id: string, name: string, level: "minimal"|"quality", profile: "viewer-only"|"python-plus-viewer"}} StarterOptions */

/** @param {StarterOptions} options @returns {Record<string, string>} */
export function buildStarterFiles(options) {
  const minimal = {
    "AGENTS.md": agentsText(),
    "README.md": minimalReadme(options),
    "package.json": `${JSON.stringify(minimalPackage(options), null, 2)}\n`,
    "plugin.json": `${JSON.stringify(metadata(options), null, 2)}\n`,
    "plugin.js": pluginText(options),
    "tests/plugin.test.mjs": testText(),
    "tools/check.mjs": minimalCheckText()
  };
  if (options.level === "minimal") return minimal;
  const files = {
    ...minimal,
    "README.md": qualityReadme(options),
    "package.json": `${JSON.stringify(qualityPackage(options), null, 2)}\n`,
    "package-lock.json": `${JSON.stringify(qualityLock(options), null, 2)}\n`,
    ".github/workflows/quality.yml": workflowText(),
    ".githooks/pre-push": prePushText(),
    ".prettierrc.json": starterPrettierConfigText(),
    ".markdownlint-cli2.jsonc": markdownlintConfigText(),
    "eslint.config.mjs": eslintConfigText(),
    "vitest.config.js": vitestConfigText(),
    "tsconfig.json": tsConfigText(),
    "jscpd.config.json": jscpdConfigText(),
    "schemas/plugin.schema.json": schemaText(),
    "tools/quality-policy/project-profile.json": profileText(options),
    "tools/quality-policy/generic-tokens.json": genericTokensText(),
    "tools/check-patterns/generic/namespace-policy.mjs": genericNamespaceText(),
    "plugin.js": qualityPluginText(),
    "tests/plugin.test.mjs": qualityTestText(),
    "tests/plugin-runtime.test.mjs": qualityVitestTestText(),
    "tools/check.mjs": qualityCheckText(),
    "tools/starter-quality-checks.mjs": starterQualityChecksText()
  };
  return { ...portableQualityFiles(), ...files };
}

/** @param {StarterOptions} options @returns {Record<string, unknown>} */
function metadata(options) {
  return {
    name: options.id,
    version: "0.1.0",
    title: options.name,
    description: `${options.name} AvNav plugin`
  };
}

/** @param {StarterOptions} options @returns {Record<string, unknown>} */
function minimalPackage(options) {
  return {
    name: `${options.id}-development`,
    version: "0.1.0",
    private: true,
    scripts: { "check:all": "node tools/check.mjs && node --check plugin.js && node --test" }
  };
}

/** @param {StarterOptions} options @returns {Record<string, unknown>} */
function qualityPackage(options) {
  return {
    ...minimalPackage(options),
    scripts: {
      setup: "npm ci",
      "hooks:install": "git config core.hooksPath .githooks",
      "format:check":
        "prettier --check AGENTS.md README.md plugin.js plugin.json package.json package-lock.json .github/**/*.yml .prettierrc.json .markdownlint-cli2.jsonc eslint.config.mjs jscpd.config.json tsconfig.json vitest.config.js schemas/plugin.schema.json tools/starter-quality-checks.mjs tests/plugin.test.mjs tests/plugin-runtime.test.mjs tools/quality-policy/project-profile.json",
      format:
        "prettier --write AGENTS.md README.md plugin.js plugin.json package.json package-lock.json .github/**/*.yml .prettierrc.json .markdownlint-cli2.jsonc eslint.config.mjs jscpd.config.json tsconfig.json vitest.config.js schemas/plugin.schema.json tools/starter-quality-checks.mjs tests/plugin.test.mjs tests/plugin-runtime.test.mjs tools/quality-policy/project-profile.json",
      lint: "eslint plugin.js tests tools",
      typecheck: "tsc -p tsconfig.json",
      "schema:check": "node tools/starter-quality-checks.mjs schema",
      "test:focus:check": "node tools/starter-quality-checks.mjs focus",
      "test:node": "node --test tests/plugin.test.mjs && vitest run",
      "test:coverage": "vitest run --coverage",
      "duplication:check": "jscpd plugin.js tests --config jscpd.config.json --exit-code=1",
      "check:shared-core": "node tools/check-shared-core.mjs",
      "check:profile": "node tools/check-quality-profile.mjs",
      "check:generic-surface": "node tools/check-generic-surface.mjs",
      "check:generic-conformance": "node tools/check-generic-conformance.mjs",
      "check:standalone": "node tools/starter-quality-checks.mjs standalone",
      "check:suppressions": "node tools/portable-core/suppression-engine.mjs",
      "check:complexity": "node tools/starter-quality-checks.mjs complexity",
      "check:scaling": "node tools/starter-quality-checks.mjs scaling",
      "docs:check":
        "markdownlint-cli2 && linkinator README.md --markdown --check-fragments --server-root . --skip '^(https?://)' && node tools/starter-quality-checks.mjs docs",
      "check:filesize": "node tools/starter-quality-checks.mjs filesize",
      "package:check": "npm run schema:check",
      "check:standard": "npm run format:check && npm run lint && npm run duplication:check",
      "check:smells": "npm run duplication:check",
      "check:core":
        "node tools/portable-core/gate-orchestrator.mjs --roles standard,portable-core,generic-surface,standalone,suppressions,typing,packaging,focus,smells,product-contracts,test-split,complexity,scaling,documentation,file-size",
      "check:coverage": "npm run test:coverage",
      "check:all": "npm run check:core && npm run check:coverage",
      "check:fast": "npm run check:standard && npm run typecheck && npm run test:node"
    },
    devDependencies: starterDependencies(),
    engines: { node: ">=26 <27", npm: "12.0.1" },
    packageManager: "npm@12.0.1"
  };
}

/** @param {StarterOptions} options @returns {Record<string, unknown>} */
function qualityLock(options) {
  const lock = JSON.parse(sourceText("tools/starter-quality/package-lock-template.json"));
  const name = `${options.id}-development`;
  lock.name = name;
  lock.version = "0.1.0";
  lock.packages[""].name = name;
  lock.packages[""].version = "0.1.0";
  lock.packages[""].devDependencies = starterDependencies();
  lock.packages[""].engines = { node: ">=26 <27", npm: "12.0.1" };
  return lock;
}

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} relativePath @returns {string} */
function sourceText(relativePath) {
  return fs.readFileSync(path.join(SOURCE_ROOT, relativePath), "utf8");
}

/** @returns {Record<string, string>} */
function portableQualityFiles() {
  const contract = JSON.parse(sourceText("tools/quality-policy/portable-core-contract.json"));
  const paths = [...contract.mandatoryPaths, ...contract.metadataPaths];
  /** @type {Record<string, string>} */
  const files = {};
  for (const relativePath of [...new Set(paths)].sort()) files[relativePath] = sourceText(relativePath);
  return files;
}

/** @returns {Record<string, string>} */
function starterDependencies() {
  return {
    "@eslint-community/eslint-plugin-eslint-comments": "4.7.2",
    "@eslint/js": "10.0.1",
    acorn: "8.17.0",
    "@types/node": "26.1.1",
    "@vitest/coverage-v8": "4.1.10",
    ajv: "8.20.0",
    eslint: "10.8.0",
    "eslint-plugin-jsdoc": "63.0.13",
    "fast-check": "4.9.0",
    globals: "17.8.0",
    jscpd: "5.0.12",
    jsdom: "26.0.0",
    "jsonc-parser": "3.3.1",
    linkinator: "8.0.2",
    "markdownlint-cli2": "0.23.1",
    prettier: "3.9.6",
    stylelint: "17.14.1",
    "stylelint-config-standard": "40.0.0",
    typescript: "7.0.2",
    vitest: "4.1.10",
    yaml: "2.9.0"
  };
}

/** @returns {string} */
function agentsText() {
  return `# Project instructions\n\n<!-- BEGIN SHARED_INSTRUCTIONS -->\n\nThis greenfield plugin keeps runtime code dependency-free and browser-host compatible. Validate values at boundaries, add a focused test for each behavior change, and run \`npm run check:all\` before handoff. Never suppress, skip, or focus a failing check. Keep the portable quality core generic; product rules belong in the local profile.\n\n<!-- END SHARED_INSTRUCTIONS -->\n`;
}

/** @param {StarterOptions} options @returns {string} */
function minimalReadme(options) {
  return `# ${options.name}\n\nThis is the minimal AvNav plugin lesson. Runtime code stays in \`plugin.js\`; the seven-file scaffold is intentionally a smoke environment, not the quality-grade profile.\n\n## Start\n\n1. Run \`npm run check:all\`.\n2. Add one small behavior to \`plugin.js\`.\n3. Add its contract to \`tests/plugin.test.mjs\`.\n4. Run the complete check again.\n\nGenerate the quality-grade profile with \`--level quality --profile viewer-only\` or \`--profile python-plus-viewer\`.\n`;
}

/** @param {StarterOptions} options @returns {string} */
function qualityReadme(options) {
  return `# ${options.name}\n\nThis quality-grade AvNav plugin environment (${options.profile}) is a deterministic greenfield seed. Runtime code is dependency-free and loaded by the host without a bundler; development dependencies are used only by the maintained quality gates.\n\n## Start\n\n1. Use Node 26 and npm 12.0.1, then run \`npm ci\`.\n2. Install the pre-push hook with \`npm run hooks:install\`.\n3. Run \`npm run check:all\` before and after each change.\n4. Add a focused test for every new behavior; never suppress, skip, or focus a failing check.\n\nThe canonical role graph runs formatting, ESLint, TypeScript checkJs, Ajv schema validation, Vitest split/coverage, jscpd duplication checks, Markdown/link checks, and the signed portable-core/genericness policies. The profile and role graph are intentionally product-neutral so this tree can seed a new plugin without copying project rules.\n`;
}

/** @param {StarterOptions} options @returns {string} */
function pluginText(options) {
  return `/** @file ${options.name} browser entrypoint */\n(function (root) {\n  "use strict";\n  if (!root.avnav || !root.avnav.api) throw new Error("AvNav plugin API is unavailable.");\n})(globalThis);\n`;
}

/** @returns {string} */
function qualityPluginText() {
  return `/** @file AvNav browser entrypoint */\n(function (/** @type {any} */ root) {\n  "use strict";\n  if (!root.avnav || !root.avnav.api) throw new Error("AvNav plugin API is unavailable.");\n  root.avnav.api.registerPlugin?.({ id: "generated-plugin" });\n})(globalThis);\n`;
}

/** @returns {string} */
function testText() {
  return `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\nimport vm from "node:vm";\n\ntest("plugin loads with the host API and fails closed without it", () => {\n  const source = fs.readFileSync(new URL("../plugin.js", import.meta.url), "utf8");\n  assert.doesNotThrow(() => vm.runInNewContext(source, { avnav: { api: {} } }));\n  assert.throws(() => vm.runInNewContext(source, {}), /plugin API is unavailable/);\n});\n`;
}

/** @returns {string} */
function qualityTestText() {
  return `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\nimport vm from "node:vm";\n\ntest("host boundary is explicit", () => {\n  const source = fs.readFileSync(new URL("../plugin.js", import.meta.url), "utf8");\n  assert.doesNotThrow(() => vm.runInNewContext(source, { avnav: { api: { registerPlugin() {} } } }));\n  assert.throws(() => vm.runInNewContext(source, {}), /plugin API is unavailable/);\n});\n`;
}
/** @returns {string} */
function minimalCheckText() {
  return [
    'import fs from "node:fs";',
    'import path from "node:path";',
    'const roots = ["AGENTS.md", "README.md", "package.json", "plugin.json", "plugin.js", "tests", "tools"];',
    "const files = roots.flatMap((entry) => list(entry)).sort();",
    "for (const file of files) {",
    '  const source = fs.readFileSync(file, "utf8");',
    '  if (source.split(/\\r?\\n/).filter((line) => line.trim()).length > 400) throw new Error(file + ": exceeds 400 non-empty lines");',
    '  if (file !== "tools/check.mjs" && /\\b(?:FIXME|TODO)\\b/.test(source)) throw new Error(file + ": unresolved work marker");',
    "}",
    'const metadata = JSON.parse(fs.readFileSync("plugin.json", "utf8"));',
    'if (!/^[a-z][a-z0-9-]{2,39}$/.test(metadata.name)) throw new Error("plugin.json: invalid name");',
    'console.log("Starter quality check passed over " + files.length + " files.");',
    "function list(entry) {",
    '  if (!fs.existsSync(entry)) throw new Error("Missing required path: " + entry);',
    "  if (fs.statSync(entry).isFile()) return [entry];",
    "  return fs.readdirSync(entry).flatMap((name) => list(path.join(entry, name)));",
    "}",
    ""
  ].join("\n");
}

/** @returns {string} */
function workflowText() {
  return `name: quality\non:\n  push:\n  pull_request:\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 26\n          cache: npm\n      - run: npm ci\n      - run: npm run check:all\n`;
}

/** @returns {string} */
function prePushText() {
  return `#!/bin/sh\nset -eu\nnpm run check:all\n`;
}

/** @returns {string} */
function schemaText() {
  return `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "version", "title"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{2,39}$"
    },
    "version": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    }
  },
  "additionalProperties": false
}\n`;
}

/** @param {StarterOptions} options @returns {string} */
function profileText(options) {
  return `${compactJsonText({
    schemaVersion: 1,
    profileType: "product-quality-profile",
    product: {
      id: "greenfield-plugin",
      runtime: options.profile === "python-plus-viewer" ? "python-plus-browser" : "browser"
    },
    portableCore: { coreVersion: "3.2.0", roleGraph: "tools/quality-policy/portable-role-graph.json" },
    sourceScopes: [
      { id: "runtime", roots: ["plugin.js", ...(options.profile === "python-plus-viewer" ? ["plugin.py"] : [])] },
      { id: "tests", roots: ["tests"] },
      { id: "tools", roots: ["tools"] }
    ],
    languages: {
      javascript: true,
      markdown: true,
      ...(options.profile === "python-plus-viewer" ? { python: true } : {})
    },
    testProjects: [
      { id: "node", command: "npm run test:node", paths: ["tests/plugin.test.mjs"] },
      { id: "portable-core", command: "vitest run", paths: ["tests/portable-core", "tests/plugin-runtime.test.mjs"] }
    ],
    policies: {
      coverage: "tools/portable-core/coverage-engine.mjs",
      complexity: "tools/portable-core/complexity-engine.mjs",
      fileSize: "tools/portable-core/file-size-engine.mjs"
    },
    documentation: { roots: ["README.md", "AGENTS.md", ".agents"] },
    adapters: {
      setup: "npm ci",
      standard: "npm run check:standard",
      "portable-core": "npm run check:shared-core && npm run check:profile",
      "generic-surface": "npm run check:generic-surface && npm run check:generic-conformance",
      standalone: "npm run check:standalone",
      suppressions: "npm run check:suppressions",
      typing: "npm run typecheck",
      packaging: "npm run package:check",
      focus: "npm run test:focus:check",
      smells: "npm run check:smells",
      "product-contracts": "npm run schema:check",
      "test-split": "npm run test:node",
      complexity: "npm run check:complexity",
      scaling: "npm run check:scaling",
      documentation: "npm run docs:check",
      "file-size": "npm run check:filesize",
      coverage: "npm run check:coverage"
    }
  })}\n`;
}

/** @param {unknown} value @returns {string} */
function compactJsonText(value) {
  return JSON.stringify(value, null, 2).replace(/\[\n((?:\s+"[^"\n]+",?\n)+\s+)\]/g, (_match, body) => {
    const values = [...body.matchAll(/"([^"\n]+)"/g)].map((match) => `"${match[1]}"`);
    return `[${values.join(", ")}]`;
  });
}

/** @returns {string} */
function qualityCheckText() {
  return [
    'import fs from "node:fs";',
    'import { runGenericSurfaceCheck } from "./check-generic-surface.mjs";',
    'import { runSharedCoreCheck } from "./check-shared-core.mjs";',
    'const metadata = JSON.parse(fs.readFileSync("plugin.json", "utf8"));',
    'if (!/^[a-z][a-z0-9-]{2,39}$/.test(metadata.name)) throw new Error("plugin.json: invalid name");',
    'if (!runSharedCoreCheck({ print: false }).summary.ok) throw new Error("portable core contract failed");',
    'if (!runGenericSurfaceCheck({ print: false }).ok) throw new Error("generic surface contract failed");',
    'console.log("Starter quality check passed over the signed portable core.");',
    ""
  ].join("\n");
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  eslintConfigText,
  genericNamespaceText,
  genericTokensText,
  generatedCodingStandardsText,
  generatedDocumentationIndexText,
  generatedPlanGuideText,
  packageStarterText,
  hooksDoctorText,
  generatedQualityCheckText,
  generatedPythonRequirementsText,
  generatedPyprojectText,
  generatedSmellPreventionText,
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
  /** @type {Record<string, string>} */
  const files = {
    ...minimal,
    "README.md": qualityReadme(options),
    "package.json": `${JSON.stringify(qualityPackage(options), null, 2)}\n`,
    "package-lock.json": `${JSON.stringify(qualityLock(options), null, 2)}\n`,
    ".github/workflows/quality.yml": workflowText(options),
    ".githooks/pre-push": prePushText(),
    ".prettierignore": "node_modules/\ncoverage/\ndist/\n.venv/\n.pytest_cache/\n.quality-cache/\n",
    ".prettierrc.json": starterPrettierConfigText(),
    ".markdownlint-cli2.jsonc": markdownlintConfigText(),
    "eslint.config.mjs": eslintConfigText(),
    "vitest.config.js": vitestConfigText(),
    "tsconfig.json": tsConfigText(),
    "jscpd.config.json": jscpdConfigText(),
    "schemas/plugin.schema.json": schemaText(),
    "tools/quality-policy/project-profile.json": profileText(options),
    "tools/quality-policy/generic-tokens.json": genericTokensText(),
    "tools/check-generated-quality.mjs": generatedQualityCheckText(),
    "tools/package-starter.mjs": packageStarterText(options),
    "tools/hooks-doctor.mjs": hooksDoctorText(),
    "tools/check-patterns/generic/namespace-policy.mjs": genericNamespaceText(),
    "plugin.js": qualityPluginText(options),
    "plugin.mjs": qualityModuleText(options),
    "tests/plugin.test.mjs": qualityTestText(options),
    "tests/plugin-runtime.test.mjs": qualityVitestTestText(options),
    "tools/check.mjs": qualityCheckText(),
    "tools/starter-quality-checks.mjs": starterQualityChecksText(),
    "documentation/TABLEOFCONTENTS.md": generatedDocumentationIndexText(),
    "documentation/conventions/coding-standards.md": generatedCodingStandardsText(),
    "documentation/conventions/smell-prevention.md": generatedSmellPreventionText(),
    "documentation/guides/exec-plan-authoring.md": generatedPlanGuideText()
  };
  if (options.profile === "python-plus-viewer") {
    files["pyproject.toml"] = generatedPyprojectText();
    files["requirements-dev.txt"] = generatedPythonRequirementsText();
  }
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
      setup:
        options.profile === "python-plus-viewer"
          ? "npm ci && python3 -m venv .venv && ./.venv/bin/python -m pip install --upgrade pip && ./.venv/bin/python -m pip install -r requirements-dev.txt"
          : "npm ci",
      "hooks:install": "git config core.hooksPath .githooks",
      "hooks:doctor": "node tools/hooks-doctor.mjs",
      "format:check": "prettier --check .",
      format: "prettier --write .",
      lint: "eslint .",
      "lint:python": options.profile === "python-plus-viewer" ? "./.venv/bin/ruff check ." : "node --check plugin.js",
      "format:python":
        options.profile === "python-plus-viewer" ? "./.venv/bin/ruff format --check ." : "node --check plugin.js",
      typecheck: "tsc -p tsconfig.json",
      "typecheck:python":
        options.profile === "python-plus-viewer"
          ? "./.venv/bin/mypy . --strict --cache-dir .quality-cache/mypy"
          : "node --check plugin.js",
      "schema:check": "node tools/starter-quality-checks.mjs schema",
      "test:focus:check": "node tools/starter-quality-checks.mjs focus",
      "test:node": "node --test tests/plugin.test.mjs && vitest run",
      "test:python":
        options.profile === "python-plus-viewer"
          ? "./.venv/bin/python -m py_compile plugin.py tests/test_plugin.py && mkdir -p coverage/python && ./.venv/bin/pytest tests --cov=. --cov-branch --cov-report=json:coverage/python/coverage.json --cov-fail-under=80"
          : "node --check plugin.js",
      "test:coverage": "vitest run --coverage",
      "duplication:check": "jscpd . --config jscpd.config.json --exit-code=1",
      "check:shared-core": "node tools/check-shared-core.mjs",
      "check:profile": "node tools/check-quality-profile.mjs",
      "check:generic-surface":
        "node tools/check-generic-surface.mjs && node tools/check-generated-quality.mjs inventory",
      "check:generic-conformance": "node tools/check-generic-conformance.mjs",
      "check:standalone":
        "node tools/starter-quality-checks.mjs standalone && node tools/check-generated-quality.mjs standalone",
      "check:suppressions": "node tools/portable-core/suppression-engine.mjs",
      "check:complexity": "node tools/starter-quality-checks.mjs complexity && eslint .",
      "check:scaling": "node tools/starter-quality-checks.mjs scaling",
      "check:workflow": "node tools/check-generated-quality.mjs workflow",
      "docs:check": "markdownlint-cli2 && node tools/starter-quality-checks.mjs docs",
      "check:filesize":
        "node tools/starter-quality-checks.mjs filesize && node tools/check-generated-quality.mjs inventory",
      "package:create": "node tools/package-starter.mjs",
      "package:check":
        "npm run schema:check && node tools/package-starter.mjs --check && node tools/check-generated-quality.mjs package",
      "check:standard": "npm run format:check && npm run lint && npm run duplication:check",
      "check:smells": "node tools/check-generated-quality.mjs smells",
      "check:core":
        "node tools/portable-core/gate-orchestrator.mjs --roles standard,portable-core,generic-surface,standalone,suppressions,typing,packaging,focus,smells,product-contracts,test-split,complexity,scaling,documentation,file-size",
      "check:coverage": [
        "npm run test:coverage",
        "npm run test:python",
        "node tools/check-generated-quality.mjs coverage"
      ].join(" && "),
      "check:all": "npm run check:core && npm run check:coverage",
      "check:fast": "npm run check:standard && npm run typecheck && npm run test:node"
    },
    devDependencies: starterDependencies(),
    overrides: { "js-yaml": "5.2.2" },
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
  lock.packages[""].overrides = { "js-yaml": "5.2.2" };
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
    "@eslint/js": "10.0.1",
    "@types/node": "26.1.1",
    "@vitest/coverage-v8": "4.1.10",
    ajv: "8.20.0",
    eslint: "10.8.0",
    globals: "17.8.0",
    jscpd: "5.0.12",
    "jsonc-parser": "3.3.1",
    "markdownlint-cli2": "0.23.1",
    prettier: "3.9.6",
    typescript: "7.0.2",
    vitest: "4.1.10"
  };
}

/** @returns {string} */
function agentsText() {
  return `# Project instructions\n\n<!-- BEGIN SHARED_INSTRUCTIONS -->\n\nThis greenfield plugin keeps runtime code dependency-free and browser-host compatible. Validate values at boundaries, add a focused test for each behavior change, and run \`npm run check:all\` before handoff. Never suppress, skip, or focus a failing check. Keep the portable quality core generic; product rules belong in the local profile. Read the generated documentation index before changing quality policy.\n\n<!-- END SHARED_INSTRUCTIONS -->\n`;
}

/** @param {StarterOptions} options @returns {string} */
function minimalReadme(options) {
  return `# ${options.name}\n\nThis is the minimal AvNav plugin lesson. Runtime code stays in \`plugin.js\`; the seven-file scaffold is intentionally a smoke environment, not the quality-grade profile.\n\n## Start\n\n1. Run \`npm run check:all\`.\n2. Add one small behavior to \`plugin.js\`.\n3. Add its contract to \`tests/plugin.test.mjs\`.\n4. Run the complete check again.\n\nGenerate the quality-grade profile with \`--level quality --profile viewer-only\` or \`--profile python-plus-viewer\`.\n`;
}

/** @param {StarterOptions} options @returns {string} */
function qualityReadme(options) {
  return `# ${options.name}

This quality-grade AvNav plugin environment (${options.profile}) is a deterministic greenfield seed. Runtime code is dependency-free and loaded by the host without a bundler; development dependencies are used only by the maintained quality gates.

## Start

1. Use Node 26 and npm 12.0.1, then run \`npm run setup\`.
2. Install and inspect the pre-push hook with \`npm run hooks:install\` and \`npm run hooks:doctor\`.
3. Run \`npm run check:all\` before and after each change.
4. Add a focused test for every new behavior; never suppress, skip, or focus a failing check.

## First lesson

The working host boundary is in \`plugin.mjs\` and \`plugin.js\`; the first user-visible behavior is the dependency-free module initialization log. Add behavior under the discovered source roots and add its test before running the complete gate. A new file is automatically owned by formatting, lint, typing, smell, test, coverage, documentation, packaging, and file-size checks; an unsupported file type is rejected by the inventory check.

## Runtime and package

Create an AvNav-consumable deterministic artifact with \`npm run package:create\`; development files are excluded. \`npm run package:check\` verifies the metadata and exact runtime allowlist without leaving an artifact. The \`${options.profile}\` profile keeps its product-specific boundary in \`project-profile.json\`; the runtime itself remains build-free and dependency-free.

## Guidance

Read [coding standards](documentation/conventions/coding-standards.md) before adding files and [smell prevention](documentation/conventions/smell-prevention.md) when a gate fails. The portable core and generic conformance rules are vendored with signed digests; update profile-owned policy only when the owning check and its negative test are updated together.
`;
}

/** @param {StarterOptions} options @returns {string} */
function pluginText(options) {
  return `/** @file ${options.name} browser entrypoint */\n(function (root) {\n  "use strict";\n  if (!root.avnav || !root.avnav.api) throw new Error("AvNav plugin API is unavailable.");\n})(globalThis);\n`;
}

/** @param {StarterOptions} options @returns {string} */
function qualityPluginText(options) {
  return `/** @file ${options.name} legacy AvNav browser entrypoint */\n(function (/** @type {any} */ root) {\n  "use strict";\n  if (!root.avnav || !root.avnav.api) return;\n})(globalThis);\n`;
}

/** @param {StarterOptions} options @returns {string} */
function qualityModuleText(options) {
  return `/**\n * @file ${options.name} modern AvNav module entrypoint\n * Depends: none\n */\n\n/** @param {{getBaseUrl?: () => string, log?: (...args: unknown[]) => void}} api */\nexport default async function initPlugin(api) {\n  if (!api || typeof api.getBaseUrl !== "function" || typeof api.log !== "function") {\n    throw new Error("AvNav module API requires getBaseUrl() and log().");\n  }\n  const baseUrl = api.getBaseUrl();\n  if (typeof baseUrl !== "string" || baseUrl.trim() === "") throw new Error("AvNav base URL is invalid.");\n  api.log("${options.id} initialized");\n  return undefined;\n}\n`;
}

/** @returns {string} */
function testText() {
  return `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\nimport vm from "node:vm";\n\ntest("plugin loads with the host API and fails closed without it", () => {\n  const source = fs.readFileSync(new URL("../plugin.js", import.meta.url), "utf8");\n  assert.doesNotThrow(() => vm.runInNewContext(source, { avnav: { api: {} } }));\n  assert.throws(() => vm.runInNewContext(source, {}), /plugin API is unavailable/);\n});\n`;
}

/** @param {StarterOptions} options @returns {string} */
function qualityTestText(options) {
  return `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\nimport vm from "node:vm";\n\ntest("legacy host boundary is optional and safe", () => {\n  const source = fs.readFileSync(new URL("../plugin.js", import.meta.url), "utf8");\n  assert.doesNotThrow(() => vm.runInNewContext(source, { avnav: { api: {} } }));\n  assert.doesNotThrow(() => vm.runInNewContext(source, {}));\n});\n\ntest("modern module carries the requested identity", () => {\n  const source = fs.readFileSync(new URL("../plugin.mjs", import.meta.url), "utf8");\n  assert.match(source, /${options.id}/);\n});\n`;
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

/** @param {StarterOptions} options @returns {string} */
function workflowText(options) {
  const python =
    options.profile === "python-plus-viewer"
      ? `      - name: Set up Python\n        uses: actions/setup-python@a309ff8b426b58ec0e2a45f0f869d46889d02405 # v6.2.0\n        with:\n          python-version: "3.14"\n`
      : "";
  return `name: quality\non:\n  push:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2\n      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version: 26\n          cache: npm\n${python}      - run: npm run setup\n      - run: npm run check:all\n`;
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
      id: options.id,
      runtime: options.profile === "python-plus-viewer" ? "python-plus-browser" : "browser"
    },
    portableCore: { coreVersion: "3.2.0", roleGraph: "tools/quality-policy/portable-role-graph.json" },
    sourceScopes: [
      {
        id: "runtime",
        roots: ["plugin.js", "plugin.mjs", ...(options.profile === "python-plus-viewer" ? ["plugin.py"] : [])]
      },
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
      { id: "portable-core", command: "vitest run", paths: ["tests/portable-core", "tests/plugin-runtime.test.mjs"] },
      ...(options.profile === "python-plus-viewer"
        ? [{ id: "python", command: "npm run test:python", paths: ["plugin.py", "tests/test_plugin.py"] }]
        : [])
    ],
    policies: {
      coverage: "tools/portable-core/coverage-engine.mjs",
      complexity: "tools/portable-core/complexity-engine.mjs",
      fileSize: "tools/portable-core/file-size-engine.mjs"
    },
    documentation: { roots: ["README.md", "AGENTS.md", ".agents", "documentation"] },
    adapters: {
      setup: options.profile === "python-plus-viewer" ? "npm run setup" : "npm ci",
      standard:
        options.profile === "python-plus-viewer"
          ? "npm run check:standard && npm run lint:python && npm run format:python"
          : "npm run check:standard",
      "portable-core": "npm run check:shared-core && npm run check:profile",
      "generic-surface": "npm run check:generic-surface && npm run check:generic-conformance",
      standalone: "npm run check:standalone",
      suppressions: "npm run check:suppressions",
      typing:
        options.profile === "python-plus-viewer"
          ? "npm run typecheck && npm run typecheck:python"
          : "npm run typecheck",
      packaging: "npm run package:check",
      focus: "npm run test:focus:check",
      smells: "npm run check:smells",
      "product-contracts": "npm run schema:check && npm run check:workflow",
      "test-split":
        options.profile === "python-plus-viewer" ? "npm run test:node && npm run test:python" : "npm run test:node",
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

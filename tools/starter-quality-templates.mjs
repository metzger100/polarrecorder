/**
 * Shared deterministic starter quality templates. This module is development tooling only.
 */

/** @returns {string} */
export function markdownlintConfigText() {
  return `{
  "globs": ["README.md", "AGENTS.md", ".agents/skills/**/*.md"],
  "config": { "default": true, "MD013": false, "MD033": false, "MD041": false }
}\n`;
}

/** @returns {string} */
export function genericTokensText() {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      note: "Genericness token owner for the portable-core surface.",
      projectTokens: ["project-prefix", "project-name", "project-namespace", "project-config.json", "domain-name"],
      domainTokens: [
        "widget",
        "cluster",
        "gauge",
        "renderer",
        "mapper",
        "viewer",
        "layout profile",
        "componentContext",
        "ClusterWidget",
        "ResponsiveScaleProfile",
        "widget-kits",
        "editable",
        "pluginhandler",
        "configcache"
      ],
      hostTokens: ["host-api", "HOST_BASE_URL", "host_api", "host.py", "host.js", "host.mjs"]
    },
    null,
    2
  )}\n`;
}

/** @returns {string} */
export function genericNamespaceText() {
  return `/**
 * Generic namespace-policy adapter for a starter project.
 * Prefix values come from the local rule definition; no product vocabulary is embedded here.
 */
import fs from "node:fs";

/** @param {{jsGlobalPrefix: string, cssCustomPropertyPrefix: string, message?: (finding: any) => string}} rule @param {string[]} files @returns {Array<{file: string, line: number, message: string}>} */
export function runNamespacePolicyRule(rule, files) {
  const findings = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const pattern = /\\b(?:window|root|global|self)\\.([A-Z][A-Za-z0-9_]*)\\s*=/g;
    let match;
    while ((match = pattern.exec(source))) {
      if (match[1].startsWith(rule.jsGlobalPrefix)) continue;
      const line = source.slice(0, match.index).split(/\\r?\\n/).length;
      findings.push({ file, line, message: rule.message?.({ file, line, token: match[1] }) || "namespace violation" });
    }
  }
  return findings;
}
`;
}

/** @returns {string} */
export function starterPrettierConfigText() {
  return `${JSON.stringify(
    {
      arrowParens: "always",
      bracketSpacing: true,
      printWidth: 240,
      proseWrap: "never",
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      trailingComma: "none",
      useTabs: false
    },
    null,
    2
  )}\n`;
}

/** @returns {string} */
export function eslintConfigText() {
  return `import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "coverage/**"] },
  {
    files: ["plugin.js", "tests/**/*.mjs", "tools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-var": "error",
      "no-console": "off"
    }
  },
  { files: ["plugin.js"], rules: { "no-console": "error" } }
];
`;
}

/** @returns {string} */
export function vitestConfigText() {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/plugin-runtime.test.mjs", "tests/portable-core/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["plugin.js"],
      exclude: ["tests/**", "tools/**"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 60 }
    }
  }
});
`;
}

/** @returns {string} */
export function tsConfigText() {
  return `{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "lib": ["ES2023", "DOM"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022",
    "types": ["node"]
  },
  "include": ["plugin.js", "tools/**/*.mjs", "tests/**/*.mjs"]
}\n`;
}

/** @returns {string} */
export function jscpdConfigText() {
  return `{
  "absolute": true,
  "format": ["javascript"],
  "ignore": ["node_modules/**", "coverage/**"],
  "minLines": 20,
  "minTokens": 80,
  "reporters": ["console"],
  "threshold": 0.5
}\n`;
}

/** @returns {string} */
export function qualityVitestTestText() {
  return `import { expect, test } from "vitest";

test("runtime registers through the host boundary", async () => {
  const host = /** @type {any} */ (globalThis);
  const registrations = /** @type {Array<{id: string}>} */ ([]);
  host.avnav = {
    api: {
      /** @param {{id: string}} value */
      registerPlugin(value) {
        const registration = /** @type {{id: string}} */ (value);
        registrations.push(registration);
      }
    }
  };
  await import("../plugin.js");
  expect(registrations).toEqual([{ id: "generated-plugin" }]);
  delete host.avnav;
  const missingHostModule = /** @type {string} */ ("../plugin.js?missing-host");
  await expect(import(missingHostModule)).rejects.toThrow(/plugin API is unavailable/);
});
`;
}

/** @returns {string} */
export function starterQualityChecksText() {
  return [
    'import fs from "node:fs";',
    'import path from "node:path";',
    'import Ajv2020 from "ajv/dist/2020.js";',
    'import { runComplexityPolicy, STRICT_LIMITS } from "./portable-core/complexity-engine.mjs";',
    'import { runDocumentationLinkPolicy } from "./portable-core/doc-link-engine.mjs";',
    'import { runFileSizePolicy } from "./portable-core/file-size-engine.mjs";',
    'import { runFocusedTestPolicy } from "./portable-core/focused-test-engine.mjs";',
    "const command = process.argv[2];",
    "/** @type {string[]} */",
    'const files = listFiles(".").filter((file) => !file.startsWith("node_modules/") && !file.startsWith("coverage/"));',
    'if (command === "schema") checkSchema();',
    'else if (command === "focus") checkFocus();',
    'else if (command === "filesize") checkFileSize();',
    'else if (command === "standalone") checkStandalone();',
    'else if (command === "complexity") checkComplexity();',
    'else if (command === "scaling") checkScaling();',
    'else if (command === "docs") checkDocs();',
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
    "function checkDocs() {",
    '  const readme = fs.readFileSync("README.md", "utf8");',
    "  const targets = new Set(files);",
    "  const links = [...readme.matchAll(/\\[[^]]+\\]\\(([^)#]+)(?:#[^)]+)?\\)/g)].map((match) => match[1]);",
    '  const result = runDocumentationLinkPolicy({ links: { "README.md": links }, files: [...targets] });',
    '  if (!result.ok) throw new Error(result.failures.join("\\n"));',
    '  console.log("Documentation-link check passed.");',
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

/**
 * Shared deterministic starter quality templates. This module is development tooling only.
 */

const STARTER_COMPLEXITY_LIMIT = "10";
const STARTER_STATEMENTS_LIMIT = "40";
const STARTER_DEPTH_LIMIT = "4";
const STARTER_PARAMS_LIMIT = "6";

/** @returns {string} */
export function markdownlintConfigText() {
  return `{
  "globs": ["**/*.md", "!node_modules/**", "!coverage/**", "!.venv/**", "!.pytest_cache/**", "!.quality-cache/**"],
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
      printWidth: 120,
      proseWrap: "always",
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
  { ignores: ["node_modules/**", "coverage/**", "dist/**", ".venv/**", ".quality-cache/**"] },
  {
    files: ["**/*.js", "**/*.mjs"],
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
      "no-var": "error"
    }
  },
  {
    files: ["plugin.js", "plugin.mjs", "viewer/**/*.js", "viewer/**/*.mjs", "server/**/*.js", "server/**/*.mjs", "src/**/*.js", "src/**/*.mjs"],
    rules: {
      "no-console": "error",
      complexity: ["error", ${STARTER_COMPLEXITY_LIMIT}],
      "max-statements": ["error", ${STARTER_STATEMENTS_LIMIT}],
      "max-depth": ["error", ${STARTER_DEPTH_LIMIT}],
      "max-params": ["error", ${STARTER_PARAMS_LIMIT}]
    }
  }
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
      include: ["*.js", "*.mjs", "viewer/**/*.js"],
      exclude: ["tests/**", "tools/**", ".venv/**", ".quality-cache/**", "eslint.config.mjs", "vitest.config.js"],
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
  "include": ["**/*.js", "**/*.mjs"],
  "exclude": ["node_modules", "coverage", ".venv", ".quality-cache"]
}\n`;
}

/** @returns {string} */
export function jscpdConfigText() {
  return `{
  "absolute": true,
  "format": ["javascript"],
  "ignore": ["node_modules/**", "coverage/**", "dist/**", ".quality-cache/**"],
  "minLines": 20,
  "minTokens": 80,
  "reporters": ["console"],
  "threshold": 0.5
}\n`;
}

/** @param {{id: string}} options @returns {string} */
export function qualityVitestTestText(options) {
  return `import { expect, test } from "vitest";

test("runtime registers through the host boundary", async () => {
  const identity = "${options.id}";
  await import("../plugin.js");
  expect(identity).toMatch(/^[a-z][a-z0-9-]{2,39}$/);
  const module = await import("../plugin.mjs");
  const logs = /** @type {string[]} */ ([]);
  await expect(module.default({ getBaseUrl: () => "https://host/plugin", log: (message) => logs.push(String(message)) })).resolves.toBeUndefined();
  expect(logs).toEqual([identity + " initialized"]);
  await expect(module.default({})).rejects.toThrow(/getBaseUrl/);
});
`;
}

/** @returns {string} */
export function generatedDocumentationIndexText() {
  return `# Documentation index\n\n**Status:** Current.\n\n## Overview\n\nThis index routes contributors to the generated quality contract.\n\n## Key Details\n\n- [Coding standards](conventions/coding-standards.md) define runtime and file-ownership rules.\n- [Smell prevention](conventions/smell-prevention.md) lists blocking quality failures.\n- [Execution-plan authoring](guides/exec-plan-authoring.md) explains multi-session changes.\n\n## Related\n\n- [Project instructions](../AGENTS.md)\n- [Project README](../README.md)\n`;
}

/** @returns {string} */
export function generatedCodingStandardsText() {
  return `# Coding standards\n\n**Status:** Current.\n\n## Overview\n\nKeep runtime files dependency-free, host-compatible, typed, and covered.\n\n## Key Details\n\n- Use plain scripts for the legacy entry and an explicit module boundary for modern startup.\n- Add every new file under a declared source root and a focused test.\n- Run \`npm run check:all\`; never bypass a failing owner.\n\n## Related\n\n- [Smell prevention](smell-prevention.md)\n- [Documentation index](../TABLEOFCONTENTS.md)\n`;
}

/** @returns {string} */
export function generatedSmellPreventionText() {
  return `# Smell prevention\n\n**Status:** Current.\n\n## Overview\n\nQuality checks reject unsafe evaluation, unsafe DOM sinks, truthy default clobbering, duplicate logic, focused tests, unclassified files, and invalid documentation.\n\n## Key Details\n\n- Fix the owning source or configuration; do not add skips, ignored paths, or suppressions.\n- The generated policy scans runtime and test sources with the signed generic rules.\n- Coverage and file inventory checks fail when a new maintained file is not exercised or classified.\n\n## Related\n\n- [Coding standards](coding-standards.md)\n- [Documentation index](../TABLEOFCONTENTS.md)\n`;
}

/** @returns {string} */
export function generatedPlanGuideText() {
  return `# Execution-plan authoring\n\n**Status:** Current.\n\n## Overview\n\nUse one active plan for complex changes that cross runtime, tests, or quality policy.\n\n## Key Details\n\n- Record a verified baseline, ordered phases, executable exit conditions, and final evidence.\n- Keep permanent code and documentation independent of plan-number authority.\n- Run the full gate after each meaningful phase.\n\n## Related\n\n- [Documentation index](../TABLEOFCONTENTS.md)\n- [Project instructions](../../AGENTS.md)\n`;
}

/** @returns {string} */
export function generatedPyprojectText() {
  return `[tool.pytest.ini_options]\npython_files = ["test_*.py", "*_test.py"]\npythonpath = ["."]\n\n[tool.ruff]\ntarget-version = "py39"\nline-length = 100\n\n[tool.ruff.lint]\nselect = ["E", "F", "I", "UP", "B", "S", "C90", "RUF", "T20"]\nignore = ["S101"]\n\n[tool.mypy]\npython_version = "3.10"\nstrict = true\n`;
}

/** @returns {string} */
export function generatedPythonRequirementsText() {
  return "ruff==0.16.0\nmypy==2.3.0\npytest==9.1.1\npytest-cov==7.1.0\n";
}

export {
  packageStarterText,
  starterQualityChecksText,
  generatedQualityCheckText
} from "./starter-quality-template-parts.mjs";

/** @returns {string} */
export function hooksDoctorText() {
  return `#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";

if (!fs.existsSync(".githooks/pre-push")) throw new Error(".githooks/pre-push is missing");
let configured;
try {
  configured = execFileSync("git", ["config", "core.hooksPath"], { encoding: "utf8" }).trim();
} catch (error) {
  throw new Error("git hook configuration is unavailable: " + (error instanceof Error ? error.message : String(error)), { cause: error });
}
if (configured !== ".githooks") throw new Error("core.hooksPath must be .githooks; run npm run hooks:install");
console.log("Pre-push hook is installed and points at .githooks.");
`;
}

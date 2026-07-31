#!/usr/bin/env node

/**
 * @file create-avnav-plugin-starter - Generates a small, dependency-free AvNav plugin learning environment
 * Documentation: documentation/conventions/quality-gates.md
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** @typedef {{output: string, id: string, name: string}} StarterOptions */

/** @param {StarterOptions} options @returns {string[]} */
export function createStarter(options) {
  validateOptions(options);
  const output = path.resolve(options.output);
  if (fs.existsSync(output) && fs.readdirSync(output).length > 0) {
    throw new Error(`Starter output directory is not empty: ${output}`);
  }
  const files = starterFiles(options);
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(output, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }
  return Object.keys(files).sort();
}

/** @param {StarterOptions} options @returns {void} */
function validateOptions(options) {
  if (!options || typeof options !== "object") throw new Error("Starter options are required.");
  if (typeof options.output !== "string" || options.output.length === 0) throw new Error("--output is required.");
  if (typeof options.id !== "string" || !/^[a-z][a-z0-9-]{2,39}$/.test(options.id)) {
    throw new Error("--id must be 3-40 lowercase letters, digits, or hyphens and start with a letter.");
  }
  if (typeof options.name !== "string" || options.name.trim().length === 0) throw new Error("--name is required.");
}

/** @param {StarterOptions} options @returns {Record<string, string>} */
function starterFiles(options) {
  const metadata = JSON.stringify(
    {
      name: options.id,
      version: "0.1.0",
      title: options.name,
      description: `${options.name} AvNav plugin`
    },
    null,
    2
  );
  const packageData = JSON.stringify(
    {
      name: `${options.id}-development`,
      version: "0.1.0",
      private: true,
      scripts: { "check:all": "node tools/check.mjs && node --check plugin.js && node --test" }
    },
    null,
    2
  );
  return {
    "AGENTS.md": agentsText(),
    "README.md": readmeText(options),
    "package.json": packageData + "\n",
    "plugin.json": metadata + "\n",
    "plugin.js": pluginText(options),
    "tests/plugin.test.mjs": testText(),
    "tools/check.mjs": checkText()
  };
}

/** @returns {string} */
function agentsText() {
  return `# Project instructions

Keep the plugin dependency-free at runtime. Validate external values at their boundary, keep functions focused, add a
test with each behavior change, and run \`npm run check:all\` before handoff. Do not suppress or skip a failing check.
`;
}

/** @param {StarterOptions} options @returns {string} */
function readmeText(options) {
  return `# ${options.name}

This is a deliberately small AvNav plugin learning environment. Runtime code stays in \`plugin.js\`; tests use Node's
built-in runner, so the quality gate needs no downloaded package.

## Start

1. Run \`npm run check:all\`.
2. Add one small behavior to \`plugin.js\`.
3. Add its contract to \`tests/plugin.test.mjs\`.
4. Run the complete check again.
`;
}

/** @param {StarterOptions} options @returns {string} */
function pluginText(options) {
  return `/** @file ${options.name} browser entrypoint */
(function (root) {
  "use strict";
  if (!root.avnav || !root.avnav.api) throw new Error("AvNav plugin API is unavailable.");
})(globalThis);
`;
}

/** @returns {string} */
function testText() {
  return `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("plugin loads with the host API and fails closed without it", () => {
  const source = fs.readFileSync(new URL("../plugin.js", import.meta.url), "utf8");
  assert.doesNotThrow(() => vm.runInNewContext(source, { avnav: { api: {} } }));
  assert.throws(() => vm.runInNewContext(source, {}), /plugin API is unavailable/);
});
`;
}

/** @returns {string} */
function checkText() {
  return `import fs from "node:fs";
import path from "node:path";

const roots = ["AGENTS.md", "README.md", "package.json", "plugin.json", "plugin.js", "tests", "tools"];
const files = roots.flatMap((entry) => list(entry)).sort();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split(/\\r?\\n/).filter((line) => line.trim()).length;
  if (lines > 400) throw new Error(\`\${file}: exceeds 400 non-empty lines\`);
  if (file !== "tools/check.mjs" && /\\b(?:FIXME|TODO)\\b/.test(source)) {
    throw new Error(\`\${file}: unresolved work marker\`);
  }
}
const metadata = JSON.parse(fs.readFileSync("plugin.json", "utf8"));
if (!/^[a-z][a-z0-9-]{2,39}$/.test(metadata.name)) throw new Error("plugin.json: invalid name");
console.log(\`Starter quality check passed over \${files.length} files.\`);

function list(entry) {
  if (!fs.existsSync(entry)) throw new Error(\`Missing required path: \${entry}\`);
  if (fs.statSync(entry).isFile()) return [entry];
  return fs.readdirSync(entry).flatMap((name) => list(path.join(entry, name)));
}
`;
}

/** @param {string[]} argv @returns {StarterOptions} */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("Use --output, --id, and --name pairs.");
    values[key.slice(2)] = value;
  }
  return { output: values.output, id: values.id, name: values.name };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const files = createStarter(parseArgs(process.argv.slice(2)));
  console.log(`Created ${files.length} starter files.`);
}

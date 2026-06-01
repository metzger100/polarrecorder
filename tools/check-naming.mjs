#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const VIEWER_ROOT = path.join(ROOT, "viewer");
const failures = [];

for (const file of collectViewerJsFiles()) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.js$/.test(path.basename(file.rel))) {
    failures.push(`${file.rel}: JS filenames must be kebab-case`);
  }
  const content = fs.readFileSync(file.abs, "utf8");
  for (const match of content.matchAll(/Polarrecorder\.([A-Za-z_$][\w$]*)\s*=/g)) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(match[1])) {
      failures.push(`${file.rel}: exported namespace member '${match[1]}' must be PascalCase`);
    }
  }
  for (const match of content.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(match[1])) {
      failures.push(`${file.rel}: function '${match[1]}' must be camelCase`);
    }
  }
}

const summary = {
  ok: failures.length === 0,
  checkedJsFiles: collectViewerJsFiles().length,
  failures: failures.length
};

if (failures.length > 0) {
  for (const failure of failures) console.error(`[naming] ${failure}`);
  console.error("SUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("Naming check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function collectViewerJsFiles() {
  return fs.readdirSync(VIEWER_ROOT)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(VIEWER_ROOT, name), rel: `viewer/${name}` }));
}

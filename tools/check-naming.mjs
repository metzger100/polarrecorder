#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function runNamingCheck({ root = process.cwd(), print = true } = {}) {
  const viewerRoot = path.join(root, "viewer");
  const failures = [];
  const files = collectViewerJsFiles(viewerRoot);

  for (const file of files) {
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
    checkedJsFiles: files.length,
    failures: failures.length
  };

  if (print) reportNaming(failures, summary);
  return { ok: summary.ok, failures, summary };
}

function reportNaming(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[naming] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Naming check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

function collectViewerJsFiles(viewerRoot) {
  if (!fs.existsSync(viewerRoot)) return [];
  return fs.readdirSync(viewerRoot)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(viewerRoot, name), rel: `viewer/${name}` }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runNamingCheck().ok ? 0 : 1);
}

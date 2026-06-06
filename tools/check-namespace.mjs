#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function runNamespaceCheck({ root = process.cwd(), print = true } = {}) {
  const viewerRoot = path.join(root, "viewer");
  const failures = [];
  const files = collectViewerJsFiles(viewerRoot);

  for (const file of files) {
    const content = fs.readFileSync(file.abs, "utf8");
    if (!content.includes("window.Polarrecorder")) {
      failures.push(`${file.rel}: missing window.Polarrecorder namespace usage`);
    }
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const matches = lines[index].matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g);
      for (const match of matches) {
        if (match[1] !== "Polarrecorder") {
          failures.push(`${file.rel}:${index + 1}: illegal global window.${match[1]} assignment`);
        }
      }
    }
  }

  const summary = {
    ok: failures.length === 0,
    checkedJsFiles: files.length,
    failures: failures.length
  };

  if (print) reportNamespace(failures, summary);
  return { ok: summary.ok, failures, summary };
}

function reportNamespace(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[namespace] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Namespace check passed.");
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
  process.exit(runNamespaceCheck().ok ? 0 : 1);
}

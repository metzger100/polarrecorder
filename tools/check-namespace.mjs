#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const failures = [];

for (const file of collectRootJsFiles()) {
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
  checkedJsFiles: collectRootJsFiles().length,
  failures: failures.length
};

if (failures.length > 0) {
  for (const failure of failures) console.error(`[namespace] ${failure}`);
  console.error("SUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("Namespace check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function collectRootJsFiles() {
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(ROOT, name), rel: name }));
}

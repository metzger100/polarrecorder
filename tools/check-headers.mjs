#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const failures = [];

for (const file of collectRootJsFiles()) {
  const content = fs.readFileSync(file.abs, "utf8");
  const header = extractTopHeader(content);
  if (!header) {
    failures.push(`${file.rel}: missing top /** Module */ header`);
    continue;
  }
  for (const field of ["Module", "Documentation", "Depends"]) {
    if (!new RegExp(`^\\s*\\*\\s*${field}:\\s*.+$`, "m").test(header)) {
      failures.push(`${file.rel}: header missing ${field}`);
    }
  }
  const docMatch = header.match(/^\s*\*\s*Documentation:\s*(.+?)\s*$/m);
  if (docMatch) {
    const docPath = docMatch[1].trim().replace(/[?#].*$/, "");
    if (!fs.existsSync(path.join(ROOT, docPath))) {
      failures.push(`${file.rel}: Documentation target does not exist: ${docPath}`);
    }
  }
}

const summary = {
  ok: failures.length === 0,
  checkedJsFiles: collectRootJsFiles().length,
  failures: failures.length
};

if (failures.length > 0) {
  for (const failure of failures) console.error(`[headers] ${failure}`);
  console.error("SUMMARY_JSON=" + JSON.stringify(summary));
  process.exit(1);
}

console.log("Header check passed.");
console.log("SUMMARY_JSON=" + JSON.stringify(summary));

function collectRootJsFiles() {
  if (!fs.existsSync(ROOT)) return [];
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(ROOT, name), rel: name }));
}

function extractTopHeader(content) {
  let index = 0;
  if (content.charCodeAt(0) === 0xfeff) index = 1;
  while (/\s/.test(content[index] || "")) index += 1;
  if (!content.startsWith("/**", index)) return null;
  const end = content.indexOf("*/", index + 3);
  return end >= 0 ? content.slice(index, end + 2) : null;
}

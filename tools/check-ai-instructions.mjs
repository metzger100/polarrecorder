#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BEGIN = "<!-- BEGIN SHARED_INSTRUCTIONS -->";
const END = "<!-- END SHARED_INSTRUCTIONS -->";

const AGENTS_PATH = path.join(ROOT, "AGENTS.md");
const CLAUDE_PATH = path.join(ROOT, "CLAUDE.md");

try {
  const agents = readSharedSection(AGENTS_PATH, "AGENTS.md");
  const claude = readSharedSection(CLAUDE_PATH, "CLAUDE.md");

  if (agents !== claude) {
    const line = firstDifferentLine(agents, claude);
    console.error("Shared instruction blocks are out of sync.");
    console.error(`First differing line: ${line}`);
    console.error("Fix by running one of:");
    console.error("  npm run ai:sync:agents");
    console.error("  npm run ai:sync:claude");
    process.exit(1);
  }

  console.log("AI instruction files are in sync.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function readSharedSection(filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${fileName}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  return extractSharedSection(content, fileName);
}

function extractSharedSection(content, fileName) {
  const beginIndex = content.indexOf(BEGIN);
  if (beginIndex < 0) throw new Error(`${fileName}: missing marker '${BEGIN}'`);

  const endIndex = content.indexOf(END);
  if (endIndex < 0) throw new Error(`${fileName}: missing marker '${END}'`);
  if (endIndex < beginIndex) throw new Error(`${fileName}: end marker appears before begin marker`);

  const secondBegin = content.indexOf(BEGIN, beginIndex + BEGIN.length);
  if (secondBegin >= 0) throw new Error(`${fileName}: multiple begin markers found`);

  const secondEnd = content.indexOf(END, endIndex + END.length);
  if (secondEnd >= 0) throw new Error(`${fileName}: multiple end markers found`);

  return content.slice(beginIndex + BEGIN.length, endIndex);
}

function firstDifferentLine(a, b) {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const max = Math.max(aLines.length, bLines.length);

  for (let i = 0; i < max; i += 1) {
    if (aLines[i] !== bLines[i]) {
      return i + 1;
    }
  }

  return max;
}

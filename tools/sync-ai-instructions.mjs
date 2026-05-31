#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BEGIN = "<!-- BEGIN SHARED_INSTRUCTIONS -->";
const END = "<!-- END SHARED_INSTRUCTIONS -->";

const DOCS = {
  agents: { key: "agents", name: "AGENTS.md", path: path.join(ROOT, "AGENTS.md") },
  claude: { key: "claude", name: "CLAUDE.md", path: path.join(ROOT, "CLAUDE.md") }
};

const usage = [
  "Usage:",
  "  node tools/sync-ai-instructions.mjs --from=agents|claude",
  "",
  "Behavior:",
  "  - Copies shared instructions from the selected source to the other file.",
  "  - Preserves content outside shared instruction markers.",
  "  - If --from is omitted and the shared blocks differ, the command fails.",
  "  - If --from is omitted and the shared blocks are equal, no-op success."
].join("\n");

try {
  const from = parseFromArg(process.argv.slice(2));
  const docs = {
    agents: readDoc(DOCS.agents),
    claude: readDoc(DOCS.claude)
  };

  if (!from) {
    if (docs.agents.shared === docs.claude.shared) {
      console.log("No changes: AGENTS.md and CLAUDE.md shared instructions are already identical.");
      process.exit(0);
    }

    console.error("Shared instructions differ. Use --from=agents or --from=claude to choose sync direction.");
    console.error(usage);
    process.exit(1);
  }

  const source = docs[from];
  const target = docs[from === "agents" ? "claude" : "agents"];

  if (source.shared === target.shared) {
    console.log(`No changes: ${source.name} and ${target.name} shared instructions are already synchronized.`);
    process.exit(0);
  }

  const nextTargetContent = target.prefix + source.shared + target.suffix;
  fs.writeFileSync(target.path, nextTargetContent, "utf8");

  console.log(`Synchronized shared instructions from ${source.name} to ${target.name}.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseFromArg(args) {
  let from = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      console.log(usage);
      process.exit(0);
    }

    if (arg.startsWith("--from=")) {
      from = arg.slice("--from=".length);
      continue;
    }

    if (arg === "--from") {
      const next = args[i + 1];
      if (!next) throw new Error("Missing value after --from. Expected: agents|claude");
      from = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (from === null) return null;
  if (from !== "agents" && from !== "claude") {
    throw new Error(`Invalid --from value: '${from}'. Expected: agents|claude`);
  }

  return from;
}

function readDoc(doc) {
  if (!fs.existsSync(doc.path)) {
    throw new Error(`Missing required file: ${doc.name}`);
  }

  const content = fs.readFileSync(doc.path, "utf8");
  const section = extractSharedSection(doc.name, content);

  return {
    ...doc,
    ...section,
    content
  };
}

function extractSharedSection(name, content) {
  const beginIndex = content.indexOf(BEGIN);
  if (beginIndex < 0) throw new Error(`${name}: missing marker '${BEGIN}'`);

  const endIndex = content.indexOf(END);
  if (endIndex < 0) throw new Error(`${name}: missing marker '${END}'`);
  if (endIndex < beginIndex) throw new Error(`${name}: end marker appears before begin marker`);

  const secondBegin = content.indexOf(BEGIN, beginIndex + BEGIN.length);
  if (secondBegin >= 0) throw new Error(`${name}: multiple begin markers found`);

  const secondEnd = content.indexOf(END, endIndex + END.length);
  if (secondEnd >= 0) throw new Error(`${name}: multiple end markers found`);

  const sharedStart = beginIndex + BEGIN.length;
  const sharedEnd = endIndex;

  return {
    prefix: content.slice(0, sharedStart),
    shared: content.slice(sharedStart, sharedEnd),
    suffix: content.slice(sharedEnd)
  };
}

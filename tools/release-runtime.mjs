import fs from "node:fs";
import path from "node:path";

const FIXED_RUNTIME_FILES = [
  "README.md",
  "plugin.css",
  "plugin.json",
  "plugin.mjs",
  "plugin.py",
  "viewer/icon.svg",
  "viewer/viewer.css",
  "viewer/viewer.html"
];

const RUNTIME_PREFIXES = [
  "server/polarrecorder/",
  "viewer/"
];

export function isRuntimePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return false;
  }
  const normalized = normalizeRelativePath(filePath);
  if (FIXED_RUNTIME_FILES.includes(normalized)) {
    return true;
  }
  return RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function buildReleaseManifest(rootDir) {
  const files = new Set(FIXED_RUNTIME_FILES);
  collectMatchingFiles(files, rootDir, path.join(rootDir, "viewer"), (filePath) => {
    return path.extname(filePath) === ".js";
  });
  collectMatchingFiles(
    files,
    rootDir,
    path.join(rootDir, "server", "polarrecorder"),
    (filePath) => path.extname(filePath) === ".py"
  );
  return Array.from(files).sort((a, b) => a.localeCompare(b));
}

export function validateManifest(rootDir, files) {
  const missing = [];

  for (const relPath of files) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) {
      missing.push(relPath);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

function collectMatchingFiles(files, rootDir, startPath, predicate) {
  if (!fs.existsSync(startPath)) {
    return;
  }
  walkFiles(startPath, (absFile) => {
    if (!predicate(absFile)) {
      return;
    }
    files.add(path.relative(rootDir, absFile).replace(/\\/g, "/"));
  });
}

function walkFiles(currentPath, visitor) {
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    visitor(currentPath);
    return;
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    walkFiles(path.join(currentPath, entry.name), visitor);
  }
}

function normalizeRelativePath(rawPath) {
  return rawPath
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .replace(/^\.\//, "")
    .trim();
}

import fs from "node:fs";

import { maskCode, maskStringsOnly } from "./source-scan.mjs";

/**
 * Per-run cache of {@link import("./shared.mjs").FileData} keyed by absolute
 * path, so every rule scanning the same file reuses one read and one pair of
 * masked-text computations instead of redoing them per rule.
 * @type {Map<string, import("./shared.mjs").FileData>}
 */
let cache = new Map();

/**
 * Clear the file-data cache for a fresh run (mirrors `setRoot()`).
 * @returns {void}
 */
export function resetFileCache() {
  cache = new Map();
}

/**
 * @param {import("./shared.mjs").PatternFile} file File to read and mask.
 * @returns {import("./shared.mjs").FileData} Cached raw content, line split,
 *   comment-and-string masked text, and string-only masked text.
 */
export function getFileData(file) {
  let data = cache.get(file.abs);
  if (!data) {
    const content = fs.readFileSync(file.abs, "utf8");
    data = {
      content,
      lines: content.split(/\r?\n/),
      masked: maskCode(content),
      maskedStringsOnly: maskStringsOnly(content)
    };
    cache.set(file.abs, data);
  }
  return data;
}

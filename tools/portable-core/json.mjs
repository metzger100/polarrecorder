/**
 * Product-neutral JSON loading helpers with duplicate-key rejection.
 */

import fs from "node:fs";

/**
 * @typedef {{ok: true, value: unknown} | {ok: false, error: string}}
 * JsonReadResult
 */

/**
 * Reject duplicate object keys before JSON.parse loses that information.
 * @param {string} source
 * @returns {string[]}
 */
export function duplicateJsonKeys(source) {
  /** @type {string[]} */
  const keys = [];
  const stack = [];
  let inString = false;
  let escaped = false;
  let expectKey = false;
  let keyStart = -1;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') {
        inString = false;
        if (expectKey) {
          const key = JSON.parse(source.slice(keyStart, index + 1));
          const current = stack[stack.length - 1];
          if (current?.has(key)) keys.push(key);
          current?.add(key);
          expectKey = false;
        }
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      keyStart = index;
    } else if (character === "{") {
      stack.push(new Set());
      expectKey = true;
    } else if (character === "}") {
      stack.pop();
      expectKey = false;
    } else if (character === "," && stack.length > 0) {
      expectKey = true;
    }
  }
  return [...new Set(keys)];
}

/**
 * Read JSON from a local file and reject malformed or duplicate-key content.
 * @param {string} absolutePath
 * @returns {JsonReadResult}
 */
export function readJson(absolutePath) {
  let source;
  try {
    source = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unable to read JSON" };
  }
  const duplicates = duplicateJsonKeys(source);
  if (duplicates.length > 0) return { ok: false, error: `duplicate JSON keys: ${duplicates.join(", ")}` };
  try {
    return { ok: true, value: JSON.parse(source) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "malformed JSON" };
  }
}

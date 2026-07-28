import { getFileData } from "../file-cache.mjs";
import { countRefs, scanJs } from "../source-scan.mjs";
import { collectJavaScriptPatternFiles } from "../discovery.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").PatternFile} PatternFile
 */

const CANVAS_METHODS = [
  "arc",
  "beginPath",
  "clearRect",
  "closePath",
  "fill",
  "fillRect",
  "fillText",
  "lineTo",
  "measureText",
  "moveTo",
  "restore",
  "rotate",
  "save",
  "scale",
  "setLineDash",
  "stroke",
  "strokeRect",
  "translate"
];

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runDefaultTruthyFallback(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
    scanJs(
      masked,
      file,
      /\b[A-Za-z_$][\w$.]*\.default\s*\|\|/g,
      () =>
        "default-truthy-fallback: '.default ||' clobbers explicit falsy defaults " +
        "(\"\", 0, false); use '??' or a presence check",
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runRedundantNullTypeGuard(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
    scanJs(
      masked,
      file,
      /\bArray\.isArray\s*\(\s*([A-Za-z_$][\w$.]*)\s*\)\s*\?\s*\1\s*:\s*\[\s*\]/g,
      () =>
        "redundant-null-type-guard: 'Array.isArray(x) ? x : []' re-sanitizes a " +
        "guaranteed value; trust the producer contract",
      lines
    );
    scanJs(
      masked,
      file,
      /\bString\s*\(\s*\(?\s*([A-Za-z_$][\w$.]*)\s*==\s*null\s*\)?\s*\?\s*[^:]+:\s*\1\s*\)/g,
      () =>
        "redundant-null-type-guard: 'String(x == null ? ... : x)' re-sanitizes a " +
        "guaranteed value; trust the producer contract",
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runPromiseEmptyCatch(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
    scanJs(
      masked,
      file,
      /\.catch\s*\(\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{\s*\}\s*\)/g,
      () =>
        "promise-empty-catch: empty Promise catch swallows errors silently; route " +
        "the error to an existing handler or update visible state",
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runPrematureLegacySupport(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
    // 'fallback' is intentionally excluded ('unused-fallback' covers stale fallbacks; a wired
    // fallback such as 'fallbackPresets' is legitimate).
    scanJs(
      masked,
      file,
      /\b(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
      (m) =>
        /(legacy|compat|deprecated)/i.test(m[1])
          ? `premature-legacy-support: '${m[1]}' looks like a speculative legacy/` +
            "compat path; remove it unless an active boundary contract requires it"
          : null,
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runUnusedFallback(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
    const seenFallback = new Set();
    scanJs(
      masked,
      file,
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
      (m) => {
        const name = m[1];
        if (!/fallback/i.test(name) || seenFallback.has(name)) return null;
        seenFallback.add(name);
        if (countRefs(masked, name) > 1) return null;
        return (
          `unused-fallback: '${name}' is declared but never used; remove the ` +
          "stale fallback leftover or wire it into an active path"
        );
      },
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runResponsiveLayoutHardFloor(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
    scanJs(
      masked,
      file,
      /\bMath\.max\s*\(\s*(\d+(?:\.\d+)?)\s*,/g,
      (m) =>
        Number(m[1]) >= 8
          ? "responsive-layout-hard-floor: user-visible layout/text floors must come " +
            "from a shared owner, not an inline Math.max literal"
          : null,
      lines
    );
    scanJs(
      masked,
      file,
      /\bclamp\s*\([^,]+,\s*(\d+(?:\.\d+)?)\s*,/g,
      (m) =>
        Number(m[1]) >= 8
          ? "responsive-layout-hard-floor: user-visible layout/text floors must come " +
            "from a shared owner, not an inline clamp literal"
          : null,
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runCanvasApiTypeofGuard(files) {
  const methods = CANVAS_METHODS.join("|");
  const pattern = new RegExp(`typeof\\s+[A-Za-z_$][\\w$]*\\.(${methods})\\s*===\\s*["']function["']`, "g");
  for (const file of files) {
    const { content, lines } = getFileData(file);
    scanJs(
      content,
      file,
      pattern,
      (m) => `canvas-api-typeof-guard: trust the validated Canvas 2D context; do not guard ctx.${m[1]} internally`,
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runTryFinallyCanvasDrawing(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
    scanJs(
      masked,
      file,
      /try\s*\{[\s\S]{0,240}\bctx\.save\s*\([\s\S]{0,240}\bfinally\s*\{[\s\S]{0,160}\bctx\.restore\s*\(/g,
      () =>
        "try-finally-canvas-drawing: keep internal canvas save/draw/restore paths direct; " +
        "reserve try/finally for real boundary cleanup",
      lines
    );
  }
}

const JS_SCOPE = { key: "js-all", collect: collectJavaScriptPatternFiles };

/** @type {Rule[]} */
export const STRUCTURAL_GENERIC_RULES = [
  {
    id: "default-truthy-fallback",
    name: "default-truthy-fallback",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runDefaultTruthyFallback(files)
  },
  {
    id: "redundant-null-type-guard",
    name: "redundant-null-type-guard",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runRedundantNullTypeGuard(files)
  },
  {
    id: "promise-empty-catch",
    name: "promise-empty-catch",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runPromiseEmptyCatch(files)
  },
  {
    id: "premature-legacy-support",
    name: "premature-legacy-support",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runPrematureLegacySupport(files)
  },
  {
    id: "unused-fallback",
    name: "unused-fallback",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runUnusedFallback(files)
  },
  {
    id: "responsive-layout-hard-floor",
    name: "responsive-layout-hard-floor",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runResponsiveLayoutHardFloor(files)
  },
  {
    id: "canvas-api-typeof-guard",
    name: "canvas-api-typeof-guard",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runCanvasApiTypeofGuard(files)
  },
  {
    id: "try-finally-canvas-drawing",
    name: "try-finally-canvas-drawing",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runTryFinallyCanvasDrawing(files)
  }
];

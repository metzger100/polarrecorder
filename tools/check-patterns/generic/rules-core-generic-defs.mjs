import { getFileData, scopeFor } from "../shared.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").Finding} Finding
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
 * @param {string} masked
 * @param {string} file
 * @param {RegExp} regex
 * @param {(match: RegExpExecArray) => (string | null)} build
 * @returns {Finding[]}
 */
function scanMasked(masked, file, regex, build) {
  /** @type {Finding[]} */
  const out = [];
  let match;
  while ((match = regex.exec(masked)) !== null) {
    const message = build(match);
    if (message === null) continue;
    const line = masked.slice(0, match.index).split(/\r?\n/).length;
    out.push({ file, line, message });
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runDefaultTruthyFallback(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
    out.push(
      ...scanMasked(
        masked,
        file,
        /\b[A-Za-z_$][\w$.]*\.default\s*\|\|/g,
        () =>
          "default-truthy-fallback: '.default ||' clobbers explicit falsy defaults " +
          "(\"\", 0, false); use '??' or a presence check"
      )
    );
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runRedundantNullTypeGuard(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
    out.push(
      ...scanMasked(
        masked,
        file,
        /\bArray\.isArray\s*\(\s*([A-Za-z_$][\w$.]*)\s*\)\s*\?\s*\1\s*:\s*\[\s*\]/g,
        () =>
          "redundant-null-type-guard: 'Array.isArray(x) ? x : []' re-sanitizes a " +
          "guaranteed value; trust the producer contract"
      )
    );
    out.push(
      ...scanMasked(
        masked,
        file,
        /\bString\s*\(\s*\(?\s*([A-Za-z_$][\w$.]*)\s*==\s*null\s*\)?\s*\?\s*[^:]+:\s*\1\s*\)/g,
        () =>
          "redundant-null-type-guard: 'String(x == null ? ... : x)' re-sanitizes a " +
          "guaranteed value; trust the producer contract"
      )
    );
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runPromiseEmptyCatch(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
    out.push(
      ...scanMasked(
        masked,
        file,
        /\.catch\s*\(\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{\s*\}\s*\)/g,
        () =>
          "empty-catch: empty Promise catch swallows errors silently; route " +
          "the error to an existing handler or update visible state"
      )
    );
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runPrematureLegacySupport(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
    // 'fallback' is intentionally excluded ('unused-fallback' covers stale fallbacks; a wired
    // fallback such as 'fallbackPresets' is legitimate).
    out.push(
      ...scanMasked(masked, file, /\b(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g, (m) =>
        /(legacy|compat|deprecated)/i.test(m[1])
          ? `premature-legacy-support: '${m[1]}' looks like a speculative legacy/` +
            "compat path; remove it unless an active boundary contract requires it"
          : null
      )
    );
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runUnusedFallback(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
    const seenFallback = new Set();
    out.push(
      ...scanMasked(masked, file, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, (m) => {
        const name = m[1];
        if (!/fallback/i.test(name) || seenFallback.has(name)) return null;
        seenFallback.add(name);
        const matches = masked.match(new RegExp(`\\b${name}\\b`, "g"));
        const uses = matches ? matches.length : 0;
        if (uses > 1) return null;
        return (
          `unused-fallback: '${name}' is declared but never used; remove the ` +
          "stale fallback leftover or wire it into an active path"
        );
      })
    );
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runResponsiveLayoutHardFloor(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
    out.push(
      ...scanMasked(masked, file, /\bMath\.max\s*\(\s*(\d+(?:\.\d+)?)\s*,/g, (m) =>
        Number(m[1]) >= 8
          ? "responsive-layout-hard-floor: user-visible layout/text floors must come " +
            "from a shared owner, not an inline Math.max literal"
          : null
      )
    );
    out.push(
      ...scanMasked(masked, file, /\bclamp\s*\([^,]+,\s*(\d+(?:\.\d+)?)\s*,/g, (m) =>
        Number(m[1]) >= 8
          ? "responsive-layout-hard-floor: user-visible layout/text floors must come " +
            "from a shared owner, not an inline clamp literal"
          : null
      )
    );
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runCanvasApiTypeofGuard(files) {
  /** @type {Finding[]} */
  const out = [];
  const methods = CANVAS_METHODS.join("|");
  const pattern = new RegExp(`typeof\\s+[A-Za-z_$][\\w$]*\\.(${methods})\\s*===\\s*["']function["']`, "g");
  for (const file of files) {
    const { text } = getFileData(file);
    out.push(
      ...scanMasked(
        text,
        file,
        pattern,
        (m) => `canvas-api-typeof-guard: trust the validated Canvas 2D context; do not guard ctx.${m[1]} internally`
      )
    );
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runTryFinallyCanvasDrawing(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
    out.push(
      ...scanMasked(
        masked,
        file,
        /try\s*\{[\s\S]{0,240}\bctx\.save\s*\([\s\S]{0,240}\bfinally\s*\{[\s\S]{0,160}\bctx\.restore\s*\(/g,
        () =>
          "try-finally-canvas-drawing: keep internal canvas save/draw/restore paths direct; " +
          "reserve try/finally for real boundary cleanup"
      )
    );
  }
  return out;
}

/** @type {Rule[]} */
export const STRUCTURAL_GENERIC_RULES = [
  {
    id: "default-truthy-fallback",
    name: "default-truthy-fallback",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runDefaultTruthyFallback(files)
  },
  {
    id: "redundant-null-type-guard",
    name: "redundant-null-type-guard",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runRedundantNullTypeGuard(files)
  },
  {
    id: "empty-catch",
    name: "empty-catch",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runPromiseEmptyCatch(files)
  },
  {
    id: "premature-legacy-support",
    name: "premature-legacy-support",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runPrematureLegacySupport(files)
  },
  {
    id: "unused-fallback",
    name: "unused-fallback",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runUnusedFallback(files)
  },
  {
    id: "responsive-layout-hard-floor",
    name: "responsive-layout-hard-floor",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runResponsiveLayoutHardFloor(files)
  },
  {
    id: "canvas-api-typeof-guard",
    name: "canvas-api-typeof-guard",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runCanvasApiTypeofGuard(files)
  },
  {
    id: "try-finally-canvas-drawing",
    name: "try-finally-canvas-drawing",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runTryFinallyCanvasDrawing(files)
  }
];

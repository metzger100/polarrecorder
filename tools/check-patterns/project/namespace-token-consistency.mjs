import { scopeFor } from "../shared.mjs";
import { runNamespacePolicyRule } from "../generic/namespace-policy.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 */

// The project instance of the generic namespace-policy rule: registers this repository's
// global-namespace token and CSS custom-property prefix as configuration, replacing the
// former standalone tools/check-naming.mjs and tools/check-namespace.mjs.
/** @type {Rule[]} */
export const NAMESPACE_TOKEN_CONSISTENCY_RULES = [
  {
    id: "namespace-token-consistency",
    name: "namespace-token-consistency",
    severity: "block",
    scope: scopeFor("viewer-only"),
    jsGlobalPrefix: "Polarrecorder",
    cssCustomPropertyPrefix: "--polarrecorder-",
    filenameCase: "kebab",
    memberCase: "pascal",
    functionCase: "camel",
    run: runNamespacePolicyRule
  }
];

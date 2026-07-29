# PLAN9 — Make the generic quality surface byte-identical across both role-model repositories

## Status

Written after a third cross-repository quality-system audit on 2026-07-28, executed mechanically against both checkouts:
full `git ls-files` set arithmetic, `cmp` over every same-named file, a name-normalised re-diff of every shared tooling
file, rule-registry extraction and set comparison, SHA-256 recomputation of every agent skill file against both lock
files, suppression counts by kind and area, JSON reconciliation of every baseline against disk, and a complete
`npm run check:all` run in both repositories.

`PLAN8.md` converged the shared quality **contract**: one gate vocabulary, one command graph, one CI workflow, one
documentation shape, a generic/project rule split, the shared JavaScript runner, and a marked `SHARED_INSTRUCTIONS`
block. That work landed and holds. This plan closes the gap `PLAN8.md` left open: the contract converged, but the
**implementations behind it did not**. After normalising away every project name, the shared tooling files still differ
by 36 % to 98 % of their lines, and `tools/check-patterns/shared.mjs` shares zero exported symbol names with its
counterpart. "Shared" is currently asserted by prose markers and per-repository token blocklists; nothing mechanically
proves that any generic artifact is the same artifact in both repositories.

This plan makes the generic surface byte-identical and mechanically proves it, while leaving every project-specific part
free to differ.

The coding agent may choose equivalent internal helper names, test names, and file splits inside a phase. The shared
core manifest, the canonical rule identifiers, the per-artifact donation table, the single genericness token owner, the
project-owned-data boundary, and the paired acceptance matrix are prescriptive.

No pre-plan interview was run. The audit resolved the relevant design branches, so this plan makes these assumptions
explicit:

1. Plugin runtime behavior, Python APIs, the validation pipeline, persistence, exports and imports, presets, viewer
   behavior, AvNav integration, packaging, and release artifacts remain unchanged. No user-visible behavior changes.
2. This repository remains a Python/JavaScript hybrid **role model**, not a greenfield template. Neither repository can
   be used directly for a greenfield project, and this plan does not try to make that true. The greenfield environment
   will be written separately and derived from the byte-identical core this plan produces.
3. Required gates must remain independently runnable. No gate may read the sibling Dyninstruments checkout, at any
   phase, for any reason. Cross-repository identity is proven by both repositories committing the **same manifest
   digests**, verified locally in each.
4. The paired implementation plan is Dyninstruments `exec-plans/active/PLAN42.md`, with the same title. The two plans
   share the Shared Core Contract, the Canonical Rule Identifiers table, and the Paired Acceptance Matrix verbatim.
5. Donation direction is decided per artifact on audited merit, not per repository. This repository donates some
   implementations and adopts others.
6. Python remains this repository's exclusive concern. No Python tool, rule, or contract enters the generic surface;
   Python support reaches the shared checkers only through documented extension points.

Repository rules and core principles outrank this plan. If implementation reveals a conflict, amend the active plan with
repository evidence instead of weakening a gate or silently improvising.

---

## Goal

Turn the two independently healthy quality systems into one byte-identical generic core plus two project profiles, so
the core can be lifted into a greenfield generator without any further design decisions.

Expected outcomes after completion:

- A committed `tools/quality-policy/shared-core-manifest.json` lists every generic-surface path with its SHA-256, and
  `npm run check:shared-core` fails when any listed file drifts. Both repositories commit the **identical** manifest, so
  cross-repository identity is enforced without either gate reading the other checkout.
- One genericness token owner replaces the six inconsistent blocklists, and one shared checker applies it to the
  `SHARED_INSTRUCTIONS` block, every generic skill file, every generic rule definition (content and semantics), and
  every generic tool module.
- `tools/check-patterns.mjs`, its shared modules, and its generic rule definitions are byte-identical in both
  repositories, on the donated engine — which means adopting a severity model, a `--warn` mode, per-finding suppression,
  and a declarative default runner this repository does not have today.
- Every generic rule concept has exactly one canonical identifier and one classification, identical in both. This
  repository's Python rules stay project rules and are unaffected.
- Complexity, coverage-inventory, and test-inventory **mechanisms** are byte-identical; their **baseline data** stays
  project-owned. This repository adopts the mechanisms with an **empty** complexity baseline, which reproduces its
  current strict, no-exception enforcement exactly.
- The Python coverage reader becomes an adapter behind the shared coverage-inventory extension point instead of a forked
  checker, so the per-file classification schema covers Python and JavaScript alike.
- Sixteen bespoke tools this repository still carries are retired against named replacement owners, each with a recorded
  equivalence proof.
- `skills-lock.json` stops recording false sibling-repository provenance and records verified local provenance instead.
- `npm run check:all` stays green in this repository at the end of every phase.

---

## Verified Baseline

Verified against this checkout at `e03962b` and the Dyninstruments checkout at `c743f965` on 2026-07-28. Both worktrees
clean, both on `main`.

1. `npm run check:all` exits 0 in both repositories. This repository reports 378 passing pytest tests, 34 passing JS
   test files, viewer coverage 91.12 % statements / 73.95 % branches / 85.99 % functions / 92.39 % lines, and "Coverage
   inventory check passed."
2. 91 tracked paths exist in both repositories. Exactly 6 are byte-identical: `.codex/config.toml`,
   `.github/workflows/quality.yml`, `.nvmrc`, `.prettierrc.json`, `schemas/avnav-plugin-base.schema.json`, and
   `exec-plans/active/.gitkeep`. The other 85 diverge.
3. Every maintained tool is pinned to the identical version in both repositories: eslint 10.8.0, prettier 3.9.6, vitest
   4.1.10, typescript 7.0.2, stylelint 17.14.1, markdownlint-cli2 0.23.1, jscpd 5.0.12, ajv 8.20.0, linkinator 8.0.2.
   `engines` and `packageManager` are identical.
4. After normalising `polarrecorder|dyninstruments|Dyni|DyniComponents|…` to a single token, collapsing whitespace, and
   dropping blank lines, residual divergence across shared tooling files is: `install.sh` 1 %,
   `tools/quality-policy/run-format.mjs` 36 %, `tools/release-prepare.mjs` 36 %, `linkinator.config.json` 38 %,
   `tools/quality-policy/generate-format-scope.mjs` 45 %, `tools/release-create.mjs` 50 %, `.githooks/pre-push` 55 %,
   `tools/quality-policy/eslint-complexity-config.mjs` 56 %, `tsconfig.tools.json` 60 %,
   `tools/check-patterns/generic/namespace-policy.mjs` 79 %, `eslint.config.mjs` 80 %, `tools/check-file-size.mjs` 87 %,
   `tools/check-schema.mjs` 89 %, `tools/quality-policy/test-inventory.mjs` 91 %, `tools/check-test-focus.mjs` 93 %,
   `tools/check-file-size/oneliner-rules.mjs` 93 %, `tools/quality-policy/check-coverage-inventory.mjs` 94 %,
   `tools/check-patterns/rules.mjs` 96 %, `tools/check-patterns/shared.mjs` 98 %.
5. `tools/check-patterns/shared.mjs` exports 6 symbols here (`PATTERN_RULE_IDS`, `setRoot`, `suppressionMarker`,
   `isSuppressed`, `fail`, `toRel`) and 17 there (`resetContext`, `getWarnMode`, `getRoot`, `filesForScope`,
   `getFileData`, `lineAt`, `asGlobal`, `compareFindings`, `escapeRegex`, and others). The intersection is empty.
   `tools/check-file-size/oneliner-rules.mjs` exports `ONELINER_MESSAGE_BY_KIND` / `detectOneliners` /
   `countFindingsByKind` here and `detectOnelinerKind` there. The intersection is empty.
6. `tools/check-patterns.mjs` here accumulates findings into a mutated module-global `failures[]` array of strings, has
   no severity concept, no `--warn` mode, and requires every rule to supply a `run` function. There it builds
   `{file, line, message, severity}` objects, supports `block` and `warn` severities, supports `--warn` mode, filters
   each finding through `isLintSuppressed(file, line, rule)`, and defaults `rule.run` to a shared `runRegexRule`.
7. This repository does support pattern suppression, but at a different layer and with a weaker grammar:
   `tools/check-patterns/shared.mjs:158` calls `isSuppressed` inside `fail()`, matching a `pattern-ignore: <ruleName>`
   comment on the offending line or the line above, with no reason, owner, or expiry requirement. There the grammar is
   `dyni-lint-disable-next-line <rule> -- <reason>` plus
   `dyni-boundary-next-line(category:, owner:, date:[, expires:]) -- <reason>` with expiry validation, and generic
   production suppressions are forbidden outright. Both repositories currently have zero pattern suppressions in source.
8. Six separate token blocklists define "generic", and no two agree. `tests/js/shared-instructions.test.mjs` uses
   `polarrecorder, polar recorder, avnav, plugin.py, plugin.js, plugin.mjs, server/polarrecorder, polar.json, windy`.
   `tests/js/check-patterns-registry.test.mjs` uses `polarrecorder, avnav, pluginhandler, configcache`.
   `tests/js/skills-lock.test.mjs` uses
   `dyninstruments, dynicomponents, widget, gauge, mapper, cluster, renderer, ratioDefaults, rangeDefaults, createRenderer`.
   Dyninstruments uses three further lists.
9. `tests/js/skills-lock.test.mjs` forbids **the sibling repository's** tokens while explicitly permitting this
   repository's own, and its own docstring states the skills are "adapted for use on this repository, **not a
   repository-agnostic package**". Dyninstruments' equivalent contract forbids its own tokens instead. The same five
   files therefore carry opposite liftability contracts.
10. `tests/js/check-patterns-registry.test.mjs` scans whole generic rule-definition **file contents**; Dyninstruments'
    `tests/contract/pattern-rule-generic-scope-contract.test.js` checks only rule semantics and documents in-file that
    scope globs are deliberately exempt. The two contracts check different things.
11. Grepping the generic tool layer here finds 5 project-token occurrences, all in `tools/check-patterns/shared.mjs`:
    `polarrecorder` 3 times, `viewer` twice. `viewer` is not in any blocklist here, so those pass. Dyninstruments'
    generic layer leaks 26 or more.
12. Rule-name sets: 16 generic and 12 project rules here; 19 generic and 23 project rules there. Exactly 8 generic names
    exist in both: `absolute-home-path`, `canvas-api-typeof-guard`, `default-truthy-fallback`, `exec-plan-reference`,
    `premature-legacy-support`, `redundant-null-type-guard`, `try-finally-canvas-drawing`, `unused-fallback`. Exactly 2
    project names exist in both: `namespace-token-consistency`, `hardcoded-runtime-default`.
13. Same-concept rules carry different names: `inner-html-assignment` here versus `unsafe-html-dom-sink` there;
    `promise-empty-catch` versus `empty-catch`; `commented-out-code` versus `dead-code`; `catch-fallback` (project here)
    versus `catch-fallback-without-suppression` (generic there); `internal-namespace-fallback` (project here) versus
    `internal-hook-fallback` (generic there); three `todo-without-owner:{js,markdown,python}` rules here versus one
    `todo-without-owner` rule there.
14. Three rules are classified on opposite sides: `framework-method-typeof-guard` and `invalid-lint-suppression` are
    project here and generic there; `responsive-layout-hard-floor` is generic here and project there.
15. This repository's classification of fact 14's third case is the correct one.
    `tools/check-patterns/generic/structural-rules.mjs:160-175` detects an inline numeric floor of 8 or more inside
    `Math.max(...)` or `clamp(...)` and emits the project-free message "user-visible layout/text floors must come from a
    shared owner". Dyninstruments' copy carries the same detection but a 17-entry product file list as its scope and the
    message "Use ResponsiveScaleProfile-derived sizing", which is why it was classified project.
16. `tools/quality-policy/eslint-complexity-config.mjs` freezes `STRICT_LIMITS` at complexity 10, max-statements 40,
    max-depth 4, max-params 6, and `tools/quality-policy/eslint.complexity.config.mjs` builds them at **error** severity
    with `noInlineConfig: true`. Its header states there is no baseline, scanner, or exception ledger anywhere in this
    repository. Dyninstruments freezes the identical four values but exports its rule fragment at **warn** severity and
    has no second config file.
17. `npm run check:complexity` here is
    `eslint --config tools/quality-policy/eslint.complexity.config.mjs viewer/*.js plugin.js plugin.mjs`, so
    `tools/**/*.mjs` is complexity-unchecked. Python complexity is enforced natively at the same numbers by ruff:
    `pyproject.toml` selects `C90` with `[tool.ruff.lint.mccabe] max-complexity = 10` and sets
    `[tool.ruff.lint.pylint] max-args = 6`, `max-branches = 10`, `max-returns = 4`, `max-statements = 40`.
18. Quality-policy data files share filenames but not schemas. `coverage-floors.json` here is
    `{families, pluginPy, viewerPerFileLinePercent, defaultNewFileLinePercent, defaultNewFileBranchPercent, contractOwned}`
    with 13 family keys and 17 per-file viewer entries; there it is
    `{note, generatedAgainstEntryCount, entries:{<path>:{classification, lines, branches}}}` with 228 per-file entries
    covering every shipped file exactly once. `coverage-floor-baseline.json` here is `{capturedCommit, minimumFloors}`;
    there it is `{description, entries:{<path>:{lines, branches, legacyBelowDefault?}}}`.
19. `tools/quality-policy/test-inventory.json` here is `{note, executableTestHelpers}` — a flat helper list. There it is
    `{entries:{<path>:{classification}}}` with 541 entries. `tools/quality-policy/test-exception-baseline.json` here is
    `{note, capturedCommit, exceptions: []}`, deliberately empty, with the note stating every executable JS test and
    helper is classified strict and there is no harness exception class. There it holds 229 entries, of which 209 no
    longer exist on disk.
20. `tools/quality-policy/check-coverage-inventory.mjs` here is 113 lines plus a four-module
    `tools/quality-policy/coverage-inventory/` package (`shared.mjs`, `floor-baseline.mjs`, `python-coverage.mjs`,
    `viewer-coverage.mjs`). There it is 299 lines in a single file with no Python awareness.
21. Suppression counts over maintained source, excluding `exec-plans/`, lint fixtures, and
    `tools/quality-policy/format-scope.json`: this repository has **0** `eslint-disable`, `@ts-ignore`,
    `@ts-expect-error`, `prettier-ignore`, and `istanbul ignore`. The only four files matching those strings are
    `eslint.config.mjs`, which defines the banned term list, and three convention documents that describe the policy.
    Dyninstruments has 1152 `@ts-ignore` plus 13 `eslint-disable` across 160 files, all under `tests/`.
22. That zero is enforced structurally: `eslint.config.mjs` sets `linterOptions: { noInlineConfig: true }` on all three
    file groups and sets `"no-warning-comments": ["error", { terms: SUPPRESSION_COMMENT_TERMS, location: "anywhere" }]`
    over `eslint-disable`, `ts-ignore`, `ts-nocheck`, `ts-expect-error`, `prettier-ignore`, and `istanbul ignore`.
23. Further `eslint.config.mjs` differences: this repository uses `eqeqeq: "error"` and `no-unused-vars` with
    `caughtErrors: "all"` and `caughtErrorsIgnorePattern: "^_"`; sets `no-console: "error"`,
    `no-empty: ["error", { allowEmptyCatch: false }]`, and `no-restricted-globals: ["error", "isFinite", "isNaN"]` on
    shipped runtime. Dyninstruments uses `eqeqeq: ["error", "smart"]` and `caughtErrors: "none"`, has no `no-console` or
    `no-empty` rule, and adds `no-useless-assignment` plus `@eslint-community/eslint-plugin-eslint-comments` with
    `reportUnusedDisableDirectives: "error"` and an inventory-driven relaxed-test-file class. This repository has no
    relaxed test class.
24. `vitest.config.mjs` here uses `defineConfig`, no globals, projects `tools` / `viewer` / `plugin` defined by glob
    patterns only, and carries an in-file rationale that patterns prevent a new test file being silently excluded from
    every gate. Dyninstruments' `vitest.config.js` is CommonJS `module.exports` with no `defineConfig`, `globals: true`,
    projects `unit-node` / `contract` / `unit-dom`, and explicit **file lists** for the first two with a catch-all third
    project. Test files here are `.test.mjs` using `import` and `node:assert/strict`; there they are `.test.js` using
    `require()` and `expect()`.
25. `jscpd.config.json` here sets `threshold: 0`, default `minLines` and `minTokens`,
    `path: ["viewer", "plugin.js", "plugin.mjs"]`, and `gitignore: true`. There it sets `threshold: 0.25`,
    `minLines: 30`, `minTokens: 120`, no `path`, and ignores `tests/**` and `documentation/**`. This repository has
    `tools/check-js-duplication.mjs` (with an `acorn` dependency) and `tools/check-duplication.py` as its second layer;
    there the second layer is the `duplicate-functions` and `duplicate-block-clones` generic pattern rules.
26. Present here and absent there: `tools/check-all.sh`, `tools/check-js-duplication.mjs` plus
    `check-js-duplication/{parse,clone-detection}.mjs`, `tools/check-duplication.py`, `tools/check-smell-contracts.mjs`,
    `tools/check-viewer-contracts.mjs`, `tools/check-dependencies.mjs`, `tools/check-publisher-workflow.mjs`,
    `tools/quality-policy/typecheck-source.mjs`, `tools/quality-policy/typecheck-tools.mjs`, `tools/setup.mjs`,
    `tools/release-runtime.mjs`, `tools/release_manifest.py`, `tools/release-zip.py`, `tools/check-release.py`,
    `tools/viewer-harness.mjs` plus `viewer-harness/{fake-dom,fixtures}.mjs`, `tools/mock-server.py` plus
    `tools/mock_server/`, `tools/quality-policy/canonical_json.py`, and
    `tools/quality-policy/generate_baseline_coverage_capture.py`.
27. `AGENTS.md` §8 still names `tools/check-all.sh` as an authority — "`tools/check-all.sh` is a pure wrapper alias
    around the same command" — and `documentation/conventions/quality-gates.md` documents it. The file is 8 lines and
    does nothing but `cd` to the repository root and run `npm run check:all`. Dyninstruments has no such concept.
28. The `SHARED_INSTRUCTIONS` block is 74 lines here and 67 lines there. The `BEGIN` marker sits **after** the
    "AGENTS.md is a routing map" line here and **before** it there, so the two blocks do not enclose the same sections.
    Section 2 forbids plan-number citation outright here and permits a literal `PLANn.md` pointer there. The block here
    contains a "Required Documentation Shape" subsection that the block there omits, although that repository enforces
    exactly that shape.
29. `documentation/conventions/documentation-format.md` here mandates `**Status:** Current.` and the four sections.
    There it mandates an emoji `**Status:**` vocabulary, a `## API/Interfaces` section, a `## Fixed Issues (if any)`
    section, and a "Token Budget Management" allocation table. The **enforced** contract in both is title plus
    `**Status:**` plus `## Overview` plus `## Key Details` plus `## Related`, with `documentation/TABLEOFCONTENTS.md`
    exempt — `tests/js/doc-format-contract.test.mjs` and `tests/contract/documentation-format-contract.test.js` are
    functionally identical. All 28 documents here and all 77 there carry a `**Status:**` line.
30. `documentation/guides/exec-plan-authoring.md` diverges the same way: `**Status:** Current.` here, emoji status and
    different section names there. That repository's copy carries an "Exec-Plan Citation Rule" section this one lacks.
31. `npm run docs:check` here is `docs:lint && docs:links:proof && docs:links`, with the TOC, format, reachability,
    smell-catalog, and pointer contracts reached through `test:tools` instead — documented deliberately in
    `documentation/conventions/quality-gates.md`. There `docs:check` additionally includes `check:doclinks`,
    `check:reachability`, and `check:docformat`. This repository has a dedicated `tests/js/doc-toc-contract.test.mjs`;
    that repository folds TOC into reachability.
32. `skills-lock.json` here holds 5 entries — `preflight`, `create-plan`, `doc-sync`, `scan-smells`, `grill-me-repo` —
    each with `sourceType: "sibling-repository"` and source `dyninstruments/.agents/skills/<name>/SKILL.md`.
    `tests/js/skills-lock.test.mjs` asserts `sha256(local SKILL.md) === computedHash`, and recomputation confirms the
    hashes match **this repository's own local files** (`preflight` → `dedbc2e3…`). The Dyninstruments files hash
    differently (`preflight` → `af0e5f8b…`). The recorded provenance is therefore false, and the drift between the two
    copies is undetected.
33. Dyninstruments' `skills-lock.json` holds 5 entries named `grill-me`, `improve-codebase-architecture`, `prd-to-plan`,
    `request-refactor-plan`, `write-a-prd` from `mattpocock/skills`, none of which matches any local skill directory
    there, and its contract test never compares a hash to a file. Each repository has half of a working lock mechanism.
34. `.agents/skills/` here holds exactly the 5 generic skills. There it holds those 5 plus two project skills,
    `add-widget` and `mapper-review`, with the generic/project split asserted by contract.
35. The 5 shared skills are structurally converged and diverge mainly in vocabulary: `preflight` differs by "module"
    versus "component" plus one real routing difference (`smell-prevention.md` versus `shared-helpers.md` for the
    refactor route); `create-plan` differs by "Behavior Concept" versus "Layout Concept"; `grill-me-repo` differs by
    "Category" versus "Archetype" and two branch titles; `doc-sync` mandates a four-section shape here and a
    five-section shape there; `scan-smells` has 8 categories in both, but Category 8 is "Suppression Discipline" here
    and "Structural Patterns" there.
36. `documentation/conventions/` files here keep the canonical three `##` sections with all content under `Key Details`:
    `coding-standards.md` has 5, `smell-prevention.md` 4, `testing-infrastructure.md` 4, `smell-fix-playbooks.md` 4 with
    11 `###` playbooks. There the same files have 19, 9, 11, and 4 with 32 `###` playbooks. Both pass the format
    contract, which requires only that the three sections be present.
37. `pyproject.toml:127` names `tools/check-coverage.py` as the enforcing authority for the validation-package 95 %/95 %
    floor. That file does not exist; the authority is `tools/quality-policy/check-coverage-inventory.mjs`.
38. `tools/quality-policy/format-scope.json` has the identical schema in both (`{rows: [{path, owner}], countByOwner}`)
    and is generated. Adding any tracked file requires rerunning `npm run format:scope`. `tools/check-file-size.mjs`'s
    `collectTargetFiles` collects `viewer/*`, `plugin.js`, `plugin.mjs`, `documentation/**/*.md`, six root Markdown
    files, and `tools/**/*.js|mjs`, and never collects `exec-plans/`, so plan files are exempt from the 400
    non-empty-line limit here; there the exemption is an explicit `/^exec-plans\//` skip.
39. `.githooks/pre-push` here resolves the repository root, sets a stable locale, prepends
    `${POLARRECORDER_VENV:-$REPO_ROOT/venv}/bin` to `PATH` when present, and runs one `npm run check:all`. It has no
    trailing newline. `.githooks/README.md` here follows the four-section documentation shape; there it is free-form.
40. `exec-plans/completed/PLAN8.md` is the most recent completed plan here; `exec-plans/active/` contains only
    `.gitkeep`. Dyninstruments' most recent completed plan is `PLAN41.md`.
41. The `todo-without-owner` scope divergence is observable, not theoretical. This repository's
    `todo-without-owner:markdown` uses `collectMarkdownTodoTargets`, which walks `documentation/` plus six root Markdown
    files and never reaches `exec-plans/`. Dyninstruments' single rule scopes `["**/*.js", "**/*.md"]` excluding only
    `node_modules/**`, `README.md`, `CONTRIBUTING.md`, and `ROADMAP.md`, so it scans `exec-plans/**` too. Writing the
    bare marker word in a plan file therefore passes `npm run check:patterns` here and fails there — verified while
    authoring this plan. Fact 38's file-size exemption does not extend to the pattern rules. Collapsing the three rules
    into one canonical rule must resolve this scope difference explicitly, not inherit one side.
42. Negative fact: no file named `shared-core-manifest.json`, `check-shared-core.mjs`, `generic-tokens.json`, or
    `project-pattern-scopes.json` exists in either repository. Nothing anywhere compares an artifact in one repository
    to the same artifact in the other.

---

## Shared Core Contract

This section is verbatim identical in Dyninstruments `PLAN42.md` and Polar Recorder `PLAN9.md`. Neither may be edited
without amending the other in the same task.

### Definitions

- **Generic surface (Tier 1).** Files whose content depends on no product concept of either repository. Tier 1 files
  must be **byte-identical** in both repositories and are listed in `shared-core-manifest.json` with their SHA-256.
- **Project profile (Tier 2).** Files that encode one product's concepts: runtime and viewer and server code, product
  schemas, product rule definitions, product documentation, and every baseline **data** file. Tier 2 files must differ
  freely and are never listed in the manifest.
- **Project-owned data.** JSON or config consumed by a Tier 1 tool that supplies the tool with this repository's paths,
  scopes, limits, remedies, or captured debt. Project-owned data is Tier 2; the tool reading it is Tier 1.
- No Tier 1 file may contain a project token. No Tier 1 file may hard-code a product path, a product prefix, or a
  product remedy sentence.

### Per-artifact donation table

Direction is decided on audited merit, per artifact.

| Artifact                                                                               | Canonical source        | Reason                                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `tools/check-patterns.mjs`, `check-patterns/shared*.mjs`, `check-patterns/rules-*.mjs` | Dyninstruments          | Severity model, `--warn` mode, per-finding suppression, declarative default runner              |
| Suppression marker grammar                                                             | Dyninstruments, renamed | Owner, date, reason, and expiry validation; prefix must be de-branded                           |
| `tools/check-patterns/generic/*` rule definitions                                      | Merge                   | Union of both sets under canonical names, with scope and remedy externalised                    |
| `tools/check-file-size.mjs` and `check-file-size/*`                                    | Polar Recorder          | Exports `runFileSizeCheck`, so it is importable and self-testable                               |
| `tools/check-test-focus.mjs`                                                           | Polar Recorder          | Exports `runTestFocusCheck`; the Dyninstruments copy exports nothing                            |
| `tools/check-schema.mjs`                                                               | Polar Recorder          | Has a self-test; the Dyninstruments copy has none                                               |
| `tools/check-doc-links.mjs`, `check-doc-links-proof.mjs`                               | Polar Recorder          | Have self-tests                                                                                 |
| `tools/hooks-install.mjs`, `tools/hooks-doctor.mjs`                                    | Polar Recorder          | Have self-tests and richer repair output                                                        |
| `tools/quality-policy/run-format.mjs`, `generate-format-scope.mjs`                     | Polar Recorder          | Lowest residual divergence already, and self-tested                                             |
| `tools/quality-policy/check-coverage-inventory.mjs` and its data schema                | Dyninstruments          | "Every shipped file classified exactly once" is the stronger fail-closed invariant              |
| `tools/quality-policy/test-inventory.mjs` and its data schema                          | Dyninstruments          | Per-file classification generalises; the flat helper list does not                              |
| `complexity-scan.mjs`, `complexity-budget.mjs`, `complexity-capture-integrity.mjs`     | Dyninstruments          | An empty baseline reproduces strict enforcement, so one mechanism serves both postures          |
| `tools/quality-policy/eslint-complexity-config.mjs`                                    | Merge                   | One owner exporting `STRICT_LIMITS` plus a severity-parameterised rule fragment                 |
| `tools/release-*.mjs`, `tools/release-path-policy.mjs`, `release-zip-builder.mjs`      | Dyninstruments          | All-JavaScript; no Python release path                                                          |
| `install.sh`                                                                           | Dyninstruments          | Already 1 % residual divergence                                                                 |
| `eslint.config.mjs` base strictness                                                    | Polar Recorder          | `noInlineConfig`, banned suppression terms, strict `eqeqeq`, `caughtErrors: "all"`              |
| `eslint.config.mjs` test scoping                                                       | Dyninstruments          | Inventory-driven relaxation is the more precise mechanism                                       |
| `jscpd.config.json` thresholds                                                         | Polar Recorder          | `threshold: 0` at 5 lines / 50 tokens is the stronger bound                                     |
| Duplication second layer                                                               | Dyninstruments          | `duplicate-functions` and `duplicate-block-clones` replace two bespoke tools                    |
| `vitest.config` shape                                                                  | Polar Recorder          | `defineConfig`, ESM, glob-only projects, no silent-exclusion risk                               |
| `documentation/conventions/documentation-format.md`                                    | Polar Recorder          | Matches what both already enforce                                                               |
| `documentation/guides/exec-plan-authoring.md`                                          | Polar Recorder          | `**Status:** Current.`, no emoji vocabulary                                                     |
| `.githooks/pre-push`, `.githooks/README.md`                                            | Polar Recorder shape    | Documented shape, plus an optional repo-local virtualenv `PATH` block that is inert without one |
| `.markdownlint-cli2.jsonc`, `linkinator.config.json`                                   | Merge                   | Same rule set, union of ignores, strictest link options                                         |
| `tsconfig.*.json` `compilerOptions`                                                    | Merge                   | Identical options; `files` and `include` stay project-owned                                     |
| `skills-lock.json` semantics                                                           | Polar Recorder          | Hash is verified against the local file; Dyninstruments never compares a hash                   |
| `skills-lock.json` shape assertions                                                    | Dyninstruments          | Explicit generic/project skill classification                                                   |
| `SHARED_INSTRUCTIONS` block                                                            | Merge                   | Resolved per conflict in the table below                                                        |
| `.github/workflows/*`, `.nvmrc`, `.prettierrc.json`, `.codex/config.toml`, base schema | Already identical       | No change                                                                                       |

### Shared-instructions conflict resolutions

| Conflict                     | Resolution                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `BEGIN` marker position      | `BEGIN` goes immediately after the one-line file purpose and before the routing-map note, so both blocks enclose sections 0 through 4  |
| Plan-citation rule           | Adopt the Dyninstruments reading: a literal pointer to a real `PLANn.md` file is permitted; citing a plan or phase as authority is not |
| Required documentation shape | Adopt the Polar Recorder inclusion: the shape rule belongs inside the shared block, since both repositories enforce it                 |
| Quality-checklist skeleton   | Union of both item sets, with every product-specific item moved below the `END` marker                                                 |
| Gate-name references         | The block names only `check:all`, `check:fast`, and `check:core`; every other command name lives below the `END` marker                |

### Canonical rule identifiers

One identifier and one classification per concept. Both repositories rename to match.

| Concept                            | Canonical name                       | Class   | Was (Dyninstruments)                 | Was (Polar Recorder)                    |
| ---------------------------------- | ------------------------------------ | ------- | ------------------------------------ | --------------------------------------- |
| Unsafe HTML or DOM sink            | `unsafe-html-dom-sink`               | generic | `unsafe-html-dom-sink`               | `inner-html-assignment`                 |
| Swallowed catch                    | `empty-catch`                        | generic | `empty-catch`                        | `promise-empty-catch`                   |
| Dead or commented-out code         | `dead-code`                          | generic | `dead-code`                          | `commented-out-code`                    |
| Catch with unsanctioned fallback   | `catch-fallback-without-suppression` | generic | `catch-fallback-without-suppression` | `catch-fallback` (project)              |
| Re-defaulting an internal contract | `internal-contract-fallback`         | generic | `internal-hook-fallback`             | `internal-namespace-fallback` (project) |
| Undated or unowned work marker     | `todo-without-owner`                 | generic | `todo-without-owner`                 | three per-language rules                |
| Framework method typeof guard      | `framework-method-typeof-guard`      | generic | generic                              | project                                 |
| Invalid lint suppression           | `invalid-lint-suppression`           | generic | generic                              | project                                 |
| Inline responsive layout floor     | `responsive-layout-hard-floor`       | generic | project                              | generic                                 |
| NUL byte in maintained source      | `no-nul-byte`                        | generic | contract test only                   | `no-nul-byte`                           |
| Console call in shipped runtime    | `console-in-runtime`                 | generic | `console-in-widgets`                 | ESLint `no-console` only                |

`internal-contract-fallback` is a third name deliberately: neither existing name is project-neutral.
`console-in-runtime` replaces `console-in-widgets` because the old name is itself the proof that the blocklist gap is
real.

### Genericness token owner

One file, `tools/quality-policy/generic-tokens.json`, with three arrays, identical in both repositories:

- `projectTokens` — every product token of **both** repositories, so a Tier 1 file naming either is rejected: `dyni`,
  `dyninstruments`, `dynicomponents`, `dyniplugin`, `polarrecorder`, `polar recorder`, `polar.json`, `windy`.
- `domainTokens` — product-domain nouns that make a file un-liftable even when neither project is named: `widget`,
  `cluster`, `gauge`, `renderer`, `mapper`, `viewer`, `layout profile`, `componentContext`, `ClusterWidget`,
  `ResponsiveScaleProfile`, `widget-kits`, `editable`, `pluginhandler`, `configcache`.
- `hostTokens` — the AvNav host itself: `avnav`, `AVNAV_BASE_URL`, `avnav_api`, `plugin.py`, `plugin.js`, `plugin.mjs`.

One shared checker applies all three arrays, case-insensitively, to: the `SHARED_INSTRUCTIONS` block, every generic
skill file, every Tier 1 tool module's **full content**, and every generic rule definition's **content and rendered
semantics**. Scope globs and remedy sentences are not exempt — they move to project-owned data instead.

### Shared core manifest

`tools/quality-policy/shared-core-manifest.json`:

```json
{
  "note": "Digest of every generic-surface file. Both role-model repositories commit this file identically; a local digest mismatch means this repository has drifted from the shared core.",
  "entries": { "<repo-relative path>": "<sha256 of file bytes>" }
}
```

`tools/check-shared-core.mjs` exports `runSharedCoreCheck()` and fails when any entry's path is missing, any digest
mismatches, or any Tier 1 path on disk is absent from the manifest. It never reads outside its own repository.
Cross-repository identity holds because both repositories commit the same `entries` object; a paired contract test in
each repository asserts the manifest's own SHA-256 against a value recorded in that test, so changing one repository's
manifest without the other is a visible, reviewable event.

### Paired acceptance matrix

Both repositories must satisfy every row before either plan is complete.

| Row | Assertion                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| P1  | `npm run check:all` exits 0                                                                                       |
| P2  | `npm run check:shared-core` exits 0                                                                               |
| P3  | `shared-core-manifest.json` `entries` is byte-identical in both repositories                                      |
| P4  | Every Tier 1 file listed in the manifest is byte-identical in both repositories, verified by an out-of-band `cmp` |
| P5  | `generic-tokens.json` is byte-identical in both, and the genericness checker reports zero findings in both        |
| P6  | `GENERIC_RULES` name sets are identical in both; classifications match the canonical table                        |
| P7  | No Tier 1 file contains any token from `projectTokens`, `domainTokens`, or `hostTokens`                           |
| P8  | Every Tier 1 checker exports a `run*()` entry point and has at least one self-test with a negative fixture        |
| P9  | Every immutable baseline entry resolves to a live path                                                            |
| P10 | Every count narrated in `documentation/conventions/quality-gates.md` is asserted by a test, not hand-written      |
| P11 | Suppression comments in maintained source are exactly zero, asserted across the whole maintained surface          |
| P12 | `skills-lock.json` hashes match local skill files, and every entry names an existing local skill directory        |
| P13 | The `SHARED_INSTRUCTIONS` block is byte-identical in both                                                         |
| P14 | The five generic skill files are byte-identical in both                                                           |

---

## Architecture Notes

### Cross-repository identity without cross-repository reads

`PLAN8.md` assumption 4 forbids any gate reading the sibling checkout, and that constraint is right: a gate that depends
on a sibling directory cannot run in CI, cannot run in a fresh clone, and cannot survive extraction. That constraint is
also exactly why "shared" drifted — with no sibling read allowed and no canonical copy, nothing could compare the two.
Fact 32 is the visible symptom: `skills-lock.json` names the sibling as its source precisely because the constraint made
verifying that claim impossible, so the hash silently fell back to the local file.

A committed digest manifest resolves the tension. Each repository verifies its own files against the manifest locally.
Identity across the pair is a property of the **manifest being the same file**, which is a review-time fact, not a
runtime dependency. This repository already applies exactly this mechanism correctly to its own skill files; it was
simply pointed at the wrong target.

### Adopting the richer engine is the larger half of this plan for this repository

Fact 6 makes the direction unambiguous: the sibling engine has a severity model, a `--warn` exploratory mode,
per-finding suppression filtering, and a declarative default runner, and this one has none of those. Adopting it is the
single biggest change here. The compensating simplification is real: `runRegexRule` as a default means most rule
definitions become pure data, and fact 25's two bespoke duplication tools plus their `acorn` dependency are replaced by
two generic rules.

The suppression grammar upgrade matters more than it looks. Fact 7 shows this repository's `pattern-ignore: <ruleName>`
requires no reason, no owner, and no expiry. Zero suppressions exist today, so the weaker grammar has cost nothing yet —
but a template must ship the grammar that stays honest once someone reaches for it.

### This repository already had the right answer twice

Fact 15 and fact 29 are both cases where this repository's choice is the one that generalises: the
`responsive-layout-hard-floor` classification is correct here and wrong there, and the documentation-format text here
matches what both repositories actually enforce. Convergence is not a migration toward the larger repository. The
donation table reflects that: this repository donates nine artifacts, including every checker that is importable and
self-tested.

### An empty baseline is the greenfield default

Complexity is the one axis where the two repositories look irreconcilable: hard error here, warn-plus-ratchet there
(facts 16 and 17). They are the same mechanism at two points on one dial. With an empty `complexity-baseline.json`, the
scan-plus-budget pipeline fails on the first finding — behaviourally identical to the error severity this repository
enforces today. So one mechanism serves both, this repository's zero-debt posture is preserved exactly, and the
greenfield environment inherits the mechanism with an empty ledger.

Adopting the mechanism also closes a real coverage gap here: fact 17 shows `check:complexity` currently lints only
`viewer/*.js`, `plugin.js`, and `plugin.mjs`, leaving `tools/**/*.mjs` complexity-unchecked. The scan's project-owned
root list fixes that without changing any limit value.

### Retiring a bespoke checker must not retire its assertions

Fact 26 lists sixteen tools this repository still carries. Each retirement must name its replacement owner and prove
finding equivalence in the same phase — the same discipline `PLAN8.md` applied. The three that need the most care are
`check-viewer-contracts.mjs`, `check-smell-contracts.mjs`, and `check-dependencies.mjs`, because their replacements are
contract tests rather than checkers, so the assertions move rather than disappear. `tools/check-all.sh` is the one
exception: fact 27 shows it is a pure alias, so deleting it needs only the two documentation references removed.

### Role model is not greenfield output

Neither repository can be used as a greenfield starting point, and this plan does not attempt that. It produces one
thing the greenfield generator needs and cannot otherwise get: a set of files that are known-good, known-generic, and
**known-identical**, so the generator's authors copy them rather than re-deciding them. Every Tier 2 file in this
repository — `server/polarrecorder/`, `viewer/`, `plugin.py`, the validation pipeline, the Python tooling, the product
schemas, and every baseline data file — stays exactly as project-specific as it is today.

---

## Hard Constraints

### Runtime and product behavior

- No change to Python APIs, the validation pipeline and its reason codes, persistence and recovery, export and import
  formats, presets, timeline or histogram behavior, viewer screens, AvNav integration, packaging output, or release
  artifacts.
- No change to any file under `server/polarrecorder/` or `viewer/`, and no change to `plugin.py`, `plugin.js`,
  `plugin.mjs`, `plugin.json`, or `plugin.css`, except where a canonical rule rename requires a marker or comment text
  update.
- Runtime Python stays Python 3.9 standard library only. No target-device `pip install`. No new runtime dependency.
- Dev-only tooling changes only. `acorn` may be removed once its two consumers are retired; no dev dependency is added
  except `@eslint-community/eslint-plugin-eslint-comments` if the adopted ESLint test scoping requires it.

### Quality integrity

- `npm run check:all` must be green at the end of every phase, not only at the end of the plan.
- No gate may be weakened to land a phase: no lowered threshold, no widened ignore list, no new suppression, no disabled
  rule, no deleted or skipped test. A rule rename must be proven behavior-preserving before the old name is removed.
- The suppression count in fact 21 must stay at exactly zero. Adopting the sibling's engine must not import its
  test-layer suppression debt, and `noInlineConfig` plus `no-warning-comments` must remain in force throughout.
- Removing a checker requires an explicit equivalence proof in the same phase, naming the replacement owner. Retiring
  `check-viewer-contracts.mjs`, `check-smell-contracts.mjs`, or `check-dependencies.mjs` requires every one of its
  assertions to exist in the replacement first.
- `mypy --strict` over `server/polarrecorder`, `tests`, and `plugin.py` stays binding, as does the full ruff rule
  selection in `pyproject.toml`. Neither may be narrowed.
- Python coverage stays at its 90 % native aggregate floor with the validation-package and histogram-core family floors
  intact, whatever schema they are expressed in.

### Repository independence and paired work

- No gate, test, tool, or config may read, resolve, or stat a path outside this repository. `sibling-repository` as a
  `sourceType` value is forbidden, and fact 32's five entries must stop using it.
- Tier 1 changes land in this repository and Dyninstruments in the same working session, verified by an out-of-band
  `cmp` before either side's phase is closed.
- If a Tier 1 file cannot be made identical, it is not Tier 1. Reclassify it to Tier 2, record the reason in this plan,
  and remove it from the manifest — do not weaken the manifest check.
- No Python file may enter the manifest. Python reaches a Tier 1 checker only through a documented adapter.

### File organization

- Tier 1 tool modules live under `tools/` and `tools/quality-policy/` at the paths named in the manifest. No Tier 1
  module may live under `server/`, `viewer/`, or `tools/mock_server/`.
- Project-owned data files carry a `project-` prefix or live under `tools/quality-policy/`, and are never manifest
  entries.
- The 400 non-empty-line limit applies unchanged to every maintained file. `exec-plans/` stays exempt (fact 38).
- No deliverable outside `exec-plans/` may cite this plan number or a phase letter, per the exec-plan citation rule.

---

## Implementation Order

Phases A through C are ordered; D through H may be reordered if their stated dependencies hold. Phase K is last.

### Phase A — Establish the manifest and the genericness owner

Intent: build the two mechanisms that prevent the next round of drift, before moving any content.

Dependencies: none.

#### A1. Record standalone evidence

- Run `npm run check:all` from a clean worktree. Record the pytest count, the JS test-file count, viewer coverage
  percentages, and Python coverage percentages.
- Record the current generic and project rule-name lists, the `coverage-floors.json` family and per-file key sets, and
  the suppression counts by kind from fact 21.
- Amend this plan's baseline with evidence if any number differs from facts 1, 12, 18, or 21.

#### A2. Register this plan in the format inventory

- Run `npm run format:scope` so `exec-plans/active/PLAN9.md` is classified, then run `npm run format` and
  `npm run docs:lint` over it.
- Confirm `npm run docs:check` and `npm run format:check` pass with the plan file present. This proves fact 38 before
  anything else depends on it.

#### A3. Create the genericness token owner

- Add `tools/quality-policy/generic-tokens.json` with the three arrays exactly as specified in the Shared Core Contract.
  This file is Tier 1 and must be byte-identical in both repositories.
- Add `tools/check-generic-surface.mjs` exporting `runGenericSurfaceCheck()`, applying all three arrays
  case-insensitively to the four target sets named in the contract.
- Wire it into `check:smells`. Expect it to fail initially — fact 11 guarantees at least the five
  `tools/check-patterns/shared.mjs` findings, and fact 9 guarantees findings in the skill files. Record the exact
  finding list; it is the work list for Phases C and E.

#### A4. Retire the three blocklists

- Delete the inline token arrays from `tests/js/shared-instructions.test.mjs`,
  `tests/js/check-patterns-registry.test.mjs`, and `tests/js/skills-lock.test.mjs`, and have all three read
  `generic-tokens.json` instead.
- Remove the `skills-lock.test.mjs` docstring claim that these skills are "not a repository-agnostic package" (fact 9).
  Under the converged contract they are exactly that.
- Keep each test's positive and seeded-negative assertions. Add a negative assertion proving a token added to
  `generic-tokens.json` is picked up by all three call sites, so the single-owner property is itself checked.

#### A5. Create the shared core manifest

- Add `tools/quality-policy/shared-core-manifest.json` with an initially small `entries` object containing only the six
  already-identical paths from fact 2.
- Add `tools/check-shared-core.mjs` exporting `runSharedCoreCheck()`, failing on a missing path, a digest mismatch, or a
  Tier 1 path on disk that is absent from the manifest.
- Add `npm run check:shared-core` and include it in `check:core` immediately after `check:standard`.
- Add `tests/js/shared-core-manifest.test.mjs` asserting the manifest's own SHA-256 against a literal recorded in the
  test, plus negative fixtures for each failure mode.

Exit conditions: `npm run check:all` green with the plan file tracked and classified; `npm run check:shared-core` green
over the six seed entries; `generic-tokens.json` is the only genericness token source in the repository; the Phase A
finding list from A3 is recorded in this plan; facts 1, 12, 18, and 21 reconfirmed or amended.

---

### Phase B — Donate the importable checkers and close the self-test gaps

Intent: freeze this repository's nine donated implementations as canonical, and add the self-tests it lacks.

Dependencies: Phase A.

#### B1. Prepare the donated checkers for extraction

- Move every project-specific value out of `tools/check-file-size.mjs`, `check-file-size/*`,
  `tools/check-test-focus.mjs`, `tools/check-schema.mjs`, `tools/check-doc-links.mjs`, `check-doc-links-proof.mjs`,
  `tools/hooks-install.mjs`, `tools/hooks-doctor.mjs`, `tools/quality-policy/run-format.mjs`, and
  `generate-format-scope.mjs` into project-owned data: `ROOT_MARKDOWN_FILES`, `ROOT_JS_FILES`, the
  `viewer`/`documentation`/`tools` scan roots, the schema profile paths, and the `POLARRECORDER_VENV` variable name
  become `tools/quality-policy/project-file-size-scope.json`, `project-schema-profile.json`, and
  `project-hook-environment.json`.
- Confirm each checker's finding set over the current tree is unchanged after externalisation.

#### B2. Add the missing self-tests

- Add self-tests with negative fixtures for `tools/actionlint.sh`, `tools/check-file-size.mjs` and its one-liner
  submodule, and the operation-count evaluator — the owners the sibling tests and this repository does not.
- Add the manifest precondition contract: every path in `shared-core-manifest.json` ending in `.mjs` exports at least
  one `run*` function, and each has a referencing self-test.

#### B3. Add the donated checkers to the manifest

- Add all ten donated modules plus their submodules to `shared-core-manifest.json`.
- Verify out-of-band with `cmp` that each added path is byte-identical to Dyninstruments' after its paired phase.

Exit conditions: `npm run check:all` green; `npm run check:shared-core` green over the donated set; every donated
checker exports a `run*()` function and reads project values from project-owned data; the three new self-tests each have
a negative fixture.

---

### Phase C — Adopt the canonical pattern engine

Intent: replace this repository's pattern engine with the donated one, which is the largest single change here.

Dependencies: Phases A and B.

#### C1. Capture the pre-migration finding surface

- Run `npm run check:patterns` and record every rule's finding count from `SUMMARY_JSON`, plus `checkedJsFiles` and
  `checkedPythonFiles`.
- Build a fixture workspace that triggers at least one finding per current rule, so equivalence can be proven per rule
  rather than in aggregate.

#### C2. Replace the engine

- Replace `tools/check-patterns.mjs`, `tools/check-patterns/shared.mjs`, and `tools/check-patterns/source-scan.mjs` with
  the donated engine: findings as objects, `block` and `warn` severities, `--warn` mode, `compareFindings` ordering,
  `setKnownRuleNames`, and `rule.run` defaulting to `runRegexRule`.
- Retire `tools/check-patterns/file-cache.mjs` and `tools/check-patterns/discovery.mjs` against the donated
  `filesForScope` and `getFileData`, proving the file sets they produce are identical first.
- Keep `PATTERN_RULE_IDS` and the registry-parity assertion in `tests/js/check-patterns-registry.test.mjs`. It is this
  repository's contribution and the donated engine has no equivalent.
- Migrate the suppression layer: replace `pattern-ignore: <ruleName>` with the de-branded
  `plugin-lint-disable-next-line <rule> -- <reason>` and
  `plugin-boundary-next-line(category:, owner:, date:[, expires:]) -- <reason>` grammar. Zero suppressions exist today
  (fact 21), so no source file changes; add a negative assertion that the old `pattern-ignore` form is no longer
  recognised.

#### C3. Purge project tokens from the shared modules

- Remove the `polarrecorder` and `viewer` occurrences from `tools/check-patterns/shared.mjs` (fact 11) into
  `tools/quality-policy/project-pattern-context.json`, read by project rule definitions only.
- Rerun `runGenericSurfaceCheck()` and confirm the engine modules report zero findings.

#### C4. Externalise scope and remedy from generic rule definitions

- Every generic rule definition's `scope` resolves from `tools/quality-policy/project-pattern-scopes.json`, keyed by
  canonical rule name. No generic rule definition contains a literal product path. This repository's Python scopes live
  here alongside its JavaScript scopes.
- Every generic rule's message splits into a project-neutral diagnosis (Tier 1) and a project-owned remedy sentence
  (Tier 2), joined at render time.
- Reorganise `tools/check-patterns/generic/` from kind-based files (`line-rules.mjs`, `structural-rules.mjs`,
  `todo-without-owner.mjs`) into the canonical category-based `rules-*-defs.mjs` layout, so the file set matches.

#### C5. Add the manifest entries

- Add `tools/check-patterns.mjs`, `tools/check-patterns/rules.mjs`, `shared.mjs`, `shared-source-scan.mjs`,
  `shared-suppressions.mjs`, `ast-utils.mjs`, `duplicate-utils.mjs`, every `rules-*.mjs` runner, and every
  `generic/*.mjs` definition file to `shared-core-manifest.json`.
- `tools/check-patterns/project/` stays Tier 2 and holds every Python rule unchanged.

Exit conditions: `npm run check:all` green; `npm run check:shared-core` green; per-rule finding equivalence proven
against the C1 recording; `runGenericSurfaceCheck()` reports zero findings over `tools/check-patterns/**` excluding
`project/`; `pattern-ignore` is no longer recognised and the suppression count is still zero; `file-cache.mjs` and
`discovery.mjs` are retired with a recorded file-set equivalence proof.

---

### Phase D — Adopt the canonical rule identifiers

Intent: give every rule concept one name and one classification in both repositories.

Dependencies: Phase C.

#### D1. Prove equivalence before renaming

- For each row of the Canonical Rule Identifiers table where this repository's name changes, run the old and new rule
  over the current tree and the C1 fixture workspace and confirm identical finding sets.
- For the three `todo-without-owner:{js,markdown,python}` rules collapsing into one, confirm the union of their scopes
  becomes the single rule's project-owned scope list and the combined finding set is unchanged.

#### D2. Apply the renames and reclassifications

- Rename per the canonical table: `inner-html-assignment` to `unsafe-html-dom-sink`, `promise-empty-catch` to
  `empty-catch`, `commented-out-code` to `dead-code`, and the three work-marker rules to one `todo-without-owner`.
- Reclassify `framework-method-typeof-guard` and `invalid-lint-suppression` from project to generic; rename
  `catch-fallback` to `catch-fallback-without-suppression` and `internal-namespace-fallback` to
  `internal-contract-fallback`, both as generic, moving their project scopes to project-owned data.
- Keep `responsive-layout-hard-floor` generic. Fact 15 shows this repository already has the correct classification and
  the project-free message; no change is needed beyond scope externalisation.
- Adopt `console-in-runtime` as a generic pattern rule covering the scopes ESLint's `no-console` does not reach, while
  keeping `no-console` on shipped runtime.
- Keep `no-nul-byte` unchanged; it is already the canonical generic form.
- Update every documentation reference: `documentation/conventions/smell-prevention.md`, `smell-fix-playbooks.md`
  playbook titles including the two that name retired tools, `quality-gates.md` owner rows, and the `scan-smells`
  skill's category list.

#### D3. Lock the identifier set

- Add a contract test asserting `GENERIC_RULES` names equal a canonical list committed as Tier 1 data, so a rule added
  to one repository and not the other fails.
- Add the classification assertion: every canonical generic name is in `GENERIC_RULES`, every other name is in
  `PROJECT_RULES`, and `RULES` is exactly their concatenation.

Exit conditions: `npm run check:all` green; `npm run check:smells` finding set equivalent to the C1 recording under the
new names; the canonical generic name list is a manifest entry; no documentation file references a retired rule name;
every Python rule is still in `PROJECT_RULES`.

---

### Phase E — Converge the shared instruction, skill, and documentation-shape texts

Intent: make the human-facing generic core byte-identical, closing facts 28 through 35.

Dependencies: Phase A.

#### E1. Converge the `SHARED_INSTRUCTIONS` block

- Rewrite the block per the five conflict resolutions in the Shared Core Contract. Move the `BEGIN` marker to sit after
  the one-line file purpose and before the routing-map note, so the block encloses sections 0 through 4.
- Keep this repository's "Required Documentation Shape" subsection inside the block — the contract adopts it. Change
  section 2 to the Dyninstruments reading, which permits a literal `PLANn.md` pointer. Union the checklist skeletons,
  pushing every product-specific item below the `END` marker.
- Add the block, extracted, as a manifest entry via a generated `tools/quality-policy/shared-instructions.md` that
  `AGENTS.md` is asserted to contain verbatim. `AGENTS.md` itself stays Tier 2, since section 5 onward is
  project-specific.

#### E2. Converge the five generic skill files

- Reconcile `preflight`, `create-plan`, `doc-sync`, `scan-smells`, and `grill-me-repo` into one text each, choosing the
  project-neutral term in every vocabulary case from fact 35: prefer "module" over "component", "Behavior Concept" over
  "Layout Concept", and "Category" over "Archetype".
- Resolve the routing difference in `preflight`: the refactor route must name both the smell-prevention document and the
  shared-helpers document, since both repositories have one of each under different names.
- Keep this repository's `scan-smells` "Suppression Discipline" category — the converged suppression grammar from C2 is
  richer, so the category is more necessary, not less. Keep the four-section `doc-sync` shape, which matches what both
  repositories enforce.
- Route every project-specific instruction out of the five generic files. Unlike the sibling, this repository has no
  project skills to receive them, so add `.agents/skills/polar-model-review/SKILL.md` as this repository's project skill
  if any content needs a home; otherwise record that none did.
- Add all five `SKILL.md` paths to the manifest.

#### E3. Repair the skill lock

- Rewrite `skills-lock.json` so `sourceType` is `vendored-generic` for the five generic skills and `project-local` for
  any project skill. Remove every `sibling-repository` source value and the `dyninstruments/.agents/skills/...` paths
  (fact 32) — they assert a provenance nothing verifies and that the audit showed to be false.
- Keep the existing hash-versus-local-file assertion and the tampered-file negative fixture; they are this repository's
  contribution.
- Add the sibling's shape assertions: every entry names an existing local skill directory, and the directory set equals
  the declared generic set plus the declared project set. Add a negative assertion that
  `sourceType: "sibling-repository"` is rejected.

#### E4. Converge the generic convention documents

- Keep `documentation/conventions/documentation-format.md` as canonical (fact 29) and add it to the manifest once the
  sibling adopts it verbatim.
- Keep `documentation/guides/exec-plan-authoring.md` as canonical, but adopt the sibling's "Exec-Plan Citation Rule"
  section, which this repository lacks and which is product-neutral and stronger. Add it to the manifest afterwards.

Exit conditions: `npm run check:all` green; `npm run check:shared-core` green over the block, the five skills, and the
two convention documents; no `skills-lock.json` entry uses `sourceType: "sibling-repository"`; every lock hash verified
against a local file that exists; the citation rule is present in the authoring guide.

---

### Phase F — Converge the policy mechanisms with project-owned data

Intent: adopt the donated complexity, coverage, and test-inventory mechanisms without changing this repository's
enforcement strength.

Dependencies: Phases A and B.

#### F1. Adopt the complexity mechanism with an empty baseline

- Rewrite `tools/quality-policy/eslint-complexity-config.mjs` to export `STRICT_LIMITS` plus a severity-parameterised
  rule-fragment factory, so one file serves both a warn-mode scan and an error-mode lint. Retire
  `tools/quality-policy/eslint.complexity.config.mjs` against it.
- Adopt `complexity-scan.mjs`, `complexity-budget.mjs`, and `complexity-capture-integrity.mjs` with an **empty**
  `complexity-baseline.json`, and confirm the pipeline fails on the first finding — behaviourally identical to today's
  error severity.
- Extend the scan roots in project-owned data to include `tools/**/*.mjs`, closing fact 17's gap. If that surfaces
  findings, fix the functions; do not add baseline entries.
- Ruff keeps enforcing the identical four values for Python (fact 17). Add a contract test asserting the ruff mccabe and
  pylint values equal `STRICT_LIMITS`, so the two languages cannot drift apart.
- Add all four modules to the manifest. `complexity-baseline.json` stays Tier 2 and stays empty.

#### F2. Adopt the coverage-inventory schema and checker

- Migrate `coverage-floors.json` from the family-based schema to the per-file `entries` schema, with one entry per
  shipped file: the 17 viewer files, `plugin.js`, `plugin.mjs`, every `server/polarrecorder/**/*.py`, and `plugin.py`.
  Every existing family floor must be reproduced as the per-file floor of every member of that family; prove no floor is
  lowered.
- Adopt the donated `check-coverage-inventory.mjs`, refactored so the language-specific coverage reader is an injected
  adapter. Convert `coverage-inventory/python-coverage.mjs` into that adapter and retire
  `coverage-inventory/{shared,floor-baseline,viewer-coverage}.mjs` against the donated implementation.
- Migrate `coverage-floor-baseline.json` to the `entries` schema with `legacyBelowDefault` marking, preserving every
  captured value exactly. Re-anchor its digest in the same commit.
- Add the checker and the adapter contract to the manifest; the two data files stay Tier 2.

#### F3. Adopt the test-inventory schema

- Migrate `test-inventory.json` from `{note, executableTestHelpers}` to the per-file
  `{entries:{<path>:{classification}}}` schema, classifying every executable JS test and helper as `strict`, which is
  what fact 19's note already asserts.
- Keep `test-exception-baseline.json` empty. Add the staleness assertion the audit shows is missing in both
  repositories: every entry in every immutable baseline must resolve to a live path, with a negative fixture proving a
  dead entry fails. Here that assertion is trivially satisfied and guards the empty set.
- Adopt the donated `test-inventory.mjs` and add it to the manifest. Add a `tsconfig.tests.json` `files` list driven
  from the inventory, matching the sibling's mechanism, so strict test typing is enforced by the same means in both.

#### F4. Converge the remaining configs

- `jscpd.config.json`: keep `threshold: 0` and the default `minLines` and `minTokens` as canonical (fact 25). Move the
  `path` list into project-owned data and add the donated `duplicate-functions` and `duplicate-block-clones` generic
  rules as the second layer.
- `.markdownlint-cli2.jsonc` and `linkinator.config.json`: adopt the merged form — same three disabled rules, union of
  ignores including this repository's `venv/**`, `.pytest_cache/**`, and `.hypothesis/**`, and `recurse` plus
  `redirects: "error"` plus the `[::1]` skip pattern together. Add both to the manifest.
- `tsconfig.checkjs.json`, `tsconfig.tests.json`, `tsconfig.tools.json`: make `compilerOptions` identical across both
  repositories; keep `files` and `include` project-owned. Retire the `typecheck-source.mjs` and `typecheck-tools.mjs`
  wrappers in favour of direct `tsc -p` invocations, keeping their self-tests pointed at the new form.
- `install.sh`: extract the five project constants into a header block and add the remainder to the manifest.
- `.githooks/pre-push` and `.githooks/README.md`: keep this repository's shape as canonical (fact 39), fix the missing
  trailing newline, rename `POLARRECORDER_VENV` to a project-neutral variable read from `project-hook-environment.json`,
  and add both to the manifest.
- `vitest.config.mjs`: keep the glob-only project definition as canonical. Add a contract test asserting no project uses
  a literal file list, so the sibling's file-list pattern cannot be adopted by accident.

Exit conditions: `npm run check:all` green; `npm run check:shared-core` green over every path added in this phase;
`complexity-baseline.json` is empty and the empty-baseline contract test passes; the ruff-versus-`STRICT_LIMITS`
assertion passes; no coverage floor lowered, proven entry by entry; `tools/**/*.mjs` is complexity-checked; the baseline
staleness assertion has a negative fixture.

---

### Phase G — Retire the superseded bespoke tooling

Intent: complete the custom-tooling removal this repository started, against named replacement owners.

Dependencies: Phases C, D, and F.

#### G1. Retire the duplication tools

- Confirm the donated `duplicate-functions` and `duplicate-block-clones` generic rules, plus `jscpd` at `threshold: 0`,
  reproduce every finding class of `tools/check-js-duplication.mjs` and `tools/check-duplication.py` against a fixture
  workspace exercising each.
- Delete both tools, `check-js-duplication/{parse,clone-detection}.mjs`, the `acorn` dev dependency, and the
  `duplication:js` and `duplication:python` script rungs, keeping `duplication:check` as the single entry point.
- Extend the generic rules' scope in project-owned data to cover `server/polarrecorder/**/*.py`, so Python duplication
  detection is not lost.

#### G2. Retire the contract-shaped checkers

- Move every assertion in `tools/check-smell-contracts.mjs` into `tests/js/smell-catalog-contract.test.mjs`, then delete
  the tool. Prove assertion parity by enumerating both before and after.
- Move every assertion in `tools/check-viewer-contracts.mjs` and `tools/check-dependencies.mjs` into contract tests,
  then delete both and fold `test:contract` into the Vitest projects.
- Move `tools/check-publisher-workflow.mjs` into `tests/js/check-publisher-workflow.test.mjs` as a pure contract test
  and simplify `actions:lint` to `actionlint` alone.

#### G3. Retire the aliases, harnesses, and Python release path

- Delete `tools/check-all.sh` and remove its two references: `AGENTS.md` section 8 and
  `documentation/conventions/quality-gates.md` (fact 27).
- Retire `tools/viewer-harness.mjs` and `viewer-harness/{fake-dom,fixtures}.mjs` against jsdom plus a `tests/setup/`
  module, keeping every viewer test green. If any harness capability has no jsdom equivalent, keep the harness as Tier 2
  and record why.
- Retire `tools/quality-policy/canonical_json.py` and `generate_baseline_coverage_capture.py` against the donated
  `read-json-policy.mjs`, and retire `tools/setup.mjs` in favour of an inline `setup` script, keeping
  `tests/js/setup.test.mjs` pointed at the new form.
- Leave `tools/mock-server.py` and `tools/mock_server/` in place. They are a manual development aid, not a gate; record
  that decision rather than deleting them.
- Retire `tools/release-runtime.mjs`, `tools/release_manifest.py`, `tools/release-zip.py`, and `tools/check-release.py`
  against the donated all-JavaScript release tooling, proving the built artifact is byte-identical before and after.

Exit conditions: `npm run check:all` green; every deleted tool has a named replacement owner and a recorded assertion
parity or artifact-identity proof; `acorn` is gone from `devDependencies`; `AGENTS.md` and `quality-gates.md` no longer
reference `tools/check-all.sh`; the release artifact is byte-identical to the pre-retirement build.

---

### Phase H — Repair the documentation data and wiring

Intent: close facts 31, 36, and 37.

Dependencies: Phases E and G.

#### H1. Fix the stale authority reference

- Correct `pyproject.toml:127` to name `tools/quality-policy/check-coverage-inventory.mjs` as the enforcing authority
  for the validation-package floor (fact 37).
- Sweep `pyproject.toml`, `documentation/`, and `AGENTS.md` for any other reference to a tool retired in Phase G, and
  correct each. Add a contract test asserting every tool path named in `pyproject.toml`, `package.json`, and
  `documentation/**` exists on disk, so this class of staleness cannot recur.

#### H2. Adopt the converged documentation-gate wiring

- Move `doc-format-contract`, `doc-reachability-contract`, `doc-toc-contract`, `smell-catalog-contract`, and
  `agents-pointer` into `docs:check`, so the command name means "all documentation gates" (fact 31). They keep running
  inside `test:tools` as well.
- Add a contract test asserting `docs:check` composition, so the wiring cannot silently diverge again.

#### H3. Make narrated counts asserted

- Replace every hand-written count in `documentation/conventions/quality-gates.md` with a value asserted by a test: the
  coverage-inventory entry count under the new schema, the test-inventory entry count, the exception count, and the
  complexity baseline count.
- Add a contract test that reads each policy file and asserts the document's stated number matches.

Exit conditions: `npm run check:all` green; no configuration or documentation file names a nonexistent tool, asserted by
a test; `npm run docs:check` includes lint, links, links-proof, TOC, format, reachability, smell-catalog, and pointer
contracts; every count in `quality-gates.md` is test-asserted.

---

### Phase K — Pair verification and closeout

Intent: prove every row of the Paired Acceptance Matrix in both repositories.

Dependencies: all previous phases, and Dyninstruments `PLAN42.md` Phases A through J.

#### K1. Verify identity out of band

- Run `cmp` over every manifest path against the Dyninstruments checkout and record a zero-difference result for every
  entry. This is a review action, not a gate: no committed check may read the sibling checkout.
- Confirm `shared-core-manifest.json` `entries`, `generic-tokens.json`, the extracted shared-instructions text, and the
  five generic skill files are byte-identical.
- Confirm `GENERIC_RULES` name sets are identical and match the canonical table.

#### K2. Verify both gates

- Run `npm run check:all` in both repositories from clean worktrees and record the results.
- Record the final coverage percentages, rule counts, baseline entry counts, and suppression counts, and compare them to
  the A1 recording. Any regression blocks closeout. The suppression count must still be exactly zero.

#### K3. Record the greenfield handoff

- Add a `documentation/conventions/quality-gates.md` subsection listing the manifest as the authoritative generic-core
  inventory, and stating that the greenfield environment is derived from it rather than from either repository.
- Record in this plan which Tier 1 candidates were reclassified to Tier 2 and why, and which Python capabilities reach a
  Tier 1 checker only through an adapter, so the greenfield authors inherit the reasoning and not just the result.
- Move `PLAN9.md` to `exec-plans/completed/` and update the Dyninstruments plan's pointer.

Exit conditions: every row P1 through P14 of the Paired Acceptance Matrix verified and recorded in both plans; both
gates green; suppression count still zero here; no reclassification left unexplained.

---

## User-Facing Documentation Impact

`README.md` changes are **not required**. This plan changes no installation step, no configuration key or default, no
export or import behavior, no preset behavior, no requirement or platform-support statement, and no visible viewer
behavior. The only contributor-visible changes are the addition of `npm run check:shared-core` and the removal of the
`duplication:js`, `duplication:python`, and `test:contract` script rungs, all documented in
`documentation/conventions/quality-gates.md` rather than `README.md`, consistent with how the other gate commands are
documented.

Documentation files that must change:

- `documentation/conventions/quality-gates.md` — add the `check:shared-core` row, remove the rows for every retired
  tool, record the converged `docs:check` composition, add the generic-core inventory subsection, and replace narrated
  counts with asserted ones.
- `documentation/conventions/smell-prevention.md` — canonical rule names in the catalog and rule index, and the
  converged suppression grammar replacing `pattern-ignore:`.
- `documentation/conventions/smell-fix-playbooks.md` — playbook titles under canonical rule names, and the two playbooks
  that name `check-duplication.py` and `check-js-duplication.mjs` retargeted at their replacements.
- `documentation/conventions/testing-infrastructure.md` — the converged inventory schemas, the retired viewer harness,
  the adapter-based Python coverage reader, and the empty complexity baseline.
- `documentation/conventions/coding-standards.md` — the converged suppression grammar and the complexity scan's new
  `tools/**/*.mjs` coverage.
- `documentation/guides/exec-plan-authoring.md` — add the adopted Exec-Plan Citation Rule section.
- `documentation/TABLEOFCONTENTS.md` — only if a document is added, moved, or removed.
- `AGENTS.md` — converged shared block, the `tools/check-all.sh` reference removed from section 8, and the new gate
  command in section 8.
- `CONTRIBUTING.md` — the new gate command and the retired script rungs.
- `pyproject.toml` — the corrected coverage-authority comment.

---

## Acceptance Criteria

### Shared core identity

- `tools/quality-policy/shared-core-manifest.json` exists, is committed identically in both repositories, and lists
  every Tier 1 path with a matching SHA-256.
- `npm run check:shared-core` is part of `check:core` and fails on a missing path, a digest mismatch, or an unlisted
  Tier 1 path.
- An out-of-band `cmp` shows zero differences for every manifest entry.
- A contract test anchors the manifest's own digest, so a one-sided change is visible in review.
- No manifest entry is a Python file, and no gate reads a path outside this repository.

### Genericness

- `tools/quality-policy/generic-tokens.json` is the only genericness token source, is byte-identical in both, and
  carries all three arrays.
- `runGenericSurfaceCheck()` reports zero findings over the shared-instructions text, the five generic skill files,
  every Tier 1 tool module's full content, and every generic rule definition's content and rendered semantics.
- No Tier 1 file contains `polarrecorder`, `dyninstruments`, `viewer`, `widget`, `cluster`, `avnav`, `plugin.py`, or any
  other listed token.
- The `skills-lock.test.mjs` claim that the skills are not repository-agnostic is removed.

### Rules

- `GENERIC_RULES` name sets are identical in both repositories and match the Canonical Rule Identifiers table.
- Every renamed rule was proven finding-equivalent per rule, against a fixture workspace, before its old name was
  removed.
- `responsive-layout-hard-floor` stays generic; the three work-marker rules are one rule; `console-in-runtime` exists;
  every Python rule is still a project rule.
- A contract test locks the canonical generic name list and the classification split.

### Engine

- The engine builds finding objects with severities, supports `--warn`, filters per-finding suppressions, and defaults
  `rule.run` to `runRegexRule`.
- `pattern-ignore:` is no longer recognised; the de-branded marker grammar with owner, date, reason, and expiry is.
- `file-cache.mjs` and `discovery.mjs` are retired with a recorded file-set equivalence proof.
- `PATTERN_RULE_IDS` and the registry-parity assertion survive the migration.

### Policy mechanisms

- Complexity, coverage-inventory, and test-inventory checkers are manifest entries; their baselines are not.
- `complexity-baseline.json` is empty, and a contract test proves an empty baseline fails on the first finding.
- The ruff mccabe and pylint values are asserted equal to `STRICT_LIMITS`.
- `tools/**/*.mjs` is within the complexity scan roots.
- Every coverage floor is reproduced per file with no value lowered, proven entry by entry, and both baselines are
  re-anchored.
- Python coverage reaches the shared checker through a documented adapter, and its 90 % aggregate floor and family
  floors are intact.
- Every immutable baseline entry resolves to a live path, with a negative fixture.

### Retired tooling

- `check-js-duplication.mjs`, `check-duplication.py`, `check-smell-contracts.mjs`, `check-viewer-contracts.mjs`,
  `check-dependencies.mjs`, `check-publisher-workflow.mjs`, `check-all.sh`, `typecheck-source.mjs`,
  `typecheck-tools.mjs`, `setup.mjs`, `release-runtime.mjs`, `release_manifest.py`, `release-zip.py`,
  `check-release.py`, `canonical_json.py`, and `generate_baseline_coverage_capture.py` are deleted, each with a named
  replacement owner and a recorded parity proof.
- `acorn` is gone from `devDependencies`.
- The release artifact is byte-identical before and after the release-tooling retirement.
- `tools/mock-server.py` and `tools/mock_server/` are retained with the reason recorded.

### Suppressions

- Suppression comments in maintained source remain at exactly **zero**, asserted across the whole maintained surface.
- `noInlineConfig` and `no-warning-comments` remain in force on every ESLint group throughout every phase.
- Adopting the sibling's engine imported no suppression debt.

### Data and documentation truth

- `pyproject.toml` names the correct coverage authority.
- No configuration or documentation file names a nonexistent tool, asserted by a test.
- Every count narrated in `documentation/conventions/quality-gates.md` is asserted by a test.
- `npm run docs:check` includes every documentation gate.

### Skills

- Every `skills-lock.json` entry names an existing local skill directory, and its hash is verified against that file.
- No entry uses `sourceType: "sibling-repository"`, and a negative assertion rejects it.
- The five generic skill files are byte-identical in both repositories and are manifest entries.
- Any project-specific skill content has a declared project-skill home, or its absence is recorded.

### Gate integrity

- `npm run check:all` is green at the end of every phase in this repository.
- No threshold lowered, ignore list widened, rule disabled, test deleted or skipped, or suppression added to reach
  green.
- `mypy --strict` and the full ruff selection stay binding and unnarrowed.
- No gate, test, tool, or config reads any path outside this repository.

### Project profile preservation

- No change to Python APIs, the validation pipeline, persistence, exports and imports, presets, timeline or histogram
  behavior, viewer screens, host integration, packaging output, or release artifacts.
- `server/polarrecorder/`, `viewer/`, `plugin.py`, the Python tooling, and the product schemas stay Tier 2.
- `documentation/` content outside the two converged convention documents stays project-specific.
- `tools/check-patterns/project/*` keeps every Python rule unchanged.

---

## Progress / Completion Evidence

Record per phase, in order: the commands run, the recorded numbers, the equivalence proofs, and the out-of-band `cmp`
results. Every retirement records its replacement owner and parity proof here. Every Tier 1 candidate reclassified to
Tier 2 records its reason here.

---

## Related

- Paired plan: Dyninstruments `exec-plans/active/PLAN42.md`
- [PLAN8.md](../completed/PLAN8.md) — the contract convergence this plan completes
- [PLAN7.md](../completed/PLAN7.md) — the alignment attempt whose implementation gap this plan closes
- [PLAN5.md](../completed/PLAN5.md) — the fail-closed gate set this plan must not weaken
- [Execution plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Documentation format](../../documentation/conventions/documentation-format.md)

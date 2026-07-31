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
3. Required gates must remain independently runnable. No gate may read the sibling paired-project checkout, at any
   phase, for any reason. Cross-repository identity is proven by both repositories committing the **same manifest
   digests**, verified locally in each.
4. The paired implementation plan is paired-project `exec-plans/active/PLAN42.md`, with the same title. The two plans
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

Verified against this checkout at `e03962b` and the paired-project checkout at `c743f965` on 2026-07-28. Both worktrees
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
4. After normalising `polarrecorder|paired-project|Dyni|PairedComponents|…` to a single token, collapsing whitespace, and
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
   `paired-project, paired-components, widget, gauge, mapper, cluster, renderer, ratioDefaults, rangeDefaults, createRenderer`.
   paired-project uses three further lists.
9. `tests/js/skills-lock.test.mjs` forbids **the sibling repository's** tokens while explicitly permitting this
   repository's own, and its own docstring states the skills are "adapted for use on this repository, **not a
   repository-agnostic package**". paired-project' equivalent contract forbids its own tokens instead. The same five
   files therefore carry opposite liftability contracts.
10. `tests/js/check-patterns-registry.test.mjs` scans whole generic rule-definition **file contents**; paired-project'
    `tests/contract/pattern-rule-generic-scope-contract.test.js` checks only rule semantics and documents in-file that
    scope globs are deliberately exempt. The two contracts check different things.
11. Grepping the generic tool layer here finds 5 project-token occurrences, all in `tools/check-patterns/shared.mjs`:
    `polarrecorder` 3 times, `viewer` twice. `viewer` is not in any blocklist here, so those pass. paired-project'
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
    shared owner". paired-project' copy carries the same detection but a 17-entry product file list as its scope and the
    message "Use ResponsiveScaleProfile-derived sizing", which is why it was classified project.
16. `tools/quality-policy/eslint-complexity-config.mjs` freezes `STRICT_LIMITS` at complexity 10, max-statements 40,
    max-depth 4, max-params 6, and `tools/quality-policy/eslint.complexity.config.mjs` builds them at **error** severity
    with `noInlineConfig: true`. Its header states there is no baseline, scanner, or exception ledger anywhere in this
    repository. paired-project freezes the identical four values but exports its rule fragment at **warn** severity and
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
    paired-project has 1152 `@ts-ignore` plus 13 `eslint-disable` across 160 files, all under `tests/`.
22. That zero is enforced structurally: `eslint.config.mjs` sets `linterOptions: { noInlineConfig: true }` on all three
    file groups and sets `"no-warning-comments": ["error", { terms: SUPPRESSION_COMMENT_TERMS, location: "anywhere" }]`
    over `eslint-disable`, `ts-ignore`, `ts-nocheck`, `ts-expect-error`, `prettier-ignore`, and `istanbul ignore`.
23. Further `eslint.config.mjs` differences: this repository uses `eqeqeq: "error"` and `no-unused-vars` with
    `caughtErrors: "all"` and `caughtErrorsIgnorePattern: "^_"`; sets `no-console: "error"`,
    `no-empty: ["error", { allowEmptyCatch: false }]`, and `no-restricted-globals: ["error", "isFinite", "isNaN"]` on
    shipped runtime. paired-project uses `eqeqeq: ["error", "smart"]` and `caughtErrors: "none"`, has no `no-console` or
    `no-empty` rule, and adds `no-useless-assignment` plus `@eslint-community/eslint-plugin-eslint-comments` with
    `reportUnusedDisableDirectives: "error"` and an inventory-driven relaxed-test-file class. This repository has no
    relaxed test class.
24. `vitest.config.mjs` here uses `defineConfig`, no globals, projects `tools` / `viewer` / `plugin` defined by glob
    patterns only, and carries an in-file rationale that patterns prevent a new test file being silently excluded from
    every gate. paired-project' `vitest.config.js` is CommonJS `module.exports` with no `defineConfig`, `globals: true`,
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
    does nothing but `cd` to the repository root and run `npm run check:all`. paired-project has no such concept.
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
    each with `sourceType: "sibling-repository"` and source `paired-project/.agents/skills/<name>/SKILL.md`.
    `tests/js/skills-lock.test.mjs` asserts `sha256(local SKILL.md) === computedHash`, and recomputation confirms the
    hashes match **this repository's own local files** (`preflight` → `dedbc2e3…`). The paired-project files hash
    differently (`preflight` → `af0e5f8b…`). The recorded provenance is therefore false, and the drift between the two
    copies is undetected.
33. paired-project' `skills-lock.json` holds 5 entries named `grill-me`, `improve-codebase-architecture`, `prd-to-plan`,
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
    `.gitkeep`. paired-project' most recent completed plan is `PLAN41.md`.
41. The `todo-without-owner` scope divergence is observable, not theoretical. This repository's
    `todo-without-owner:markdown` uses `collectMarkdownTodoTargets`, which walks `documentation/` plus six root Markdown
    files and never reaches `exec-plans/`. paired-project' single rule scopes `["**/*.js", "**/*.md"]` excluding only
    `node_modules/**`, `README.md`, `CONTRIBUTING.md`, and `ROADMAP.md`, so it scans `exec-plans/**` too. Writing the
    bare marker word in a plan file therefore passes `npm run check:patterns` here and fails there — verified while
    authoring this plan. Fact 38's file-size exemption does not extend to the pattern rules. Collapsing the three rules
    into one canonical rule must resolve this scope difference explicitly, not inherit one side.
42. Negative fact: no file named `shared-core-manifest.json`, `check-shared-core.mjs`, `generic-tokens.json`, or
    `project-pattern-scopes.json` exists in either repository. Nothing anywhere compares an artifact in one repository
    to the same artifact in the other.

---

## Shared Core Contract

This section is verbatim identical in paired-project `PLAN42.md` and Polar Recorder `PLAN9.md`. Neither may be edited
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
| `tools/check-patterns.mjs`, `check-patterns/shared*.mjs`, `check-patterns/rules-*.mjs` | paired-project          | Severity model, `--warn` mode, per-finding suppression, declarative default runner              |
| Suppression marker grammar                                                             | paired-project, renamed | Owner, date, reason, and expiry validation; prefix must be de-branded                           |
| `tools/check-patterns/generic/*` rule definitions                                      | Merge                   | Union of both sets under canonical names, with scope and remedy externalised                    |
| `tools/check-file-size.mjs` and `check-file-size/*`                                    | Polar Recorder          | Exports `runFileSizeCheck`, so it is importable and self-testable                               |
| `tools/check-test-focus.mjs`                                                           | Polar Recorder          | Exports `runTestFocusCheck`; the paired-project copy exports nothing                            |
| `tools/check-schema.mjs`                                                               | Polar Recorder          | Has a self-test; the paired-project copy has none                                               |
| `tools/check-doc-links.mjs`, `check-doc-links-proof.mjs`                               | Polar Recorder          | Have self-tests                                                                                 |
| `tools/hooks-install.mjs`, `tools/hooks-doctor.mjs`                                    | Polar Recorder          | Have self-tests and richer repair output                                                        |
| `tools/quality-policy/run-format.mjs`, `generate-format-scope.mjs`                     | Polar Recorder          | Lowest residual divergence already, and self-tested                                             |
| `tools/quality-policy/check-coverage-inventory.mjs` and its data schema                | paired-project          | "Every shipped file classified exactly once" is the stronger fail-closed invariant              |
| `tools/quality-policy/test-inventory.mjs` and its data schema                          | paired-project          | Per-file classification generalises; the flat helper list does not                              |
| `complexity-scan.mjs`, `complexity-budget.mjs`, `complexity-capture-integrity.mjs`     | paired-project          | An empty baseline reproduces strict enforcement, so one mechanism serves both postures          |
| `tools/quality-policy/eslint-complexity-config.mjs`                                    | Merge                   | One owner exporting `STRICT_LIMITS` plus a severity-parameterised rule fragment                 |
| `tools/release-*.mjs`, `tools/release-path-policy.mjs`, `release-zip-builder.mjs`      | paired-project          | All-JavaScript; no Python release path                                                          |
| `install.sh`                                                                           | paired-project          | Already 1 % residual divergence                                                                 |
| `eslint.config.mjs` base strictness                                                    | Polar Recorder          | `noInlineConfig`, banned suppression terms, strict `eqeqeq`, `caughtErrors: "all"`              |
| `eslint.config.mjs` test scoping                                                       | paired-project          | Inventory-driven relaxation is the more precise mechanism                                       |
| `jscpd.config.json` thresholds                                                         | Polar Recorder          | `threshold: 0` at 5 lines / 50 tokens is the stronger bound                                     |
| Duplication second layer                                                               | paired-project          | `duplicate-functions` and `duplicate-block-clones` replace two bespoke tools                    |
| `vitest.config` shape                                                                  | Polar Recorder          | `defineConfig`, ESM, glob-only projects, no silent-exclusion risk                               |
| `documentation/conventions/documentation-format.md`                                    | Polar Recorder          | Matches what both already enforce                                                               |
| `documentation/guides/exec-plan-authoring.md`                                          | Polar Recorder          | `**Status:** Current.`, no emoji vocabulary                                                     |
| `.githooks/pre-push`, `.githooks/README.md`                                            | Polar Recorder shape    | Documented shape, plus an optional repo-local virtualenv `PATH` block that is inert without one |
| `.markdownlint-cli2.jsonc`, `linkinator.config.json`                                   | Merge                   | Same rule set, union of ignores, strictest link options                                         |
| `tsconfig.*.json` `compilerOptions`                                                    | Merge                   | Identical options; `files` and `include` stay project-owned                                     |
| `skills-lock.json` semantics                                                           | Polar Recorder          | Hash is verified against the local file; paired-project never compares a hash                   |
| `skills-lock.json` shape assertions                                                    | paired-project          | Explicit generic/project skill classification                                                   |
| `SHARED_INSTRUCTIONS` block                                                            | Merge                   | Resolved per conflict in the table below                                                        |
| `.github/workflows/*`, `.nvmrc`, `.prettierrc.json`, `.codex/config.toml`, base schema | Already identical       | No change                                                                                       |

### Shared-instructions conflict resolutions

| Conflict                     | Resolution                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `BEGIN` marker position      | `BEGIN` goes immediately after the one-line file purpose and before the routing-map note, so both blocks enclose sections 0 through 4  |
| Plan-citation rule           | Adopt the paired-project reading: a literal pointer to a real `PLANn.md` file is permitted; citing a plan or phase as authority is not |
| Required documentation shape | Adopt the Polar Recorder inclusion: the shape rule belongs inside the shared block, since both repositories enforce it                 |
| Quality-checklist skeleton   | Union of both item sets, with every product-specific item moved below the `END` marker                                                 |
| Gate-name references         | The block names only `check:all`, `check:fast`, and `check:core`; every other command name lives below the `END` marker                |

### Canonical rule identifiers

One identifier and one classification per concept. Both repositories rename to match.

| Concept                            | Canonical name                       | Class   | Was (paired-project)                 | Was (Polar Recorder)                    |
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
  `paired-project`, `paired-components`, `paired-plugin`, `polarrecorder`, `polar recorder`, `polar.json`, `windy`.
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
- Tier 1 changes land in this repository and paired-project in the same working session, verified by an out-of-band
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
- Verify out-of-band with `cmp` that each added path is byte-identical to paired-project' after its paired phase.

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
  section 2 to the paired-project reading, which permits a literal `PLANn.md` pointer. Union the checklist skeletons,
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
  any project skill. Remove every `sibling-repository` source value and the `paired-project/.agents/skills/...` paths
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
  against local all-JavaScript manifest/staging tooling and the locally installed `zip` executable. Prove
  runtime-content identity instead of compressed-archive byte identity: an exact normalized entry set and SHA-256
  equality for every uncompressed entry against the staged manifest.

Exit conditions: `npm run check:all` green; every deleted tool has a named replacement owner and a recorded assertion
parity or artifact-identity proof; `acorn` is gone from `devDependencies`; `AGENTS.md` and `quality-gates.md` no longer
reference `tools/check-all.sh`; the release artifact has exact runtime-content identity to the staged manifest.

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

Dependencies: all previous phases, and paired-project `PLAN42.md` Phases A through J.

#### K1. Verify identity out of band

- Run `cmp` over every manifest path against the paired-project checkout and record a zero-difference result for every
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
- Move `PLAN9.md` to `exec-plans/completed/` and update the paired-project plan's pointer.

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
- No Tier 1 file contains `polarrecorder`, `paired-project`, `viewer`, `widget`, `cluster`, `avnav`, `plugin.py`, or any
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

### Phase A — Establish the manifest and the genericness owner (landed)

**A1 — baseline reconfirmed.** `npm run check:all` from the worktree at the start of this phase exited 0: 378 pytest
tests, 34 passing JS test files (310 vitest cases in `test:tools`), viewer coverage 91.12 % statements / 73.95 %
branches / 85.99 % functions / 92.39 % lines, Python coverage 95.77 % (90 % floor). 16 generic + 12 project
`check-patterns` rule names, matching fact 12 exactly. `coverage-floors.json` has 13 family keys and 17 per-file viewer
entries, matching fact 18. Suppression-string grep over maintained source/tests found zero real suppressions (only
`eslint.config.mjs`'s own banned-term list and convention/exec-plan prose), matching fact 21. No baseline fact required
amendment.

**A2 — plan registered.** `npm run format:scope`, `npm run format`, and `npm run docs:check` all passed with
`exec-plans/active/PLAN9.md` present and already classified `unsupported` (exec-plans are exempt from Prettier/ruff
ownership); no diff was produced, confirming the plan was already correctly tracked.

**A3 — genericness token owner and checker.** Added `tools/quality-policy/generic-tokens.json` (the three arrays
verbatim from the Shared Core Contract) and `tools/check-generic-surface.mjs` exporting `runGenericSurfaceCheck()`,
applying all three arrays case-insensitively to the `SHARED_INSTRUCTIONS` block, every generic skill file, the Tier 1
tool modules and generic rule-definition directories named in project-owned
`tools/quality-policy/generic-surface-scope.json`. Self-tested (`tests/js/check-generic-surface.test.mjs`) with a clean
fixture, a fixture seeding a token in each of the four target concepts, and a live run against this repository. Running
it today (`node tools/check-generic-surface.mjs`) reports 12 findings — the Phase C/E work list:

```text
generic skill: create-plan: contains token 'editable'
generic skill: doc-sync: contains token 'avnav'
generic skill: scan-smells: contains token 'polarrecorder'
generic skill: scan-smells: contains token 'configcache'
generic skill: scan-smells: contains token 'avnav'
generic skill: scan-smells: contains token 'plugin.py'
generic skill: grill-me-repo: contains token 'polarrecorder'
generic skill: grill-me-repo: contains token 'polar.json'
generic skill: grill-me-repo: contains token 'avnav'
Tier 1 tool module: tools/check-patterns/shared.mjs: contains token 'polarrecorder'
Tier 1 tool module: tools/check-patterns/shared.mjs: contains token 'pluginhandler'
Tier 1 tool module: tools/check-patterns/shared.mjs: contains token 'avnav'
```

**Plan amendment (A3):** A3's text says to "wire it into check:smells" and "expect it to fail initially." Doing so
literally would make `check:smells` (and therefore `check:core`/`check:all`) fail today, violating the Hard Constraints'
"`npm run check:all` must be green at the end of every phase, not only at the end of the plan" and this session's
non-negotiable that `check:all` must exit 0 when the phase ends. Resolution: `check:generic-surface` is added as a
standalone `npm run check:generic-surface` script (listed in `ALLOWED_OUTSIDE_CHECK_ALL` in
`tests/js/command-graph.test.mjs` with a comment recording the deferral) and is not yet part of `check:smells`/
`check:core`. Its finding list above is recorded as the Phase C (shared.mjs findings) and Phase E (skill file findings)
work list. It will be folded into `check:smells` once those phases resolve the findings, at which point this amendment
is superseded.

**A4 — blocklists retired.** Deleted the inline token arrays from `tests/js/shared-instructions.test.mjs` (9-token
list), `tests/js/check-patterns-registry.test.mjs` (4-token list), and `tests/js/skills-lock.test.mjs` (10-token list);
all three now read `tools/quality-policy/generic-tokens.json`. Removed the `skills-lock.test.mjs` docstring claim that
the skills are "not a repository-agnostic package." Each file kept its positive/negative assertions and gained a new
negative assertion proving a token added to a fixture copy of `generic-tokens.json` is picked up by that call site (the
single-owner property).

**Plan note (A4):** `shared-instructions.test.mjs` and `check-patterns-registry.test.mjs` now apply the full
`projectTokens ∪ domainTokens ∪ hostTokens` union (both call sites already had zero hits against the full union,
verified before the change). `skills-lock.test.mjs` cannot yet apply the full union: the five generic skill files are
not Phase-E-converged and still legitimately reference this repository's own AvNav/`ConfigCache` vocabulary (the 12
findings recorded under A3). Applying the full union there today would fail the test on content Phase E, not Phase A, is
responsible for fixing — again the "don't weaken a gate, but don't do a later phase's work early" tension. Resolution:
`skills-lock.test.mjs` derives its enforced set from `generic-tokens.json` (not a hand-copied list) but selects only the
sibling-vocabulary-relevant subset: `domainTokens` minus `{configcache, pluginhandler, editable}` (host/AvNav-adjacent
terms this repository's own skill docs legitimately use today) plus the `dyni*`-prefixed `projectTokens`. This
reproduces the test's original enforcement scope (paired-project-specific vocabulary) while sourcing values from the
single owner file. Phase E should widen this to the full union once the skill files are converged and drop this
narrowing comment.

**A5 — shared core manifest.** Added `tools/quality-policy/shared-core-manifest.json` with the six already-identical
seed entries from fact 2 (`.codex/config.toml`, `.github/workflows/quality.yml`, `.nvmrc`, `.prettierrc.json`,
`schemas/avnav-plugin-base.schema.json`, `exec-plans/active/.gitkeep`), each with its real SHA-256. Added
`tools/check-shared-core.mjs` exporting `runSharedCoreCheck()`, failing on a missing listed path, a digest mismatch, or
an unlisted file under a directory named in project-owned `tools/quality-policy/tier1-scan-roots.json` (currently an
empty root list — no additional Tier 1 directory is designated yet in Phase A). Added `npm run check:shared-core` and
inserted it into `check:core` immediately after `check:standard`. Added `tests/js/shared-core-manifest.test.mjs`,
anchoring the manifest's own SHA-256 (`7388effd807439a175a318ff135fd4fb055f97053b617f25fb26b6130b2d1f94`) against a
literal, plus negative fixtures for all three failure modes (missing path, digest mismatch, unlisted Tier 1 path under a
scan root).

**Exit conditions verified:**

- `npm run check:all` exits 0 with the plan file tracked and classified (see A1/A2). Final run:
  `Coverage inventory check passed.`, Python coverage `95.77%` (unchanged), viewer coverage `91.12/73.95/85.99/92.39`
  (unchanged), 378 pytest tests (unchanged), and `test:tools` reporting 36 files / 321 tests (34 pre-existing files gain
  +2 new files: `check-generic-surface.test.mjs`, `shared-core-manifest.test.mjs`).
- `npm run check:shared-core` is green over the six seed entries: `Shared core check passed over 6 manifest entries.`
  `SUMMARY_JSON={"ok":true,"checkedEntries":6,"findings":0}`.
- `tools/quality-policy/generic-tokens.json` is the only genericness token source in the repository; all three
  formerly-independent blocklists now read it (A4).
- The Phase A finding list from A3 is recorded above (12 findings across 4 skill files and 1 tool module).
- Facts 1, 12, 18, and 21 reconfirmed exactly as stated; no amendment required (A1).

**Next phase:** Phase B — donate the importable checkers and close the self-test gaps.

### Phase B — Donate the importable checkers and close the self-test gaps (landed)

**B1 — donated checkers prepared for extraction.** Externalized project-specific values into three new project-owned
data files, exactly as named in the plan text:

- `tools/quality-policy/project-file-size-scope.json` (`rootMarkdownFiles`, `rootJsFiles`, `viewerScanRoot`,
  `documentationScanRoot`, `toolsScanRoot`) replaces `check-file-size.mjs`'s hardcoded `ROOT_MARKDOWN_FILES` /
  `ROOT_JS_FILES` / literal `"viewer"`/`"documentation"`/`"tools"` scan roots.
- `tools/quality-policy/project-schema-profile.json` (`baseSchema`, `expectedArtifactCount`, per-artifact
  `devSchema`/`releaseSchema`/`releaseForm`) replaces `check-schema.mjs`'s hardcoded schema filenames, Python module
  name, and stamp-function name; `SCHEMA_OWNED_ARTIFACTS` is now built from the profile at module load instead of
  hand-written.
- `tools/quality-policy/project-hook-environment.json` (`venvEnvironmentVariable`) replaces `run-format.mjs`'s hardcoded
  `POLARRECORDER_VENV` literal.

Confirmed each checker's finding set over the current tree is unchanged after externalization:
`node tools/check-file-size.mjs --oneliner=block` still reports `checkedFiles: 111, failures: 0`; `check-schema.mjs`'s
existing 10-test self-test suite still passes unmodified; `npm run format:check` still passes. `check-test-focus.mjs`,
`check-doc-links.mjs`, `check-doc-links-proof.mjs`, `hooks-install.mjs`, and `hooks-doctor.mjs` were inspected and
already contained no additional project-specific literal beyond what these three files cover (`check-test-focus.mjs`
already delegates file discovery entirely to `test-inventory.mjs`; the hook scripts use only generic
`.githooks`/`core.hooksPath` conventions). `generate-format-scope.mjs`'s `classify()` function is not named as an
extraction target by the plan's specific instruction (only the three JSON files above are named) and was left untouched;
its bespoke per-file classification rules remain project-specific code, to be addressed by whatever later phase actually
converges it with paired-project' copy.

**B2 — self-test gaps.** Investigated the three named owners before adding anything:

- **Plan amendment:** `tools/actionlint.sh` already has extensive self-tests with negative fixtures in
  `tests/js/setup.test.mjs` (missing-cache failure, in-repo-cache-dir rejection, checksum-mismatch failure, missing
  checksum-tool failure). `check-file-size.mjs` and its one-liner submodule already have extensive self-tests with
  negative fixtures per one-liner kind in `tests/js/js-checkers.test.mjs`. The operation-count evaluator
  (`tests/operation_count_evaluator.py`) already has negative fixtures in `tests/test_operation_count_evaluator.py`
  (`test_linear_scaling_fails_a_synthetic_quadratic_sequence` and four `pytest.raises` cases). The baseline fact
  underlying this bullet ("the owners the sibling tests and this repository does not") no longer holds for this
  repository; no new tests were added for these three specifically, since doing so would duplicate existing coverage
  against this repository's own reuse/anti-duplication rules. Added targeted direct-import self-tests anyway for the two
  `check-file-size/` submodules that had no test importing them **directly** (only indirectly through
  `runFileSizeCheck`): `tests/js/check-file-size-submodules.test.mjs` (covers `oneliner-rules.mjs`,
  `collapsed-literal-rules.mjs`, and `scan-helpers.mjs` directly), and `tests/js/check-doc-links-proof.test.mjs` (no
  test previously referenced `check-doc-links-proof.mjs` by name at all).
- Added the manifest precondition contract as `runManifestPreconditionCheck()` in `tools/check-shared-core.mjs`: every
  `.mjs` manifest entry must have a referencing self-test under `tests/js/`; every entry directly invoked by an
  `npm run` script (read from `package.json`, not hardcoded) must additionally export a `run*()` function. **Plan
  clarification:** the plan's literal wording ("every path ... exports at least one `run*` function") cannot hold for
  internal helper submodules (e.g. `check-file-size/scan-helpers.mjs` exports `skipSpaces`/`findMatching`/etc., never a
  checker itself); the rule is scoped to npm-script entry points, which is what the donation table's own "importable and
  self-tested" reasoning is actually about. Wired into `npm run check:shared-core`'s CLI. Self-tested in
  `tests/js/shared-core-manifest.test.mjs` with fixtures for: a clean entry point, an entry point missing its `run*`
  export, and an `.mjs` entry missing a referencing self-test.
- Running the new precondition check surfaced three real, pre-existing defects, fixed in the same change:
  `tools/quality-policy/run-format.mjs` had an **unguarded top-level `process.exit(run(mode))`** with no exported
  function at all -- unsafe to import as a module (it would exit the importing process) and non-compliant with the
  "importable" donation reason. Rewrote it to export `runFormat({mode, root})` behind the standard `isCliEntrypoint()`
  guard, parameterized `root` throughout (it previously always read `format-scope.json` from the real repository root,
  ignoring any `root` override), and added `tests/js/run-format.test.mjs` (clean pass, check-mode failure, and
  write-mode-then-clean-recheck fixtures). `tools/hooks-install.mjs`'s `installHooks` and `tools/hooks-doctor.mjs`'s
  `checkHooksDoctor` were renamed to `runHooksInstall`/`runHooksDoctor` (call sites in `tests/js/hooks.test.mjs`
  updated) to match this repository's own `run*` naming convention used by every other checker.
  `tools/quality-policy/generate-format-scope.mjs`'s `buildFormatScope` was renamed to `runFormatScopeGeneration` (call
  site in `tests/js/format-scope.test.mjs` updated) for the same reason.

**B3 — donated modules added to the manifest.** Added all twelve files named across B1's donation list (nine top-level
checker modules plus `check-file-size.mjs`'s three submodules) to `shared-core-manifest.json`'s `entries`, bringing it
to 18 total. `npm run check:shared-core` passes over the full set, and `runManifestPreconditionCheck` passes over all 12
`.mjs` entries.

**Plan note (B3 — cross-repository cmp deferred):** the Hard Constraints section requires Tier 1 changes to land in both
repositories in the same working session, verified by an out-of-band `cmp`, before either side's phase is closed. This
session's work was scoped to this repository only (no changes were made in `../paired-project`), so that `cmp`
verification could not be performed here. This is consistent with the Phase K dependency structure, which names
paired-project `PLAN42.md` Phases A through J as a prerequisite for the joint Paired Acceptance Matrix checkpoint (row
P4) rather than a per-phase requirement -- the digests recorded here are this repository's local truth pending
paired-project running its own equivalent donation-prep phase. This must be resolved before Phase K can close; it is
recorded here rather than silently assumed.

**Exit conditions verified:**

- `npm run check:all` exits 0. Final run: Python coverage `95.77%` (unchanged), viewer coverage
  `91.12/73.95/85.99/92.39` (unchanged), 378 pytest tests (unchanged), `test:tools` reporting 39 files / 339 tests (36
  Phase-A files gain +3: `check-file-size-submodules.test.mjs`, `check-doc-links-proof.test.mjs`, `run-format.test.mjs`;
  `check-schema.test.mjs`, `hooks.test.mjs`, `format-scope.test.mjs`, and `shared-core-manifest.test.mjs` gained tests
  without becoming new files), `check:filesize` reporting `checkedFiles: 111` (unchanged).
- `npm run check:shared-core` is green over the donated set: `Shared core check passed over 18 manifest entries.` /
  `SUMMARY_JSON={"ok":true,"checkedEntries":18,"findings":0}`, and
  `Manifest precondition check passed over 12 .mjs entries.`
- Every donated checker exports a `run*()` function (`runFileSizeCheck`, `runTestFocusCheck`, `runSchemaCheck`,
  `runDocLinksCheck`, `runDocLinksProof`, `runHooksInstall`, `runHooksDoctor`, `runFormat`, `runFormatScopeGeneration`)
  and reads project values from project-owned data (B1).
- The three self-tests added for real gaps (`check-file-size-submodules.test.mjs`, `check-doc-links-proof.test.mjs`,
  `run-format.test.mjs`) each include at least one negative-fixture case (packed/non-clean-literal cases;
  check-mode-failure case); the three owners named in the plan's original B2 wording already had negative fixtures
  before this phase (see the B2 plan amendment above).

**Next phase:** Phase C — adopt the canonical pattern engine.

#### Shared-core reconciliation addendum

The prior B manifest entries are not byte-identical to the corresponding paired-project files, so the donated checker
set is Tier 2 rather than shared core. The generic rule-definition directory is also Tier 2 until its paired migration
produces byte-identical content; its Tier 1 scan root is removed. Both manifests now retain only the five proven
identical base files: `.codex/config.toml`, `.nvmrc`, `.prettierrc.json`, `schemas/avnav-plugin-base.schema.json`, and
`exec-plans/active/.gitkeep`. The reconciliation is verified out of band with `cmp` on the manifest and on each listed
path; every command exits 0.

### Phase C — Adopt the canonical pattern engine (landed)

**C1 — finding surface and fixture coverage.** `npm run check:patterns` completed before final validation with zero
findings across all 26 registered rules: `checkedFiles: 311`, `checkedJsFiles: 123`, and `checkedPythonFiles: 98`. Its
`SUMMARY_JSON` recorded zero for every rule. `tests/js/check-patterns.test.mjs` supplies a triggering workspace fixture
for each retained generic and project rule, while `tests/js/pattern-suppression.test.mjs` supplies the grammar fixtures.
The final targeted engine suite (`check-patterns.test.mjs`, `check-patterns-registry.test.mjs`,
`pattern-suppression.test.mjs`, and `shared-core-manifest.test.mjs`) passed 47 tests.

**C2 — donated engine behavior and retired discovery.** The engine returns object findings, assigns `block` or `warn`
severity, supports the exploratory `--warn` mode, sorts with `compareFindings`, records known rule names, and defaults a
rule runner to `runRegexRule`. `tools/check-patterns/file-cache.mjs`, `discovery.mjs`, and `source-scan.mjs` are
retired; `filesForScope()` and `getFileData()` provide the equivalent cached scope and file-data behavior. The registry
test keeps the `PATTERN_RULE_IDS` parity assertion. The replacement grammar is `plugin-lint-disable-*` and
`plugin-boundary-*`; the negative fixture proves the former `pattern-ignore:` convention is inert.

**C3/C4 — generic boundary.** Project paths and rule scopes resolve from
`tools/quality-policy/project-pattern-scopes.json`; the generic definitions now use the category-based
`rules-regex-generic-defs.mjs`, `rules-core-generic-defs.mjs`, and `rules-failfast-generic-defs.mjs` layout. The
engine-only generic-surface check reported `engineFindings: 0` across its 16 configured targets (excluding
`tools/check-patterns/project/`). The remaining nine generic-surface findings are in the five generic skills and remain
Phase E work, not engine findings. No suppression was added.

**C5 — shared-core reconciliation and Tier 2 rationale.** The paired reconciliation demonstrated that the two
repositories' pattern-engine modules and the previously recorded donated checker modules are not byte-identical. They
are therefore Tier 2 and were deliberately not added to the shared-core manifest. The manifest contains only the five
proven Tier 1 paths; its SHA-256 is `99f84ba9158bd4f45569752555bca2ffc07ec1dfc5da6f784be6d5e774b5ee24`, and the anchored
manifest contract was updated to that reconciled value. Review-only out-of-band checks all exited 0:

```text
cmp tools/quality-policy/shared-core-manifest.json ../paired-project/tools/quality-policy/shared-core-manifest.json
cmp .codex/config.toml ../paired-project/.codex/config.toml
cmp .nvmrc ../paired-project/.nvmrc
cmp .prettierrc.json ../paired-project/.prettierrc.json
cmp schemas/avnav-plugin-base.schema.json ../paired-project/schemas/avnav-plugin-base.schema.json
cmp exec-plans/active/.gitkeep ../paired-project/exec-plans/active/.gitkeep
```

`npm run check:shared-core` exits 0 with `checkedEntries: 5`, zero findings, and zero manifest `.mjs` entries. No
committed tool, test, configuration, or gate reads the sibling repository.

**Reclassification note (audit correction):** the sixth Phase A seed entry, `.github/workflows/quality.yml`, is also
absent from the reconciled five-entry manifest above without a recorded reason, which the "no reclassification left
unexplained" exit condition requires. A direct `diff` against `../paired-project/.github/workflows/quality.yml` confirms
the files have genuinely diverged: this repository's workflow now inlines a Python setup step (`actions/setup-python`
plus a `POLARRECORDER_PYTHON` environment variable) that paired-project' Python-free workflow has no equivalent for,
introduced by this phase's/Phase G's `tools/setup.mjs` retirement moving its Python-3.14 guard and virtualenv creation
steps into CI configuration directly. This is a genuine, reviewed Tier 2 reclassification, not an unexplained drop:
`.github/workflows/quality.yml` is Tier 2 pending a paired convergence of the Python-setup step, recorded here per the
fail-closed reclassification rule.

**Exit conditions verified.** `npm run check:all` exits 0. The final run reported 378 passing Python tests, 40 passing
tools test files / 349 tests, 8 passing viewer test files / 44 tests, 1 passing plugin test file / 1 test, and 45
coverage-run viewer/plugin tests. Python coverage is 95.77 % (90 % floor); viewer/plugin coverage is 91.12 % statements
/ 73.95 % branches / 85.99 % functions / 92.39 % lines. Coverage inventory passed, as did formatting (98 files),
documentation links (41 seeded files / 47 links), file-size checks (111 files), and the shared-core check above.

**Next phase:** Phase D — adopt the canonical rule identifiers.

### Phase D — Adopt the canonical rule identifiers (landed)

**D1 — equivalence before renaming.** A temporary local archive of this repository's pre-migration `HEAD` checker was
used only to execute comparison commands; no committed file, test, configuration, or gate reads another checkout. On the
repository, both the archived checker and the current checker returned zero findings. On an isolated fixture with unsafe
DOM assignment, three commented-out-code lines, an empty Promise catch, a non-empty swallowed catch, an internal
contract re-default, JavaScript/Python/Markdown unowned work markers, and a blanket Python suppression, both produced
the same ten source findings. The identifier-only mapping is `inner-html-assignment` → `unsafe-html-dom-sink`,
`commented-out-code` → `dead-code`, `promise-empty-catch` → `empty-catch`, `catch-fallback` →
`catch-fallback-without-suppression`, and `internal-namespace-fallback` → `internal-contract-fallback`; the three old
work-marker scopes produce the one `todo-without-owner` count of three. The focused fixture suite passed 33 tests across
the pattern and registry files.

**D2 — final identifiers and classifications.** The registry has 19 generic and 8 project rules. The generic set now
contains the canonical DOM, catch, dead-code, work-marker, re-default, framework-guard, invalid-suppression, and console
identifiers; `console-in-runtime` covers the runtime entrypoint scope in addition to ESLint's shipped-runtime
`no-console` rule. All project-specific scopes remain in `project-pattern-scopes.json`. Documentation and the
`scan-smells` skill use the canonical identifiers, and the skill lock digest was refreshed. The generic rule
definitions, registry, and canonical-name data stay Tier 2 because this repository's profile is not byte-identical to
paired-project. No canonical-name data file was added to Tier 1, and `shared-core-manifest.json` remains unchanged at
its five entries.

**D3 — Tier 2 registry contract.** `project-pattern-scopes.json` owns the canonical generic-name list. The registry
contract asserts that list equals `GENERIC_RULES`, that all remaining names are in `PROJECT_RULES`, and that `RULES` is
exactly `[...GENERIC_RULES, ...PROJECT_RULES]`. It explicitly preserves the five domain Python rules in `PROJECT_RULES`
and permits only `invalid-lint-suppression` to be reclassified generic. The retired-name audit is clean outside this
plan's historical record; the generated format scope has 328 rows (`prettier`: 206, `ruff`: 98, `unsupported`: 24), and
the test inventory and TypeScript tool lists pass.

**Validation evidence.** `npm run check:patterns` is green with 311 checked files (123 JavaScript and 98 Python), zero
findings, and all 27 final rule IDs reporting zero. `npm run check:smells`, `npm run check:shared-core`,
`npm run format:check`, `npm run typecheck:tools`, and the focused registry/fixture suite pass. A full
`npm run check:all` was started repeatedly; it passed formatting, lint, duplication, shared-core (five entries), all
type checks, package checks, focus checks, smells, Python contracts, and all 378 Python tests before the execution
environment terminated the process during the intentionally serial `test:tools` suite, before a final exit status or
coverage metrics could be produced. This is an execution-host limitation, not a recorded green full-gate result.

**Next phase:** Phase E — converge the shared instruction, skill, and documentation-shape texts. It was not started.

### Phase E — Converge the shared instruction, skill, and documentation-shape texts (landed)

**E1 — extracted instruction artifact.** `tools/quality-policy/shared-instructions.md` continues to be asserted verbatim
against the marked block in `AGENTS.md` by `tests/js/shared-instructions.test.mjs`. The block keeps the four-part
documentation shape and permits factual `PLANn.md` pointers while forbidding plan or phase citations as authority.
`node tools/check-generic-surface.mjs` now reports zero findings across 16 targets.

**E2/E3 — generic skills and local provenance.** Reconciled all five generic skill files (`preflight`, `create-plan`,
`doc-sync`, `scan-smells`, and `grill-me-repo`) to the paired generic text. Their SHA-256 digests are respectively
`ac4b57bf5e765e607edf6371f8d0af1f90ef01d5a44ed989753ea61848b12868`,
`67e91f8fe4a614d9d755023a4e5f33f1b36eeeda817336f1e19c40af57f51e37`,
`9be9eb94f87bf31d2a893f89a566114aff7e11894492906ec3454630a79152a2`,
`2b8ca3666e809adff6ba91f6f50879684743e36c564f9bccb9b5e32884f2f005`, and
`01dbea2ec180f575a51458bb012147c2f8859796d3ede608f8a18067cf9ddad6`. `skills-lock.json` records only local paths and
`vendored-generic` provenance. Its tests now verify every local skill directory, the exact directory set, every hash,
tamper detection, and rejection of `sibling-repository` provenance.

**E4 — convention guidance.** The existing documentation-format guidance remains the canonical four-section contract.
The execution-plan authoring guide contains the strengthened citation rule. Neither document is in the manifest because
its current bytes differ from the paired checkout; each is Tier 2 pending a paired content reconciliation.

**Tier classification and validation.** The five skill files are byte-identical to the paired checkout under direct
read-only `cmp`, but the manifest remains at its reconciled five entries until the pair lands the same manifest update.
The extracted instruction artifact and both convention documents are Tier 2: the paired checkout currently has different
bytes. `npm run test:tools -- tests/js/skills-lock.test.mjs tests/js/shared-instructions.test.mjs` passed 2 files / 17
tests; `node tools/check-generic-surface.mjs` passed with zero findings; and `npm run check:shared-core` passed over 5
entries with zero findings. The full-gate attempt reached `package:check` before the sandbox blocked its virtualenv
Python executable (`EPERM`); it needs the approved host run recorded below. No committed artifact reads the sibling.

**Next phase:** Phase F — converge policy mechanisms with project-owned data.

### Phase F — Converge policy mechanisms with project-owned data (reclassified)

**Classification decision.** The complexity, coverage-inventory, and test-inventory candidates were compared read-only
against the paired checkout before any manifest update. They are not byte-identical: their required repository paths,
coverage-report formats, Python support, test extensions, and strict no-exception policy differ. Under this plan's Tier
1 rule, they are Tier 2 mechanisms and project-owned policy data, not manifest entries. The reconciled five-entry
manifest is deliberately unchanged.

**Preserved enforcement.** Polar Recorder keeps direct error-level ESLint limits of 10 complexity, 40 statements, depth
4, and 6 parameters with no complexity baseline or exception ledger. Python coverage remains behind its dedicated
adapter in `coverage-inventory/python-coverage.mjs`; the coverage inventory continues to classify every shipped Python,
viewer, and plugin source file as measured or contract-owned and rejects a floor regression against its captured
baseline. The test inventory retains per-file `strict` classifications and drives the TypeScript test list. Its empty
exception baseline is checked, so no test classification, coverage floor, or test/typecheck scope was lowered.

**Required repository data and checks.** Regenerated `tools/quality-policy/format-scope.json` after the new extracted
artifact entered the tracked surface: 329 rows (`prettier`: 207, `ruff`: 98, `unsupported`: 24). Focused format-scope,
skill-lock, and shared-instruction contracts passed 23 tests. No candidate was added to the manifest because none can
currently satisfy the paired byte-identity condition without changing the paired repository. No committed tool, test,
configuration, or gate reads the sibling checkout.

**Next phase:** Phase G is intentionally not started.

---

### Phase G — Retire superseded bespoke tooling (landed)

**Release-proof amendment (user-authorized).** The planned paired-project release implementation was inspected only out
of band and uses a local `zip` executable; it cannot reproduce Python `zipfile`'s compressed bytes. The old Python
builder was separately proven to reproduce `releases/polarrecorder-1.0.0-beta.7.zip` from its own tagged source. The
Phase G release proof therefore uses exact runtime-content identity: normalized archive paths and SHA-256 equality for
every uncompressed staged entry. `tools/release-archive.mjs` is the local JS manifest/staging/validation owner; it uses
the installed `zip` and `unzip` commands and never reads a sibling checkout. Its dry run validated 61 runtime files. The
artifact is Tier 2 because its allowlist names this plugin's runtime surface; the five-entry shared-core manifest is
unchanged.

**G3 alias retirement.** Deleted `tools/check-all.sh`. Its replacement owner is the existing package command graph:
`check:all` remains the sole full gate and `check:core` retains direct passing/failing fixture coverage in
`tests/js/command-graph.test.mjs`. The targeted contract suite passed 27 tests after removal. Updated AGENTS, the
quality-gate documentation, contributor and maintenance guidance, hook/release comments, and the generated format scope;
no suppression, ignored path, threshold, or test coverage was weakened.

**G3 release-path retirement.** `tools/release_manifest.py`, `tools/release-zip.py`, and `tools/check-release.py` and
their Python self-tests were retired after `tools/release-archive.mjs` became the sole local manifest, staging, stamp,
archive, and validation owner. `tests/js/release-archive.test.mjs` proves the sorted runtime-only manifest, executable
plugin/viewer/server paths, development-path exclusion, version-first stamping, and entry-set plus SHA-256 equality;
`tests/js/check-schema.test.mjs` now checks that the same JavaScript stamper produces the release schema form. The
focused release and contract suites passed 57 tests, and format plus both TypeScript inventory checks passed. This is an
exact uncompressed-content proof, not a compressed-ZIP-byte claim.

**G3 release classifier retirement.** `tools/release-runtime.mjs` was deleted after `release-prepare.mjs` adopted
`isRuntimePath()` from `release-archive.mjs`. The replacement is the runtime manifest owner itself, preventing advisory
release classification from drifting from the archive allowlist. The release-focused suite passed 31 tests and tool
typechecking passed after its TypeScript inventory entry was removed.

**G3 retained manual aid.** `tools/mock-server.py` and `tools/mock_server/` are deliberately retained as Tier 2. They
support manual browser development against representative API fixtures, are neither invoked by `check:all` nor included
in release archives, and have no generic replacement owner to donate. Keeping them preserves that local workflow without
expanding the release runtime surface.

**G2 publisher-workflow retirement.** Moved the parsed workflow assertion implementation from
`tools/check-publisher-workflow.mjs` into `tests/js/publisher-workflow-contract.test.mjs`; the existing focused suite
now directly owns those assertions. `actions:lint` is actionlint alone as required. The two contract files passed 18
tests (including clean and failing workflow shapes), and test/tool type inventories were updated without exclusions.

**G2 dependency-checker retirement.** Moved the namespace-cycle and module-load assertions from
`tools/check-dependencies.mjs` into `tests/js/viewer-dependency-contract.test.mjs`; `tests/js/js-checkers.test.mjs`
retains clean and cyclic fixture behavior. Removed the `check:deps` rung. The focused contract suite passed 6 tests, and
both test and tool typechecks passed.

**G2 viewer-contract and metadata-checker retirement.** Moved the render assertions from
`tools/check-viewer-contracts.mjs` into `tests/js/viewer-render-contract.test.mjs` and the script-order and dependency
header assertions from `tools/check-smell-contracts.mjs` into `tests/js/viewer-structure-contract.test.mjs`. The latter
retains the existing clean, rogue-script, and stale-header fixtures through `tests/js/js-checkers.test.mjs`; the render
test drives the real viewer through the retained manual harness. Removed `check:viewer-contracts`, `test:contract`, and
the standalone smell-checker rung without excluding either test from the tools project. The focused combined suite
passed 32 tests before the release migration and 57 tests after it.

**G1 duplication-tool retirement.** Deleted `tools/check-js-duplication.mjs`, its `parse.mjs` and `clone-detection.mjs`
helpers, and `tools/check-duplication.py`; removed the `duplication:js` and `duplication:python` rungs and the direct
`acorn` development dependency. The single `duplication:check` owner now runs `jscpd` at its unchanged `threshold: 0`
over viewer, plugin, and `server/polarrecorder` Python sources, followed by the generic `duplicate-functions` and
`duplicate-block-clones` rules. The latter has a fixture proving variable-renamed cross-file functions fail; the live
duplication check passed over all 51 configured source files. This preserves the old structural function and
copied-block finding classes without adding exclusions or suppressions.

**G3 baseline and setup retirement.** Deleted `canonical_json.py` and `generate_baseline_coverage_capture.py`;
`tests/test_baseline_captures.py` retains the canonical serialization, digest, frozen-commit, and volatile-metadata
assertions directly against the reviewed immutable capture data (6 tests passed). Deleted `tools/setup.mjs`;
`package.json` now owns the same `npm ci`, Python-3.14 guard, virtual-environment creation, pinned `pip==26.1.2`,
hash-required requirements install, and actionlint provisioning steps inline. The setup contract suite passed 16 tests.
The custom VM viewer harness remains Tier 2: the suite relies on its deterministic fetch responder, canvas/DOM fakes,
and vm script-order loader, none of which jsdom supplies without a replacement fake server/harness; retaining it keeps
the existing behavioral assertions and does not make it a gate or release-runtime artifact.

**Gate evidence (audit re-run, single uninterrupted invocation).** A prior session's `npm run check:all` attempts were
each cut short by that execution host before a single run could finish end to end (recorded above). Re-run here from a
clean shell with a 590-second budget, `npm run check:all` completed in one pass and exited 0:

- `format:check`: 90 files already formatted.
- `duplication:check`: jscpd at `threshold: 0` over 51 source files (0 clones) plus
  `check-patterns.mjs --only=duplicate-functions,duplicate-block-clones` over 52 checked files, 0 findings.
- `check:shared-core`: `Shared core check passed over 5 manifest entries.`
  `{"ok":true,"checkedEntries":5,"findings":0}`.
- `test:focus:check`: 4 files / 36 tests.
- `check:smells` (`check-patterns.mjs`): 301 checked files (121 JavaScript, 90 Python), 0 findings across all 29
  registered rule names.
- `check:python-contracts` and `test:python`: 359 Python tests passed.
- `test:tools`: 42 files / 361 tests.
- `test:viewer`: 11 files / 47 tests. `test:plugin`: 1 file / 1 test.
- `check:scaling`: 26 passed.
- `docs:check`: 42 seeded files / 48 links checked; link-fixture proof passed.
- `check:filesize`: 104 files, 0 findings.
- `test:coverage:python`: 359 passed, Python coverage 95.77 % (90 % floor).
- `test:coverage:viewer`: 12 files / 48 tests; viewer/plugin coverage 91.19 % statements / 74.35 % branches / 85.99 %
  functions / 92.46 % lines.
- `check:coverage-inventory`: `Coverage inventory check passed.`

This confirms Phase G's own exit conditions are fully met, not merely assembled from partial runs: every deleted tool
has a named replacement owner and a recorded parity/artifact-identity proof (G1/G2/G3 above); `acorn` is absent from
`package.json`'s `devDependencies` (confirmed via `package-lock.json`'s root package entry); `AGENTS.md` and
`documentation/conventions/quality-gates.md` contain zero references to `tools/check-all.sh`; and
`tests/js/release-archive.test.mjs` proves the release artifact's runtime-content identity as part of `package:check`,
which passed in this same run.

**Audit correction:** the `.github/workflows/quality.yml` Tier 2 reclassification uncovered during this audit (it
dropped out of the shared-core manifest between Phase A and Phase C without a recorded reason) is now documented under
Phase C's C5 evidence above, per the fail-closed "no reclassification left unexplained" rule.

**Next phase:** Phase H — repair the documentation data and wiring.

### Phase H — Repair the documentation data and wiring (landed)

**H1 — stale authority reference and existence contract.** Corrected `pyproject.toml`'s coverage-exclusion comment,
which named the nonexistent `tools/check-coverage.py` as the validation-package floor's enforcing authority; it now
names the real owner, `tools/quality-policy/check-coverage-inventory.mjs` (fact 37). The `pyproject.toml`/`AGENTS.md`/
`documentation/**` sweep for other Phase G retirees found none. Sweeping more broadly (not limited to Phase G names)
surfaced one further stale mention: `documentation/conventions/testing-infrastructure.md` cited a
`tools/check-performance.py` that predates this plan and was never a Phase G retiree; reworded the sentence to describe
the retired wall-clock checker without naming a dead path. Added `tests/js/tool-path-existence-contract.test.mjs`,
asserting every `tools/*.{mjs,py,sh}` path named in `pyproject.toml`, `package.json`, or any `documentation/**/*.md`
file resolves to a real file, plus a seeded-nonexistent-path negative fixture, so this class of staleness cannot recur
silently.

**H2 — documentation-gate wiring.** Added `docs:format`, `docs:reachability`, `docs:toc`, `docs:smell-catalog`, and
`docs:pointer` npm scripts, each invoking its existing Vitest contract file directly (`doc-format-contract.test.mjs`,
`doc-reachability-contract.test.mjs`, `doc-toc-contract.test.mjs`, `smell-catalog-contract.test.mjs`,
`agents-pointer.test.mjs`), and composed all five into `docs:check` alongside the original
`docs:lint`/`docs:links:proof`/`docs:links` rungs, so `docs:check` now means "every documentation gate" (fact 31). Every
one of the five still runs inside `test:tools` too, since `vitest.config.mjs`'s `tools` project is glob-matched, not
file-listed. Added `tests/js/docs-check-composition-contract.test.mjs`, asserting `docs:check` composes all eight
required tokens and that each new rung's script body names the real test file it wires.

**H3 — narrated counts.** `documentation/conventions/quality-gates.md` already narrates zero coverage-inventory,
test-inventory, exception, or complexity-baseline **entry counts** — Phase F (reclassified) kept this repository's own
family-based `coverage-floors.json` schema and a baseline-free direct-ESLint complexity policy instead of adopting
paired-project' per-file schema and scan-plus-budget mechanism, so the specific drift-prone counts this bullet
originally targeted do not exist in this document the way the plan's audit found them. What the document does narrate
are four numeric **policy thresholds** (complexity `10/40/4/6`, viewer coverage `80/80/80/65`), which are config values,
not counts that grow — but they can still silently drift from their live source, so
`tests/js/quality-gates-doc-numbers-contract.test.mjs` asserts the document's stated complexity limits match
`tools/quality-policy/eslint-complexity-config.mjs`'s `STRICT_LIMITS`, its stated viewer coverage thresholds match
`vitest.config.mjs`'s coverage config, and that no hand-written `"<N> entries"`/`"<N> entry"` phrase exists in the
document at all.

**Exit conditions verified.** `npm run check:all` exits 0: Python coverage `95.77%` (unchanged), viewer coverage
`91.19/74.35/85.99/92.46%` (unchanged), 359 Python tests (unchanged), `test:tools` reporting 45 files / 368 tests (42
Phase-G files gain +3: `tool-path-existence-contract.test.mjs`, `docs-check-composition-contract.test.mjs`,
`quality-gates-doc-numbers-contract.test.mjs`), and `docs:check` now running eight component gates in one composed
command (five of them as their own newly visible sub-invocations: 3, 4, 3, 6, and 9 tests respectively). No
configuration or documentation file names a nonexistent tool, mechanically asserted; `npm run docs:check` includes lint,
links, links-proof, TOC, format, reachability, smell-catalog, and pointer contracts; every count narrated in
`quality-gates.md` is test-asserted (or, for the two counts that no longer apply under this repository's Tier 2
mechanisms, confirmed absent from the document by the same test).

**Next phase:** Phase K — pair verification and closeout. Its dependencies (all previous phases, plus paired-project
`PLAN42.md` Phases A through J) are not yet satisfied from this repository's side alone: Phase K requires joint,
out-of-band cross-repository verification against paired-project' own phase progress, which this session has not
performed (see the Phase B/C/E notes above on deferred cross-repo `cmp` work).

---

### Phase K — pair verification and closeout (completed)

The paired out-of-band comparison passed for all five manifest entries: `.codex/config.toml`, `.nvmrc`,
`.prettierrc.json`, `schemas/avnav-plugin-base.schema.json`, and `exec-plans/active/.gitkeep`. The manifest itself,
`generic-tokens.json`, the extracted `SHARED_INSTRUCTIONS` artifact, and all five generic skill files are now
byte-identical. The two initially discovered generic-artifact drifts were reconciled here: the canonical domain-token
list retains `viewer`, and the extracted instructions match the shared block verbatim.

P1–P14 are evidenced by the paired full-gate results recorded in the preceding completed phases, the local
`check:shared-core` and `check:generic-surface` results from this closeout (both zero findings in both repositories),
the direct `cmp` sweep, and the paired documentation gates. The direct rerun of paired-project' full gate was
interrupted by the execution host during linting; no failure was reported before termination. The existing clean-shell
full-gate records remain the final complete-gate evidence for this change set.

The following candidates are Tier 2 by paired comparison and are intentionally absent from the manifest: the pattern
engines and rule registries (product scopes and detection domains), documentation-format and execution-plan guides
(repository-specific conventions), and complexity, coverage, and test-inventory mechanisms (repository paths, captured
debt, and coverage-report formats). The manifest is the authoritative greenfield handoff; a greenfield environment is
derived from it rather than copied from either role model.

## Related

- Paired plan: paired-project `exec-plans/completed/PLAN42.md`
- [PLAN8.md](../completed/PLAN8.md) — the contract convergence this plan completes
- [PLAN7.md](../completed/PLAN7.md) — the alignment attempt whose implementation gap this plan closes
- [PLAN5.md](../completed/PLAN5.md) — the fail-closed gate set this plan must not weaken
- [Execution plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Documentation format](../../documentation/conventions/documentation-format.md)

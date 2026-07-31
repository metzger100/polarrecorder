# PLAN8 — Converge the shared quality contract into an extraction-ready common core

## Status

Written after repository verification and the second cross-repository quality-system audit on 2026-07-27.

This plan closes the remaining divergences between the two role-model repositories so a future greenfield AvNav plugin
environment can be derived from their common core. It resolves three contradictions where each repository's canonical
file is a gate violation in the other, migrates the JavaScript test surface to the shared runner, unifies the
pattern-rule namespace, gives each shared concern exactly one owner, adds read-only pull-request quality enforcement,
and adopts the agent skill layer this repository currently lacks entirely.

The coding agent may choose equivalent helper names, test names, and file splits. The converged pointer contract, the
converged documentation shape, the shared JavaScript test runner, the canonical pattern-rule identifiers, the
single-owner assignments, the read-only pull-request gate, the adopted generic skill set, and the paired acceptance
matrix are prescriptive.

No pre-plan interview was run. The completed audit resolved the relevant design branches, so this plan makes these
assumptions explicit:

1. Plugin runtime behavior, Python APIs, persistence, exports, viewer behavior, AvNav integration, packaging, and
   release artifacts remain unchanged.
2. This repository remains a Python/JavaScript hybrid **role model**, not a greenfield template. The greenfield
   environment will be written separately and derived from the converged core this plan produces. Creating that
   scaffolder, a shared npm package, or a generic `doctor` command is out of scope here.
3. This plan **supersedes PLAN7 Status assumption 3** on the repository owner's explicit instruction. A read-only
   pull-request quality workflow is now in scope. The transport-only tag publisher stays transport-only, and no
   CODEOWNERS file, branch ruleset, or pre-commit framework is introduced.
4. Required gates must remain independently runnable and must never read the sibling paired-project checkout.
5. The paired implementation plan is paired-project
   `exec-plans/active/PLAN41.md — Converge the shared quality contract into an extraction-ready common core`.
6. Common alignment means the same guarantees, contracts, and contributor vocabulary — not byte-identical
   product-specific tools. Python tooling stays Python.

Repository rules and core principles outrank this plan. If implementation reveals a conflict, amend the active plan with
repository evidence instead of weakening a gate or silently improvising.

---

## Goal

Turn the two independently healthy quality systems into one shared contract with two profile-specific implementations,
so the common core can be lifted into a greenfield generator without further design decisions.

Expected outcomes after completion:

- `CLAUDE.md` and its contract are converged: one pointer shape that passes in both repositories, enforced by the same
  mechanism as its pair.
- The documentation shape this repository already requires becomes the shared contract, enforced by a Vitest contract
  test rather than a bespoke checker.
- The JavaScript test surface runs on Vitest with native V8 coverage, retiring the hand-enumerated `node --test` file
  lists and c8. Python keeps pytest.
- `check-patterns` uses the declarative rule-array engine with canonical identifiers, split into a generic rule set and
  a project rule set, so the generic set is liftable verbatim.
- Each shared concern has exactly one owner: ESLint owns complexity limits from one shared configuration, ESLint owns
  file-overview headers, the generated scope inventory owns the maintained-file surface, and Vitest contracts own
  instruction, documentation, and hotspot shape.
- `.prettierrc.json` is byte-identical to its pair, joining `.codex/config.toml` and the generic base schema as shared
  files.
- A read-only pull-request workflow runs the same `check:all` gate the pre-push hook runs, with the publisher-workflow
  contract reworked to cover two workflows instead of forbidding the second.
- `.agents/skills/` exists here for the first time, holding the five generic skills with a hash-verified lock.
- `AGENTS.md` carries a `SHARED_INSTRUCTIONS` block proven free of project-specific tokens, making it extractable.
- The full quality gate, hook diagnostics, package checks, and the one-off paired comparison pass from a clean worktree.

---

## Verified Baseline

The following facts were checked against Polar Recorder `8ff80c9` before this plan was written:

1. The worktree is clean on `main` and `exec-plans/active/` contains only its marker file. The next sequential plan
   number is 8.
2. `npm run check:all` passes end to end (exit 0). Python coverage is 95.77% combined against a 90% floor with 378 tests
   passing. Viewer coverage via c8 is 93.43% statements, 79.38% branches, and 90.82% functions. The coverage inventory
   check passes.
3. The JavaScript test surface is 31 `tests/js/*.mjs` files executed by `node --test` through four npm scripts with
   hand-enumerated file lists: `test:tools` names 24 files, `test:viewer` names 6, and `test:plugin` names 1. Adding a
   test file without editing `package.json` silently excludes it from every gate.
4. Coverage for JavaScript uses c8 with `--check-coverage --lines 80 --functions 80 --statements 80 --branches 65` and a
   second hand-enumerated file list. There is no `vitest`, `@vitest/coverage-v8`, or `jsdom` dependency.
5. `.prettierrc.json` sets `printWidth: 100`, `tabWidth: 2`, `singleQuote: false`, `trailingComma: "none"`, and
   `semi: true`, with no `proseWrap`. paired-project sets `printWidth: 120` and `proseWrap: "always"` plus explicit
   defaults.
6. Adopting the paired-project configuration here reformats about 35 Markdown files, 66 of 104 JavaScript/MJS files, and
   4 JSON/YAML files. The reverse direction would reformat at least 237 files there. Adopting the sibling configuration
   here is therefore the cheaper single-repository direction and is what the paired plans agree on.
7. `tools/check-agents-pointer.mjs` requires `CLAUDE.md` to contain `[AGENTS.md](AGENTS.md)`, to omit the
   `SHARED_INSTRUCTIONS` marker, to stay at or under 40 non-empty lines, and to name all three mandatory preflight files
   and prove they exist.
8. paired-project enforces the same concern through a Vitest contract test that caps `CLAUDE.md` at 8 total lines and
   does not check preflight names. This repository's `CLAUDE.md` is 24 total and 17 non-empty lines, so it fails that
   cap; the sibling's is 6 total and 4 non-empty lines and fails this repository's preflight-name requirement. The two
   contracts are mutually exclusive.
9. `tools/check-doc-format.mjs` requires a title, a `**Status:**` line, and the sections `Overview`, `Key Details`, and
   `Related`. Every document here satisfies the sibling's narrower two-section rule, so this repository's requirement is
   a strict superset and becomes the converged contract.
10. `tools/check-patterns.mjs` is imperative: `collect*` discovery functions feed `check*` functions that report through
    a flat 24-entry `PATTERN_RULE_IDS` allow-list. paired-project uses a declarative `RULES` array of 41 rules with
    per-rule `scope`, `severity`, and suppression support.
11. Exactly 9 rule identifiers match between the repositories: `canvas-api-typeof-guard`, `default-truthy-fallback`,
    `exec-plan-reference`, `framework-method-typeof-guard`, `hardcoded-runtime-default`, `premature-legacy-support`,
    `redundant-null-type-guard`, `responsive-layout-hard-floor`, and `try-finally-canvas-drawing`.
12. At least seven further pairs express the same concept under different identifiers: `absolute-home-path`/
    `absolute-user-home-path`, `unowned-todo`/`todo-without-owner`, `commented-out-code`/`dead-code`, `catch-fallback`/
    `catch-fallback-without-suppression`, `promise-empty-catch`/`empty-catch`, `internal-namespace-fallback`/
    `internal-hook-fallback`, and `python-suppression`/`invalid-lint-suppression`. Equivalence is asserted, not yet
    proven, for each pair.
13. `tools/quality-policy/eslint.complexity.config.mjs` enforces `complexity: 10`, `max-statements: 40`, `max-depth: 4`,
    and `max-params: 6` as errors with `noInlineConfig` over `viewer/*.js`, `plugin.js`, and `plugin.mjs`, with no
    baseline or ledger.
14. paired-project' `tools/quality-policy/complexity-scan.mjs` runs ESLint with the identical four rules at identical
    limits and adds a 175-entry legacy ledger. **The complexity owner is already the same maintained tool in both
    repositories**; the limit values are hardcoded separately in each, which is a drift risk. This repository's
    zero-debt policy is the greenfield model and must not gain a baseline.
15. `tools/check-headers.mjs` enforces the mandatory module header. paired-project enforces the same concern with
    `eslint-plugin-jsdoc`'s `require-file-overview` rule, which is the maintained owner.
16. `tools/check-publisher-workflow.mjs` fails when `.github/workflows` contains any file other than
    `publish-release.yml` — "must contain exactly one file" — and requires exactly one job id, `publish-release`. Adding
    a quality workflow requires reworking this contract to cover both files, not deleting it.
17. `.github/workflows/publish-release.yml` is the only workflow. It triggers on `v*` tags and pins `actions/checkout`
    and `softprops/action-gh-release` by commit SHA. There is no pull-request or push quality workflow, so all
    enforcement depends on the optional `.githooks/pre-push` hook.
18. `tools/quality-policy/format-scope.json` is generated by `generate-format-scope.mjs` from
    `git ls-files --cached --others --exclude-standard`, classifies every maintained file as `prettier`, `ruff`, or
    `unsupported` with a reason and alternate validation owner, and a contract test fails closed on anything unmatched.
    `tools/check-doc-links.mjs` seeds linkinator from the same inventory. This design is the converged owner and the
    sibling adopts it.
19. Adding `exec-plans/active/PLAN8.md` therefore requires regenerating the scope inventory before the formatting gate
    can pass.
20. `.markdownlint-cli2.jsonc` globs `**/*.md` with `default: true` minus `MD013`, `MD033`, and `MD041`, ignoring
    completed plans. Active plans, including this file, are linted. The sibling disables 14 rules and globs only root
    and `documentation/` Markdown, leaving 8 tracked files formatted but unlinted; a live run of this rule set against
    all 88 of its tracked Markdown files produces zero issues, so the sibling adopts this configuration.
21. Linkinator options are inlined in `tools/check-doc-links.mjs`. paired-project externalizes them in
    `linkinator.config.json`, which is the converged owner.
22. `tools/quality-policy/hotspot-budgets.json` plus `check-hotspot-budgets.mjs` is the data-driven hotspot owner. The
    sibling hardcodes a two-entry array inside a test file and adopts this shape.
23. There is no `.agents/` directory, no skills, and no `skills-lock.json`. paired-project has seven skills and a lock
    pinning five upstream skills from `mattpocock/skills` by SHA-256.
24. `AGENTS.md` has no `SHARED_INSTRUCTIONS` markers. The sibling wraps its entire body in them, including
    project-specific content, so the mechanism currently delimits nothing generic in either repository.
25. `AGENTS.md` section 6 names `tools/check-all.sh` as the required completion gate. That script is a 9-line wrapper
    around `npm run check:all`, which is the name the sibling documents. The functional gate is identical; only the
    documented entry point differs.
26. `tools/check-naming.mjs` and `tools/check-namespace.mjs` enforce the `Polarrecorder` namespace and the
    `--polarrecorder-` CSS prefix. The sibling has the same concern for `PairedComponents` without dedicated checkers.
27. Three concerns carry different file names for the same job: `tools/check-schema.mjs` versus
    `tools/validate-schemas.mjs`, `tools/check-test-focus.mjs` versus `tools/check-vitest-only.mjs`, and
    `documentation/guides/live-avnav-checklist.md` versus `documentation/guides/manual-avnav-validation.md`.
28. `.codex/config.toml` and `schemas/avnav-plugin-base.schema.json` are already byte-identical across both
    repositories. They are the only two shared files that are.
29. `tools/check-file-size.mjs` scans an explicit six-file root Markdown list plus source trees and does not include
    `exec-plans/`, so this plan file is not subject to the 400-non-empty-line limit.

---

## Target Alignment Contract

The paired plans use this vocabulary. Profile-specific extensions are allowed only where shown.

| Concern                   | Converged owner                                                            | Polar Recorder implementation                        |
| ------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| AI instruction pointer    | Vitest contract, preflight-name based                                      | Migrate the bespoke checker into a contract test     |
| Documentation shape       | Vitest contract, four required elements                                    | Migrate the bespoke checker; requirements unchanged  |
| Markdown lint             | markdownlint-cli2, `default: true` minus 3 rules                           | Already converged; unchanged                         |
| Formatting settings       | The sibling's `.prettierrc.json`                                           | Adopt verbatim and reformat once                     |
| Maintained-file inventory | Generated scope inventory plus contract test                               | Already the owner; unchanged                         |
| JavaScript test runner    | Vitest with native V8 coverage                                             | Migrate 31 files; retire `node --test` lists and c8  |
| Python test runner        | pytest with coverage floors                                                | Unchanged, profile-specific                          |
| Pattern rules             | Declarative rule array, canonical identifiers                              | Port the engine; split generic and project rule sets |
| Complexity limits         | ESLint `complexity`/`max-statements`/`max-depth`/`max-params` at 10/40/4/6 | One shared config; zero debt, no baseline ever       |
| File-overview headers     | `eslint-plugin-jsdoc` `require-file-overview`                              | Adopt the plugin; retire `check-headers.mjs`         |
| Hotspot budgets           | JSON policy data plus a contract test                                      | Already the owner; move the checker into a contract  |
| Link checking             | linkinator with an externalized config file                                | Externalize the inlined options                      |
| Namespace policy          | One configurable generic rule with a repo token                            | Fold both checkers into the generic rule             |
| Quality enforcement       | Local `check:all` plus a read-only pull-request workflow                   | New workflow; publisher contract reworked            |
| Agent skill layer         | `.agents/skills/` split generic/project, locked                            | Adopt the five generic skills and the lock           |

Enforcement parity is defined by contract, not by byte identity. Product-coupled implementations may differ; the
contracts they satisfy may not.

---

## Architecture Notes

### The complexity owner was never actually divergent

The audit initially read as this repository using a maintained tool while the sibling did not. Verification shows both
run ESLint with the same four rules at the same limits. The real divergence is that the sibling adds a legacy ledger and
that the limit values are hardcoded twice. Convergence means extracting one shared complexity configuration as the
single source of the limits. This repository's zero-debt stance is the greenfield model and must survive the change
unweakened: no baseline, no ledger, no exception file.

### Hand-enumerated test lists are the highest-risk gap here

Four npm scripts name 31 test files explicitly, and the coverage script names a fifth list. A new test file is invisible
to every gate until someone edits `package.json`, and nothing fails when they forget. This is the one place where the
current system can silently lose coverage, which is why the runner migration is prescribed rather than deferred — the
sibling's configured include patterns remove the failure mode entirely.

### A generic instruction block must be provable, not asserted

Marking a section "shared" is worthless if nothing checks it. The `SHARED_INSTRUCTIONS` block only becomes an extraction
asset once a contract proves the enclosed text contains no project-specific tokens. That check runs per repository and
needs no access to the sibling checkout, so it satisfies repository independence while still guaranteeing both blocks
are liftable.

### Retiring a bespoke checker must not retire its assertions

Each custom checker replaced by a Vitest contract carries assertions the gate depends on. The migration is a move, not a
rewrite: every existing failure mode keeps a test, and the checker is deleted only after its replacement proves the same
negatives.

### Role model is not greenfield output

The future generator starts with no historical debt. This repository keeps its Python profile, its frozen coverage
floors, and its product-specific validation policy. No phase may delete valid evidence to resemble an empty project.

---

## Hard Constraints

### Runtime and product behavior

- Do not modify `plugin.py`, `server/polarrecorder/`, `viewer/` runtime behavior, `plugin.js`, `plugin.mjs`, CSS, or
  AvNav integration.
- Do not add a bundler, runtime build step, browser driver, runtime npm or pip dependency, or any target-device install
  requirement. Runtime Python stays 3.9+ stdlib only.
- Do not change release ZIP contents, API response shapes, export or import formats, `polar.json` handling, or user
  configuration.
- Do not add AvNav imports to `server/polarrecorder/`, locks to domain modules, or hidden real-time dependencies.

### Quality integrity

- Do not lower or delete coverage floors, hotspot budgets, file-size limits, type checks, smell rules, documentation
  checks, or package checks.
- Do not add a suppression, skipped or focused test, coverage exception, formatter ignore, or any complexity baseline to
  make a gate pass. This repository must still have zero complexity debt when the plan closes.
- The Vitest migration must not reduce the assertion count, the covered file set, or the coverage floors. Line,
  function, statement, and branch floors carry over at their current values or higher.
- Renaming a rule identifier must not change what the rule detects. Every rename needs a proof that the old and new rule
  produce the same findings on the same input before the old identifier is removed.
- Reworking `check-publisher-workflow.mjs` must make it stricter over two workflows, never permissive over many. An
  unknown third workflow file must still fail.
- Every changed contract needs a focused positive assertion and a focused negative or drift assertion.
- Required gates remain deterministic, external-browser-free, and offline after successful setup. The new pull-request
  workflow may use the network for dependency installation only.

### Repository independence and paired work

- No required script, hook, test, workflow, release command, or documentation checker may resolve `../paired-project`.
- The paired checkout may be read only by the final one-off alignment comparison, never by a committed gate.
- Do not create the future scaffolder, shared npm package, or generic project manifest in this plan.
- Do not claim byte identity for product-coupled tools. Record justified differences instead.

### File organization

- Keep all maintained Python, JavaScript, MJS, and Markdown files at or below 400 non-empty lines; `exec-plans/` remains
  exempt.
- Regenerate the format-scope inventory whenever a file is added, renamed, or deleted, in the same change.
- Keep plan prose inside `exec-plans/`. No shipped source, docstring, test name, config note, or documentation paragraph
  may cite this plan or its phases as authority.
- This plan file is markdownlint-checked. Keep headings unique, fence every code block with a language, and leave no
  trailing whitespace.

---

## Implementation Order

### Phase A — Reconfirm the paired baseline and freeze the converged contract

Intent: prevent either implementation from landing against stale facts or a different reading of the shared contract.

Dependencies: none.

#### A1. Record standalone evidence

- Run `npm run check:all` from a clean worktree and record Python and viewer coverage, the test counts, and the coverage
  inventory result.
- Record the current pattern-rule count, the workflow inventory, and the enumerated test-file counts per script.

#### A2. Register this plan in the format inventory

- Run the scope generator so `exec-plans/active/PLAN8.md` is classified, then run the formatter and the Markdown lint
  over it.
- Confirm `npm run docs:check` and `npm run format:check` pass with the plan file present. This proves baseline fact 19
  before any other change depends on it.

#### A3. Agree the converged contract in writing

- Record in this plan's progress section that the Target Alignment Contract table is the frozen reference for both
  repositories, including the decision to adopt the sibling's Prettier configuration verbatim.

Exit conditions: `check:all` green with the plan file tracked and classified; baseline facts 2, 3, 8, 11, 16, and 17
reconfirmed or amended with evidence.

---

### Phase B — Adopt the shared formatting configuration

Intent: make `.prettierrc.json` byte-identical to its pair in one mechanical, reviewable change.

Dependencies: Phase A.

#### B1. Replace the configuration

- Replace `.prettierrc.json` with the sibling's exact content: `arrowParens`, `bracketSpacing`, `printWidth: 120`,
  `proseWrap: "always"`, `semi`, `singleQuote`, `tabWidth`, `trailingComma`, and `useTabs`.

#### B2. Reformat the maintained surface

- Run `npm run format` and commit the mechanical result as its own change, separate from any behavioral edit, so review
  can skip it safely.
- Confirm the reformatted file count matches the expectation in baseline fact 6, and record any deviation.

#### B3. Prove the shared shape

- Add a contract assertion pinning the exact key set and values of `.prettierrc.json`, so a future local edit that
  breaks shared-file identity fails a gate.

Exit conditions: `npm run format:check`, `npm run lint`, and `npm run docs:check` green; `.prettierrc.json`
byte-identical to the paired repository; the reformat isolated in its own change.

---

### Phase C — Migrate the JavaScript test surface to the shared runner

Intent: remove the hand-enumerated file lists and run JavaScript tests on the same runner and coverage provider as the
pair.

Dependencies: Phase B, so formatting churn does not mix with the migration diff.

#### C1. Introduce the runner

- Add `vitest` and `@vitest/coverage-v8` at the versions the paired repository pins, plus `jsdom` only if a migrated
  test genuinely needs a DOM environment beyond the existing fake-DOM harness.
- Add a Vitest configuration with configured projects separating tool tests, viewer tests, and plugin-entrypoint tests,
  using include patterns rather than file lists, and with `allowOnly: false`.

#### C2. Convert the tests

- Convert all 31 `tests/js/*.mjs` files from `node:test` to Vitest, preserving every assertion and every negative case.
- Keep `tools/viewer-harness.mjs` and its fake-DOM fixtures as the viewer test harness; the runner change must not
  become a harness rewrite.
- Record the assertion count before and after. A drop in assertions is a plan defect, not an acceptable simplification.

#### C3. Move coverage to the native provider

- Replace the c8 invocation with Vitest V8 coverage, carrying over the current thresholds at their existing values or
  higher, including the per-file viewer floors in `coverage-floors.json`.
- Update `check-coverage-inventory.mjs` to read the Vitest coverage summary, keeping the family and per-file floor
  semantics intact.
- Remove the `c8` dependency and the coverage file lists only after the new run reproduces or exceeds the recorded
  numbers.

#### C4. Retire the enumerated lists

- Replace `test:tools`, `test:viewer`, `test:plugin`, and their coverage counterpart with project-scoped Vitest
  invocations, keeping the public script names and their documented meanings.
- Update `check-test-focus.mjs` to detect focused and skipped Vitest modifiers, and keep the Python focus checker
  unchanged.
- Add a contract assertion that every tracked `tests/js/**` test file is matched by at least one configured project, so
  a new test file can never be silently excluded.

Exit conditions: `npm run test:node`, `npm run test:split`, and `npm run test:coverage:check` green; assertion count at
or above the recorded pre-migration value; coverage at or above baseline fact 2; no npm script names any individual test
file; `c8` removed.

---

### Phase D — Migrate the bespoke shape checkers into contract tests

Intent: give instruction, documentation, and hotspot shape one owner shared with the pair.

Dependencies: Phase C, which provides the contract-test runner.

#### D1. Converge the pointer contract

- Move the assertions from `tools/check-agents-pointer.mjs` into a Vitest contract test: the `[AGENTS.md](AGENTS.md)`
  link, absence of the `SHARED_INSTRUCTIONS` marker, the 40-non-empty-line cap, all three preflight names, and proof
  that each named preflight file exists.
- Keep `CLAUDE.md` as it is; it already satisfies the converged rule.
- Add a negative assertion for each of the five failure modes, then delete the checker, its test, and its `docs:check`
  invocation.

#### D2. Converge the documentation-shape contract

- Move the assertions from `tools/check-doc-format.mjs` into a Vitest contract test requiring a title, `**Status:**`,
  `## Overview`, `## Key Details`, and `## Related`, with the table-of-contents exception.
- Migrate `check-docs.mjs`, `check-doc-reachability.mjs`, and `check-smell-catalog.mjs` the same way, one contract test
  per concern, preserving each existing failure mode.
- Delete each checker only after its replacement proves the same negatives.

#### D3. Converge the hotspot contract

- Move `check-hotspot-budgets.mjs` into a contract test that reads `hotspot-budgets.json` unchanged, and add an
  assertion that a budget value may not increase.

Exit conditions: `npm run docs:check` and `npm run test:contract` green; five bespoke checkers retired with no assertion
lost; every migrated contract carries positive and negative assertions.

---

### Phase E — Adopt the declarative pattern-rule engine and canonical namespace

Intent: make the generic rule set liftable verbatim into the future greenfield environment.

Dependencies: Phase C.

#### E1. Prove pair equivalence before renaming

- For each of the seven concept pairs in baseline fact 12, compare the two implementations and record one of:
  equivalent, overlapping, or distinct.
- Rename only proven-equivalent pairs. Keep distinct rules distinct under separate canonical names.
  `promise-empty-catch` and the sibling's `empty-catch` are expected to be distinct detections; do not collapse them
  without proof.

#### E2. Port the engine

- Restructure `tools/check-patterns.mjs` to the declarative rule-array shape with per-rule `scope`, `severity`, and
  suppression support, matching the paired engine's interface.
- Keep every current detection. The ported engine must reproduce the current findings on the current tree, proven by a
  before-and-after comparison on a fixture corpus.

#### E3. Apply canonical identifiers and split the rule sets

- Adopt the canonical names agreed with the pair: `absolute-home-path`, `todo-without-owner`, `commented-out-code`,
  `catch-fallback`, `internal-namespace-fallback`, and `invalid-lint-suppression` with per-language scopes.
- Move rules that depend on no Polar Recorder concept into a generic rule directory and the rest into a project rule
  directory. Rules referencing `server/polarrecorder/`, `plugin.py` locks, the viewer namespace, validation pipeline
  stages, or Python-specific forms are project rules by definition.
- Fold `check-naming.mjs` and `check-namespace.mjs` into one configurable generic namespace rule, registering the
  `Polarrecorder` token and the `--polarrecorder-` CSS prefix as configuration rather than code.
- Add a contract assertion that no file in the generic rule directory references a project-specific token, and a drift
  assertion that the smell catalog and the rule registry list exactly the same identifiers.

Exit conditions: `npm run check:smells` green with an unchanged or larger detection set; every rename backed by a
recorded equivalence proof; the generic directory proven token-free; the two namespace checkers retired into the generic
rule.

---

### Phase F — Give each remaining shared concern exactly one owner

Intent: remove duplicated and hardcoded ownership so the converged core has a single implementation per concern.

Dependencies: Phases D and E.

#### F1. Share the complexity configuration

- Restructure `eslint.complexity.config.mjs` into the shared shape agreed with the pair, so the four limit values live
  in exactly one file that both repositories' complexity commands read.
- Do not introduce a baseline, ledger, exception file, or scanner. Add a drift assertion that no second copy of the
  limit values exists and that no complexity baseline file is present.

#### F2. Adopt the maintained header owner

- Add `eslint-plugin-jsdoc` and enable `require-file-overview` for the shipped runtime files and `tools/**/*.mjs`,
  matching the paired configuration's scope.
- Confirm every currently passing file still passes, then delete `tools/check-headers.mjs`, its test, and the
  `check:headers` script, folding the concern into `lint:js`.

#### F3. Externalize the link configuration

- Move the inlined linkinator options into `linkinator.config.json` using the paired file's key set, keeping the
  seed-selection logic and the `format-scope.json`-derived seed list in `check-doc-links.mjs`.
- Keep the documented reason the seed logic exists; it is a real finding, not incidental complexity.

#### F4. Converge the remaining names

- Rename `documentation/guides/live-avnav-checklist.md` to `documentation/guides/manual-avnav-validation.md`, updating
  `TABLEOFCONTENTS.md`, `AGENTS.md`, and every referring document.
- Keep `check-schema.mjs` and `check-test-focus.mjs` as the canonical names; the sibling renames toward them.
- Point `AGENTS.md` section 6 at `npm run check:all` as the required gate and retire `tools/check-all.sh`, or keep the
  wrapper and document it explicitly as an alias. Do not leave two names presented as two gates.

Exit conditions: `npm run check:core` green; exactly one source for the complexity limits; no complexity baseline
exists; `check-headers.mjs` retired with header enforcement intact; one documented gate entry point.

---

### Phase G — Add the read-only pull-request quality workflow

Intent: stop enforcement from depending on a contributor having activated the local hook.

Dependencies: Phase F, so the workflow runs the converged gate.

#### G1. Rework the publisher-workflow contract first

- Change `check-publisher-workflow.mjs` from "exactly one file" to an explicit two-file allow-list with a per-file shape
  contract, so an unknown third workflow still fails closed.
- Add a negative assertion proving an unexpected workflow file, an unexpected job id, and an unexpected permission are
  all rejected.
- This step lands before the workflow file exists; otherwise the gate breaks the moment the file is added.

#### G2. Add the workflow

- Add `.github/workflows/quality.yml` triggering on `pull_request` and on `push` to the default branch.
- Declare top-level `permissions: contents: read` and grant no write permission to any job.
- Read the Node version from `.nvmrc`, run `npm ci`, run `npm run setup` to provision the virtual environment from the
  hash-pinned `requirements-dev.txt` and the checksum-verified actionlint cache, then run `npm run check:all`.
- Pin every action by reviewed commit SHA. Set an explicit job timeout and a concurrency group that cancels superseded
  runs for the same ref.
- Regenerate the format-scope inventory so the new workflow file is classified.

#### G3. Keep the publisher transport-only

- Do not add quality steps to `publish-release.yml`, and do not let the new workflow publish, tag, or write artifacts.
- Assert that the quality workflow declares no `contents: write` permission and no release step, and that its final step
  invokes `check:all` rather than a narrower gate, so the pull-request gate and the pre-push hook cannot diverge.

Exit conditions: `npm run actions:lint` green over both workflows; the publisher contract covers two files and rejects a
third; contract assertions cover trigger, permissions, gate command, and action pinning; `check:all` green locally.

---

### Phase H — Adopt the agent skill layer

Intent: give this repository the agent-facing layer it currently lacks entirely, in the shared classified form.

Dependencies: Phase B for formatting, Phase D for the contract runner.

#### H1. Add the generic skills

- Create `.agents/skills/` and add the five generic skills handed over by the paired plan: `preflight`, `create-plan`,
  `doc-sync`, `scan-smells`, and `grill-me-repo`.
- Adapt each skill's commands and paths to this repository's stack — pytest, ruff, mypy, the Vitest projects, and
  `check:all` — without reintroducing a project-specific concept into the generic text.
- Do not copy the sibling's project-specific skills. If a Polar Recorder-specific skill is worth having, add it as a
  project skill in a separate change.

#### H2. Add the verified lock

- Add `skills-lock.json` in the shared shape, pinning the same five upstream skills by SHA-256.
- Add a contract test asserting every entry has a source, a source type, and a 64-character hash, and that the file
  parses as the pinned shape.

#### H3. Bring the layer under the gates

- Regenerate the format-scope inventory so every skill file is classified, and confirm the Markdown lint already covers
  them through the existing `**/*.md` glob.
- Add a contract assertion that each generic skill file is free of project-specific tokens.

Exit conditions: five generic skills present and adapted; lock integrity contract-tested; every skill file formatted,
linted, and proven token-free; `npm run docs:check` and `npm run format:check` green.

---

### Phase I — Add the shared instruction block

Intent: make `AGENTS.md` carry a provably generic, extractable block.

Dependencies: Phases D and H.

#### I1. Scope the markers

- Add `<!-- BEGIN SHARED_INSTRUCTIONS -->` and `<!-- END SHARED_INSTRUCTIONS -->` around only the guidance that holds
  for any AvNav plugin: the mandatory preflight, the precedence order, the documentation-navigation rules, the
  plan-citation rule, the README sync principle, and the quality-checklist skeleton.
- Leave Python runtime constraints, the viewer namespace, lock ownership, validation rules, and export formats outside
  the markers.

#### I2. Prove the block is generic

- Add a contract test asserting the markers exist, are balanced, appear exactly once each, and that the enclosed text
  contains no project-specific token.
- Add a negative assertion proving the check fails when a project token is placed inside the block.

Exit conditions: the enclosed block proven token-free with a negative assertion; `npm run docs:check` green; `AGENTS.md`
still at or below 400 non-empty lines.

---

### Phase J — Prove standalone quality and paired alignment

Intent: produce the evidence that this repository is independently green and contract-aligned with its pair.

Dependencies: all previous phases.

#### J1. Run the complete local gate

- Run `npm run check:all` from a clean worktree and record Python and viewer coverage, test counts, and inventory
  results.
- Run `npm run hooks:doctor` and `npm run package:check` and record their output.
- Confirm coverage has not regressed against baseline fact 2 and that no complexity baseline file exists.

#### J2. Run the one-off paired comparison

- Read-only, compare against the sibling checkout: the pointer contract semantics and both `CLAUDE.md` files, the
  documentation-shape requirements, the canonical pattern-rule identifier sets, the complexity limit values, the
  markdownlint rule sets, the `.prettierrc.json` files, the workflow inventory and permissions, and the generic skill
  set.
- Record each comparison as identical, contract-equivalent, or justified difference. Any product-coupled difference must
  carry its justification.
- This comparison is a one-off command run by a human or agent. It must not become a committed gate.

#### J3. Close the plan

- Record completion evidence per phase with dates and command output.
- Move this file to `exec-plans/completed/PLAN8.md` once every acceptance criterion is met and the paired plan has
  reached the same point.

Exit conditions: `check:all` green; no coverage regression; zero complexity debt; every paired comparison row recorded;
the plan archived.

---

## User-Facing Documentation Impact

`README.md` changes are **required**. This plan changes the contributor-visible development workflow by adding a
pull-request quality gate and by replacing the JavaScript test runner, so the development and testing sections must
describe both.

Required documentation updates:

1. `README.md` — development workflow: the new pull-request gate, the Vitest-based JavaScript test commands, and the
   unchanged local `check:all` requirement.
2. `CONTRIBUTING.md` — the pull-request gate, the test-runner change, the agent skill layer, and the single documented
   gate entry point.
3. `documentation/conventions/quality-gates.md` — the single-owner map for complexity limits, headers, link
   configuration, shape contracts, and the new workflow; the retired checkers; the reworked publisher contract.
4. `documentation/conventions/testing-infrastructure.md` — the Vitest projects, the coverage provider change, the
   carried-over floors, and the new and migrated contract tests.
5. `documentation/conventions/smell-prevention.md` — the canonical rule identifiers, the generic/project split, and the
   folded namespace rule.
6. `documentation/conventions/coding-standards.md` — the header owner change from the bespoke checker to the ESLint
   rule.
7. `documentation/guides/manual-avnav-validation.md` — the renamed checklist, with `TABLEOFCONTENTS.md` updated.
8. `AGENTS.md` — the gate entry point, the header owner, and the new shared-instruction markers.

No user-facing plugin behavior, installation, configuration, export/import, or requirement statement changes, so no
other README category applies.

---

## Acceptance Criteria

**Status as of 2026-07-27 (see Progress / Completion Evidence for the full per-phase record):** every group below is
met, including "Single ownership"'s namespace-rule bullet, all of "Rule namespace" (the ported declarative engine,
per-rule scope/severity/suppression support, and the generic-directory token/catalog-parity assertions), and
"Completion"'s archive bullet. The user confirmed in this session that the paired paired-project plan (PLAN41) has also
reached completion, satisfying the one precondition this session itself could not verify; the plan was archived to
`exec-plans/completed/PLAN8.md` on that confirmation.

### Converged contracts

- `CLAUDE.md` satisfies the converged pointer rule and would also pass the sibling repository's updated contract.
- The pointer contract is a Vitest contract test asserting link presence, marker absence, the non-empty-line cap, all
  three preflight names, and preflight existence, each with a negative assertion.
- Documentation shape, reachability, and smell-catalog coverage are enforced by contract tests with every previously
  covered failure mode retained.
- `.prettierrc.json` is byte-identical to the paired repository and pinned by a contract assertion.

### Test surface

- All 31 JavaScript test files run under Vitest configured projects; no npm script names an individual test file.
- A contract test fails if a tracked `tests/js/**` test file matches no configured project.
- Assertion count is at or above the recorded pre-migration value; coverage is at or above baseline fact 2; all floors
  carried over at existing values or higher.
- `c8` is removed; Python tests still run under pytest with unchanged floors.

### Single ownership

- Exactly one file defines the complexity limits, and no complexity baseline, ledger, or exception file exists.
- `require-file-overview` enforces module headers; `check-headers.mjs` and `check:headers` are retired.
- Linkinator options live in `linkinator.config.json`; seed selection still derives from the format-scope inventory.
- One configurable generic namespace rule replaces `check-naming.mjs` and `check-namespace.mjs`.
- One gate entry point is documented; `check:schema` and `check-test-focus.mjs` keep their canonical names.

### Rule namespace

- Every renamed pattern rule has a recorded equivalence proof; the ported engine reproduces the pre-port findings.
- The declarative engine supports per-rule scope, severity, and suppression.
- No file in the generic rule directory references a project-specific token; the catalog and registry identifier sets
  match exactly.

### Pull-request enforcement

- `check-publisher-workflow.mjs` contracts exactly two named workflows, with per-file shape assertions, and rejects an
  unknown third file, job id, or permission.
- `.github/workflows/quality.yml` runs on `pull_request` and default-branch `push`, declares only `contents: read`, pins
  every action by SHA, provisions the virtual environment, and ends in `npm run check:all`.
- `publish-release.yml` remains transport-only and unchanged in behavior.

### Agent layer and instruction block

- Five generic skills exist, adapted to this stack and proven token-free.
- `skills-lock.json` entry shape and hash format are contract-tested.
- The `SHARED_INSTRUCTIONS` block encloses only generic guidance and is proven free of project-specific tokens, with a
  negative assertion.

### Completion

- `npm run check:all`, `npm run hooks:doctor`, and `npm run package:check` pass from a clean worktree.
- Coverage is at or above baseline fact 2; no floor, threshold, or budget was lowered; complexity debt is still zero.
- Every paired-comparison row is recorded as identical, contract-equivalent, or a justified difference.
- The plan is archived to `exec-plans/completed/PLAN8.md`.

---

## Progress / Completion Evidence

Record per-phase evidence here during implementation: the command run, its summary output, the files changed, and the
date. Keep the paired-comparison table from Phase J2 in this section.

### Phase A — 2026-07-27

- `npm run check:all`: green. Python coverage 95.77% (378 passed), viewer coverage 93.43%/79.38%/90.82%
  (statements/branches/functions), coverage inventory passed. Confirms baseline fact 2.
- Test-file enumeration confirmed (baseline fact 3): `test:tools` names 24 files, `test:viewer` names 6, `test:plugin`
  names 1; `test:coverage:viewer` names a 7th list (includes `plugin-entrypoints.test.mjs`); 31 `tests/js/*.mjs` files
  exist on disk.
- **Amendment to baseline fact 10/11:** `PATTERN_RULE_IDS` in `tools/check-patterns/shared.mjs` has **25** entries, not
  24 as fact 10 states. Recount: absolute-home-path, avnav-import, canvas-api-typeof-guard, catch-fallback,
  commented-out-code, default-truthy-fallback, domain-lock-acquisition, domain-time-sleep, exec-plan-reference,
  framework-method-typeof-guard, hardcoded-runtime-default, inner-html-assignment, internal-namespace-fallback,
  no-nul-byte, placeholder-literal, pluginhandler-import, premature-legacy-support, promise-empty-catch,
  python-suppression, redundant-null-type-guard, responsive-layout-hard-floor, reverse-plugin-import,
  try-finally-canvas-drawing, unowned-todo, unused-fallback. This does not change the plan's conclusions (fact 11's
  9-match / fact 12's 7-pair analysis is unaffected; the extra entries are project-only rules with no sibling
  counterpart), so no further amendment is needed beyond correcting the count.
- Workflow inventory confirmed (baseline fact 17): `.github/workflows/publish-release.yml` is the only workflow,
  triggers on `v*` tags, pins `actions/checkout` and (further down the file) `softprops/action-gh-release` by commit
  SHA, `permissions: contents: read` at top level with job-level `contents: write`.
- `npm run format:scope`: wrote 292 rows (`unsupported: 24, prettier: 170, ruff: 98`); `exec-plans/active/PLAN8.md`
  classified as `prettier`. Confirms baseline fact 19.
- `npm run docs:check` and `npm run format:check`: both green with the plan file present and tracked.
- Target Alignment Contract table (above) is frozen as the reference for both repositories, including adopting the
  sibling's `.prettierrc.json` verbatim in Phase B.
- Files changed: `tools/quality-policy/format-scope.json` (regenerated), `exec-plans/active/PLAN8.md` (this section).

### Phase B — 2026-07-27

- Replaced `.prettierrc.json` with the sibling's exact content (`arrowParens`, `bracketSpacing`, `printWidth: 120`,
  `proseWrap: "always"`, `semi`, `singleQuote`, `tabWidth`, `trailingComma`, `useTabs`), byte-identical to
  `../paired-project/.prettierrc.json`.
- `npm run format`: reformatted 109 files (1725 insertions, 2258 deletions), close to the ~105-file estimate in baseline
  fact 6.
- Added `tests/js/prettier-config.test.mjs` pinning the exact key set and values, with a missing-key negative and a
  drifted-value negative. Registered it in `test:tools` (`package.json`), `test-inventory.json`, and
  `tsconfig.tests.json`; regenerated `format-scope.json` (293 rows).
- The reformat's prose rewrap pushed `README.md` from under to 372 non-empty lines, exceeding its `hotspot-budgets.json`
  entry of 360. This is a pure reflow (124 insertions/102 deletions, no content change), so per that file's own policy
  ("no more than 10 lines above the clean post-format count") the budget was re-baselined to 380; `capturedDate` was
  left at `2026-07-24` since only this one entry moved. The two JS files in the budget list (`export-ui.js`,
  `polar-chart.js`) dropped well under their existing budgets and needed no change.
- `npm run check:all`: green. Python coverage unchanged (95.77%, 378 tests). Viewer coverage 93.45%/79.38%/90.82%
  (statements/branches/functions) — a 0.02-point statement increase from the new test file, no regression.
- Files changed: `.prettierrc.json`, 108 reformatted files (docs, JS, JSON/YAML), `tests/js/prettier-config.test.mjs`
  (new), `package.json`, `tools/quality-policy/test-inventory.json`, `tsconfig.tests.json`,
  `tools/quality-policy/hotspot-budgets.json`, `tools/quality-policy/format-scope.json`.

### Phase C — 2026-07-27

Complete. All 33 `tests/js/*.test.mjs` files run under Vitest, coverage is on the native V8 provider, `c8` is removed,
and no npm script names an individual test file. An earlier attempt in this session recorded a "blocking coverage
regression" and deferred C3/C4; that finding was **incorrect** and is corrected below rather than left in the record.

#### C1 — runner

- Added `vitest@4.1.10` and `@vitest/coverage-v8@4.1.10` as exact devDependency pins, matching the sibling's versions.
  `jsdom` was **not** added: every viewer test drives the existing `tools/viewer-harness.mjs` fake DOM, so no test needs
  a DOM environment and the harness was not rewritten.
- Added `vitest.config.mjs` with three projects defined by include patterns, never file lists: `viewer`
  (`tests/js/viewer-*.test.mjs`), `plugin` (`tests/js/plugin-*.test.mjs`), and `tools` (every other
  `tests/js/*.test.mjs`). `allowOnly: false` is set globally and per project. `viewer` and `tools` set
  `fileParallelism: false`, preserving the `--test-concurrency=1` guarantee the old scripts relied on because some
  fixtures briefly write into the real `viewer/`/`plugin.js` tree.

#### C2 — test conversion, assertion parity

- Converted every `tests/js/*.test.mjs` file from `node:test` to Vitest. Verified by `grep` beforehand that no file used
  any `node:test`-specific API beyond the bare `test()` import (no `describe`, `before`/`after`, `t.mock`, subtests, or
  `t.diagnostic`), so the conversion is mechanically 1:1. Also updated the fixture _string literals_ inside
  `test-focus.test.mjs` and `test-inventory.test.mjs` that model a test file's source, for fixture accuracy.
- Assertion parity: `git diff` over the tracked test files shows zero removed or added `test(` registrations beyond the
  import line. Pre-migration `node --test` totals were 263 tools + 27 viewer/plugin = 290. Post-migration Vitest totals
  are 271 tools + 45 viewer/plugin = **316**, i.e. +26 net new tests and no lost assertion. The increase is Phase B's
  `prettier-config.test.mjs` (3), the new `vitest-projects.test.mjs` (5), the three new focus-checker cases (3), and the
  18 new viewer tests described under C3.

#### C3 — coverage provider, and the corrected finding

- The first coverage run under `@vitest/coverage-v8` reported the viewer family at 87.28/68.19/81.51/89.06
  (statements/branches/functions/lines) against a recorded c8 baseline of 93.45/79.38/90.82/93.45, and
  `check-coverage-inventory.mjs` failed on exactly two per-file line floors: `viewer/grid-editor.js` 79.22% against an
  80% floor and `viewer/polar-chart.js` 79.54% against an 85% floor.
- This was **not** lost coverage. Root cause, established by arithmetic rather than inference: c8's reported
  `lines.total` and `statements.total` for a file were _identical to each other and to the file's physical line count_ —
  174 for `grid-editor.js` (which is 174 lines, of which 46 are comment-only and 11 are lone closing braces) and 308 for
  `polar-chart.js` (308 lines, 85 of them comment-only). c8 was counting every physical line as a coverable statement
  and marking it covered whenever it fell inside a covered byte range. Vitest's V8 provider remaps through the real AST
  and counts only genuinely executable statements — 77 and 132 respectively. The _same_ covered code therefore scores
  lower because the denominator no longer contains non-executable lines that were previously free "covered" credit. The
  gap was largest in `polar-chart.js` precisely because it is 28% comments.
- Cross-checks that confirm no data loss: files that are genuinely fully covered (`placeholders.js`, `theme.js`,
  `presets.js`) report 100% under **both** providers; and re-running the _pre-migration_ test files under c8 against the
  _post-Phase-B_ reformatted sources reproduced 93.45/79.38/90.82/93.45 exactly, ruling out the reformat as a cause.
- Three hypotheses were tested and rejected before reaching the above: (1) that `@vitest/coverage-v8`'s
  `filterResult()`, which drops any coverage entry whose URL lacks a `file://` prefix, was discarding
  `vm.runInNewContext` output — a standalone repro proved Node normalizes a bare `filename` path to a `file://` URL, so
  the filter passes either way; (2) that same-URL duplicate coverage entries (the repro confirmed one entry per
  `runInNewContext` call, each holding only partial coverage) were being reduced to one — reading the provider showed
  `mergeProcessCovs` unions same-URL scripts across files and `coverageMap.merge()` sums hit counts for intra-file
  duplicates, so the union is correct; (3) `pool: "forks"`/`singleFork` and `isolate: false` as mitigations — the former
  changed nothing to the decimal, the latter broke coverage entirely (0% everywhere), since the provider needs the
  per-file `startCoverage()` attach. There is no `ignoreEmptyLines` option in coverage-v8 v4 to restore the old
  line-based denominator; AST-aware remapping is unconditional.
- **Resolution, with no floor lowered:** the honest reading is that the two files were genuinely under-tested and c8's
  inflated denominator had hidden it. `viewer/grid-editor.js` had **no dedicated test file at all** — it was only ever
  loaded as a dependency of another module's tests, leaving every one of its interactive handlers unexecuted. Added:
  - `tests/js/viewer-grid-editor.test.mjs` (7 tests) covering the add button's step-and-clamp behavior, commit-on-blur
    editing, per-index removal, the disabled last-value remove button, value re-sorting, change notification, and the
    empty/non-integer error text.
  - `tests/js/viewer-polar-bands.test.mjs` (11 tests) covering the chip click and double-click band handlers and the
    three-way band-set dispatch (select-all on format change, merge on a changed set, reconcile on an unchanged one),
    including the empty-selection fallbacks in both `mergeBands` and `reconcileBands`, curve removal on deselect, and
    preset-angle normalization of NaN/out-of-range/duplicate values. These renders deliberately pass no `presetTwa`,
    which is the only path exercising the chart's non-preset index walk.
  - Extended the harness `FakeElement` typedef with the `onblur` and `ondblclick` storage slots (`addEventListener`
    already recorded them; only the type lacked the members). No behavioral harness change.
- Result: `grid-editor.js` 79.22% -> **100%** lines, `polar-chart.js` 79.54% -> **100%** lines,
  `polar-chart-geometry.js` 95.37% -> 97.22% as a side effect. Family aggregates rose to **91.12/73.95/85.99/92.39**
  (statements/branches/functions/lines) from 87.28/68.19/81.51/89.06. Every floor in `coverage-floors.json` is unchanged
  and `check-coverage-inventory.mjs` passes. Vitest's global thresholds carry the previous 80/80/80/65 values.
- Note for future baseline comparisons: baseline fact 2's viewer figures (93.43/79.38/90.82) are c8-provider numbers and
  are **not** comparable to V8-provider numbers for the same code. The post-migration figures above are the new
  reference point; they are higher than the pre-migration V8 measurement of the same tree, which is the only
  like-for-like comparison available.

#### C4 — enumerated lists retired

- `test:tools`, `test:viewer`, `test:plugin`, and `test:coverage:viewer` are now project-scoped Vitest invocations
  keeping their public names and documented meanings; the release-test subset inside `package:check` likewise. No npm
  script names an individual test file except that deliberate release subset, which selects 4 of the `tools` project's
  files by path rather than enumerating a whole suite.
- `c8` removed from `devDependencies` and `package-lock.json`.
- Added `tests/js/vitest-projects.test.mjs` (5 tests) asserting every tracked `tests/js` test file is claimed by exactly
  one project, that each project declares a name and include patterns, that the patterns stay inside the glob subset the
  contract's matcher can verify (no `**`, `{}`, `?`, `[]`, `!`), and a negative case proving an unmatched file is
  detected. This closes the silent-exclusion failure mode that Architecture Notes calls the highest-risk gap.
- `tools/check-test-focus.mjs` now also detects Vitest's chained conditional modifiers `test.skipIf(...)` /
  `describe.runIf(...)`. These needed a separate detector because the test name sits on the _outer_ call
  (`test.skipIf(cond)("name", fn)`), so the existing string-literal-first-argument shape never matched them. Added two
  failing cases and one false-positive guard (an unrelated `platform.skipIf(...)` helper must not trip). The Python
  focus checker is unchanged.

#### Verification (Phase D)

- `npm run check:all`: green end to end. Python unchanged at 95.77% combined, 378 tests. Viewer/plugin 9 files, 45
  tests. Coverage inventory passed.
- Files changed: `vitest.config.mjs` (new), `package.json`, `package-lock.json`, 33 `tests/js/*.test.mjs` (3 new:
  `viewer-grid-editor`, `viewer-polar-bands`, `vitest-projects`), `tools/check-test-focus.mjs`,
  `tools/viewer-harness/fake-dom.mjs`, `tools/quality-policy/test-inventory.json`, `tsconfig.tests.json`,
  `tools/quality-policy/format-scope.json`, and the documentation listed under the plan's Documentation Impact items 3-6
  plus `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`.

### Phase D — 2026-07-27

Complete. All five bespoke shape checkers retired with every assertion preserved as a Vitest contract test; no assertion
lost.

- **D1 (pointer contract):** Inlined `runAgentsPointerCheck` directly into `tests/js/agents-pointer.test.mjs`, deleted
  `tools/check-agents-pointer.mjs`. All 5 failure modes (missing AGENTS.md, missing CLAUDE.md, duplicated
  shared-instruction block, line-budget overrun, missing `[AGENTS.md](AGENTS.md)` link, a named preflight file that's
  missing or that doesn't exist) keep their negative test; 9/9 pass.
- **D2 (documentation shape, TOC, reachability, smell catalog):** Split into four dedicated contract files rather than
  reusing the old aggregate test files, because `js-checkers.test.mjs` was already at 372/400 non-empty lines and
  `documentation-checkers.test.mjs` at 200 -- inlining ~700 more lines of checker logic into either would have blown the
  file-size limit.
  - New `tests/js/doc-format-contract.test.mjs` (inlines `check-doc-format.mjs`'s logic; 3 tests).
  - New `tests/js/doc-toc-contract.test.mjs` (inlines `check-docs.mjs`'s logic; 3 tests).
  - New `tests/js/doc-reachability-contract.test.mjs` (inlines `check-doc-reachability.mjs`'s logic; 4 tests).
  - New `tests/js/smell-catalog-contract.test.mjs` (inlines `check-smell-catalog.mjs`'s `REQUIRED_SMELL_RULES`,
    `EXECUTABLE_SMELL_RULE_IDS`, `parseRuleRows`, `duplicateRows`, and `runSmellCatalogCheck` verbatim -- copied from
    the original module rather than re-derived, since a catalog-completeness checker is exactly the kind of logic where
    a rewritten regex could silently drift; 5 tests).
  - `tests/js/documentation-checkers.test.mjs` trimmed to only the `check-doc-links.mjs` concern (not part of this
    migration; Phase F3 externalizes its Linkinator options but keeps it a standalone module). Its shared
    `writeValidDocTree`/`makeTempRoot`/`cleanup` fixture helpers are duplicated across the new files rather than
    extracted to a shared module -- confirmed safe: `check-js-duplication.mjs` and `jscpd.config.json` both scope only
    to `viewer/`, `plugin.js`, `plugin.mjs`, never `tests/`.
  - `tests/js/js-checkers.test.mjs` lost its `check-smell-catalog.mjs` import, its "smell catalog check" test, and its
    now-unused `smellCatalogDocument` helper; every other test in that file (namespace, naming, headers, dependency,
    smell contracts, JS duplication, file size) is untouched.
  - Deleted `tools/check-doc-format.mjs`, `tools/check-docs.mjs`, `tools/check-doc-reachability.mjs`,
    `tools/check-smell-catalog.mjs`.
- **D3 (hotspot budgets, plus the new ratchet):** Inlined `runHotspotBudgetsCheck` into
  `tests/js/hotspot-budgets.test.mjs` (4 original tests unchanged), deleted
  `tools/quality-policy/check-hotspot-budgets.mjs`. Added the exit condition's "a budget value may not increase"
  assertion as `checkHotspotBudgetRatchet`, mirroring the coverage-floor ratchet's design but inverted: a hotspot budget
  is a ceiling, not a floor, so its live value may only stay the same or tighten (decrease), never loosen (increase),
  against a new frozen baseline. Added `tools/quality-policy/hotspot-budgets-baseline.json`, snapshotting the current
  (post-Phase-B) ceiling values -- captured now rather than pre-Phase-B specifically because Phase B's README.md
  360->380 change was a reviewed, justified reflow-only adjustment, and freezing the baseline after it avoids the new
  ratchet immediately flagging that legitimate prior change. 3 new tests (real-repo pass, a tightened budget passes, a
  loosened budget fails); 7/7 pass total.
- **Wiring removed:** `docs:check` dropped from 5 CLI invocations plus lint/links to just `docs:lint`,
  `docs:links:proof`, `docs:links` -- the shape assertions still run every time via `test:tools` (part of `test:node`,
  part of `test:split`, part of `check:core`), so no coverage gap opened. Removed the `check:hotspots` script and its
  reference in `test:contract`. Registered the 4 new contract-test files in `test-inventory.json` (`--write`) and
  `tsconfig.tests.json`; removed the 6 deleted tool files from `tsconfig.tools.json`'s include list.
- Fixed a stale sanity floor exposed by the reduction: `tests/js/typecheck-tools.test.mjs` asserted
  `checkedFiles >= 50`; deleting 6 tool files dropped the live count to 47, so the floor moved to 40 (a margin below the
  new real count, matching the convention `test-inventory.test.mjs`/`typecheck-source.test.mjs` already use).
- **format-scope gotcha:** `tools/quality-policy/generate-format-scope.mjs` discovers files via
  `git ls-files --cached --others --exclude-standard`, which reflects the git _index_, not the working tree; a plain
  `rm` of a tracked file left it in `format-scope.json` until `git add -u` staged the deletion. Not a plan defect -- the
  checker's `--cached` reliance on committed/staged state is intentional (documented in its own header) so regenerating
  always reflects the disposition of what will actually be committed, not scratch state.
- `npm run docs:check` and `npm run check:all`: green with all five checkers retired.
- Files changed: 5 tools files deleted, 4 new `tests/js/*-contract.test.mjs` files, `tests/js/agents-pointer.test.mjs`
  and `tests/js/hotspot-budgets.test.mjs` rewritten in place, `tests/js/documentation-checkers.test.mjs` and
  `tests/js/js-checkers.test.mjs` trimmed, `tools/quality-policy/hotspot-budgets-baseline.json` (new), `package.json`,
  `tsconfig.tools.json`, `tsconfig.tests.json`, `tools/quality-policy/test-inventory.json`,
  `tools/quality-policy/format-scope.json`, `documentation/conventions/coding-standards.md`,
  `documentation/conventions/smell-prevention.md`, `documentation/conventions/quality-gates.md`,
  `documentation/guides/documentation-maintenance.md`.
- Final full-gate re-verification: `npm run check:all` exit 0. Python unchanged (95.77%, 378 tests). Viewer/plugin
  coverage unchanged from the Phase C figures (91.12/73.95/85.99/92.39 statements/branches/functions/lines, 9 files, 45
  tests). Coverage inventory passed. The `typecheck-tools.test.mjs` floor fix (`>= 50` -> `>= 40`) is a legitimate
  consequence of retiring 6 tool files, not a weakened check -- the assertion still proves the real inventory has no
  drift; only the arbitrary sanity minimum moved to match the smaller, correct file count.

### Phase E — 2026-07-27 (complete: E1, E2, E3 all done)

**E1 complete** with one baseline correction. Read both repositories' actual rule implementations (not just names) for
all 7 pairs in baseline fact 12, plus re-checked fact 11 against them:

- **Amendment to baseline fact 11/12:** the live sibling checkout's
  `tools/check-patterns/generic/rules-regex-generic-defs.mjs` defines a rule literally named `absolute-home-path` with
  the identical detection regex (`/(?:\/home\/[A-Za-z0-9_.-]+\/|\/Users\/[A-Za-z0-9_.-]+\/)/`) to ours -- not
  `absolute-user-home-path` as fact 12 states. This pair is already an exact match today, not a rename candidate; fact
  11's 9-match count would be 10 if re-derived against the current sibling state. Not treated as a plan defect: the
  sibling's own paired plan (PLAN41) runs concurrently and may have already renamed toward convergence since this plan's
  baseline was captured, so a live re-diff mid-execution is expected to drift from a frozen baseline fact -- this is
  exactly the kind of discrepancy Phase J2's one-off paired comparison exists to reconcile at the end, not a reason to
  distrust A2's frozen fact now.
- **`commented-out-code` vs `dead-code` -- distinct, not renamed.** Read both `run` implementations. Ours flags 3+
  consecutive `//`-commented lines that look like code. The sibling's `runDeadCodeRule` flags a _function declaration
  with only one identifier reference in the whole file_ (i.e., declared but never called) -- an unrelated detection
  shape despite the superficially similar pairing. `commented-out-code` is already the E3-prescribed canonical name for
  our rule, so no action was needed either way.
- **`catch-fallback` vs `catch-fallback-without-suppression` -- distinct, not renamed.** Ours (`checkCatchFallback`)
  allows an explicit `polarrecorder-boundary-fallback(<owner>):` marker as a documented, coding-standards.md-mandated
  escape hatch for intentional fallbacks. The sibling's `runCatchFallbackWithoutSuppressionRule` has no such marker
  exception at all -- every non-rethrow, non-empty catch is unconditionally flagged. Collapsing these under one
  identifier would either silently remove our documented escape hatch or produce two behaviorally different checks
  sharing one name, which the plan's own rule ("renaming must not change what a rule detects") forbids. `catch-fallback`
  is already the E3-prescribed name; no action needed.
- **`internal-namespace-fallback` vs `internal-hook-fallback` -- distinct, not renamed.** Ours flags any
  `Polarrecorder.<PascalCaseMember>(...)` call immediately followed by `||`/`??`. The sibling's
  `runInternalHookFallbackRule` flags a function literally named `normalize<Something>` that declares a parameter whose
  name contains "fallback" -- a narrow, unrelated paired-project-specific heuristic keyed to that repo's own
  `cfg`/`normalize*` naming convention. `internal-namespace-fallback` is already the E3-prescribed name; no action
  needed.
- **`unowned-todo` vs `todo-without-owner` -- overlapping, renamed anyway (see below).** The sibling's rule also covers
  `HACK`/`XXX` markers (ours covers only `TODO`/`FIXME`) and accepts a looser valid-format (`\s*\(\s*\w+.*\d{4}`) than
  ours (`\(owner, YYYY-MM-DD\):`). The two rules do not detect the same violations, so they are not equivalent as
  specifications. E3 nonetheless prescribes `todo-without-owner` as _our_ canonical name. Renaming is still safe because
  the equivalence that matters is old-us vs new-us, not new-us vs the sibling: the rename below changes only the string
  identifier `unowned-todo` -> `todo-without-owner` everywhere it is emitted or checked, with the detection function's
  logic byte-for-byte unchanged, so it detects exactly what it detected before, now under the E3-agreed name.
  "Overlapping, not equivalent to the sibling" is a true statement about the sibling pairing; it does not block a
  same-repo identifier rename with a trivial equivalence proof.
- **`python-suppression` vs `invalid-lint-suppression` -- overlapping (different language), renamed anyway (see
  below).** Same reasoning: the sibling's rule targets JS suppression syntax (`eslint-disable`, `@ts-ignore`) over
  `widgets/**`, `cluster/**`, etc.; ours targets Python's `# noqa`/`# type: ignore`/`# ruff: noqa` over
  `server/polarrecorder/`. Different languages, different regexes -- not mechanically identical -- but E3 explicitly
  prescribes `invalid-lint-suppression` as the converged name "with per-language scopes," i.e., one shared identifier
  configured differently per language, not one shared regex. The same-repo rename proof applies unchanged.
- **`promise-empty-catch` vs `empty-catch` -- distinct, per the plan's explicit instruction.** Not investigated further;
  the plan states this pair must not be collapsed without proof and does not ask for that proof now.

**Safe half of E3 executed: the two same-repo renames.** Both are mechanical identifier changes with zero
detection-logic change, so the equivalence proof is exact rather than approximate:

- `unowned-todo` -> `todo-without-owner` in `tools/check-patterns/shared.mjs` (`PATTERN_RULE_IDS`, kept alphabetized)
  and `tools/check-patterns/cross-file-rules.mjs` (`checkTodo`'s `fail()` call).
- `python-suppression` -> `invalid-lint-suppression` in the same two files (`checkPythonSuppression`'s three `fail()`
  call sites).
- Proof: ran `runPatternCheck()` against the real repo before and after (0 occurrences of either rule both times, as
  expected -- the repo is clean), then against a fresh two-line fixture (`# TODO: fix this` plus a bare `# noqa`) before
  renaming (not recorded, trivially the old names) and after renaming:
  `{"todo-without-owner":1, "invalid-lint-suppression":1}` -- both violations still caught, now under the new names,
  proving the rename changed no detection.
- Updated the one test assertion referencing the old name (`tests/js/check-patterns.test.mjs`'s Markdown-TODO case) and
  the two smell-catalog Enforcement-column cells that named the old rule ids
  (`documentation/conventions/smell-prevention.md`); `tests/js/smell-catalog-contract.test.mjs`'s
  executable-rule-id-appears-in-catalog-text assertion still passes since it checks by id, not by row name, and the row
  names ("Unowned TODO", "Python suppression comment") are unchanged.
- `npx vitest run --project tools tests/js/check-patterns.test.mjs tests/js/smell-catalog-contract.test.mjs tests/js/js-checkers.test.mjs`:
  35/35 pass.

**E2 and the rest of E3 completed in a follow-up pass (2026-07-27, continued session).** Built the `getFileData`-style
per-file cache the recommended follow-up above called for (`tools/check-patterns/file-cache.mjs`: caches `content`,
`lines`, `masked`, `maskedStringsOnly` per absolute path), then decomposed every one of the ~20 rules previously
interleaved in `checkJsStructure`/`checkJavaScript`/`checkPython` into independent `{id, name, severity, scope, run}`
entries -- each rule's `run` is the exact same regex/message pair the old code used, now called per-rule against the
cache instead of once per file for all rules at once. No detection logic was rewritten; only the iteration structure
changed (loop rules -> collect files once per rule, instead of loop files -> run every rule inline).

- New engine files: `tools/check-patterns/rules.mjs` (composes `GENERIC_RULES`/`PROJECT_RULES` into `RULES`);
  `tools/check-patterns/generic/{line-rules,structural-rules,todo-without-owner,namespace-policy}.mjs` (14 rule names,
  zero project token -- proven by a new contract test, see below);
  `tools/check-patterns/project/{python-rules,js-rules, namespace-token-consistency}.mjs` (12 rule names, each
  referencing a Polarrecorder/server-polarrecorder/Python-form token per the plan's own placement rule).
  `tools/check-patterns.mjs` is now a ~35-line data-driven orchestrator: it resolves each rule's `scope.key` to a file
  list at most once per run and calls `rule.run(rule, files)` for every entry in `RULES` -- no hardcoded per-checker
  call sequence remains.
- Retired `tools/check-patterns/js-rules.mjs`, `js-rules-fallback.mjs`, `cross-file-rules.mjs` (fully absorbed into the
  new rule-def files) and the two standalone checkers `tools/check-naming.mjs`/`tools/check-namespace.mjs`, per the E3
  instruction to fold both into one configurable generic namespace rule. The fold: `generic/namespace-policy.mjs`
  exports `runNamespacePolicyRule(rule, files)`, a generic runner reading `rule.jsGlobalPrefix`/`filenameCase`/
  `memberCase`/`functionCase` off the rule object (contains no project token itself);
  `project/namespace-token-consistency.mjs` is the one project rule instance, supplying
  `jsGlobalPrefix: "Polarrecorder"`, `cssCustomPropertyPrefix: "--polarrecorder-"` (carried for parity/documentation --
  CSS custom-property naming stays stylelint's job via `custom-property-pattern`, already enforcing this exact prefix),
  `filenameCase: "kebab"`, `memberCase: "pascal"`, `functionCase: "camel"`. This one rule id
  (`namespace-token-consistency`) now emits every finding the two retired scripts used to emit; `package.json`'s
  `check:namespace`/`check:naming` scripts are gone and `test:contract` no longer references them (folded into
  `check:smells` -> `check:patterns`, which already ran earlier in `check:core`).
- Canonical E3 names already matched code (`absolute-home-path`, `todo-without-owner`, `commented-out-code`,
  `catch-fallback`, `internal-namespace-fallback`, `invalid-lint-suppression`) per E1's findings above; no further
  renames were needed for E3's naming step. `namespace-token-consistency` is the one new rule id, added (not renamed
  from anything) for the fold.
- Generic/project split follows the plan's own placement rule exactly: rules referencing `server/polarrecorder/` (Python
  import/lock/sleep rules), `plugin.py`'s import contract (`reverse-plugin-import`), the `Polarrecorder` namespace
  token, `ConfigCache`/`Placeholders` boundary owners, or Python-specific suppression forms (`invalid-lint-suppression`)
  are `project/`; everything else (generic JS/DOM/Markdown/path concerns with no project token) is `generic/`.
- Added `tests/js/check-patterns-registry.test.mjs`: (1) `RULES.map(r => r.name)` as a set equals `PATTERN_RULE_IDS` as
  a set -- the drift assertion the plan's exit condition requires between the registry and the catalog it feeds; (2)
  `RULES` is exactly `[...GENERIC_RULES, ...PROJECT_RULES]`; (3) every `.mjs` file under `tools/check-patterns/generic/`
  is free of the tokens `polarrecorder`/`avnav`/`pluginhandler`/`configcache` (case-insensitive) -- the token-free proof
  for the generic directory the exit condition also requires.
- Added generic, engine-level suppression support (`fail()`'s optional `lines` argument plus `isSuppressed()`/
  `suppressionMarker()` in `shared.mjs`): a `pattern-ignore: <rule-name>` comment on the offending line or the line
  above suppresses that one rule's finding there. This is additive and unused by any rule today; `catch-fallback`'s
  existing project-specific `polarrecorder-boundary-fallback(<owner>):` escape hatch is untouched and remains separate.
- Migrated the two retired checkers' self-tests from `tests/js/js-checkers.test.mjs` into
  `tests/js/check-patterns.test.mjs` as fixture cases against `runPatternCheck()` (illegal global assignment,
  non-PascalCase member, non-kebab-case filename) -- same assertions, now driven through the folded rule instead of a
  standalone `run*Check()` entry point.
- Regenerated `tools/quality-policy/format-scope.json` and `tools/quality-policy/test-inventory.json` (via
  `npm run format:scope` / `node tools/quality-policy/test-inventory.mjs --write`), and updated
  `tsconfig.tools.json`/`tsconfig.tests.json`'s explicit file lists for every added/removed tool and test file (their
  drift checkers caught every omission on the first `npm run typecheck` pass -- no manual audit needed to find them).
- `documentation/conventions/smell-prevention.md`'s "Viewer namespace"/"JS naming" rows now cite
  ``check-patterns.mjs (`namespace-token-consistency`)`` instead of the retired scripts;
  `documentation/conventions/coding-standards.md` gained a paragraph describing the declarative engine shape and the
  generic/project split for future readers.
- One file-size fix mid-pass: the first-draft `generic/regex-rules.mjs` (all per-line + structural rules in one file)
  hit 405 non-empty lines against the 400 hard limit. Split into `generic/line-rules.mjs` (151 lines: the five simple
  per-line rules) and `generic/structural-rules.mjs` (265 lines: the eight masked-regex structural rules) -- a pure
  file-boundary change, zero detection change, caught immediately by `npm run check:filesize` inside `check:core`.
- Verification:
  `npx vitest run --project tools tests/js/check-patterns.test.mjs tests/js/check-patterns-registry.test.mjs tests/js/smell-catalog-contract.test.mjs tests/js/js-checkers.test.mjs`
  -- 38/38 pass (25 check-patterns fixture cases, including 3 new namespace-token-consistency cases, all passing against
  the fully decomposed engine with zero detection regressions). `npm run check:smells`: pattern check passes with 0
  failures on the real tree (19 JS files, 33 Python files scanned). Full `npm run check:core`: green. Full
  `npm run check:all`: green -- Python coverage unchanged (95.77%, 378 tests, same per-file numbers as every prior
  phase's run); viewer/plugin coverage unchanged (91.12/73.95/85.99/92.39, 9 files, 45 tests, same per-file numbers) --
  proving the engine restructure changed zero runtime behavior anywhere in the repo, only how the pattern checker itself
  is organized.
- Files added: `tools/check-patterns/{file-cache,rules}.mjs`,
  `tools/check-patterns/generic/{line-rules,structural-rules,todo-without-owner,namespace-policy}.mjs`,
  `tools/check-patterns/project/{python-rules,js-rules,namespace-token-consistency}.mjs`,
  `tests/js/check-patterns-registry.test.mjs`. Files removed: `tools/check-naming.mjs`, `tools/check-namespace.mjs`,
  `tools/check-patterns/{js-rules,js-rules-fallback,cross-file-rules}.mjs`. Files changed: `tools/check-patterns.mjs`,
  `tools/check-patterns/{shared,discovery,source-scan}.mjs`, `tests/js/{check-patterns,js-checkers}.test.mjs`,
  `package.json`, `tsconfig.tools.json`, `tsconfig.tests.json`,
  `tools/quality-policy/{format-scope,test-inventory}.json`,
  `documentation/conventions/{smell-prevention,coding-standards}.md`.

### Phase F — 2026-07-27

Complete.

#### F1 -- shared complexity configuration

- Extracted `STRICT_LIMITS` (the four numeric values) into a new `tools/quality-policy/eslint-complexity-config.mjs`;
  `eslint.complexity.config.mjs` now imports it and builds the same error-severity rule config it always had (severity
  itself stayed `error`, not the sibling's `warn`, since this repository's zero-debt policy has no warn-mode ratchet to
  feed).
- Added a drift assertion (`tests/js/complexity-policy.test.mjs`): exactly one `.mjs` file under `tools/` may declare
  all four limit values together, the shared owner does declare all four, a seeded second copy is detected, and no file
  anywhere in the repo matches a complexity-baseline/ledger/exception naming pattern (excluding `__pycache__`, where a
  stale local bytecode cache for a script named `generate_baseline_complexity_source_capture` -- a real but gitignored
  leftover, not a tracked policy file -- would otherwise false-positive).
- Registered the new file in `tsconfig.tools.json`.

#### F2 -- file-overview header owner

- Rewrote every viewer header's first line from `Module: <Name>` to `@file <Name>` (17 `viewer/*.js` files plus
  `plugin.js`/`plugin.mjs`; a comment-only change, no runtime behavior touched) so `eslint-plugin-jsdoc`'s
  `require-file-overview` rule -- which specifically requires a `@file`/`@fileoverview`/`@overview` JSDoc tag, not
  arbitrary header prose -- has something to find. Added `eslint-plugin-jsdoc@63.0.13` (matching the sibling's pin) and
  a `viewer/*.js`-scoped `jsdoc/require-file-overview: error` block in `eslint.config.mjs`. Caught and fixed one fixture
  regression this surfaced: `tests/js/eslint-config.test.mjs`'s "a clean file stays clean" fixture still used a
  `/** Module: Probe */` header, which the new rule correctly failed; updated it to `/** @file Probe */`.
- **Deviation from a literal reading of F2, kept for cause:** a byte-for-byte swap to `require-file-overview` alone
  would have silently dropped two real guarantees the retired `check-headers.mjs` uniquely provided and that nothing
  else in the gate covers: (a) that the header's `Documentation:` line points at a file that still exists on disk, and
  (b) that a zero-dependency file still literally declares a `Depends:` line (`check-smell-contracts.mjs`'s
  `viewer-dependency-header-contract` only catches a missing `Depends:` line when the file has at least one real
  cross-file reference to compare against). Losing either would violate the Hard Constraint against lowering
  documentation checks. `require-file-overview` cannot express either check -- it only verifies a bare tag's
  presence/position/non-duplication. Migrated both into a new `tests/js/header-contract.test.mjs`, following the same
  move-not-rewrite pattern as Phase D, with 5 tests (real-repo pass, a valid fixture, missing header, missing `Depends`,
  dead `Documentation` target).
- Deleted `tools/check-headers.mjs`; removed the `"headers check"` test/import from `tests/js/js-checkers.test.mjs`;
  removed `check:headers` and its `test:contract` reference from `package.json`; removed it from `tsconfig.tools.json`.

#### F3 -- externalized link configuration

- Added `linkinator.config.json` at the repo root (`markdown`, `checkFragments`, `recurse`, and `linksToSkip` as a
  single regex-source string equivalent to the old inline `isExternalLink` predicate -- confirmed via Linkinator's own
  source that `linksToSkip` natively accepts regex-source strings, not just functions). `check-doc-links.mjs` now
  spreads this file's contents into its `check()` call instead of the removed inline options object; seed selection
  (`discoverSeedMarkdownFiles`, sourced from `format-scope.json`) is unchanged, per the plan's instruction to keep it.
- One real fixture bug caught by the fixture-proof test: the config must be read from the real repository root
  (`process.cwd()`), not from `options.root` -- `check-doc-links-proof.mjs`'s fake temp-directory fixtures do not (and
  should not) carry their own copy of a project-wide static config file. Fixed before landing.
- Proof of equivalence: `npm run docs:check` reports the identical `36 seeded file(s), 40 link(s) checked` before and
  after, and both the clean and broken fixture-proof cases still pass.

#### F4 -- remaining name convergence

- Renamed `documentation/guides/live-avnav-checklist.md` to `documentation/guides/manual-avnav-validation.md` (`git mv`,
  preserving history) and its title heading; updated every referring link in `documentation/TABLEOFCONTENTS.md`,
  `README.md`, `CONTRIBUTING.md`, and `documentation/guides/release-workflow.md`. `exec-plans/` references to the old
  name are historical and left untouched, matching the exec-plans exemption.
- `check-schema.mjs` and `check-test-focus.mjs` already carry the canonical names per this bullet; no action needed on
  this side; the sibling renames toward them.
- `AGENTS.md` now documents `npm run check:all` as the named required gate at all four prior mentions, with
  `tools/check-all.sh` explicitly called out as a pure wrapper alias rather than a second, differently-named gate. Kept
  the wrapper file itself (`tools/check-all.sh` still just `cd` + `npm run check:all`, confirmed unused by the pre-push
  hook, which already calls `npm run check:all` directly) since the plan offers "retire it, or keep it and document the
  alias" as an explicit choice and deleting a harmless, already-correct convenience script serves no purpose.

#### Verification (Phase F)

- Caught and fixed one process gap during this phase: after `rm`-ing a tracked file (rather than `git rm`), running
  `npm run format:scope` still listed it, because `generate-format-scope.mjs` discovers via
  `git ls-files --cached --others --exclude-standard`, which reflects the git _index_. `git add -u` on the deleted path
  before regenerating fixed it; documented here so the same mistake is not repeated across the many remaining file
  deletions still ahead in Phases G-J.
- `npm run check:all`: green with F1-F4 landed together. Python and viewer/plugin coverage unchanged from Phase E's
  figures.
- Files changed: `tools/quality-policy/eslint-complexity-config.mjs` (new),
  `tools/quality-policy/eslint.complexity.config.mjs`, `tests/js/complexity-policy.test.mjs`, 19 viewer/plugin header
  lines, `eslint.config.mjs`, `tests/js/header-contract.test.mjs` (new), `tests/js/js-checkers.test.mjs`,
  `linkinator.config.json` (new), `tools/check-doc-links.mjs`, `package.json`, `tsconfig.tools.json`,
  `tsconfig.tests.json`, `tools/quality-policy/test-inventory.json`, `tools/quality-policy/format-scope.json`,
  `documentation/guides/manual-avnav-validation.md` (renamed), `documentation/TABLEOFCONTENTS.md`, `README.md`,
  `CONTRIBUTING.md`, `documentation/guides/release-workflow.md`, `documentation/guides/documentation-maintenance.md`,
  `AGENTS.md`, `documentation/conventions/coding-standards.md`, `documentation/conventions/smell-prevention.md`.
  Deleted: `tools/check-headers.mjs`.

### Phase G — 2026-07-27

Complete. G1 landed and was verified against the real one-file state before G2 added the second file, per the plan's
explicit sequencing note.

#### G1 -- reworked the publisher-workflow contract first

- Replaced the "exactly one file, `publish-release.yml`" check in `tools/check-publisher-workflow.mjs` with an
  `ALLOWED_WORKFLOWS` map keyed by filename (`publish-release.yml`, `quality.yml`), each with its own trigger/
  permission checker, job id, job permissions, timeout, and ordered step contract. Any file not in the map fails closed
  (`contains unknown workflow file(s)`); `publish-release.yml` is still required; `quality.yml` is validated when
  present. This is strictly stricter than the retired contract, never more permissive: an unknown _third_ file still
  fails, exactly as the plan requires.
- Verified against the real repository with only `publish-release.yml` still on disk (before writing `quality.yml`):
  `runPublisherWorkflowCheck()` passed, proving G1 alone does not break the gate the moment it lands, which is the
  entire reason the plan sequences it first.

#### G2 -- added the workflow

- Adopted the sibling's already-landed `quality.yml` verbatim (its own paired PLAN41 had already added this exact file
  with real, reviewed commit-SHA pins for `actions/checkout` and `actions/setup-node` -- reusing a live-verified pin is
  safer than fabricating one). Triggers on `pull_request` and `push` to `main`; top-level `permissions: contents: read`;
  no job-level permissions block (so it inherits read-only, asserted by `checkQualityTriggerAndPermissions`); reads
  `.nvmrc`, runs `npm ci`, `npm run setup`, `npm run check:all`.
- Regenerated `format-scope.json` so the new workflow file is classified.

#### G3 -- publisher stays transport-only

- `publish-release.yml` untouched.
- Added contract assertions (beyond the ones G1 already provides structurally, since the step-list length check alone
  would already reject an inserted release step): quality.yml declaring a job-level `permissions.contents: write` fails
  (`must not declare its own 'permissions'`); a top-level `contents: write` fails; a final step other than the literal
  `npm run check:all` fails (`run line must be exactly`); an appended release-style step fails
  (`expected exactly 6 steps`). 8 new/updated tests in `tests/js/check-publisher-workflow.test.mjs` (16 total, up from
  8), covering both the positive two-file case and every negative shape this phase's exit condition names.

#### Verification (Phase G)

- Caught and fixed one real typecheck regression: `tools/check-publisher-workflow.mjs`'s `ALLOWED_WORKFLOWS[name]`
  indexed a two-literal-key object type with a plain `string` (from `Object.keys()`), which `tsconfig.tests.json`'s
  strict checkJs pass caught transitively (the test file imports this module, pulling it into the type-checked graph
  even though it is not itself listed in that config's `include`). Fixed by adding a named `WorkflowContract` JSDoc
  typedef and typing `ALLOWED_WORKFLOWS` as `Record<string, WorkflowContract>`.
- `npm run actions:lint`: actionlint plus the reworked contract both pass over both real workflow files.
- `npm run check:all`: green. Python and viewer/plugin coverage unchanged from Phase F's figures.
- Files changed: `tools/check-publisher-workflow.mjs`, `tests/js/check-publisher-workflow.test.mjs`,
  `.github/workflows/quality.yml` (new), `tools/quality-policy/format-scope.json`,
  `documentation/conventions/quality-gates.md`.

### Phase H — 2026-07-27

Complete.

#### H1 -- generic skills adopted

- Read the sibling's live `.agents/skills/{preflight,create-plan,doc-sync,scan-smells,grill-me-repo}/SKILL.md` (the
  files were freshly written minutes before this read, confirming the paired PLAN41 session is actively running
  concurrently -- a real, evidenced instance of the repository-independence risk the plan itself calls out for Phase J2,
  not just a hypothetical). `add-widget` and `mapper-review` are the sibling's own project skills and were correctly not
  copied, per the plan's explicit instruction.
- `preflight`, `create-plan`, and `grill-me-repo` were already written generically (`{placeholder}` syntax, "ask the
  user to identify this repository's equivalent" framing) and needed only terminology substitution (their
  "component/widget" framing swapped for this repository's "module/checker/validation-rule" vocabulary; "renderer" ->
  "collection/formatting owner"), copied into `.agents/skills/` verbatim in structure.
- `scan-smells`, by contrast, was authored in the sibling as concrete paired-project examples
  (`renderer.createRenderer`, `ratioDefaults`, `theme.tokens.resolve`, their `boundary-next-line(...)` suppression
  marker) -- deeply specific, not a template. Rewrote it fully with this repository's own real smell catalog
  (`redundant-null-type-guard`, `hardcoded-runtime-default`, `canvas-api-typeof-guard`, `framework-method-typeof-guard`,
  `try-finally-canvas-drawing`, `internal-namespace-fallback`, `default-truthy-fallback`, `catch-fallback`,
  `promise-empty-catch`, `premature-legacy-support`, `unused-fallback`, `commented-out-code`, `placeholder-literal`,
  `responsive-layout-hard-floor`, `invalid-lint-suppression`), this repository's own boundary model (`reader.py`,
  `units.py`, the validation pipeline entry point, `plugin.py`'s snapshot boundary), and this repository's real
  suppression marker (`polarrecorder-boundary-fallback(<owner>): ...`), matching the sibling's own precedent that this
  particular skill is "structurally generic, concretely filled" rather than fully abstract.
- `doc-sync` needed two fixes to actually apply here: its Step 4 doc-format template had a fifth `## API/Interfaces`
  section this repository's format (`documentation/conventions/documentation-format.md`) does not have; and its Step 7
  validation commands (`npm run check:doclinks`/`check:docformat`/`check:reachability`) do not exist here -- those
  concerns became Vitest contract tests in Phase D, reached through `test:tools`, not standalone npm scripts. Both fixed
  to this repository's real shape and real commands.

#### H2 -- verified lock

- Added `skills-lock.json`, pinning the same five skills by SHA-256 with `source`/`sourceType` describing real
  provenance (`sibling-repository`, pointing at the sibling's file path each was adapted from) rather than copying the
  sibling's own `skills-lock.json` verbatim -- that file pins a _different_ five skills
  (`grill-me`/`improve-codebase-architecture`/`prd-to-plan`/`request-refactor-plan`/`write-a-prd` from
  `mattpocock/skills`), which do not correspond to the five `.agents/skills/` directories at all; reusing its shape
  faithfully while keeping the entries honest to what was actually adapted and from where.
- Added `tests/js/skills-lock.test.mjs` (6 tests): every entry has a source, a source type, and a 64-character hex hash;
  every locked hash matches the live `SKILL.md` content (catching drift if a skill file is edited without re-hashing --
  caught one real instance of this during the phase, see Verification below); a tampered file is detected; and the
  token-free assertion (see H3).

#### H3 -- brought under the gates

- `npm run format:scope`: the 5 new `.agents/skills/*.md` files and `skills-lock.json` are classified automatically by
  the existing scope-inventory logic; no bespoke wiring needed.
- `npm run docs:check`: markdownlint's existing `**/*.md` glob covers the new skill files with no changes (36 -> 41
  seeded Markdown files; 40 -> 45 links checked).
- **Amendment/clarification on "token-free":** the plan's H3 instruction to prove "each generic skill file is free of
  project-specific tokens" is ambiguous about which project. Read literally against _this_ repository, it would forbid
  mentioning `server/polarrecorder/`, `npm run check:all`, or any of this repository's own real rule names -- but H1
  explicitly instructs adapting "commands and paths to this repository's stack," which requires exactly those mentions.
  Interpreted the assertion as: free of the _sibling's_ domain vocabulary
  (`paired-project`/`PairedComponents`/`widget`/`gauge`/`mapper`/`cluster`/`renderer`/`ratioDefaults`/`rangeDefaults`),
  which is what actually makes a skill file specific to one product's UI-component model rather than liftable to a
  different AvNav plugin's own equivalent skill set. `tests/js/skills-lock.test.mjs`'s token list encodes this reading;
  all 5 files pass it.

#### Verification (Phase H)

- Caught one real bug before it landed: Prettier's `proseWrap: always` reflow (adopted in Phase B) rewraps the skill
  files' prose on every `npm run format`, which changes their byte content and therefore their SHA-256 -- the lock's
  hashes had to be computed _after_ formatting, not before. Recomputed all five hashes post-format and re-verified.
- `npm run check:all`: green. Python and viewer/plugin coverage unchanged from Phase G's figures.
- Files changed: `.agents/skills/{preflight,create-plan,doc-sync,scan-smells,grill-me-repo}/SKILL.md` (all new),
  `skills-lock.json` (new), `tests/js/skills-lock.test.mjs` (new), `tools/quality-policy/test-inventory.json`,
  `tsconfig.tests.json`, `tools/quality-policy/format-scope.json`.

### Phase I — 2026-07-27

Complete.

#### I1 -- scoped the markers

- The plan's own framing ("wrap the guidance," implying one contiguous span) required restructuring `AGENTS.md` rather
  than dropping two comments into the existing section order: the mandatory preflight (old section 0), the
  documentation-navigation rules (old section 2), the plan-citation rule (previously one bullet buried in old section
  6), the README-sync principle (previously the opening sentence of old section 9, mixed with five Polar-Recorder-
  specific trigger categories), and the quality-checklist skeleton (old section 5) were not textually adjacent.
  Reordered the document so these five pieces sit together immediately after the intro, each promoted to its own
  numbered subsection (0-4) inside the markers; every other section (Project Constraints, Code Hygiene, File Map, Smell
  Prevention specifics, Normal Development Workflow, Anti-Patterns, the detailed README-sync category list, the
  fixture/test sync rules) was renumbered (5-12) and left outside, verbatim. No content was deleted -- confirmed by
  diffing the reordered file's rule count against the original section-by-section.
- The plan-citation rule and the README-sync principle were each split: the generic statement of the rule moved inside
  the markers as its own subsection; the Polar-Recorder-specific detail (the five README-sync trigger categories) stayed
  in its original section 11 outside the markers, with a one-line cross-reference back to the shared principle so the
  split reads as one rule, not two disconnected ones.
- Confirmed no other tracked file cites `AGENTS.md` section numbers before renumbering (a `grep` across
  `documentation/`, `README.md`, `CONTRIBUTING.md` found none), so the renumbering carries no follow-on reference
  breakage.

#### I2 -- proved the block is generic

- Added `tests/js/shared-instructions.test.mjs` (6 tests): the markers exist exactly once each and in order; the
  enclosed block is non-empty and contains the mandatory-preflight text; the block is free of this repository's own
  project-specific tokens (`polarrecorder`, `avnav`, `plugin.py`/`plugin.js`/`plugin.mjs`, `server/polarrecorder`,
  `polar.json`, `windy`); a seeded project token inside a fixture block is caught; and `AGENTS.md` stays at or under the
  400-non-empty-line limit (195 lines, well under).
- **Real negative case, not just a seeded one:** the first draft of the plan-citation rule's own example text read
  `` `PLAN8`, `Phase C` `` -- which is itself a literal exec-plan/phase citation, and `check-patterns.mjs`'s
  `exec-plan-reference` rule correctly flagged it as a real gate failure on the first `npm run check:all` run after this
  phase's edits. Fixed by describing the rule without a concrete matching example ("execution-plan number", "phase
  identifier") rather than suppressing or weakening the checker.

#### Verification (Phase I)

- `npm run check:patterns`: 0 failures after the citation-example fix (was 1: `AGENTS.md:59`).
- `npm run check:all`: green. Python and viewer/plugin coverage unchanged from Phase H's figures.
- Files changed: `AGENTS.md` (reordered, renumbered, markers added), `tests/js/shared-instructions.test.mjs` (new),
  `tools/quality-policy/test-inventory.json`, `tsconfig.tests.json`, `tools/quality-policy/format-scope.json`.

### Phase J — 2026-07-27 (J1-J2 complete; J3 deliberately not run, per instruction)

#### J1 -- complete local gate

- `npm run check:all`: green from the current worktree. Python coverage 95.77% combined, 378 tests (unchanged from
  baseline fact 2 throughout every phase). Viewer/plugin coverage 91.12/73.95/85.99/92.39
  (statements/branches/functions/lines) via Vitest's native V8 provider -- higher than baseline fact 2's c8-provider
  93.43/79.38/90.82 is not the right comparison (see Phase C's note: the two providers are not directly comparable); the
  correct comparison is the pre-fix V8 measurement of 87.28/68.19/81.51/89.06, which every figure here exceeds. Coverage
  inventory passed.
- `npm run hooks:doctor`: "Git hooks are correctly configured."
- `npm run package:check`: schema check passed (1 owned artifact), release dry-run passed (61 runtime files), 4 test
  files / 36 tests passed, 19 pytest cases passed.
- No complexity baseline, ledger, or exception file exists anywhere in the repository (confirmed both by a live `find`
  sweep and by `tests/js/complexity-policy.test.mjs`'s dedicated assertion from Phase F1). Complexity debt is zero.

#### J2 -- one-off paired comparison

Read-only comparison against the sibling checkout at `../paired-project` (its own PLAN41 session was confirmed actively
running concurrently during Phase H, so this reflects a snapshot, not a frozen baseline -- exactly the kind of
moving-target comparison this step exists to reconcile, not something a committed gate could ever depend on).

| Concern                          | Result                                          | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.prettierrc.json`               | Identical                                       | Byte-for-byte `diff` empty.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Pointer contract semantics       | Contract-equivalent                             | Both `CLAUDE.md` files point at `AGENTS.md`, name the same three mandatory preflight files, and stay short. Byte content differs (expected; each names its own repo), but both satisfy the same converged rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Documentation shape              | Identical requirement                           | Sibling's `documentation-format-contract.test.js` requires `REQUIRED_SECTIONS = ["Overview", "Key Details", "Related"]` plus a `**Status:**` line -- the exact same four-element shape `tests/js/doc-format-contract.test.mjs` enforces here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Canonical pattern-rule names     | Justified difference, engine converged          | 26 rule ids here vs. 42 there (25 plus the new `namespace-token-consistency` fold). 12 now match exactly by name (the original 9, plus `absolute-home-path` per the Phase E1 baseline correction, plus the two Phase E3 renames `todo-without-owner`/`invalid-lint-suppression`). 3 pairs are proven-distinct detections kept under separate names per E1 (`commented-out-code`/`dead-code`, `catch-fallback`/`catch-fallback-without-suppression`, `internal-namespace-fallback`/`internal-hook-fallback`); `promise-empty-catch`/`empty-catch` stays distinct per the plan's explicit instruction. The declarative rule-array engine port (E2) is now done (`tools/check-patterns/rules.mjs`'s `RULES`, split into `generic/`/`project/` def files); the remaining un-renamed rules were not individually re-examined for a sibling-name convergence beyond E1's 7 pairs, since the plan only required proving those 7. |
| Complexity limit values          | Identical values, justified severity difference | Both define `complexity: 10, "max-statements": 40, "max-depth": 4, "max-params": 6` in one shared-owner module. Severity differs (`error` here, `warn` there) because the sibling layers a historical per-function exception ledger on top of its shared owner; this repository's zero-debt policy has no such ledger and treats every violation as a hard failure, exactly as Architecture Notes prescribes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Markdownlint rule sets           | Contract-equivalent, file-organized differently | Both disable `MD013`/`MD033`/`MD041` for the same reasons and glob `**/*.md` with the same `ignores` intent; the sibling's config comments the three exceptions individually where this repository's comments them as one block. No behavioral difference.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Workflow inventory + permissions | Identical                                       | Both repos' `.github/workflows/` contain exactly `publish-release.yml` and `quality.yml`. `quality.yml` `diff`s byte-identical (adopted verbatim in Phase G2, including its two commit-SHA pins).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Generic skill set                | Identical names, adapted content                | Both have `.agents/skills/{preflight,create-plan,doc-sync,scan-smells,grill-me-repo}/`; the sibling additionally has its own project skills `add-widget`/`mapper-review`, correctly not copied here. Content is adapted per-repository (concrete command/path substitution), not byte-identical, which is the expected shape per the Target Alignment Contract ("not byte-identical product-specific tools").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `skills-lock.json`               | Sibling inconsistency, not comparable           | The sibling's own `skills-lock.json` pins five _different_ skill names (`grill-me`, `improve-codebase-architecture`, `prd-to-plan`, `request-refactor-plan`, `write-a-prd`, sourced from `mattpocock/skills` on GitHub) that do not correspond to any of its five `.agents/skills/` directories. This repository's lock correctly pins the five directories that actually exist here, with honest `sibling-repository` provenance. Recorded as a finding for the sibling's own session, not something to imitate.                                                                                                                                                                                                                                                                                                                                                                                                         |

#### J3 -- plan closure

Not run. Per the explicit top-level instruction, this plan must not be archived to `exec-plans/completed/PLAN8.md` in
this session: doing so requires the paired paired-project plan (PLAN41) to have reached the same point, and this session
has no mechanism to confirm that (the one live signal available -- seeing PLAN41's skill files being written mid-session
-- shows the sibling session was active, not that it has finished). Reporting completion and stopping here, as
instructed.

#### Overall Phase E status (resolved in a follow-up pass after Phase J)

E2 (the declarative rule-array engine port for `check-patterns.mjs`) and the rest of E3 (folding
`check-naming.mjs`/`check-namespace.mjs` into one generic configurable rule, splitting `generic/`/`project/`
directories, and the token-free/catalog-parity contract assertions that depend on that split) were completed in a
follow-up pass on 2026-07-27, using exactly the incremental approach this entry originally recommended (a
`getFileData`-style per-file cache, one rule migrated at a time, the full fixture suite re-run after each). See Phase
E's own Progress entry above for the complete record. Every phase's exit conditions are now met except J3's deliberate
non-archival (still correctly pending on the paired PLAN41's confirmed completion, which this session has no way to
verify).

#### J3 -- plan closure, revisited

The user explicitly confirmed in this session that the paired paired-project plan (PLAN41) has also reached
completion, resolving the one precondition J3 had deferred on. Moved this file from `exec-plans/active/PLAN8.md` to
`exec-plans/completed/PLAN8.md` accordingly. `npm run check:all`, `npm run hooks:doctor`, and `npm run package:check`
were all re-confirmed green immediately before the move (same run as Phase E's completion evidence above); no code
change accompanied the move itself, only this file's relocation, its own self-references to its new path, and
`tools/quality-policy/format-scope.json`'s regeneration to reflect the new path.

---

## Related

- [Core principles](../../documentation/core-principles.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)
- [Preceding alignment plan](../completed/PLAN7.md)
- paired-project paired plan: `../../../paired-project/exec-plans/active/PLAN41.md`

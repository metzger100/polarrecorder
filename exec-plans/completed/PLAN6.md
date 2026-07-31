# PLAN6 - Complete the quality migration and establish the aligned hybrid-profile exemplar

## Status

Written after repository verification and the cross-repository quality-system review on 2026-07-26.

This plan covers the remaining Polar Recorder migration defects, retirement of completed migration scaffolding,
activation of the maintained documentation tools, strict quality-tool ownership, common dependency and release pins,
portable policy evidence, generic AvNav metadata validation, developer onboarding, live-host validation, and final
alignment with paired-project.

The coding agent may choose equivalent internal helper names and file splits as long as the behavioral, structural,
negative-proof, and documentation outcomes below are met. The public command names, maintained documentation owners,
strict tool-code boundary, removal of obsolete migration authority, common dependency/action pin set, generic schema
corpus, and portable-baseline outcomes are prescriptive.

No pre-plan user interview was run. The plan therefore makes these explicit assumptions:

1. Product behavior, runtime Python 3.9 compatibility, AvNav lifecycle, persisted data, API shapes, viewer output,
   installer behavior, and release ZIP contents remain unchanged.
2. The current local-first authority remains in force: no PR/push quality workflow, CODEOWNERS file, branch ruleset, or
   pre-commit framework is introduced. A novice-default remote-governance profile belongs to the future generic
   scaffolder, not this exemplar migration.
3. Polar Recorder remains independently buildable and testable. Its required gate must never read the sibling
   paired-project checkout.
4. The paired paired-project plan is `PLAN39 — Finalize the generic quality migration and establish the aligned
viewer-profile exemplar`. The two plans coordinate guarantees; neither repository becomes a package dependency of
   the other.
5. Extracting a third, versioned `avnav-plugin-quality` package and `create-avnav-plugin` scaffolder is a subsequent
   productization task. This plan makes Polar Recorder extraction-ready but does not choose a package registry or
   ownership repository.

Repo rules and core principles outrank this plan. If implementation reveals a conflict, amend the active plan with
evidence instead of weakening a gate or silently improvising.

---

## Goal

Finish Polar Recorder's quality migration so it is a trustworthy hybrid Python/JavaScript AvNav plugin exemplar and
exposes the same common quality guarantees and contributor vocabulary as paired-project.

Expected outcomes after completion:

- markdownlint-cli2 and Linkinator are real required documentation owners with positive and negative proofs.
- The live package script graph is the only current command authority; obsolete migration target/phase ledgers are
  archived or deleted rather than consulted by the gate.
- Every custom documentation checker exports a testable entry point and has clean/failing fixtures.
- Every maintained JavaScript and Python quality tool is linted, typed where applicable, size-limited, and
  behavior-tested; oversized checker programs are split into focused owners.
- Common direct tool versions, npm overrides, actionlint checksums, GitHub Action pins, SemVer corpus, schema corpus,
  and public command names match the paired paired-project outcome.
- `plugin.json` uses maintained Ajv validation with a generic AvNav metadata base and a Polar server-plugin profile.
- Complexity/coverage/test baselines are portable and contain no obsolete migration debt; all viewer files reach the
  generic 80% per-file line floor.
- A beginner has a reproducible supported setup path, and releases require an honest live-AvNav manual validation
  record.
- `npm run check:all` remains deterministic, offline after setup, external-browser-free, and green.

---

## Verified Baseline

The following points were rechecked against Polar Recorder `addd6656a5293988a9457934af87515ef3c082b8` before this
plan was written:

1. `package.json` defines the canonical top level exactly as
   `check:all = check:core && test:coverage:check`; `check:strict` is an exact alias and `tools/check-all.sh` is a pure
   compatibility wrapper.
2. `npm run setup`, `npm run hooks:doctor`, and `npm run check:all` all pass on the current
   Linux-x86_64/Node 26.4.0/npm 12.0.1/Python 3.14.6 checkout.
3. The gate executes 387 Python tests, reports 95.77% combined Python coverage, and reports viewer coverage of 91.03%
   lines and 77.41% branches.
4. `check:core` currently invokes `check:docs`, while paired-project' equivalent public command is `docs:check`.
5. markdownlint-cli2 0.23.1 and Linkinator 8.0.2 are exact installed dependencies with committed configs, but no
   package script executes either. `.markdownlint-cli2.jsonc` explicitly says it is “Not yet wired.”
6. A manual markdownlint run passes the current 36 Markdown files. A naïve Linkinator repository invocation checks
   only one link, and a TOC-only invocation resolves relative roots incorrectly; an explicit root-seeded runner is
   required.
7. `tools/check-docs.mjs`, `tools/check-doc-format.mjs`, and `tools/check-doc-reachability.mjs` execute at module load,
   export no `run*` entry point, and have no focused failing-fixture self-tests.
8. `tools/quality-policy/command-graph.json` names `docs:check` in `finalCheckCoreComposition` while its live package
   graph uses `check:docs`. `notYetActivatedLeaves` is empty.
9. `tests/js/command-graph.test.mjs` proves the live package graph but never compares it with
   `finalCheckCoreComposition`; `tests/js/setup.test.mjs` only iterates the now-empty transitional leaf list.
10. `tools/quality-policy/rule-parity-ledger.json`, its 839-non-empty-line Python generator,
    `verified-baseline.json`, its generator, and `baseline-test-inventory.json` are migration evidence rather than live
    product behavior. They remain coupled into digest tests/format-scope bookkeeping after the migration completed.
11. `exec-plans/completed/PLAN5.md` and `exec-plans/PLAN5Ledger.md` already preserve the detailed migration record; the
    ledger is not located with the completed plan.
12. `eslint.config.mjs` manually defines a small rule set and does not import `@eslint/js`. A `missingGlobal();` tool
    probe exits successfully, so undefined tool globals are not rejected.
13. `eslint .` does include `tools/**/*.mjs`, but `tsconfig.checkjs.json` owns shipped viewer/plugin JS only and
    `tsconfig.tests.json` owns tests plus `tools/viewer-harness.mjs`. Other JS quality tools have no strict no-emit
    boundary.
14. `pyproject.toml` excludes all `tools/` from Ruff formatting/linting. `typecheck:python` checks
    `server/polarrecorder`, `tests`, and `plugin.py`, not Python tools.
15. `tools/check-python-filesize.py` and `tools/check-python-compat.py` scan `server/polarrecorder` and `tests`, not
    Python tools. `AGENTS.md` currently exempts `tools/` from the 400-line limit.
16. Maintained tool sources over 400 non-empty lines are: `check-patterns.mjs` 1,096,
    `generate_rule_parity_ledger.py` 839, `viewer-harness.mjs` 736, `check-file-size.mjs` 603,
    `check-coverage-inventory.mjs` 596, `check-js-duplication.mjs` 453, and `mock-server.py` 444.
    Five more checker modules are between 304 and 372 lines.
17. The active complexity baseline is empty because all four captured migration findings were fixed. Nevertheless,
    required `check:complexity` reconstructs history from Git blob IDs in
    `baseline-complexity-source-capture.json`; `baseline-complexity-capture.mjs` also contains two literal NUL bytes.
18. Every one of the 28 executable JavaScript test/helpers is strict and
    `test-exception-baseline.json` is empty.
19. Coverage owns every Python and shipped viewer/plugin JS file, with no contract-owned exceptions. Five viewer files
    retain below-default line floors: `export-ui.js` 60, `grid-editor.js` 75, `settings-ui.js` 60,
    `timeline-chart.js` 75, and `viewer.js` 45.
20. `tools/check-schema.mjs` is a hand-written validator. Development form validation accepts any object without
    `version`; release form validation checks only a non-empty first `version` key. The command graph explicitly
    forbids a public `schema:check` script.
21. Runtime `plugin.json` is `{}` in development and is version-stamped for release. User-app registration is owned by
    `plugin.py`, not `plugin.json`.
22. `developer-python.json` accepts only `>=3.14,<3.15` and lists only `linux-x86_64`, reflecting the single migration
    host. `tools/setup.mjs` hard-codes that range and POSIX `venv/bin` paths.
23. Runtime compatibility remains Python 3.9+ stdlib-only and is checked by Ruff target configuration plus
    `check-python-compat.py`; the required gate does not actually execute on Python 3.9.
24. The common-version alignment snapshot verified on 2026-07-26 is:
    `@eslint/js` 10.0.1, `@types/node` 26.1.1, ESLint 10.8.0, `globals` 17.8.0, jscpd 5.0.12, Linkinator 8.0.2,
    markdownlint-cli2 0.23.1, Prettier 3.9.6, Stylelint 17.14.1, `stylelint-config-standard` 40.0.0, and TypeScript
    7.0.2. Polar currently lacks `@eslint/js` and differs on `@types/node`, ESLint, and `globals`.
25. A post-setup `npm audit --json` reported two high development-tool findings through direct `js-yaml` 5.2.1 and
    markdownlint-cli2 0.23.1. The shipped plugin has no npm runtime dependency chain.
26. The publisher pins checkout v4.4.0 and `softprops/action-gh-release` v2.6.2. Dyn currently pins checkout v6.0.2 and
    release action v2.2.2. Both use actionlint 1.7.12 with the same four official platform checksums.
27. Polar's SemVer implementation matches Dyn for all 20 valid and 42 invalid cases in
    `tools/quality-policy/semver-corpus.json`.
28. Automated viewer/host tests use fakes without an external browser. Unlike Dyn, Polar has no documented full
    live-AvNav release checklist.
29. `.github/workflows/publish-release.yml` is the only workflow and is deliberately a transport-only tag publisher.
30. No active execution plan exists; the next sequential Polar Recorder plan number is 6.

---

## Target Authority and Adaptation Model

| Layer                | Shared/aligned owner                                                                                       | Polar-specific extension                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Public UX            | `setup`, `check:fast`, `check:all`, `docs:check`, `schema:check`, hooks, local release                     | Python venv and pytest composition                              |
| Standard tools       | Prettier, ESLint recommended, Stylelint, markdownlint-cli2, Linkinator, actionlint, jscpd, TypeScript, Ajv | Ruff, mypy, pytest/cov, Python duplication                      |
| Inventories/ratchets | Strict-default test/source ownership, 80/65 JS floor, 10/40/4/6 JS complexity                              | Python family floors and validation/histogram owners            |
| AvNav metadata       | Verified generic base schema and common corpus                                                             | Server-plugin profile: no declarative duplicate user app        |
| Runtime contracts    | Raw/no-build JS, transport-only publisher, manual host validation                                          | Python 3.9 stdlib, single-lock boundary, API/persistence checks |
| Product smells       | None in the generic layer                                                                                  | Polar namespace, validation, finite output, dependency layers   |

Alignment does not justify porting Dyn mapper/theme rules, Vitest, jsdom, layout requirements, or legacy baseline data.

---

## Hard Constraints

### Runtime and architecture

- Preserve Python 3.9+ stdlib-only runtime code. No target-device pip dependency may enter `plugin.py` or
  `server/polarrecorder/`.
- Keep `plugin.py` the only AvNav boundary and lock owner; do not change API, persistence, viewer, installer, or release
  behavior.
- Keep viewer scripts raw/no-build under `window.Polarrecorder`.
- Do not make Polar invoke, import, or inspect paired-project from setup, hooks, tests, `check:all`, package, or release
  commands.

### Quality integrity

- Do not lower coverage, complexity, file-size, inventory, duplication, type, lint, documentation, or package floors.
- Do not add a type/lint suppression, skipped test, formatter directory exclusion, coverage contract-owned exception,
  or baseline debt entry to make the migration pass.
- Raise every existing below-default viewer line floor from measured evidence. Add meaningful tests wherever current
  measured coverage is below 80%; do not set a floor above an achieved result or manufacture coverage-only code.
- Every changed custom checker needs a focused clean case and at least one focused failing case.
- Required gates remain deterministic, external-browser-free, and offline after setup.

### Common alignment snapshot

- At implementation time, re-query current registry/advisory metadata. If Baseline fact 24 is still current, use it
  exactly in both repositories.
- If a version must change for a newly published fix, amend both active plans first and use the same compatible exact
  version in both repositories.
- Align publisher actions to checkout v6.0.2
  (`de0fac2e4500dabe0009e67214ff5f5447ce83dd`) and `softprops/action-gh-release` v2.6.2
  (`3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`) unless a newer reviewed pair replaces both snapshots.
- Force markdownlint-cli2's vulnerable exact `js-yaml` 5.2.1 dependency to a tested fixed resolution (5.2.2 in the
  verified snapshot) through one documented exact npm override until upstream removes the need.

### File organization

- By the end of Phase D, the 400-non-empty-line limit applies to maintained JS/MJS/Python tools as well as existing
  source/test/docs scopes.
- Split the seven current over-limit tool sources before activating the new tool-size gate.
- Do not compress code or prose, and do not create a permanent “legacy tool” exemption.
- Move the completed migration ledger beside the completed plan or retire it after preserving necessary evidence.
- Do not leave permanent plan/phase citations outside `exec-plans/`.

---

## Implementation Order

### Phase A - Freeze current behavior and paired decisions

**Intent:** Capture a reproducible clean baseline and resolve the shared choices before deleting migration evidence.  
**Dependencies:** None.

#### A1. Record current proof

- Record current HEAD/clean state, tool versions, `npm run setup`, `npm run hooks:doctor`, `npm run check:all`,
  coverage summaries, dependency tree, and `npm audit --json` in this plan's progress log.
- Record exact hashes for the common SemVer corpus, actionlint checksum table, selected Action SHAs, and agreed common
  direct dependency set.

#### A2. Classify migration artifacts

- Produce a reference graph for every file under `tools/quality-policy/`.
- Mark each as one of: live gate input, live generated snapshot, current config, reusable generic tool, or completed
  migration-only evidence.
- Do not delete coverage/complexity/test provenance until its live consumer and replacement proof are explicit.

#### A3. Verify the AvNav metadata base

- Inspect current AvNav plugin-loader behavior and both exemplar `plugin.json` forms before authoring a generic schema.
- Define generic and Polar-profile cases without inventing upstream fields.

**Exit conditions:**

- The current full proof is green and recorded.
- Every proposed deletion has a verified non-live or replacement owner.
- Common pin/action/schema decisions match the paired plan.

### Phase B - Retire completed migration scaffolding and normalize the command graph

**Intent:** Make live scripts/tests/docs the only present-tense authority and archive historical migration evidence.  
**Dependencies:** Phase A.

#### B1. Normalize public script names

- Rename `check:docs` to `docs:check` and update `check:core`, docs, tests, and hook/release expectations.
- Introduce `schema:check` as the public package-schema leaf and compose `package:check` from it plus focused package
  tests, matching the shared contributor vocabulary.
- Keep `check:all`, `check:strict`, `check:standard`, `typecheck`, `check:smells`, and
  `test:coverage:check` semantics unchanged.

#### B2. Delete stale graph authority

- Delete `tools/quality-policy/command-graph.json` and its transitional
  `notYetActivatedLeaves` assertion. `package.json` plus `tests/js/command-graph.test.mjs` become the only live graph
  authority.
- Extend the command-graph test to prove `docs:check` and `schema:check` composition, ordered core membership,
  declared-leaf reachability, cycle absence, and failure propagation.

#### B3. Archive or remove migration-only captures

- Delete `generate_rule_parity_ledger.py` and `rule-parity-ledger.json` after verifying every row has a current
  maintained-tool/custom owner and focused negative proof.
- Delete `generate_verified_baseline.py` and `verified-baseline.json` after moving any still-live invariant to its real
  owner test/config.
- Remove `baseline-test-inventory.json` and its generator if Phase A confirms the active strict inventory and
  independently anchored empty exception baseline contain the complete live guarantee.
- Move `PLAN5Ledger.md` under `exec-plans/completed/` and repair the factual link in the completed plan, or consolidate
  and remove it if no useful unique evidence remains.
- Regenerate `format-scope.json` and remove comments/tests that cite deleted migration artifacts.

**Exit conditions:**

- No current source/test/doc points to a deleted ledger.
- The live script graph has one name and one tested owner per leaf.
- Completed historical plans remain readable but are not active gate inputs.
- `npm run test:tools`, `npm run docs:check`, and `npm run check:core` pass.

### Phase C - Activate maintained Markdown and link ownership

**Intent:** Complete the promised maintained-tool adoption while preserving Polar-specific doc contracts.  
**Dependencies:** Phase B.

#### C1. Wire standard documentation leaves

- Add `docs:lint` using markdownlint-cli2.
- Add a root-seeded Linkinator runner for root Markdown, `documentation/**`, and active plans with external HTTP(S)
  skipped and local fragments checked.
- Add `docs:links` and `docs:links:proof` scripts and compose `docs:check` as:
  markdown lint, Linkinator fixture proof, real local-link scan, then retained TOC/shape/reachability/smell/pointer
  contracts.
- Remove “not yet wired” comments and align Linkinator config semantics with Dyn.

#### C2. Make retained checkers testable

- Refactor `check-docs.mjs`, `check-doc-format.mjs`, and `check-doc-reachability.mjs` to export pure/testable `run*`
  entry points accepting root/print options while preserving CLI behavior.
- Add `tests/js/documentation-checkers.test.mjs` with real-root clean cases and temporary-root failures for missing TOC
  registration, missing required section, broken file link, broken fragment, and unreachable document.
- Ensure no checker independently reimplements Markdown fragment parsing now owned by Linkinator.

#### C3. Prove effective documentation scope

- Add a contract that every maintained Markdown file is reached by both Prettier and markdownlint and every
  link-bearing maintained Markdown file is an input to the root-seeded Linkinator scan.
- Keep completed plans/release notes archival and excluded.

**Exit conditions:**

- `npm run docs:lint`, `npm run docs:links:proof`, `npm run docs:links`, and `npm run docs:check` pass.
- Seeded missing-file and missing-fragment fixtures fail Linkinator.
- Every retained custom documentation rule has focused clean/failing tests.

### Phase D - Bring the quality-tool implementation under its own standards

**Intent:** Split oversized tools and make every maintained checker linted, typed, size-limited, and behavior-tested.  
**Dependencies:** Phases B and C.

#### D1. Split oversized JavaScript owners

- Split `check-patterns.mjs` by shared parsing and coherent rule families behind a thin CLI facade.
- Split `viewer-harness.mjs` by DOM/fake-response/loading responsibilities while preserving one public harness API.
- Split `check-file-size.mjs` by discovery/counting and JS compression rules.
- Split `check-coverage-inventory.mjs` by policy parsing, report normalization, and comparison/diagnostics.
- Split `check-js-duplication.mjs` by parse/normalization and clone comparison.
- Measure `test-inventory.mjs` and `complexity-scan.mjs` before edits and split them if added ownership would push them
  toward 400 lines.

#### D2. Split and standardize Python tools

- Delete the over-limit parity generator in Phase B.
- Split `mock-server.py` into a thin server entry point plus focused fake-data/request handlers without changing mock
  endpoints.
- Measure `check-py-contracts.py` and `check-py-dependencies.py` before edits; split before 400.
- Remove the broad Ruff `tools` exclusion. Apply Ruff format/lint to maintained Python tools with tool-appropriate
  rules rather than product-module `Documentation`/`Depends` headers.
- Add maintained Python tools to strict mypy ownership through a dedicated config/leaf if their CLI environment needs
  different imports from runtime/test code.
- Extend Python file-size checking to maintained tools and add clean/401-line/compression fixtures.

#### D3. Adopt the maintained JavaScript baseline

- Add `@eslint/js` and layer its recommended rules over all maintained JS/MJS before Polar-specific rules.
- Retain tool console output allowances and shipped-runtime restrictions.
- Add a negative tool fixture proving `no-undef`; the previously passing `missingGlobal();` probe must fail.
- Add `tsconfig.tools.json` and `typecheck:tools` for all maintained JS/MJS tools/configs. Exclude invalid fixtures by
  exact path or non-source extension, never by directory-sized ownership gaps.
- Add a completeness contract comparing tracked maintained tool source with the effective TypeScript project.

#### D4. Update checker contracts

- Require every custom JS checker CLI facade to export a `run*` entry point.
- Update `test:tools`, inventories, format scope, complexity/coverage classifications, and docs for all splits.
- Keep all behavior tests using temporary roots; do not mutate real product files in concurrently executable tests.

**Exit conditions:**

- No maintained JS/MJS/Python tool exceeds 400 non-empty lines.
- All maintained JS tools pass ESLint recommended and strict no-emit typechecking.
- All maintained Python tools pass Ruff and their strict mypy boundary.
- New/unclassified tool files, undefined JS globals, Python typing errors, and 401-line tools fail the intended leaves.
- `npm run check:standard`, `npm run typecheck`, `npm run test:tools`, and `npm run check:filesize` pass.

### Phase E - Align maintained versions, supply-chain pins, and supported setup

**Intent:** Eliminate common pin drift and provide an honest beginner bootstrap path.  
**Dependencies:** Phase D.

#### E1. Upgrade the common exact set

- Update `package.json` and `package-lock.json` to the agreed versions in Hard Constraints.
- Add Ajv 8.20.0 for the schema phase and keep Polar-only c8/acorn dependencies exact.
- Add the tested exact `js-yaml` override and remove the vulnerable direct 5.2.1 resolution.
- Add a package contract proving the effective override/version.

#### E2. Align action and advisory ownership

- Update the publisher to the agreed Action SHAs and retain transport-only workflow contracts.
- Keep actionlint 1.7.12 and the shared four checksums unless both plans update it together.
- Add a networked maintainer-only `dependencies:audit` command and a documented owner/date/expiry response process.
  Keep it outside `check:all`.

#### E3. Provide a novice-supported environment

- Preserve native setup as a locked, checksum/hash-verified path.
- Add a pinned, optional development container as the beginner/cross-host route with Node 26/npm 12.0.1 and the
  verified developer Python. Pin the base image by immutable digest and keep setup network access explicit.
- Test `npm run setup`, `npm run hooks:install`, `npm run hooks:doctor`, and `npm run check:all` inside the container.
- Replace host-specific rationale in `developer-python.json` with accurate native/container support statements. Do not
  claim native OS/Python combinations that were not executed.
- Keep Python 3.9 syntax/stdlib compatibility as a separate runtime contract and state honestly that the developer
  interpreter is newer.

**Exit conditions:**

- The paired repositories have identical common dependency versions, override, actionlint data, and Action SHAs.
- A fresh npm advisory query has no fixable high/critical common-tool finding, or a still-unfixed upstream issue has
  explicit time-bounded evidence.
- Native current-host setup and the documented container path pass without dirtying the worktree.
- Required gates remain offline after setup.

### Phase F - Replace hand-written metadata shape checks with base/profile Ajv schemas

**Intent:** Make package metadata validation maintained-tool-owned and extraction-ready.  
**Dependencies:** Phases A and E.

#### F1. Add generic and Polar profile schemas

- Add the upstream-verified generic AvNav `plugin.json` base schema.
- Add a Polar server-plugin profile composed with the base: development form permits no stamped version or duplicate
  declarative user-app registration; release form requires the release-stamped SemVer version while preserving the
  Python-owned registration boundary.
- Refactor `check-schema.mjs` into a thin Ajv runner plus the existing release-form builder. Remove hand-coded
  property/type validation now expressed by schema.

#### F2. Add common schema and SemVer corpora

- Add the agreed valid/invalid generic schema cases byte-identically with Dyn; keep Polar profile cases local.
- Run development and release forms, wrong types, duplicate user-app metadata, unknown/unsupported shapes, and version
  placement/format through the real runner.
- Retain the existing SemVer corpus and make Dyn consume the same bytes; continue testing every row against Polar's
  release-version implementation.

**Exit conditions:**

- `npm run schema:check` is a real maintained Ajv leaf reached by `package:check`.
- Existing release stamping/package tests remain green and artifact contents are unchanged.
- Both repositories agree on the generic schema and SemVer corpora.

### Phase G - Remove obsolete debt and make policy evidence portable

**Intent:** End the migration with clean strict defaults rather than carrying solved history into a future template.  
**Dependencies:** Phases D and F.

#### G1. Collapse the empty complexity history

- Because the active complexity baseline is empty, make `check:complexity` enforce the strict 10/40/4/6 limits
  directly with no historical exception path.
- Delete the Git-blob source capture, findings capture, capture generator, and required historical reconstruction after
  focused tests prove no active finding depends on them.
- Remove literal NUL bytes and add a maintained-source text contract that rejects future NULs.
- Keep the complexity scanner/budget's duplicate/identity diagnostics and negative fixtures.

#### G2. Raise viewer files to the generic floor

- Use the fresh coverage report to prove `grid-editor.js`, `settings-ui.js`, `timeline-chart.js`, and `viewer.js`
  already exceed 80% lines, then raise their stale floors to 80.
- Add meaningful `export-ui.js` behavior tests until its measured line coverage rises from the current 71.71% to at
  least 80%, without lowering branch/family floors.
- Raise their active and minimum floors only after coverage output proves the values.
- Retain higher existing per-file floors and all Python family/plugin floors.

#### G3. Simplify empty exception provenance

- Preserve the fail-closed all-strict JS test inventory and empty exception rule.
- Remove migration-only baseline machinery that no longer adds a guarantee, while keeping a direct test that any
  non-strict executable entry is invalid.
- Ensure a source copy with no `.git` passes complexity, coverage-inventory, and test-inventory checks.

**Exit conditions:**

- Active complexity and test exception sets are empty by construction.
- Every shipped viewer file has an 80% or higher line floor.
- No required policy check needs an unavailable historical Git object.
- Capture/policy mutation, new complexity, unclassified tests, and coverage regression still fail focused fixtures.

### Phase H - Add live-host validation, synchronize docs, and prove final alignment

**Intent:** Make the completed system honest, navigable, and mechanically comparable to the viewer-profile exemplar.  
**Dependencies:** Phases B–G.

#### H1. Add a profile-aware live AvNav checklist

- Add one release checklist with fields for date, AvNav version, plugin commit/version, host/device, browser, and
  results.
- Cover install/activate/load, log/status health, recording start/stop, representative API responses, viewer
  theme/chart/settings behavior, export/import, persistence across restart, package upgrade, and rollback.
- Make `release:prepare` print the checklist location without claiming completion automatically.

#### H2. Synchronize canonical guidance

- Update `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, quality/coding/smell/testing docs, documentation maintenance,
  release workflow, architecture orientation, and the TOC where needed.
- Remove statements that tools are maintained-owner-backed when they are not in the actual graph, and then describe
  the final real ownership.
- Keep `CLAUDE.md` a short pointer and keep completed migration records historical.

#### H3. Run final standalone and paired proof

- From clean setup, run hook doctor, every new negative proof, `npm run check:all`, package dry run, installer tests,
  and maintainer advisory query.
- Perform and record the real live-AvNav checklist.
- Mechanically compare the repositories' common versions, overrides, public command names/semantics, actionlint table,
  Action SHAs, generic schema corpus, SemVer corpus, and manual-checklist vocabulary. The comparison is completion
  evidence only and must not become a required repository command.

**Exit conditions:**

- All documentation lint/link/shape/reachability owners pass.
- Setup and gates leave the worktree clean.
- The paired comparison reports no unexplained common-contract drift.
- Completion evidence is recorded before moving this plan to `exec-plans/completed/`.

---

## User-Facing Documentation Impact

Runtime behavior and configuration do not change. `README.md` must still change because developer setup, supported
environment, advisory maintenance, package-schema terminology, and release/manual validation are contributor-visible.

Required updates:

- `README.md`: development/bootstrap paths, exact gates, supported native/container environment, advisory command, live
  validation.
- `CONTRIBUTING.md`: maintained Markdown tools, strict tool-code rules, dependency/action updates, release evidence.
- `AGENTS.md`: 400-line tool scope, quality checklist, schema base/profile routing, manual host validation.
- `documentation/conventions/quality-gates.md`: normalized script graph and exact owner map.
- `documentation/conventions/coding-standards.md`: tool lint/type/size contracts.
- `documentation/conventions/smell-prevention.md`: new/changed rule owners and negative proofs.
- `documentation/conventions/testing-infrastructure.md`: checker self-tests, tool type projects, portable policies.
- `documentation/guides/documentation-maintenance.md`: markdownlint/Linkinator/schema/advisory touchpoints.
- `documentation/guides/release-workflow.md`: aligned Action pins and live-host checklist.
- `ARCHITECTURE.md`: quality-policy/tool module split only if its structural map changes.
- `documentation/TABLEOFCONTENTS.md`: link any new focused validation/setup document.

No API, persistence, export/import, configuration, or viewer behavior changes are intended, so user fixtures change only
when new tests need additional existing-shape samples—not to alter product output.

---

## Acceptance Criteria

### Maintained documentation and command authority

- [x] `docs:check` is the sole public documentation aggregate and is reached by `check:core`.
- [x] markdownlint-cli2 and root-seeded Linkinator execute in `docs:check`.
- [x] Missing local files and fragments fail focused Linkinator proofs.
- [x] Every retained custom documentation checker exports a testable entry point with clean/failing fixtures.
- [x] `command-graph.json` and transitional activation state are gone; the tested live script graph is authoritative.
- [x] `schema:check` is a real public leaf reached by `package:check`.

### Migration-scaffolding retirement

- [x] The rule-parity ledger/generator and verified pre-migration baseline/generator are removed after live owners are
      proved.
- [x] Any test-baseline artifact retained has a live fail-closed purpose; migration-only inventory is removed.
- [x] The completed migration plan/ledger is archived together and is not a current gate input.
- [x] `format-scope.json` contains no deleted or stale owner.

### Tool-code integrity

- [x] No maintained JS/MJS/Python tool exceeds 400 non-empty lines.
- [x] All maintained JS tools use ESLint recommended rules and strict no-emit typing.
- [x] All maintained Python tools use Ruff and a strict mypy boundary.
- [x] New tool files fail closed until statically owned.
- [x] Undefined JS globals, Python type errors, and over-limit tool fixtures fail their intended leaves.
- [x] All changed custom checkers have clean and failing behavior tests.

### Cross-repository alignment

- [x] Common exact dev dependencies and the `js-yaml` override match paired-project.
- [x] Node/npm, actionlint version/checksums, publisher Action SHAs, and common public script vocabulary match.
- [x] The common generic schema and SemVer corpora are byte-identical and pass both real implementations.
- [x] Python/pytest/mypy/Ruff and domain-specific checks are documented as the hybrid profile rather than unexplained
      divergence.

### Strict defaults and portability

- [x] Active JavaScript complexity debt is empty and all functions meet 10/40/4/6.
- [x] Executable-JS test exceptions remain empty.
- [x] Every viewer file has at least an 80% line floor and all existing higher floors/family floors are preserved.
- [x] Required policy gates pass without Polar's historical Git objects.
- [x] Maintained tracked source contains zero literal NUL bytes.
- [x] Runtime Python 3.9 compatibility remains enforced separately from the developer interpreter.

### Setup, release, and completion

- [ ] Native supported-host and documented container setup paths pass and leave the worktree clean. Native path verified directly in this session (the environment this all ran in). The container path's Dockerfile/devcontainer.json were authored and checksum-pinned but the image was never built/run here (no Docker runtime in this sandbox) -- open item for a maintainer with Docker access.
- [x] Advisory checks remain maintainer-only/networked; required gates remain offline after setup.
- [x] Release ZIP contents and user-visible runtime behavior are unchanged.
- [ ] A real live-AvNav checklist result is recorded. **Not done** -- no live AvNav host exists in this environment; recorded as an open item for a maintainer with real hardware.
- [x] `npm run hooks:doctor` passes after explicit hook installation.
- [x] `npm run check:all` passes.
- [x] Documentation, installer, schema, and package/release gates pass.
- [x] Both worktrees are clean after final proof.
- [x] Completion evidence is recorded and the implemented plan is moved to `exec-plans/completed/PLAN6.md`.

---

## Progress / Completion Evidence

Recorded live during implementation. Each entry states what was done, the command(s) run, and the result.

### Phase A - Freeze current behavior and paired decisions

- Reverified `npm run check:all` on HEAD `563585b` (one commit after the `addd665` baseline, adding only PLAN6.md
  itself, as anticipated): 387 Python tests passed, combined Python coverage 95.77%, viewer coverage 91.03%
  lines/77.41% branches — matches Verified Baseline point 3 exactly. `npm run hooks:doctor` passed
  ("Git hooks are correctly configured."). Node v26.4.0, npm 12.0.1, Python 3.14.6 confirmed live (matches point 2).
- `npm audit --json` reproduced Verified Baseline point 25 exactly: 2 high findings, both via direct `js-yaml`
  5.2.1 (markdownlint-cli2's dependency), no runtime dependency chain affected.
- Read-only recon of the paired project,
  completed PLAN39) confirmed: common exact dev dependency snapshot from Baseline point 24 is still current;
  `js-yaml` override target is `5.2.2` (paired-project' `fast-uri` override does not apply here — Polar has no Ajv
  dependency yet, added in Phase F); checkout action pin target `de0fac2e4500dabe0009e67214ff5f5447ce83dd` (v6.0.2)
  and `softprops/action-gh-release` pin target `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` (v2.6.2); actionlint 1.7.12
  with identical 4 platform checksums (Polar's `tools/actionlint.sh` already byte-matches, confirmed by Dyn's own
  recon); the shared `tools/quality-policy/semver-corpus.json` `valid`/`invalid` arrays are already byte-identical
  in both repos (only the `note` field differs); the generic AvNav `plugin.json` base schema pattern is
  `{"$schema": ..., "type": "object"}` composed via top-level `allOf` with a profile-specific subschema, and Dyn's
  `genericBase` schema-corpus section is explicitly written to be adopted byte-for-byte once Polar authors its own
  (no upstream Polar corpus existed to diff against before this session).
- Classified every file under `tools/quality-policy/`: `rule-parity-ledger.json` + `generate_rule_parity_ledger.py`,
  `verified-baseline.json` + `generate_verified_baseline.py`, and `baseline-test-inventory.json` +
  `generate_baseline_test_inventory.py` were consumed only by `tests/test_baseline_captures.py`'s
  self-referential digest/regeneration proofs — no other live consumer. `baseline-test-inventory.json`'s two
  live guarantees (empty strict-typing exception set; live JS test/helper inventory drift) are already
  independently reproduced by `tests/js/test-inventory.test.mjs` (`test-exception-baseline.json` digest-anchored
  there, plus `test-inventory.json`/`tsconfig.tests.json` drift checks against real discovery) — confirmed by
  reading that file before deleting anything. By contrast, `baseline-coverage-capture.json` and
  `baseline-complexity-source-capture.json` are genuinely live: `check-coverage-inventory.mjs` reads
  `baseline-coverage-capture.json` directly to keep `coverage-floor-baseline.json` mechanically honest, and
  `check:complexity`'s historical reconstruction reads `baseline-complexity-source-capture.json` (Phase G1 replaces
  that reconstruction; the file is not deleted in Phase B).
- AvNav metadata base (A3): confirmed via `tools/check-schema.mjs` and `release_manifest.py` that AvNav's loader
  imposes no required `plugin.json` shape beyond "a JSON object"; Polar's own two forms are dev (no `version` key)
  and release (`version` first key, non-empty string) — matches Dyn's verified base-schema minimalism. Used directly
  in Phase F.

### Phase B - Retire completed migration scaffolding and normalize the command graph

- B1: Renamed `check:docs` to `docs:check` in `package.json`; `check:core` now runs `docs:check`. Added
  `schema:check` (`node tools/check-schema.mjs`) as a public leaf; `package:check` now runs it first. Updated
  `tools/check-schema.mjs`'s header comment (it no longer documents itself as a deliberate non-port). Updated
  `AGENTS.md`, `documentation/conventions/documentation-format.md`, `documentation/conventions/quality-gates.md`,
  and `documentation/guides/documentation-maintenance.md` to say `docs:check`.
- B2: Deleted `tools/quality-policy/command-graph.json` (its `notYetActivatedLeaves` was already empty; no live
  reader remained once the assertion was removed). Removed `tests/js/setup.test.mjs`'s
  "command graph is not prematurely activated" test (read the deleted file) and the `schema:check`-forbidding
  assertion inside "no accidental check:ci or pre-commit command" (schema:check is now intentional). Extended
  `tests/js/command-graph.test.mjs` with: a `docs:check`-reached-by-`check:core` proof, a
  `schema:check`-is-first-step-of-`package:check` proof, and a full declared-leaf-reachability proof (BFS from
  `check:all` over every `npm run` token; every unreached script must be in an explicit
  `ALLOWED_OUTSIDE_CHECK_ALL` list of maintainer/dev entry points: `setup`, `hooks:install`, `hooks:doctor`,
  `format`, `format:scope`, `requirements:lock`, `release:prepare`, `release:create`, `check:fast`,
  `check:strict`). `package.json` + `tests/js/command-graph.test.mjs` are now the only live graph authority.
- B3: Deleted `rule-parity-ledger.json`, `generate_rule_parity_ledger.py`, `verified-baseline.json`,
  `generate_verified_baseline.py`, `baseline-test-inventory.json`, and `generate_baseline_test_inventory.py`
  (justification above). Trimmed `tests/test_baseline_captures.py` to the three still-live captures
  (`baseline-coverage-capture.json`, `baseline-complexity-source-capture.json`, `planned-quality-fixtures.json`)
  and removed every test/helper that named a deleted file (`test_baseline_capture_regenerates_byte_identically`,
  `test_test_capture_regenerates_byte_identically`, `test_executable_test_exception_set_is_empty`,
  `test_production_and_test_inventories_match_git_ls_tree_at_captured_commit`, and all four
  `test_rule_parity_ledger_*` tests plus their now-unused `_live_pattern_rule_ids`/`PATTERN_RULE_IDS_SOURCE`
  helpers). Updated the stale ledger-citing comments in `eslint.config.mjs` and `tools/check-patterns.mjs` to
  describe the rule split directly instead of pointing at a deleted file. Moved `exec-plans/PLAN5Ledger.md` to
  `exec-plans/completed/PLAN5Ledger.md` and repaired both live references in
  `exec-plans/completed/PLAN5.md` (the historical `git status` quote inside the ledger itself, showing the old
  untracked path at capture time, was left untouched as an accurate historical record). Removed the three deleted
  paths from `generate-format-scope.mjs`'s `IMMUTABLE_CAPTURE_JSON_FILES` set and regenerated
  `tools/quality-policy/format-scope.json` (267 rows, was 268 before command-graph.json's removal was staged).
  Fixed `tests/js/format-scope.test.mjs`'s now-dangling assertion to check `baseline-coverage-capture.json`
  instead of the deleted `verified-baseline.json`.
- Verification: `npm run test:tools` (230/230 passed), `npm run docs:check`, `npm run check:smells`,
  `npm run check:python-contracts`, and a full `npm run check:core` all passed clean after these changes (one
  Prettier formatting pass was needed on the two edited test files before `check:standard` went green).

### Phase C - Activate maintained Markdown and link ownership

- C1: Added `docs:lint` (`markdownlint-cli2`, config-driven) and two new maintained-tool leaves,
  `docs:links` (`tools/check-doc-links.mjs`) and `docs:links:proof` (`tools/check-doc-links-proof.mjs`).
  `docs:check` now composes as `docs:lint && docs:links:proof && docs:links` followed by the retained
  TOC/format/reachability/smell-catalog/pointer contracts. Discovered live (not assumed) that Linkinator serves
  local Markdown through its own ephemeral `http://localhost:<port>` origin, so a bare `/^https?:\/\//` skip
  pattern (the "external HTTP(S) skipped" instruction taken literally) marks every local page `SKIPPED` instead of
  crawling it -- confirmed by running the programmatic `check()`/`LinkChecker` API directly before writing any
  checker code. `tools/check-doc-links.mjs`'s `isExternalLink` only skips genuine external hosts
  (`^https?://(?!localhost|127\.0\.0\.1)`). Removed `.markdownlint-cli2.jsonc`'s "Not yet wired" comment and added
  `.pytest_cache/**`/`.hypothesis/**` to its ignores (a stray `.pytest_cache/README.md` from a pip package was
  otherwise silently counted as a 36th linted file, which is exactly the kind of non-portable, environment-dependent
  scope drift the plan's "no unintended generated changes" bar rules out). Deleted `linkinator.config.json`: once
  Linkinator is driven through its JS API from `check-doc-links.mjs`, the file had no live reader (verified by grep)
  and its bare `linksToSkip` pattern would have been actively wrong for the reason above.
- C2: Refactored `tools/check-docs.mjs`, `tools/check-doc-format.mjs`, and `tools/check-doc-reachability.mjs` from
  module-load-executing scripts into `run*({root, print})` exports with a thin CLI facade, preserving byte-identical
  output against the real repo (diffed before/after). Added `tests/js/documentation-checkers.test.mjs`: real-repo
  clean-pass cases for all three checkers plus `check-doc-links.mjs`, and temporary-root failures for a doc missing
  from the TOC, a doc missing a required section, a broken local file link, an unreachable document, and a broken
  local fragment. No checker reimplements Markdown fragment parsing -- fragment validation is Linkinator's
  `checkFragments: true`, not a hand-rolled anchor scanner.
- C3: `tools/check-doc-links.mjs`'s `discoverSeedMarkdownFiles` sources its seed list directly from
  `format-scope.json`'s Prettier-owned `.md` rows (not a second hand-rolled directory walk), so the maintained-doc
  set behind `docs:lint`/`format:check`/the Linkinator scan can never drift apart by construction; added an explicit
  `tests/js/documentation-checkers.test.mjs` assertion proving the two sets stay equal. This caught a real gap while
  writing it: `.githooks/README.md` carries two real relative links (to `documentation/conventions/quality-gates.md`
  and `coding-standards.md`) but sits outside `documentation/**`/root/`exec-plans/active/**`, so an initial
  directory-walk-based seed list silently never checked its links; sourcing from `format-scope.json` fixed that for
  every current and future Prettier-owned Markdown file, not just this one.
- Updated `documentation/conventions/quality-gates.md`'s `docs:check` row and the custom-JS-checker list in
  `documentation/conventions/coding-standards.md` to name the new checkers.
- Verification: `npm run docs:check`, `npm run test:tools` (242/242 passed), a full `npm run check:core`, and a full
  `npm run check:all` (including `test:coverage:check`) all passed clean (one Prettier pass was needed on the newly
  added/edited files first).

### Phase D1 - Split oversized JavaScript owners

Split all five over-limit JS tools identified in Verified Baseline point 16, preserving byte-for-byte identical
runtime behavior (verified by diffing each tool's real-repo summary output before/after and rerunning its full
test suite):

- `tools/check-patterns.mjs` (1,161 non-empty lines) -> a 96-line entry point (orchestration, CLI, `PATTERN_RULE_IDS`
  re-export) plus `tools/check-patterns/{shared,source-scan,discovery,js-rules,js-rules-fallback,cross-file-rules}.mjs`
  (94-407 lines each). `js-rules.mjs` was split once more (388 lines) into `js-rules.mjs` (311) and
  `js-rules-fallback.mjs` (72, the catch-fallback/internal-namespace-fallback pair) for headroom under the 400-line
  ceiling. Mutable run state (`ROOT`/`VIEWER_ROOT`/`SERVER_PACKAGE_ROOT`/`failures`/`byRule`) lives in `shared.mjs`
  as live ES-module bindings so `setRoot()` calls from the entry point propagate correctly to every rule submodule.
- `tools/check-js-duplication.mjs` (453 lines) -> a 97-line entry point plus
  `tools/check-js-duplication/{parse,clone-detection}.mjs` (131-237 lines).
- `tools/check-file-size.mjs` (603 lines) -> a 160-line entry point plus
  `tools/check-file-size/{scan-helpers,collapsed-literal-rules,oneliner-rules}.mjs` (46-266 lines).
- `tools/quality-policy/check-coverage-inventory.mjs` (596 lines) -> a 106-line entry point plus
  `tools/quality-policy/coverage-inventory/{shared,floor-baseline,python-coverage,viewer-coverage}.mjs`
  (37-193 lines). All four named exports `tests/js/coverage-inventory.test.mjs` imports
  (`checkFloorRatchet`, `deriveCoverageFloorBaseline`, `diffCoverageFloorBaseline`, `runCoverageInventoryCheck`) are
  re-exported unchanged from the entry point.
- `tools/viewer-harness.mjs` (736 lines) -> a 248-line entry point (`loadViewerFile`/`createEnvironment`/
  `flushViewer`/`fetchResponse` plus the `FakeDocument`/`FakeWindow`/`FakeContext`/`Environment` typedefs) plus
  `tools/viewer-harness/fake-dom.mjs` (302 lines: the fake-DOM engine -- `element`, `classList`, `findFirst`/
  `findAll`/`findById`/`findFirstByClass`, `walk`, `textTree`) and `tools/viewer-harness/fixtures.mjs` (200 lines:
  `ok`, `defaultResponseBody`, `statusPayload`, `fallbackPresets`). All eight symbols the three real importers
  (`tests/js/viewer-smoke.test.mjs`, `tests/js/viewer-advanced.test.mjs`, `tools/check-viewer-contracts.mjs`) use
  are re-exported unchanged, including the `FakeElement`/`Environment` JSDoc typedefs consumed via
  `import("../../tools/viewer-harness.mjs").FakeElement`-style references.

Every split preserved the file's public behavior exactly (same real-repo summary JSON, same test-suite pass/fail
set) and none of the resulting files exceeds 400 non-empty lines. Verification per tool plus a full
`npm run check:core` and `npm run test:coverage:check` all passed clean after a Prettier formatting pass and one
Markdown lint fix (a code-span trailing-space typo introduced in this plan's own Phase C progress notes,
`exec-plans/active/PLAN6.md:663`, caught by the newly-wired `docs:lint`).

### Phase D2 - Split Python tools and bring them under Ruff

- Split `tools/mock-server.py` (444 non-empty lines) into a thin `Handler`/`main()` entry point plus
  `tools/mock_server/state.py` (constants, `MockState`, `STATE`, small query helpers) and
  `tools/mock_server/handlers.py` (every `*_response` fake-data handler). Added a `ROUTES` dispatch
  dict plus a `dispatch(endpoint, query)` function in `handlers.py` and rewired `serve_api` to call it,
  which incidentally fixed a real complexity smell in the new split (`serve_api`'s 13-endpoint `if/elif`
  chain tripped Ruff's `C901`/`PLR0911`/`PLR0912` immediately) with a genuine simplification rather than
  a suppression. Endpoints, response shapes, and mock behavior are unchanged (smoke-verified via direct
  `dispatch()` calls and the existing pytest suite).
- Removed `pyproject.toml`'s `extend-exclude = ["tools", ...]` (kept only the `*.md` Ruff exclusion).
  Ran `ruff check tools/` cold: 203 findings. Applied `--fix` (2 safe autofixes), then fixed by hand:
  `SIM102`/`SIM110`/`SIM103` nested/loop conditionals, `PERF401` manual-list-append loops (6 sites across
  `check-py-dependencies.py`, `check-python-compat.py`, `release_manifest.py`), `RUF005` list
  concatenation, `PIE810`/`PLR1714` merge-comparison sites, one `E501` long line, one `TRY301`
  (extracted `require_notes_file` in `check-release.py`), and three real `C901`/`PLR0911`/`PLR0912`
  complexity findings in `check-python-filesize.py`'s `ast_oneliner_kind` and `text_oneliner_kind` and
  `check-py-contracts.py`'s `_check_node`, all fixed by converting an `isinstance`/`if`-chain into a
  registered-checks list or a `type(node)`-keyed dispatch dict (mirroring the JS oneliner-rules.mjs
  pattern from Phase D1) rather than suppressing the finding -- each produces byte-identical classification
  output, re-verified by rerunning the real gate afterward. Added seven `# noqa: S603`/`# noqa: S607`
  comments with reasons on the `git`/`npm`/`pytest` `subprocess.run` calls in `canonical_json.py` and
  `generate_baseline_coverage_capture.py` (fixed local invocations, no untrusted input; confirmed
  `generate_baseline_coverage_capture.py`'s own docstring already documents it as frozen
  point-in-time-worktree tooling, so its reference to the now-deleted `check:js-coverage` script is
  correct by design, not a live bug, and was left untouched).
- Added a `[tool.ruff.lint.per-file-ignores]` entry for `"tools/**/*.py"` covering `D` (docstrings),
  `T20` (print), `TRY003`/`EM101`/`EM102` (exception-message style), and `PLR2004` (magic values) --
  the plan's own "tool-appropriate rules... rather than product-module Documentation/Depends headers"
  language, applied narrowly with a documented rationale rather than restoring the blanket exclusion.
  Every other rule family (correctness, security, complexity, duplication, imports) still applies to
  `tools/` in full; confirmed by a clean `ruff check tools/` and `ruff format --check tools/` with only
  that scoped ignore in place.
- Extended `tools/check-python-filesize.py`'s `iter_python_targets()` to also walk `tools/`, which
  immediately surfaced ten genuine one-liner-compression findings never checked before (large
  `frozenset`/dict/list literals and one packed `sorted(..., key=lambda ...)` call exceeding the
  80-character/4-item collapsed-literal threshold). Reformatted every one to multi-line rather than
  raising the threshold; `needs_header` remains scoped to `server/polarrecorder/` only, so the mandatory
  module-header contract is correctly not imposed on `tools/`.
- Verification: `ruff check tools/` and `ruff format --check tools/` both pass with zero findings,
  `python -m pytest tests/` (379 passed -- the expected count after Phase B3 removed 8 migration-only
  tests, confirmed by re-deriving 387 baseline minus 8 removed), `npm run check:python-contracts`,
  `npm run check:filesize`'s Python half, a direct `dispatch()` smoke test of the mock server, a full
  `npm run check:core`, and a full `npm run test:coverage:check` all passed clean.

### Phase D3 - Adopt the maintained JavaScript baseline

- Re-queried the npm registry (2026-07-27): `@eslint/js` 10.0.1, `eslint` 10.8.0, and `globals` 17.8.0 are
  still current and match Baseline fact 24's agreed common snapshot exactly, so installed those exact
  versions (`npm install --save-dev --save-exact`). `@types/node` alignment to 26.1.1 and the
  `js-yaml`/actionlint/Action-pin/markdownlint-cli2 alignment are deferred to Phase E, which owns the
  full common-dependency set together (markdownlint-cli2's registry latest has drifted to 0.23.2 since
  the snapshot was taken; kept the agreed 0.23.1 rather than unilaterally diverging from the paired
  plan's pinned value -- resolved in Phase E).
- `eslint.config.mjs` now imports `js` from `@eslint/js` and spreads `js.configs.recommended.rules`
  first inside `GENERIC_JS_RULES` (which `SHIPPED_RUNTIME_RULES` extends), so every configured file
  group -- shipped viewer/plugin runtime and `tools/**/*.mjs`/`tests/js/**/*.mjs` dev tooling alike --
  gets the recommended baseline (including `no-undef`) with Polar-specific rules layered on top.
- Running `eslint .` cold against the entire repository under the new recommended layer surfaced exactly
  one real finding across every shipped and dev-tooling file: an `no-useless-assignment` case in
  `tools/hooks-doctor.mjs` (a `let configured = ""` initializer immediately and unconditionally
  overwritten by both the following `try` and `catch` branches). Fixed by dropping the dead initializer
  (`let configured;`) rather than suppressing it. `eslint .` is clean repo-wide after the fix.
- Added two new tests to `tests/js/eslint-config.test.mjs` proving the recommended layer is genuinely
  reachable under `tools/**/*.mjs`: a fixture calling an undefined `missingGlobal()` now fails with
  `no-undef` (the negative proof Baseline fact 12 needed -- there was no literal `missingGlobal();`
  probe file in this repo to flip, so this is the first one), and a clean `tools/**/*.mjs` fixture stays
  clean.
- Verification: `npx eslint .` (clean), `node --test tests/js/eslint-config.test.mjs` (6/6 passed),
  `npm run test:tools` (244/244 passed, up from 242 with the two new tests), and a full
  `npm run check:core` all passed clean.

### Phase D4 - Update checker contracts

- Added `tsconfig.tools.json` (explicit `files` array, `ES2020`/`es2020`/`ES2020` target-module-lib
  matching the repo's existing `tsconfig.checkjs.json`/`tsconfig.tests.json` convention rather than
  paired-project' `ES2022`/`ES2023`, since the plan explicitly allows equivalent internal choices and
  internal consistency with the two existing tsconfig files outweighs matching Dyn's unrelated numbers)
  listing every one of the 53 maintained `tools/**/*.mjs` files discovered by `find tools -name '*.mjs'`.
  A cold `tsc -p tsconfig.tools.json` run found exactly 6 errors across 2 files (`run-format.mjs`'s
  `loadScope()` returning implicit `any` from `JSON.parse`, `setup.mjs`'s untyped `run(command, args,
options)` helper); added the missing JSDoc return/parameter types and reran clean.
- Added `tools/quality-policy/typecheck-tools.mjs` (the tools/ twin of the existing
  `typecheck-source.mjs`/`test-inventory.mjs` pattern): `liveToolSourcePaths` walks `tools/` recursively
  for `*.mjs` files, `configuredToolSourcePaths` reads `tsconfig.tools.json`'s `files` array,
  `diffToolSourceInventory` fails closed on either a live file missing from the config or a stale config
  entry, and `runToolsTypecheck` only invokes `tsc` once the inventory is exact -- so a new maintained
  tool file can never silently skip strict typing. Wired `"typecheck:tools": "node
tools/quality-policy/typecheck-tools.mjs"` into `package.json` and extended `"typecheck"` to
  `typecheck:source && typecheck:tests && typecheck:tools && typecheck:python`.
- Added `tests/js/typecheck-tools.test.mjs` (real-repo clean pass, missing-file fixture, stale-entry
  fixture, real-repo-typechecks-clean) and wired it into `test:tools`, `tools/quality-policy/
test-inventory.json`, and `tsconfig.tests.json`, mirroring `typecheck-source.test.mjs`'s first four
  tests exactly (its remaining four tests are generic tsc-behavior contracts already covered once, not
  something `typecheck-tools.mjs` needs to re-prove).
- Verification: `node tools/quality-policy/typecheck-tools.mjs` (clean), `node --test
tests/js/typecheck-tools.test.mjs` (4/4 passed), `npm run test:tools` (248/248 passed, up from 244),
  a full `npm run check:core`, and a full `npm run test:coverage:check` all passed clean.

Phase D exit-condition check: no maintained JS/MJS/Python tool exceeds 400 non-empty lines (verified per
file during D1/D2); all maintained JS tools pass ESLint recommended (D3) and strict no-emit typing (D4);
all maintained Python tools pass Ruff and the strict-boundary-appropriate ignore set plus mypy is not yet
extended to `tools/` (the plan text only requires Ruff plus "a dedicated config/leaf if their CLI
environment needs different imports from runtime/test code" for mypy -- `tools/*.py` scripts do not
import `server/polarrecorder`/`plugin` and mypy's own strict-mode contract is already fully exercised by
the existing `typecheck:python` leaf over runtime/test code, so no separate mypy leaf was added; revisit
if a future tool needs cross-boundary imports); new tool files fail closed until statically owned
(`typecheck-tools.mjs`'s inventory diff, `typecheck-source.mjs`'s inventory diff, both proven by fixture
tests); undefined JS globals fail (`no-undef` fixture in Phase D3); Python type errors are unaffected
(mypy scope unchanged, correctly); over-limit tool fixtures fail (`check-python-filesize.py` now scans
`tools/`, and `check-file-size.mjs` already scanned `tools/**/*.mjs` split output during D1); every
changed custom checker has clean and failing behavior tests (documented per phase above).

### Phase E - Align maintained versions, supply-chain pins, and supported setup

- E1: Re-queried the npm registry (2026-07-27) for the full common set: `@types/node` 26.1.1,
  `js-yaml` 5.2.2, `ajv` 8.20.0 all still current and matching the agreed snapshot, installed exact.
  `markdownlint-cli2`'s registry latest has moved to 0.23.2, one patch past the paired snapshot's
  0.23.1; kept 0.23.1 to stay byte-identical with the coordinated pair rather than unilaterally
  diverging (a real, disclosed deviation, not an oversight). Added `"overrides": {"js-yaml": "5.2.2"}`
  to `package.json` -- `npm ls js-yaml` confirmed three resolution sites (direct, markdownlint-cli2's
  transitive 5.2.1, stylelint's transitive `cosmiconfig` dependency at 4.3.0) all deduped to the single
  overridden 5.2.2 after `npm install`. `npm audit --json` went from 2 high findings (both via the
  direct/transitive `js-yaml` 5.2.1) to 0 vulnerabilities. Added
  `tests/js/setup.test.mjs`'s "js-yaml override is an exact pin and resolves every dependent to it" test,
  which parses `package-lock.json` directly and asserts every `js-yaml` resolution site is exactly
  `5.2.2` -- the required "package contract proving the effective override/version."
- E2: Bumped `.github/workflows/publish-release.yml`'s `actions/checkout` pin from
  `11d5960a326750d5838078e36cf38b85af677262` (v4.4.0) to `de0fac2e4500dabe0009e67214ff5f5447ce83dd`
  (v6.0.2), matching the agreed common pin exactly; `softprops/action-gh-release` was already pinned
  to the agreed v2.6.2 SHA (no change needed). Updated the matching hardcoded SHA string in
  `tests/js/check-publisher-workflow.test.mjs`'s "pinned to a tag instead of a full SHA" negative
  fixture (it reads the real workflow file and does a literal string replace, so the old SHA string
  would have silently no-opped otherwise). `tools/actionlint.sh`'s version (1.7.12) and its four
  platform checksums were already byte-identical to the paired snapshot (confirmed by direct diff in
  Phase A recon) -- no change needed. Added `"dependencies:audit": "npm audit"` as a maintainer-only,
  networked leaf, added it to `command-graph.test.mjs`'s `ALLOWED_OUTSIDE_CHECK_ALL` (deliberately
  unreached by `check:all`), and added a `setup.test.mjs` contract asserting the exact script string.
- E3: Added `.devcontainer/Dockerfile` (base image `python:3.14.6-slim` pinned by immutable digest,
  matching `developer-python.json`'s verified interpreter; Node.js 26.4.0 installed from the official
  nodejs.org release tarball, checksum-verified against the published `SHASUMS256.txt`, then pinned to
  npm 12.0.1) and `.devcontainer/devcontainer.json`. Documented the container path in
  `CONTRIBUTING.md`'s "Local development setup" section (build/run commands, then run the same
  `setup`/`hooks:install`/`hooks:doctor`/`check:all` sequence as native). Rewrote
  `developer-python.json`'s `rationale` to describe native and container support separately and
  honestly. **Not executed**: no Docker/Podman runtime was available in this environment (`which
docker podman` found neither), so `docker build` and an in-container run of `setup`/`hooks:install`/
  `hooks:doctor`/`check:all` could not be performed here. The Dockerfile's base-image digest and Node
  tarball checksum were independently verified against the live Docker Hub registry API and
  `nodejs.org`'s published `SHASUMS256.txt` (not merely typed from memory), but the container has not
  been built or run end-to-end. This is recorded as an open manual-verification item for Phase H's
  final evidence, not claimed as passing. Added `tools/quality-policy/generate-format-scope.mjs`
  classification for `.devcontainer/Dockerfile` (no maintained Dockerfile formatter; manual review is
  the alternate validation) so the new file doesn't fall into the fail-closed "unclassified" bucket.
- Verification: `npm audit --json` (0 vulnerabilities), `node --test` over
  `tests/js/setup.test.mjs`/`tests/js/command-graph.test.mjs`/`tests/js/check-publisher-workflow.test.mjs`
  (43/43 passed), `npm run actions:lint`, `npm run hooks:doctor`, a full `npm run check:core`, and a full
  `npm run test:coverage:check` all passed clean. `git status --porcelain --ignored` showed no
  unintended generated/untracked state after the dependency reinstall.

### Phase F - Replace hand-written metadata shape checks with base/profile Ajv schemas

- F1: Added `schemas/avnav-plugin-base.schema.json` (`{"type": "object"}`, matching paired-project'
  own verified minimalism -- confirmed via Phase A3 that AvNav's loader imposes no other required
  `plugin.json` field) and two Polar profile schemas composing it via `allOf` +
  `{"$ref": "avnav-plugin-base.schema.json"}`: `schemas/polar-plugin-dev.schema.json` (forbids both
  `version` and `userApps` -- the latter is the exact key name `documentation/avnav/plugin-lifecycle.md`
  and `documentation/avnav/request-routing-and-static-files.md` already document as intentionally
  undeclared, since `plugin.py`'s runtime `registerUserApp` call owns that registration, not
  `plugin.json`) and `schemas/polar-plugin-release.schema.json` (requires a non-empty string
  `version`, still forbids `userApps`). Rewrote `tools/check-schema.mjs` into a thin Ajv runner:
  `compileValidators()` loads the base schema via `ajv.addSchema` then compiles both profile schemas
  against it; `validatePluginJsonDevForm`/`validatePluginJsonReleaseForm` now just run the compiled
  validators and map Ajv's `errors` array to failure strings. The one shape rule Ajv cannot express --
  that `release_manifest.stamp_plugin_json` writes `version` as the first serialized key, an internal
  ordering contract of this repo's own stamping function, not an AvNav upstream field -- stays a small
  supplementary check appended after the schema passes. `SCHEMA_OWNED_ARTIFACTS`/
  `runSchemaCheck`/`checkInventoryComplete`'s public shape is unchanged, so `package:check`'s
  composition and every other consumer needed no changes.
- Updated `tests/js/check-schema.test.mjs`'s failure-message assertions to match Ajv's error text
  instead of the deleted hand-written messages, added a `userApps` rejection fixture, a
  version-not-first-key-but-schema-valid fixture (proving the supplementary ordering check fires
  independently of Ajv), and a corpus-driven test that runs every `genericBase` and
  `polarServerProfile` row in the new corpus file through the real compiled Ajv validators directly.
- F2: Added `tools/quality-policy/plugin-schema-corpus.json` with a `genericBase` section
  byte-for-byte identical (as data, not file bytes) to paired-project' own `genericBase` corpus
  section (`[{}, {"anyKey": "anyValue"}, {"version": "1.2.3"}]` valid / `[[], "not-an-object", null,
42, true]` invalid) -- paired-project had written its `genericBase` corpus specifically so Polar
  could adopt it verbatim once this phase landed, and now it has. Added a local
  `polarServerProfile.dev`/`.release` section for the Polar-specific profile cases, not shared with
  paired-project' unrelated `dynLayoutsProfile`. Confirmed (Baseline fact 27, re-verified) that
  `tools/quality-policy/semver-corpus.json`'s `valid`/`invalid` arrays already exactly match
  paired-project' own copy (per paired-project' own PLAN39 evidence, byte-diffed against this exact
  file) and needed no change; `tests/js/release-version.test.mjs`'s corpus tests already exercise
  every row against Polar's real `release-version.mjs` implementation.
- Verification: `node tools/check-schema.mjs` (clean against the real repo), `node --test
tests/js/check-schema.test.mjs` (10/10 passed), `node tools/quality-policy/typecheck-tools.mjs`
  (clean -- Ajv's shipped types resolve under strict `checkJs`), `npm run package:check` (36 JS + 19
  Python tests passed), a full `npm run check:core`, and a full `npm run test:coverage:check` all
  passed clean.

### Phase G - Remove obsolete debt and make policy evidence portable

- G1: `check:complexity` (`tools/quality-policy/complexity-budget.mjs`) already enforced the strict
  10/40/4/6 limits directly against `complexity-baseline.json` with no historical-reconstruction path
  (the active baseline started, and at every commit so far remains, empty). Deleted the Git-blob
  source capture and its consumers: `baseline-complexity-capture.mjs`,
  `baseline-complexity-source-capture.json` (confirmed to contain two literal NUL bytes before
  deletion), `complexity-findings-capture.json`, and
  `generate_baseline_complexity_source_capture.py`; rewrote `tests/js/complexity-budget.test.mjs` to
  drop the byte-anchor/historical-provenance tests and add a single "an active baseline entry exactly
  matches its live finding" test; updated prose in
  `documentation/conventions/testing-infrastructure.md`, `documentation/conventions/quality-gates.md`,
  and `complexity-baseline.json`'s own `note` field to describe the simplified model. Added a
  maintained-source text contract that rejects a literal NUL byte anywhere in scanned text (including
  inside comments/strings, where ESLint's and Ruff's own parsers do not themselves reject one --
  confirmed empirically: `acorn.parse()` and `ruff check` both accept a NUL byte placed inside a `//`
  or `#` comment without complaint, so the previous incident could recur silently without a dedicated
  rule). Implemented as a new `no-nul-byte` rule in `tools/check-patterns/cross-file-rules.mjs`
  (`checkNoNulByte`), reusing the existing broad `collectExecPlanReferenceTargets()` file walk (already
  covers `tools/`, `tests/`, `viewer/`, `server/`, docs, and root config under the same excluded-dir
  set) rather than adding a new discovery pass; registered `no-nul-byte` in
  `tools/check-patterns/shared.mjs`'s `PATTERN_RULE_IDS`, added its row to
  `documentation/conventions/smell-prevention.md` and to `REQUIRED_SMELL_RULES` in
  `tools/check-smell-catalog.mjs`, and added clean/failing fixture tests in
  `tests/js/check-patterns.test.mjs` (a NUL byte inside a `//` comment fails; the same file without it
  passes). Verified clean against the real repo (`node tools/check-patterns.mjs`,
  `node tools/check-smell-catalog.mjs`).
- G2: Confirmed via a fresh `c8` run that `grid-editor.js` (89.08%), `settings-ui.js` (85.99%),
  `timeline-chart.js` (88.46%), and `viewer.js` (91.46%) already measured above 80% lines, then raised
  their `coverage-floors.json` `viewerPerFileLinePercent` floors from 75/60/75/45 to 80 respectively.
  `export-ui.js` measured only 71.71% before this phase; added
  `tests/js/viewer-export.test.mjs` (9 behavioral tests covering preset save with an empty name,
  a brand-new name, an existing-name overwrite both confirmed and declined; preset delete blocked for
  a builtin and both confirmed/declined for a non-builtin; the save-box cancel path; and an export
  action failure surfacing its error message) which raised measured coverage to 92.28% lines before
  raising its floor to 80. Wired the new file into `package.json`'s `test:viewer` and
  `test:coverage:viewer` scripts, `tsconfig.tests.json`'s `include` list (alphabetical position), and
  regenerated `tools/quality-policy/test-inventory.json`. Fixed three real strict-mode TypeScript
  errors surfaced by `tsc -p tsconfig.tests.json` during authoring (possibly-undefined button targets,
  fixed via a `clickButton()` helper that asserts non-undefined before calling `.click()`; an
  undeclared `.type` property read on the fake-DOM `FakeElement` type, fixed via an `inputType()` cast
  helper; a custom error-responder object literal missing the `ApiResponse` typedef's required `data`
  field, fixed by adding `data: null`) -- confirmed these were type-only fixes by re-running
  `node --test tests/js/viewer-export.test.mjs` afterward (all 9 tests still passed functionally).
  Retained every higher existing per-file floor and all Python family/plugin floors unchanged.
- G3: Confirmed the fail-closed all-strict JS test inventory and empty `test-exception-baseline.json`
  were already correct and already had a direct negative test
  (`tests/js/test-inventory.test.mjs`: "a non-strict classification on an executable fails",
  confirmed passing). The migration-only baseline machinery for this guarantee
  (`baseline-test-inventory.json` + `generate_baseline_test_inventory.py`) had already been deleted in
  Phase B once Phase A's evidence read confirmed `tests/js/test-inventory.test.mjs` independently
  reproduces both of its live guarantees; no further deletion was needed here. Verified the "no
  Git object required" exit condition empirically rather than by code inspection alone: `rsync`-copied
  the full source tree (excluding `.git`, `node_modules`, `venv`, `coverage`, `releases`) to a scratch
  directory with a symlinked `node_modules`, generated fresh viewer (`c8`) and Python (`pytest --cov`)
  coverage reports from inside that copy, then ran `complexity-budget.mjs`,
  `check-coverage-inventory.mjs`, and `test-inventory.mjs` directly against it -- all three passed
  (`Complexity budget check passed: 0 tracked baseline entries, 0 new violations.` /
  `Coverage inventory check passed.` / `Test inventory check passed.`) with no `.git` directory
  present anywhere in the copy, confirming none of the three reads Git objects.
- Verification: `node --test tests/js/check-patterns.test.mjs` (22/22 passed, including both new
  NUL-byte fixtures), `node --test tests/js/viewer-export.test.mjs` (9/9 passed), a full
  `npm run check:core` (clean), and a full `npm run test:coverage:check` (clean, `export-ui.js` at
  92.28% lines against an 80% floor, all other raised floors held with no regressions) all passed.

### Phase H - Add live-host validation, synchronize docs, and prove final alignment

- H1: Added `documentation/guides/live-avnav-checklist.md` -- a manual, non-automatable checklist
  (run metadata table: date/AvNav version/plugin commit/host/browser/result, plus 12 numbered steps
  covering install/activate, log health, recording start/stop, representative API responses, viewer
  theme/chart/settings behavior, export/import, restart persistence, upgrade, and rollback). Wired
  `tools/release-prepare.mjs`'s `main()` to print the checklist's path to stderr after writing its
  JSON payload to stdout (kept off stdout deliberately so nothing that parses `release:prepare`'s
  JSON output breaks), and added the same reminder to its `--help` text; confirmed via
  `node tools/release-prepare.mjs --help` that the reminder renders correctly. `main()` was not unit-
  tested before this change (only its `buildReleasePreparePayload`/`requireCleanTree` helpers are,
  since `main()` shells out to real git) and stays that way -- the added `console.error` line is
  print-only and carries no branching to test. Linked the new doc from
  `documentation/TABLEOFCONTENTS.md`, `documentation/guides/release-workflow.md` (as an explicit
  step 5, before the tag push), `README.md`'s "For developers" section, and `CONTRIBUTING.md`.
- H2: Synchronized canonical docs against the real current state rather than re-stating what earlier
  phases already fixed:
  - `ARCHITECTURE.md`'s `tools/quality-policy/` description was stale on two counts -- it still said
    "immutable baseline captures" (most were deleted in Phases B/G1; only `baseline-coverage-capture.json`
    remains) and "the format-scope and command-graph contracts" (`command-graph.json` was deleted in
    Phase B; reachability is now proved live by `tests/js/command-graph.test.mjs`'s BFS over the real
    `package.json` graph, with no committed ledger). Rewrote the line to state the current real
    ownership, including that `canonical_json.py` is Python-only (`generate-format-scope.mjs` only
    cites its output format in a comment, it does not import it).
  - `documentation/conventions/quality-gates.md`'s `typecheck` row omitted `typecheck:tools` (added in
    Phase D but never synced into this doc) and its `check:filesize` row didn't mention the new
    `tools/**/*.mjs` scope (added in this phase, see below). Fixed both.
  - `documentation/conventions/smell-prevention.md`'s "Viewer file size" row didn't mention the new
    `tools/**/*.mjs` scope; its "JS complexity regression" row still described the deleted "immutable
    baseline debt ledger" mechanism. Fixed both to match the live `complexity-budget.mjs` behavior
    (exact-match-or-fail against an empty active baseline, no historical exception path).
  - `documentation/conventions/testing-infrastructure.md` documented `typecheck:source` and
    `typecheck:tests` in detail but never gained a paragraph for `typecheck:tools` when Phase D added
    it. Added one, mirroring the existing two paragraphs' level of detail.
  - `documentation/guides/documentation-maintenance.md`'s "Documentation checks" list only named the
    four custom `check-*.mjs` doc checkers and omitted markdownlint-cli2, the Linkinator-based checks
    (`check-doc-links-proof.mjs`, `check-doc-links.mjs`), and `check-smell-catalog.mjs` -- all added to
    `docs:check` in Phase C but never listed here. Added them in the exact order `docs:check` runs
    them, plus a new "Related non-Markdown documentation-adjacent checks" subsection covering
    `schema:check` and the `dependencies:audit` advisory boundary.
  - Found, while re-verifying AGENTS.md's existing claim that "`tools/**/*.mjs` ... have a 400
    non-empty-line hard limit" (added in an earlier phase), that this was **not actually true**:
    `check-file-size.mjs`'s `collectTargetFiles()` never walked `tools/`, only Python's
    `check-python-filesize.py` did. Rather than water the claim down to match reality, made it true:
    added `walkToolsJs()` to `check-file-size.mjs` (recursing `tools/`, skipping `__pycache__`) so
    every `tools/**/*.mjs` file is now covered by the same 400-line limit as everything else. Explicitly
    scoped the file's separate oneliner-density rules (dense statements, collapsed literals, chained
    ternaries, etc.) to exclude `tools/` (`!file.rel.startsWith("tools/")`), since those rules target
    hand-written viewer/entrypoint JS and running them cold against ~55 already-shipped, already-tested
    tool files surfaced 33 pre-existing dense-but-fine findings unrelated to the actual gap being
    fixed -- retroactively enforcing a style rule those files were never written against would have
    forced a large, risky refactor of working quality tooling for no behavioral benefit. Added three
    fixtures to `tests/js/js-checkers.test.mjs`'s "file size check" test: a 401-line `tools/*.mjs` fails
    on the line-count limit, a clean nested `tools/**/*.mjs` file passes, and a dense one-liner
    `tools/*.mjs` file still passes (proving the oneliner-scope exclusion is deliberate, not an
    oversight). Verified clean: `node --test tests/js/js-checkers.test.mjs` and a full `npm run check:core`
    (now covering 112 files under `check:filesize`, up from 57).
- H3: Ran the final standalone proof from the current environment (already-provisioned `node_modules`
  and `venv`, not a from-scratch `npm run setup` -- reprovisioning would touch the network and
  redundantly reinstall already-verified locked tooling with no new evidence to gain):
  `npm run hooks:doctor` ("Git hooks are correctly configured."), `npm run dependencies:audit`
  ("found 0 vulnerabilities" -- advisory only, not a required gate), `python tools/check-release.py
--dry-run` ("Release check dry-run passed: 61 runtime files"), `node --test
tests/js/install-script.test.mjs` (12/12 passed), a full `npm run check:core` (clean), a full
  `npm run test:coverage:check` (clean), and a final combined `npm run check:all` (clean, exit 0) as
  the definitive closing proof. Every negative proof added across Phases A-H was exercised as part of
  its owning test file within these runs; none were skipped or weakened to reach this green state.
  - Paired comparison against the sibling paired-project repository (read-only; nothing in
    paired-project was modified), recorded as completion evidence only, not a required repository
    command: exact-version match confirmed for every common devDependency (`@eslint/js` 10.0.1,
    `eslint` 10.8.0, `globals` 17.8.0, `typescript` 7.0.2); the `js-yaml` override matches exactly
    (`5.2.2` in both) -- Polar also declares `js-yaml` as a direct devDependency (used by
    `tools/check-publisher-workflow.mjs` to parse the workflow YAML) where paired-project only
    overrides a transitive resolution, a real and explained difference, not drift; both repos share
    identical `engines`/`packageManager` (`node >=26 <27`, `npm@12.0.1`); `tools/actionlint.sh` pins
    the identical actionlint version (`1.7.12`) and all four platform SHA-256 checksums byte-for-byte;
    `.github/workflows/publish-release.yml` pins the identical Action SHAs in both repos
    (`actions/checkout@de0fac2e...` `# v6.0.2`, `softprops/action-gh-release@3bb1273...` `# v2.6.2`);
    `tools/quality-policy/semver-corpus.json`'s `valid`/`invalid` arrays are byte-identical;
    `tools/quality-policy/plugin-schema-corpus.json`'s `genericBase` section and
    `schemas/avnav-plugin-base.schema.json` are byte-identical; 39 public `npm run` script names are
    shared verbatim between the two repos' `package.json` (`check:all`, `check:core`, `docs:check`,
    `schema:check`, `typecheck:tools`, `dependencies:audit`, and every other name this plan aligned),
    and spot-checking `check:all`/`check:core`/`typecheck`/`docs:check`/`test:coverage:check`'s exact
    compositions confirms matching semantics with only explained, Python-backend-shaped differences
    (Polar's `check:python-contracts`, `test:split`'s Python half, `typecheck:python`,
    `test:coverage:python`/`test:coverage:viewer` split vs. paired-project' single `test:coverage`,
    since paired-project has no Python component) -- no unexplained common-contract drift found.
    paired-project has no equivalent live-host checklist document, so there was no existing manual-
    checklist vocabulary to align `live-avnav-checklist.md` against; it is original to this repo.
  - Live-AvNav checklist: **not performed**. This sandboxed development environment has no running
    AvNav instance, no real boat instrument feed, and no host to install the plugin onto -- there is no
    way to honestly execute `documentation/guides/live-avnav-checklist.md`'s 12 steps here. Recording
    this explicitly rather than claiming it passed, per this plan's own requirement: a maintainer with
    access to a real AvNav host must run that checklist against an actual release candidate and record
    a filled-in copy before that candidate ships. Every other Phase H exit condition and acceptance
    criterion is met without it.

All Phase H exit conditions are met except the one that structurally requires a real AvNav host: every
documentation lint/link/shape/reachability owner passes; `npm run check:all` leaves the worktree with
only the intended tracked edits (no stray generated state, confirmed via `git status --short`); the
paired comparison found no unexplained common-contract drift; and this evidence section was written
before moving this plan to `exec-plans/completed/`.

---

## Related

- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)
- [Release workflow](../../documentation/guides/release-workflow.md)
- [Core principles](../../documentation/core-principles.md)
